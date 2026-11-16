/**
 * 見張る駅の選び方（docs/SPEC.md 5章）。
 *
 * OS のジオフェンスは同時に見張れる円の数に上限がある（iPhone 20、Android 100）。
 * 現在地に近い駅から上限まで登録し、残りの1つは「外枠」としてそれらを囲む円にする。
 * 外枠を抜けたら、新しい現在地で選び直す。
 */

/**
 * ジオフェンスの円の半径。判定に使う「駅の近く」（detector.ts の radiusM＝150m）より広くして、
 * 駅に入る前の位置も取れるようにする（来た向きがわからないと、乗り換えを判定できない）。
 * OS のジオフェンスは反応が遅れることもあるので、広めのほうが取りこぼしにくい。
 */
export const STATION_RADIUS_M = 300;
export const UNDERGROUND_RADIUS_M = 400;
export const OUTER_ID = 'outer';
const STATION_PREFIX = 'station:';

export type GeofenceRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
};

export function geofenceLimit(platform: string): number {
  return platform === 'android' ? 100 : 20;
}

export function stationRegionId(stationId: number): string {
  return `${STATION_PREFIX}${stationId}`;
}

export function parseRegionId(identifier: string | undefined): number | 'outer' | null {
  if (!identifier) return null;
  if (identifier === OUTER_ID) return 'outer';
  if (!identifier.startsWith(STATION_PREFIX)) return null;
  const id = Number(identifier.slice(STATION_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

export type NearbyFn = (
  lat: number,
  lng: number,
  count: number,
) => { station: { id: number; lat: number; lng: number; underground: boolean }; distance: number }[];

export function planGeofences(input: {
  lat: number;
  lng: number;
  platform: string;
  nearby: NearbyFn;
  excluded: Set<number>;
}): GeofenceRegion[] {
  const slots = geofenceLimit(input.platform) - 1; // 1つは外枠に使う
  // 除外する駅は見張らないので、そのぶん多めに取ってから絞る
  const near = input.nearby(input.lat, input.lng, slots + input.excluded.size)
    .filter((n) => !input.excluded.has(n.station.id))
    .slice(0, slots);
  const regions: GeofenceRegion[] = near.map((n) => ({
    identifier: stationRegionId(n.station.id),
    latitude: n.station.lat,
    longitude: n.station.lng,
    radius: n.station.underground ? UNDERGROUND_RADIUS_M : STATION_RADIUS_M,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));
  // 外枠：いちばん遠い駅までの距離の半分。抜けたら、まだ見張っていない駅に近づいている
  const farthest = near.length > 0 ? near[near.length - 1].distance : 2000;
  regions.push({
    identifier: OUTER_ID,
    latitude: input.lat,
    longitude: input.lng,
    radius: Math.round(Math.min(50000, Math.max(800, farthest / 2))),
    notifyOnEnter: false,
    notifyOnExit: true,
  });
  return regions;
}
