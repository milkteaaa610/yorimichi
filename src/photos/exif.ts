/** 写真の EXIF から撮影位置と撮影日時を取り出す。端末によって形が違うので、ゆるく読む。 */
import type { LatLng } from '../geo/distance';

type Exif = Record<string, unknown> | null | undefined;

/** 「35/1,41/1,2345/100」のような度分秒、または数値を度に直す。 */
function toDegrees(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    const [d = 0, m = 0, s = 0] = value.map(Number);
    return [d, m, s].every(Number.isFinite) ? d + m / 60 + s / 3600 : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  const parts = value.split(',').map((p) => {
    const [n, d] = p.trim().split('/').map(Number);
    return d ? n / d : n;
  });
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n))) return null;
  const [d = 0, m = 0, s = 0] = parts;
  return d + m / 60 + s / 3600;
}

export function exifLocation(exif: Exif): LatLng | null {
  if (!exif) return null;
  const gps = (exif['{GPS}'] as Record<string, unknown> | undefined) ?? {};
  const pick = (key: string) => exif[`GPS${key}`] ?? gps[key];
  let lat = toDegrees(pick('Latitude'));
  let lng = toDegrees(pick('Longitude'));
  if (lat === null || lng === null) return null;
  if (String(pick('LatitudeRef') ?? '').toUpperCase().startsWith('S')) lat = -Math.abs(lat);
  if (String(pick('LongitudeRef') ?? '').toUpperCase().startsWith('W')) lng = -Math.abs(lng);
  // 位置が入っていない写真は 0,0 になっていることがある
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** 「2023:03:21 10:12:00」を端末の時刻として読む。 */
export function exifDate(exif: Exif): number | null {
  if (!exif) return null;
  const nested = (exif['{Exif}'] as Record<string, unknown> | undefined) ?? {};
  const raw = exif.DateTimeOriginal ?? nested.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime;
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  return Number.isFinite(t) ? t : null;
}
