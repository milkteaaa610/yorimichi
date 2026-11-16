/**
 * @jest-environment node
 *
 * 記録と達成率の計算（同梱の駅マスタを使う）。
 */
import { sql } from 'drizzle-orm';

import { createTestDb } from '../../test/testDb';
import {
  addPhotosToVisit,
  addVisit,
  addVisitsBulk,
  getLineStations,
  getLineStats,
  getMuniStats,
  getPrefStats,
  getRecentVisits,
  getStationSummary,
  getTotals,
  recordCandidate,
  addCandidate,
  dismissCandidate,
  getPendingCandidates,
} from '../queries';

function setup() {
  const t = createTestDb();
  const yamanote = [...t.master.lines.values()].find((l) => l.code === 'JY')!;
  return { ...t, yamanote };
}

describe('まとめて登録と達成率', () => {
  test('山手線30駅をまとめて登録すると、山手線を制覇する', () => {
    const { db, yamanote } = setup();
    const stations = getLineStations(db, yamanote.id, false);
    expect(stations).toHaveLength(30);
    expect(stations[0]).toMatchObject({ name: '東京', number: '01' });
    expect(stations[29]).toMatchObject({ name: '有楽町', number: '30' });

    addVisitsBulk(db, stations.map((s) => s.stationId));

    const stat = getLineStats(db, false).get(yamanote.id)!;
    expect(stat).toEqual({ lineId: yamanote.id, visited: 30, total: 30 });
    const totals = getTotals(db, false);
    expect(totals.stations).toBe(30);
    expect(totals.linesCompleted).toBeGreaterThanOrEqual(1);
    expect(totals.prefectures).toBe(1);
    // 山手線の駅がある区（千代田・台東・荒川・北・豊島・新宿・渋谷・品川・港）
    expect(totals.municipalities).toBe(9);
    // 日付なしで登録できる
    expect(getRecentVisits(db, 1)[0].visitedOn).toBeNull();
  });

  test('一部だけ登録すると、達成率は訪れた駅数／全駅数', () => {
    const { db, yamanote } = setup();
    const stations = getLineStations(db, yamanote.id, false);
    addVisitsBulk(db, stations.slice(0, 18).map((s) => s.stationId));
    expect(getLineStats(db, false).get(yamanote.id)).toMatchObject({ visited: 18, total: 30 });
    expect(getLineStations(db, yamanote.id, false).filter((s) => s.visited)).toHaveLength(18);
  });

  test('同じ駅を何度記録しても、訪れた駅は1つと数える', () => {
    const { db, master } = setup();
    const shinjuku = master.search('新宿', 1)[0];
    addVisit(db, { stationId: shinjuku.id, kind: 'got_off', visitedOn: '2026-11-10', source: 'manual' });
    addVisit(db, { stationId: shinjuku.id, kind: 'transfer', visitedOn: '2026-11-11', source: 'manual' });
    expect(getTotals(db, false).stations).toBe(1);
    expect(getStationSummary(db, shinjuku.id)).toMatchObject({ count: 2, first: '2026-11-10', last: '2026-11-11' });
    // 乗換駅（新宿）は1駅で、乗り入れる路線すべてに数えられる
    const stats = getLineStats(db, false);
    const visitedLines = [...stats.values()].filter((s) => s.visited > 0).length;
    expect(visitedLines).toBe(master.stationLines(shinjuku.id).length);
  });

  test('「通過」は設定しない限り達成に数えない', () => {
    const { db, master } = setup();
    const s = master.search('渋谷', 1)[0];
    addVisit(db, { stationId: s.id, kind: 'pass', visitedOn: '2026-10-05', source: 'manual' });
    expect(getTotals(db, false).stations).toBe(0);
    expect(getTotals(db, true).stations).toBe(1);
  });

  test('今年の新駅は、今年はじめて訪れた駅だけ', () => {
    const { db, master } = setup();
    const [a, b] = master.search('新宿', 2);
    addVisit(db, { stationId: a.id, kind: 'got_off', visitedOn: '2025-05-01', source: 'manual' });
    addVisit(db, { stationId: a.id, kind: 'got_off', visitedOn: '2026-05-01', source: 'manual' });
    addVisit(db, { stationId: b.id, kind: 'got_off', visitedOn: '2026-06-01', source: 'manual' });
    expect(getTotals(db, false, 2026).newThisYear).toBe(1);
  });
});

describe('都道府県・市区町村', () => {
  test('東京都の分母は「駅のある区市町村」50', () => {
    const { db } = setup();
    const tokyo = getPrefStats(db, false).find((p) => p.code === 13)!;
    expect(tokyo.muniCount).toBe(50);
    const munis = getMuniStats(db, 13, false);
    expect(munis.filter((m) => m.hasStation)).toHaveLength(50);
    // 島しょ部などの駅のない町村は分母に入らない
    expect(munis.find((m) => m.name === '檜原村')?.hasStation).toBe(false);
  });

  test('訪れた駅の数が都道府県と市区町村に数えられる', () => {
    const { db, master } = setup();
    const s = master.search('長谷', 5).find((x) => x.prefCode === 14)!;
    addVisit(db, { stationId: s.id, kind: 'got_off', visitedOn: '2026-11-16', source: 'manual' });
    const kanagawa = getPrefStats(db, false).find((p) => p.code === 14)!;
    expect(kanagawa).toMatchObject({ visited: 1, muniVisited: 1 });
    const kamakura = getMuniStats(db, 14, false).find((m) => m.name === '鎌倉市')!;
    expect(kamakura.visited).toBe(1);
  });
});

describe('写真と自動チェックインの候補', () => {
  test('1件の記録に付けられる写真は10枚まで、同じ写真は二重に付けない', () => {
    const { db, master, client } = setup();
    const s = master.search('京都', 1)[0];
    const photo = (i: number) => ({ assetId: `ph://${i}`, takenAt: 1, lat: 35, lng: 135 });
    const id = addVisit(db, {
      stationId: s.id, kind: 'got_off', visitedOn: '2023-03-21', source: 'photo',
      photos: Array.from({ length: 8 }, (_, i) => photo(i)),
    });
    expect(addPhotosToVisit(db, id, [photo(1), photo(8), photo(9), photo(10)])).toBe(2);
    expect(client.prepare('SELECT COUNT(*) AS n FROM photos').get()).toEqual({ n: 10 });
  });

  test('記録を消すと写真も消える', () => {
    const { db, master } = setup();
    const s = master.search('京都', 1)[0];
    const id = addVisit(db, { stationId: s.id, kind: 'got_off', visitedOn: null, source: 'photo', photos: [{ assetId: 'a' }] });
    db.run(sql`DELETE FROM visits WHERE id = ${id}`);
    expect(db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM photos`).n).toBe(0);
  });

  test('候補は一度だけ記録できる（通知とアプリの両方から押されても二重にならない）', () => {
    const { db, master } = setup();
    const s = master.search('長谷', 1)[0];
    const c = addCandidate(db, { stationId: s.id, detectedAt: Date.UTC(2026, 10, 16, 1, 52), kindGuess: 'got_off', dwellSec: 320 });
    expect(recordCandidate(db, c)).not.toBeNull();
    expect(recordCandidate(db, c)).toBeNull();
    expect(getTotals(db, false).stations).toBe(1);
    const c2 = addCandidate(db, { stationId: s.id, detectedAt: Date.UTC(2026, 10, 16, 3), kindGuess: 'got_off', dwellSec: 400 });
    dismissCandidate(db, c2);
    expect(getPendingCandidates(db)).toHaveLength(0);
  });
});
