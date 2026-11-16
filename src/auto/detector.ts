/**
 * 自動チェックインの判定（docs/SPEC.md 5章）。位置の記録データだけを見る純粋な関数で、単体テストで守る。
 *
 *  | 状況                                         | 判定     |
 *  | 駅から150m以内に5分以上とどまった              | 降りた   |
 *  | 駅で止まったが5分未満で、出発後の向きが別の路線 | 乗り換え |
 *  | 時速20km以上のまま駅の近くを通り過ぎた          | 通過     |
 *  | 除外する駅／同じ駅を30分以内に再び検知          | 記録しない（shouldSuppress） |
 *
 * 判定の流れ：ジオフェンスで駅に近づいたら「セッション」を始め、数分間だけ細かく位置を取る。
 * 位置が届くたびに evaluate() を呼び、決まったら候補として保存する。
 */
import { type LatLng, angleDiff, bearingDeg, distanceM } from '../geo/distance';

export type Sample = {
  /** 時刻（ミリ秒） */
  t: number;
  lat: number;
  lng: number;
  /** 速さ（m/s）。端末が出さないときは null */
  speed?: number | null;
  /** 位置の誤差（m） */
  accuracy?: number | null;
};

/** 判定に使う駅の情報。lines は駅に乗り入れる路線と、その路線での隣の駅。 */
export type DetectorStation = LatLng & {
  id: number;
  underground: boolean;
  lines: { lineId: number; neighbors: LatLng[] }[];
};

export type DetectorConfig = {
  /** 「降りた」とみなす滞在時間（秒） */
  dwellSec: number;
  /** 駅の近くとみなす距離（m） */
  radiusM: number;
  /** 地下駅は位置がぶれるので広めにする */
  undergroundRadiusM: number;
  /** ここまで離れたら駅を出たとみなす（m） */
  leaveM: number;
  /** 通過とみなす速さ（km/h） */
  passKmh: number;
  /** 進む向きと路線の向きのずれの許容（度） */
  bearingToleranceDeg: number;
  /** 向きを測るのに必要な、駅からの距離（m） */
  bearingMinM: number;
  /** セッションの最長時間（秒）。これを過ぎたら打ち切る */
  maxSessionSec: number;
  /** 同じ駅をこの時間内に再び検知しても記録しない（秒） */
  repeatSec: number;
};

export const DEFAULT_CONFIG: DetectorConfig = {
  dwellSec: 5 * 60,
  radiusM: 150,
  undergroundRadiusM: 250,
  leaveM: 450,
  passKmh: 20,
  bearingToleranceDeg: 50,
  bearingMinM: 200,
  maxSessionSec: 30 * 60,
  repeatSec: 30 * 60,
};

export type Decision = {
  kind: 'got_off' | 'transfer' | 'pass';
  /** 駅の近くにいた時間（秒） */
  dwellSec: number;
  /** 判定のもとになった時刻（駅に着いた時刻） */
  at: number;
};

export type Evaluation = {
  decision: Decision | null;
  /** これ以上位置を取らなくてよい */
  done: boolean;
  /** 判定の理由（デバッグ・テスト用） */
  reason: string;
};

function radiusOf(station: DetectorStation, config: DetectorConfig): number {
  return station.underground ? config.undergroundRadiusM : config.radiusM;
}

/** 2点の間の速さ（km/h）。端末の速さがあればそれを使う。 */
function speedKmh(a: Sample, b: Sample): number {
  if (b.speed !== null && b.speed !== undefined && b.speed >= 0) return b.speed * 3.6;
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return 0;
  return (distanceM(a, b) / dt) * 3.6;
}

/** 駅から見て、ある向きに伸びている路線。 */
export function linesToward(station: DetectorStation, bearing: number, toleranceDeg: number): Set<number> {
  const out = new Set<number>();
  for (const line of station.lines) {
    for (const n of line.neighbors) {
      if (angleDiff(bearingDeg(station, n), bearing) <= toleranceDeg) out.add(line.lineId);
    }
  }
  return out;
}

