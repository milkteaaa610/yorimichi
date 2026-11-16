/**
 * 写真を選ぶ・探す（端末の写真ライブラリを使う部分）。
 *
 * 読むのはユーザーが選んだ写真だけ。撮影位置は、まず選んだ写真の EXIF から、
 * 取れなければ写真ライブラリ（expo-media-library）から読む。
 * Android で撮影位置を読むには ACCESS_MEDIA_LOCATION の許可が要る（app.json で有効にしてある）。
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import { distanceM } from '../geo/distance';
import { fromDateKey } from '../lib/date';
import { exifDate, exifLocation } from './exif';
import { PHOTO_STATION_RADIUS_M, type PhotoInput } from './infer';

const hasLibrary = Platform.OS === 'ios' || Platform.OS === 'android';

/** 写真ピッカーの assetId を、写真ライブラリのID（画像としてそのまま表示できる形）にそろえる。 */
export function toLibraryId(assetId: string | null | undefined): string | null {
  if (!assetId) return null;
  if (Platform.OS === 'ios') return assetId.startsWith('ph://') ? assetId : `ph://${assetId}`;
  if (Platform.OS === 'android') {
    return /^\d+$/.test(assetId) ? `content://media/external/images/media/${assetId}` : assetId;
  }
  return null;
}

async function libraryGranted(request: boolean): Promise<boolean> {
  if (!hasLibrary) return false;
  try {
    const current = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (current.granted) return true;
    if (!request || !current.canAskAgain) return false;
    return (await MediaLibrary.requestPermissionsAsync(false, ['photo'])).granted;
  } catch {
    return false;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** 写真を選んでもらう。キャンセルされたら空の配列。 */
export async function pickPhotos(limit: number): Promise<PhotoInput[]> {
  // 許可がなくても選べる（OS の写真ピッカーは許可なしで動く）。許可があれば撮影位置を補える。
  const granted = await libraryGranted(true);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit !== 1,
    selectionLimit: limit,
    orderedSelection: true,
    exif: true,
    quality: 1,
  });
  if (result.canceled) return [];
  return mapLimit(result.assets, 8, async (a) => {
    const assetId = toLibraryId(a.assetId);
    let location = exifLocation(a.exif);
    let takenAt = exifDate(a.exif);
    if (assetId && granted && (!location || takenAt === null)) {
      try {
        const asset = new MediaLibrary.Asset(assetId);
        if (!location) {
          const loc = await asset.getLocation();
          if (loc) location = { lat: loc.latitude, lng: loc.longitude };
        }
        if (takenAt === null) takenAt = await asset.getCreationTime();
      } catch {
        // ライブラリから読めない写真は、位置なしとして扱う
      }
    }
    return {
      key: assetId ?? a.uri,
      uri: assetId ?? a.uri,
      assetId,
      takenAt,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    };
  });
}

/**
 * 記録に付ける形にする。写真ライブラリのIDが取れなかった写真は、一時ファイルが消えても
 * 見られるようにアプリ内へコピーする。
 */
export function toStoredPhoto(p: PhotoInput): {
  assetId: string | null;
  uri: string | null;
  takenAt: number | null;
  lat: number | null;
  lng: number | null;
} {
  const base = { takenAt: p.takenAt, lat: p.lat, lng: p.lng };
  if (p.assetId) return { ...base, assetId: p.assetId, uri: null };
  if (!hasLibrary || !p.uri.startsWith('file://')) return { ...base, assetId: null, uri: p.uri };
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create({ intermediates: true });
    const source = new File(p.uri);
    const ext = source.extension || '.jpg';
    const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    source.copy(dest);
    return { ...base, assetId: null, uri: dest.uri };
  } catch {
    return { ...base, assetId: null, uri: p.uri };
  }
}

/**
 * その日に駅の近くで撮った写真を探す（記録するときの添付候補）。
 * 写真ライブラリの許可がすでにあるときだけ動く。ここでは許可を求めない。
 */
export async function findPhotosNear(
  station: { lat: number; lng: number },
  dateKey: string,
  exclude: Set<string>,
  max = 10,
): Promise<PhotoInput[]> {
  if (!(await libraryGranted(false))) return [];
  try {
    const start = fromDateKey(dateKey).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const assets = await new MediaLibrary.Query()
      .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
      .gte(MediaLibrary.AssetField.CREATION_TIME, start)
      .lt(MediaLibrary.AssetField.CREATION_TIME, end)
      .orderBy({ key: MediaLibrary.AssetField.CREATION_TIME, ascending: true })
      .limit(120)
      .exe();
    const located = await mapLimit(assets, 8, async (asset): Promise<PhotoInput | null> => {
      try {
        const loc = await asset.getLocation();
        if (!loc) return null;
        const d = distanceM(station, { lat: loc.latitude, lng: loc.longitude });
        if (d > PHOTO_STATION_RADIUS_M) return null;
        const takenAt = await asset.getCreationTime();
        return {
          key: asset.id,
          uri: asset.id,
          assetId: asset.id,
          takenAt,
          lat: loc.latitude,
          lng: loc.longitude,
        };
      } catch {
        return null;
      }
    });
    return located.filter((p): p is PhotoInput => p !== null && !exclude.has(p.key)).slice(0, max);
  } catch {
    return [];
  }
}
