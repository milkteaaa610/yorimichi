const R = 6371008.8;
const RAD = Math.PI / 180;

export type LatLng = { lat: number; lng: number };

/** 2点間の距離（m）。 */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** a から b への方角（度。北が0、時計回り）。 */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin((b.lng - a.lng) * RAD) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** 2つの方角の差（0〜180度）。 */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 「150m」「1.2km」のような表示にする。 */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)}m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m / 1000)}km`;
}
