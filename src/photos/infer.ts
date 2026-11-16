/**
 * 写真から駅を推定する。
 *
 * 撮影位置から半径300m以内の最寄り駅を探し、同じ日・同じ駅の写真を1件の候補にまとめる。
 * 位置のない写真と、駅の近くで撮っていない写真は、自分で駅を選ぶ側に回す。
 */
import { toDateKey } from '../lib/date';

export const PHOTO_STATION_RADIUS_M = 300;

export type PhotoInput = {
  /** 画面内で写真を見分けるためのキー */
  key: string;
  /** 表示に使う URI */
  uri: string;
  /** 写真ライブラリのID（取れたときだけ） */
  assetId: string | null;
  takenAt: number | null;
  lat: number | null;
  lng: number | null;
};

export type PhotoGroup = {
  key: string;
  stationId: number;
  /** 撮影日（YYYY-MM-DD）。撮影日時のない写真は null */
  dateKey: string | null;
  /** いちばん早い撮影時刻 */
  firstTakenAt: number | null;
  photos: PhotoInput[];
};

export type NearestStation = (lat: number, lng: number) => { stationId: number; distance: number } | null;

export function groupPhotosByStation(
  photos: PhotoInput[],
  nearest: NearestStation,
  radiusM = PHOTO_STATION_RADIUS_M,
): { groups: PhotoGroup[]; unmatched: PhotoInput[] } {
  const groups = new Map<string, PhotoGroup>();
  const unmatched: PhotoInput[] = [];
  for (const p of photos) {
    const hit = p.lat !== null && p.lng !== null ? nearest(p.lat, p.lng) : null;
    if (!hit || hit.distance > radiusM) {
      unmatched.push(p);
      continue;
    }
    const dateKey = p.takenAt !== null ? toDateKey(new Date(p.takenAt)) : null;
    const key = `${hit.stationId}:${dateKey ?? 'nodate'}`;
    const g = groups.get(key);
    if (g) {
      g.photos.push(p);
      if (p.takenAt !== null && (g.firstTakenAt === null || p.takenAt < g.firstTakenAt)) {
        g.firstTakenAt = p.takenAt;
      }
    } else {
      groups.set(key, { key, stationId: hit.stationId, dateKey, firstTakenAt: p.takenAt, photos: [p] });
    }
  }
  const sorted = [...groups.values()].sort(
    (a, b) => (a.firstTakenAt ?? Infinity) - (b.firstTakenAt ?? Infinity) || a.stationId - b.stationId,
  );
  for (const g of sorted) g.photos.sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));
  return { groups: sorted, unmatched };
}
