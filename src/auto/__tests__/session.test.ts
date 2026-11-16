/**
 * @jest-environment node
 *
 * セッション：位置を流すと候補ができ、設定どおりに記録される。
 */
import { getPendingCandidates, getTotals, setExcluded } from '../../db/queries';
import { saveSetting } from '../../db/settings';
import { createTestDb } from '../../test/testDb';
import type { Sample } from '../detector';
import { addSamples, getSessions, respondToCandidate, startSession } from '../session';

function stayAt(lat: number, lng: number, t0: number, sec: number): Sample[] {
  const out: Sample[] = [];
  for (let s = 0; s <= sec; s += 20) out.push({ t: t0 + s * 1000, lat: lat + (s % 3) * 0.00003, lng, speed: 0.2 });
  return out;
}

describe('session', () => {
  const T0 = Date.UTC(2026, 10, 16, 1, 46);

  test('駅に5分以上いたら、確認待ちの候補ができる', () => {
    const { db, master } = createTestDb();
    const hase = master.search('長谷', 5).find((s) => s.prefCode === 14)!;
    startSession(db, hase.id, T0);
    const samples = stayAt(hase.lat, hase.lng, T0, 340);
    const r = addSamples(db, master, samples, samples[samples.length - 1].t);
    expect(r.detected).toHaveLength(1);
    expect(r.detected[0]).toMatchObject({ stationId: hase.id, kind: 'got_off', visitId: null });
    expect(r.active).toBe(0);
    expect(getSessions(db)).toHaveLength(0);
    expect(getPendingCandidates(db)).toHaveLength(1);
    // 通知の「乗り換え」ボタン
    respondToCandidate(db, r.detected[0].candidateId, 'transfer');
    expect(getPendingCandidates(db)).toHaveLength(0);
    expect(getTotals(db, false).stations).toBe(1);
  });

  test('「すぐに記録」なら、確認なしで記録する', () => {
    const { db, master } = createTestDb();
    saveSetting(db, 'autoMode', 'instant');
    const hase = master.search('長谷', 5).find((s) => s.prefCode === 14)!;
    startSession(db, hase.id, T0);
    const samples = stayAt(hase.lat, hase.lng, T0, 340);
    const r = addSamples(db, master, samples, samples[samples.length - 1].t);
    expect(r.detected[0].visitId).not.toBeNull();
    expect(getTotals(db, false).stations).toBe(1);
  });

  test('除外する駅は候補にしない', () => {
    const { db, master } = createTestDb();
    const hase = master.search('長谷', 5).find((s) => s.prefCode === 14)!;
    setExcluded(db, hase.id, true);
    startSession(db, hase.id, T0);
    const samples = stayAt(hase.lat, hase.lng, T0, 340);
    expect(addSamples(db, master, samples, samples[samples.length - 1].t).detected).toHaveLength(0);
  });

  test('同じ駅を30分以内に再び検知しても、候補は1つ', () => {
    const { db, master } = createTestDb();
    const hase = master.search('長谷', 5).find((s) => s.prefCode === 14)!;
    for (const start of [T0, T0 + 10 * 60_000]) {
      startSession(db, hase.id, start);
      const samples = stayAt(hase.lat, hase.lng, start, 340);
      addSamples(db, master, samples, samples[samples.length - 1].t);
    }
    expect(getPendingCandidates(db)).toHaveLength(1);
  });
});
