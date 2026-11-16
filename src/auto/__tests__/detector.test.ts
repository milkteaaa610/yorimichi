/**
 * 自動チェックインの判定。位置の記録データ（駅の手前から出発まで）を流し込み、種類が出るかを見る。
 */
import { type LatLng, bearingDeg, distanceM } from '../../geo/distance';
import { DEFAULT_CONFIG, type DetectorStation, type Sample, evaluate, shouldSuppress } from '../detector';

const R = 6371008.8;
const RAD = Math.PI / 180;

/** p から方角 deg に meters 進んだ点 */
function move(p: LatLng, deg: number, meters: number): LatLng {
  const d = meters / R;
  const b = deg * RAD;
  const lat1 = p.lat * RAD;
  const lng1 = p.lng * RAD;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 / RAD, lng: lng2 / RAD };
}

/** 直線上を一定の速さで動いた記録。from から to へ、intervalSec ごとに位置を出す。 */
function travel(from: LatLng, to: LatLng, startT: number, kmh: number, intervalSec = 10): Sample[] {
  const total = distanceM(from, to);
  const mps = kmh / 3.6;
  const dur = total / mps;
  const deg = bearingDeg(from, to);
  const out: Sample[] = [];
  for (let s = 0; s <= dur; s += intervalSec) {
    const p = move(from, deg, mps * s);
    out.push({ t: startT + s * 1000, lat: p.lat, lng: p.lng, speed: mps });
  }
  return out;
}

/** 同じ場所にとどまった記録（GPS のぶれを少し入れる）。 */
function stay(at: LatLng, startT: number, sec: number, intervalSec = 15): Sample[] {
  const out: Sample[] = [];
  for (let s = 0; s <= sec; s += intervalSec) {
    const p = move(at, (s * 37) % 360, 8 + ((s / intervalSec) % 3) * 6);
    out.push({ t: startT + s * 1000, lat: p.lat, lng: p.lng, speed: 0.3 });
  }
  return out;
}

const T0 = Date.UTC(2026, 10, 16, 1, 40);

// 南北に走る路線 A と、東西に走る路線 B が交わる駅
const station: DetectorStation = {
  id: 1,
  lat: 35.68,
  lng: 139.76,
  underground: false,
  lines: [
    { lineId: 100, neighbors: [move({ lat: 35.68, lng: 139.76 }, 0, 1500), move({ lat: 35.68, lng: 139.76 }, 180, 1500)] },
    { lineId: 200, neighbors: [move({ lat: 35.68, lng: 139.76 }, 90, 1500), move({ lat: 35.68, lng: 139.76 }, 270, 1500)] },
  ],
};
const north = move(station, 0, 1200);
const south = move(station, 180, 1200);
const east = move(station, 90, 1200);

function run(samples: Sample[]) {
  return evaluate(station, samples, samples[samples.length - 1].t);
}

describe('evaluate', () => {
  test('駅の近くに5分以上とどまったら「降りた」', () => {
    const arrive = travel(north, station, T0, 40);
    const t1 = arrive[arrive.length - 1].t;
    const samples = [...arrive, ...stay(station, t1 + 15000, 330)];
    const r = run(samples);
    expect(r.decision?.kind).toBe('got_off');
    expect(r.decision!.dwellSec).toBeGreaterThanOrEqual(300);
    expect(r.done).toBe(true);
  });

  test('5分たつ前は、まだ決めない', () => {
    const arrive = travel(north, station, T0, 40);
    const t1 = arrive[arrive.length - 1].t;
    const r = run([...arrive, ...stay(station, t1 + 15000, 120)]);
    expect(r.decision).toBeNull();
    expect(r.done).toBe(false);
  });

  test('「降りた」と判定する時間は設定で変えられる', () => {
    const arrive = travel(north, station, T0, 40);
    const t1 = arrive[arrive.length - 1].t;
    const samples = [...arrive, ...stay(station, t1 + 15000, 200)];
    const r = evaluate(station, samples, samples[samples.length - 1].t, { ...DEFAULT_CONFIG, dwellSec: 180 });
    expect(r.decision?.kind).toBe('got_off');
  });

  test('短く止まって別の路線の向きへ出発したら「乗り換え」', () => {
    const arrive = travel(north, station, T0, 40);
    const t1 = arrive[arrive.length - 1].t;
    const wait = stay(station, t1 + 15000, 150);
    const t2 = wait[wait.length - 1].t;
    const depart = travel(station, east, t2 + 10000, 40);
    const r = run([...arrive, ...wait, ...depart]);
    expect(r.decision?.kind).toBe('transfer');
  });

  test('同じ路線のまま走り去ったら記録しない（停車しただけ）', () => {
    const arrive = travel(north, station, T0, 40);
    const t1 = arrive[arrive.length - 1].t;
    const wait = stay(station, t1 + 15000, 45);
    const t2 = wait[wait.length - 1].t;
    const depart = travel(station, south, t2 + 10000, 40);
    const r = run([...arrive, ...wait, ...depart]);
    expect(r.decision).toBeNull();
    expect(r.done).toBe(true);
    expect(r.reason).toBe('同じ路線で停車しただけ');
  });

  test('時速20km以上のまま通り過ぎたら「通過」', () => {
    const samples = [...travel(north, station, T0, 60, 5), ...travel(station, south, T0 + 72_000, 60, 5).slice(1)];
    const r = run(samples);
    expect(r.decision?.kind).toBe('pass');
  });

  test('駅の円に入らずに離れていったら打ち切る', () => {
    const away = move(station, 90, 400);
    const r = run(travel(away, move(away, 0, 1500), T0, 40));
    expect(r.decision).toBeNull();
    expect(r.done).toBe(true);
  });

  test('地下駅は位置がぶれても広めの円で判定する', () => {
    const under: DetectorStation = { ...station, underground: true };
    const offset = move(station, 45, 200); // 地上の駅なら円の外
    const samples = stay(offset, T0, 330);
    expect(evaluate(station, samples, samples[samples.length - 1].t).decision).toBeNull();
    expect(evaluate(under, samples, samples[samples.length - 1].t).decision?.kind).toBe('got_off');
  });
});

describe('shouldSuppress', () => {
  test('除外する駅は記録しない', () => {
    expect(shouldSuppress({ stationId: 1, at: T0, excluded: new Set([1]), lastDetectedAt: null })).toBe('除外する駅');
  });
  test('同じ駅を30分以内に再び検知したら記録しない', () => {
    expect(shouldSuppress({ stationId: 1, at: T0, excluded: new Set(), lastDetectedAt: T0 - 20 * 60_000 })).not.toBeNull();
    expect(shouldSuppress({ stationId: 1, at: T0, excluded: new Set(), lastDetectedAt: T0 - 40 * 60_000 })).toBeNull();
  });
});
