/**
 * @jest-environment node
 *
 * 駅マスタの検査（scripts/build-master/validate.ts と同じもの）と、検索・ナンバリング。
 */
import path from 'node:path';

import { validateMaster } from '../../../scripts/build-master/validate';
import { createTestDb } from '../../test/testDb';

const { master } = createTestDb();

test('駅マスタの検査をすべて通る（件数・重複・座標・市区町村コード・新宿・東京都50）', () => {
  const report = validateMaster(path.resolve(__dirname, '../../../assets/db/stations.db'));
  expect(report.errors).toEqual([]);
});

describe('新宿', () => {
  const shinjuku = master.search('新宿', 1)[0];
  test('1駅にまとまっている', () => {
    expect(master.stations.filter((s) => s.name === '新宿' && s.prefCode === 13)).toHaveLength(1);
  });
  test('ナンバリングは10。一覧では2つまで出し、残りは +8', () => {
    const badges = master.badges(shinjuku.id);
    expect(badges.map((b) => `${b.code}${b.num}`)).toEqual([
      'JY17', 'JC05', 'JB10', 'JA11', 'JS20', 'M08', 'S01', 'E27', 'OH01', 'KO01',
    ]);
  });
  test('説明は「東京都 · JR東日本・東京メトロ ほか」', () => {
    expect(master.describe(shinjuku.id)).toBe('東京都 · JR東日本・東京メトロ ほか');
  });
});

describe('search', () => {
  test('ひらがなで探せる', () => {
    expect(master.search('しんじゅく', 1)[0].name).toBe('新宿');
  });
  test('ローマ字で探せる（長音の表記ゆれも）', () => {
    expect(master.search('shin-osaka', 1)[0].name).toBe('新大阪');
    expect(master.search('Shinosaka', 1)[0].name).toBe('新大阪');
  });
  test('路線名で、その路線の駅が並ぶ', () => {
    const r = master.search('江ノ島電鉄線', 20);
    expect(r[0].name).toBe('藤沢');
    expect(r).toHaveLength(15);
  });
});

test('近い駅を距離つきで出す', () => {
  const near = master.nearest(35.3113, 139.5362, 3);
  expect(near.map((n) => n.station.name)).toEqual(['長谷', '由比ヶ浜', '極楽寺']);
  expect(near[0].distance).toBeLessThan(200);
});

test('ナンバリングのない駅にはバッジを出さない', () => {
  const aizu = master.search('会津川口', 1)[0];
  expect(master.badges(aizu.id)).toEqual([]);
});

test('乗り換えの判定に使う、隣の駅', () => {
  const kamakura = master.search('鎌倉', 5).find((s) => s.prefCode === 14 && s.name === '鎌倉')!;
  const lines = master.neighborsOf(kamakura.id);
  const enoden = lines.find((l) => master.lines.get(l.lineId)?.code === 'EN')!;
  expect(enoden.neighbors.map((n) => master.station(n.id)!.name)).toEqual(['和田塚']);
});
