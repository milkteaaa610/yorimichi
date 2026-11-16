/**
 * アプリ独自の駅ID。
 *
 * N02 の駅コードは緯度順の通し番号なので、新駅ができると番号がずれる。そこで駅IDは
 * data/station_ids.csv に控えておき、作り直すたびに「駅名と位置」で前回のIDに対応させる。
 * 記録（visits）はこのIDを持つので、駅マスタを更新しても記録は同じ駅を指し続ける。
 */
import fs from 'node:fs';
import path from 'node:path';

import { DATA_DIR } from './config';
import { readCsv, writeCsv } from './csv';
import { type Coord, haversine } from './n02';
import { normalizeName } from './numbering';

const IDS_CSV = path.join(DATA_DIR, 'station_ids.csv');
const MATCH_RADIUS_M = 1500;

type Entry = { id: number; name: string; pos: Coord; used: boolean };

export function assignStationIds(stations: { key: string; name: string; pos: Coord }[]): Map<string, number> {
  const registry: Entry[] = fs.existsSync(IDS_CSV)
    ? readCsv(IDS_CSV).map((r) => ({
        id: Number(r.id),
        name: r.name,
        pos: [Number(r.lng), Number(r.lat)] as Coord,
        used: false,
      }))
    : [];
  const byName = new Map<string, Entry[]>();
  for (const e of registry) {
    const k = normalizeName(e.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(e);
  }
  let nextId = registry.reduce((m, e) => Math.max(m, e.id), 0) + 1;

  const result = new Map<string, number>();
  const fresh: typeof stations = [];
  // 位置の近いものから先に決める（同名の駅が近くにあっても取り違えない）
  const pairs: { key: string; entry: Entry; d: number }[] = [];
  for (const s of stations) {
    for (const e of byName.get(normalizeName(s.name)) ?? []) {
      const d = haversine(s.pos, e.pos);
      if (d <= MATCH_RADIUS_M) pairs.push({ key: s.key, entry: e, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  for (const p of pairs) {
    if (result.has(p.key) || p.entry.used) continue;
    p.entry.used = true;
    result.set(p.key, p.entry.id);
  }
  const sorted = [...stations].sort((a, b) => a.key.localeCompare(b.key));
  for (const s of sorted) {
    if (result.has(s.key)) continue;
    result.set(s.key, nextId++);
    fresh.push(s);
  }

  const posOf = new Map(stations.map((s) => [result.get(s.key)!, s]));
  const rows: (string | number)[][] = [];
  for (const e of registry) {
    const cur = posOf.get(e.id);
    if (cur) rows.push([e.id, cur.name, cur.pos[1].toFixed(5), cur.pos[0].toFixed(5), 1]);
    else rows.push([e.id, e.name, e.pos[1].toFixed(5), e.pos[0].toFixed(5), 0]);
  }
  for (const s of fresh) {
    rows.push([result.get(s.key)!, s.name, s.pos[1].toFixed(5), s.pos[0].toFixed(5), 1]);
  }
  rows.sort((a, b) => Number(a[0]) - Number(b[0]));
  writeCsv(
    IDS_CSV,
    ['id', 'name', 'lat', 'lng', 'active'],
    rows,
    'アプリ独自の駅ID。手で編集しない（npm run build:master が更新する）。active=0 は廃止された駅で、IDは使い回さない。',
  );
  const retired = registry.filter((e) => !e.used).length;
  if (registry.length > 0) console.log(`  駅ID: 新規 ${fresh.length}件、廃止 ${retired}件`);
  return result;
}