export function evaluate(
  station: DetectorStation,
  samples: Sample[],
  now: number,
  config: DetectorConfig = DEFAULT_CONFIG,
): Evaluation {
  const list = [...samples].sort((a, b) => a.t - b.t);
  if (list.length === 0) return { decision: null, done: false, reason: 'まだ位置がない' };
  const radius = radiusOf(station, config);
  const dist = list.map((s) => distanceM(station, s));
  const insideIdx = dist.map((d, i) => (d <= radius ? i : -1)).filter((i) => i >= 0);
  const started = list[0].t;

  if (insideIdx.length === 0) {
    if (now - started > config.maxSessionSec * 1000) {
      return { decision: null, done: true, reason: '駅に近づかないまま時間切れ' };
    }
    const lastDist = dist[dist.length - 1];
    // 一度も駅の円に入らず、離れていった
    if (list.length >= 3 && lastDist > config.leaveM && dist.every((d) => d > radius)) {
      return { decision: null, done: true, reason: '駅の円に入らずに離れた' };
    }
    return { decision: null, done: false, reason: '駅に向かっている' };
  }

  const firstIn = insideIdx[0];
  const lastIn = insideIdx[insideIdx.length - 1];
  const arrivedAt = list[firstIn].t;
  // 最後に円の中にいた時刻。円の中にいる間に位置が来なくても、次の位置までは中にいたとみなさない
  const dwellSec = Math.round((list[lastIn].t - arrivedAt) / 1000);
  const stillInside = lastIn === list.length - 1;
  // 円の中にいる間に止まらなかったか（その間の速さがずっと速い）
  const insideSpeeds: number[] = [];
  for (let i = Math.max(1, firstIn); i <= Math.min(list.length - 1, lastIn + 1); i++) {
    insideSpeeds.push(speedKmh(list[i - 1], list[i]));
  }
  const neverStopped = insideSpeeds.length > 0 && insideSpeeds.every((v) => v >= config.passKmh);

  // 1. 長くとどまった → 降りた
  if (dwellSec >= config.dwellSec) {
    return {
      decision: { kind: 'got_off', dwellSec, at: arrivedAt },
      done: true,
      reason: '駅の近くに長くとどまった',
    };
  }

  const lastDist = dist[dist.length - 1];
  const departed = !stillInside && lastDist > config.leaveM;
  if (!departed) {
    if (now - started > config.maxSessionSec * 1000) {
      return { decision: null, done: true, reason: '駅の近くで時間切れ' };
    }
    return { decision: null, done: false, reason: '駅の近くにいる' };
  }

  // 2. 止まらずに通り過ぎた → 通過
  if (neverStopped && dwellSec < 90) {
    return { decision: { kind: 'pass', dwellSec, at: arrivedAt }, done: true, reason: '速さを保ったまま通り過ぎた' };
  }

  // 3. 短く止まって出発した → 来た向きと出ていく向きの路線を比べる
  let from: Sample | null = null;
  for (let i = firstIn - 1; i >= 0; i--) {
    if (dist[i] >= config.bearingMinM) {
      from = list[i];
      break;
    }
  }
  let to: Sample | null = null;
  for (let i = lastIn + 1; i < list.length; i++) {
    if (dist[i] >= config.bearingMinM) {
      to = list[i];
      break;
    }
  }
  if (!from || !to) {
    return { decision: null, done: true, reason: '来た向きか出ていく向きがわからない' };
  }
  const arrivalLines = linesToward(station, bearingDeg(station, from), config.bearingToleranceDeg);
  const departureLines = linesToward(station, bearingDeg(station, to), config.bearingToleranceDeg);
  if (arrivalLines.size === 0 || departureLines.size === 0) {
    return { decision: null, done: true, reason: '向きに合う路線がない' };
  }
  const sameLine = [...arrivalLines].some((l) => departureLines.has(l));
  if (!sameLine) {
    return { decision: { kind: 'transfer', dwellSec, at: arrivedAt }, done: true, reason: '別の路線へ出発した' };
  }
  return { decision: null, done: true, reason: '同じ路線で停車しただけ' };
}

/** 記録しない場合の理由。記録してよければ null。 */
export function shouldSuppress(input: {
  stationId: number;
  at: number;
  excluded: Set<number>;
  lastDetectedAt: number | null;
  config?: DetectorConfig;
}): string | null {
  const config = input.config ?? DEFAULT_CONFIG;
  if (input.excluded.has(input.stationId)) return '除外する駅';
  if (input.lastDetectedAt !== null && Math.abs(input.at - input.lastDetectedAt) < config.repeatSec * 1000) {
    return '同じ駅を30分以内に検知済み';
  }
  return null;
}

/** 設定に合わせて、記録する種類を絞る（MVP では通過は自動で記録しない）。 */
export function allowedBySettings(
  kind: Decision['kind'],
  settings: { autoTransfer: boolean; autoPass: boolean },
): boolean {
  if (kind === 'transfer') return settings.autoTransfer;
  if (kind === 'pass') return settings.autoPass;
  return true;
}
