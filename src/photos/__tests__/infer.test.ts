/**
 * @jest-environment node
 *
 * 写真からの駅の推定（撮影位置つきのテスト用の写真で、最寄り駅が正しく出るか）。
 */
import { createTestDb } from '../../test/testDb';
import { exifDate, exifLocation } from '../exif';
import { type PhotoInput, groupPhotosByStation } from '../infer';

const { master } = createTestDb();
const nearest = (lat: number, lng: number) => {
  const hit = master.nearest(lat, lng, 1, 1)[0];
  return hit ? { stationId: hit.station.id, distance: hit.distance } : null;
};
const idOf = (name: string, pref: number) => master.search(name, 10).find((s) => s.prefCode === pref)!.id;

let n = 0;
function photo(lat: number | null, lng: number | null, when: string | null): PhotoInput {
  n++;
  return { key: `p${n}`, uri: `ph://p${n}`, assetId: `ph://p${n}`, takenAt: when ? new Date(when).getTime() : null, lat, lng };
}

describe('groupPhotosByStation', () => {
  test('撮影位置から半径300m以内の最寄り駅を推定し、同じ日・同じ駅は1件にまとめる', () => {
    // 駅の座標から少しずらした位置で撮った写真
    const near = (name: string, pref: number, dLat: number, dLng: number) => {
      const s = master.station(idOf(name, pref))!;
      return [s.lat + dLat, s.lng + dLng] as const;
    };
    const photos = [
      photo(...near('今出川', 26, 0.0004, -0.0003), '2023-03-21T10:12:00+09:00'),
      photo(...near('今出川', 26, -0.0005, 0.0002), '2023-03-21T10:20:00+09:00'),
      photo(...near('四条', 26, -0.0008, -0.0002), '2023-03-21T15:40:00+09:00'),
      photo(...near('上野', 13, 0.0006, 0.0004), '2024-08-12T13:05:00+09:00'),
      photo(...near('今出川', 26, 0, 0), '2023-03-22T09:00:00+09:00'),
    ];
    const { groups, unmatched } = groupPhotosByStation(photos, nearest);
    expect(unmatched).toHaveLength(0);
    expect(groups.map((g) => [master.station(g.stationId)!.name, g.dateKey, g.photos.length])).toEqual([
      ['今出川', '2023-03-21', 2],
      ['四条', '2023-03-21', 1],
      ['今出川', '2023-03-22', 1],
      ['上野', '2024-08-12', 1],
    ]);
    expect(groups[0].stationId).toBe(idOf('今出川', 26));
  });

  test('駅から300mより遠い写真と、位置のない写真は自分で駅を選ぶ側に回す', () => {
    const far = photo(35.36, 138.73, '2024-01-01T12:00:00+09:00'); // 富士山頂
    const noGps = photo(null, null, '2024-01-01T12:00:00+09:00');
    const { groups, unmatched } = groupPhotosByStation([far, noGps], nearest);
    expect(groups).toHaveLength(0);
    expect(unmatched.map((p) => p.key)).toEqual([far.key, noGps.key]);
  });

  test('写真を100枚選んでも、すぐに候補が出る', () => {
    const photos = Array.from({ length: 100 }, (_, i) => photo(35.68 + (i % 10) * 0.01, 139.7 + Math.floor(i / 10) * 0.01, '2025-01-01T12:00:00+09:00'));
    const start = Date.now();
    groupPhotosByStation(photos, nearest);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe('exif', () => {
  test('iOS の形（{GPS} の中に度）', () => {
    expect(
      exifLocation({ '{GPS}': { Latitude: 35.0298, LatitudeRef: 'N', Longitude: 135.7597, LongitudeRef: 'E' } }),
    ).toEqual({ lat: 35.0298, lng: 135.7597 });
  });
  test('Android の形（度分秒の分数）', () => {
    const loc = exifLocation({ GPSLatitude: '35/1,1/1,4728/100', GPSLatitudeRef: 'N', GPSLongitude: '135/1,45/1,3492/100', GPSLongitudeRef: 'E' });
    expect(loc!.lat).toBeCloseTo(35.0298, 3);
    expect(loc!.lng).toBeCloseTo(135.7597, 3);
  });
  test('位置が 0,0 の写真は位置なし', () => {
    expect(exifLocation({ GPSLatitude: 0, GPSLongitude: 0 })).toBeNull();
  });
  test('撮影日時', () => {
    expect(exifDate({ DateTimeOriginal: '2023:03:21 10:12:00' })).toBe(new Date(2023, 2, 21, 10, 12, 0).getTime());
    expect(exifDate({ '{Exif}': { DateTimeOriginal: '2024:08:12 13:05:09' } })).toBe(new Date(2024, 7, 12, 13, 5, 9).getTime());
    expect(exifDate({})).toBeNull();
  });
});
