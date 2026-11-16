/**
 * 自動チェックインのセッション。ジオフェンスで駅に近づいてから、判定が決まるまでの位置をためておく。
 *
 * バックグラウンドのタスクは呼ばれるたびに別の実行になりうるので、状態は記録DB（settings）に置く。
 * ここは OS の API を呼ばない。タスク（tasks.ts）から呼ばれ、単体テストもできる。
 */
import type { MasterData } from '../data/master';
import {
  addCandidate,
  dismissCandidate,
  getCandidate,
  getExcludedStations,
  lastDetectedAt,
  recordCandidate,
} from '../db/queries';
import { type Settings, clearState, getState, loadSettings, setState } from '../db/settings';
import type { Db } from '../db/types';
import {
  DEFAULT_CONFIG,
  type DetectorConfig,
  type DetectorStation,
  type Sample,
  allowedBySettings,
  evaluate,
  shouldSuppress,
} from './detector';

const SESSIONS_KEY = 'auto.sessions';
const MAX_SAMPLES = 240;

export type Session = { stationId: number; startedAt: number; samples: Sample[] };

export type DetectedCandidate = {
  candidateId: number;
  stationId: number;
  kind: 'got_off' | 'transfer' | 'pass';
  /** すぐに記録の設定で記録したとき、その visits.id */
  visitId: number | null;
};

export function configFor(settings: Settings): DetectorConfig {
  return {
    ...DEFAULT_CONFIG,
    dwellSec: Math.round(settings.dwellMinutes * 60),
  };
}

export function toDetectorStation(master: MasterData, stationId: number): DetectorStation | null {
  const s = master.station(stationId);
  if (!s) return null;
  return {
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    underground: s.underground,
    lines: master.neighborsOf(stationId).map((l) => ({ lineId: l.lineId, neighbors: l.neighbors })),
  };
}

export function getSessions(db: Db): Session[] {
  return getState<Session[]>(db, SESSIONS_KEY) ?? [];
}

function saveSessions(db: Db, sessions: Session[]): void {
  if (sessions.length === 0) clearState(db, SESSIONS_KEY);
  else setState(db, SESSIONS_KEY, sessions);
}

/** 駅に近づいた（ジオフェンスに入った）。直前の位置があれば、来た向きの手がかりに入れる。 */
export function startSession(db: Db, stationId: number, now: number, recent: Sample[] = []): void {
  const sessions = getSessions(db);
  if (sessions.some((s) => s.stationId === stationId)) return;
  sessions.push({ stationId, startedAt: now, samples: recent.slice(-5) });
  saveSessions(db, sessions);
}

/**
 * 位置が届いた。すべてのセッションに位置を足して判定し、決まった候補を返す。
 * 返り値の active が 0 なら、細かい位置の取得を止めてよい。
 */
export function addSamples(
  db: Db,
  master: MasterData,
  samples: Sample[],
  now: number,
): { detected: DetectedCandidate[]; active: number } {
  const settings = loadSettings(db);
  const config = configFor(settings);
  const excluded = new Set(getExcludedStations(db));
  const detected: DetectedCandidate[] = [];
  const keep: Session[] = [];

  for (const session of getSessions(db)) {
    const merged = [...session.samples, ...samples]
      .filter((s) => s.t >= session.startedAt - 10 * 60 * 1000)
      .sort((a, b) => a.t - b.t)
      .slice(-MAX_SAMPLES);
    const station = toDetectorStation(master, session.stationId);
    if (!station) continue;
    const result = evaluate(station, merged, now, config);
    if (result.decision) {
      const d = result.decision;
      const suppressed = shouldSuppress({
        stationId: station.id,
        at: d.at,
        excluded,
        lastDetectedAt: lastDetectedAt(db, station.id),
        config,
      });
      if (!suppressed && allowedBySettings(d.kind, settings)) {
        const kind = d.kind;
        const candidateId = addCandidate(db, {
          stationId: station.id,
          detectedAt: d.at,
          kindGuess: kind,
          dwellSec: d.dwellSec,
        });
        const visitId = settings.autoMode === 'instant' ? recordCandidate(db, candidateId) : null;
        detected.push({ candidateId, stationId: station.id, kind, visitId });
      }
    }
    if (!result.done) keep.push({ ...session, samples: merged });
  }
  saveSessions(db, keep);
  return { detected, active: keep.length };
}

/** 古いセッションを片づける（アプリを開いたときなど）。 */
export function pruneSessions(db: Db, now: number, maxAgeMs = 45 * 60 * 1000): void {
  const sessions = getSessions(db).filter((s) => now - s.startedAt < maxAgeMs);
  saveSessions(db, sessions);
}

/** 通知のボタンが押された。 */
export function respondToCandidate(
  db: Db,
  candidateId: number,
  action: 'record' | 'transfer' | 'dismiss',
): number | null {
  const c = getCandidate(db, candidateId);
  if (!c || c.status !== 'pending') return null;
  if (action === 'dismiss') {
    dismissCandidate(db, candidateId);
    return null;
  }
  return recordCandidate(db, candidateId, action === 'transfer' ? 'transfer' : undefined);
}
