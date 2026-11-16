/**
 * ナンバリングCSVを書くときの補助。事業者を指定すると、N02 の路線ごとに駅の並びを出す。
 *   npx tsx scripts/build-master/inspect-lines.ts 東京地下鉄 東京都
 */
import path from 'node:path';

import { CACHE_DIR, N02_EDITION } from './config';
import { buildStationGraph, orderStations } from './graph';
import { type Coord, haversine, lineKey, loadN02, midpoint } from './n02';

const TOKYO: Coord = [139.7671, 35.6812];

const ops = process.argv.slice(2);
const data = loadN02(path.resolve(CACHE_DIR), N02_EDITION);

const linesOfGroup = new Map<string, Set<string>>();
const nameOf = new Map<string, string>();
const posOf = new Map<string, Coord>();
for (const s of data.stations) {
  if (!linesOfGroup.has(s.group)) linesOfGroup.set(s.group, new Set());
  linesOfGroup.get(s.group)!.add(lineKey(s.op, s.line));
  nameOf.set(s.group, s.name);
  posOf.set(s.group, midpoint(s.coords));
}

const keys = [...new Set(data.stations.map((s) => lineKey(s.op, s.line)))].sort();
for (const key of keys) {
  const [op, line] = key.split('\t');
  if (ops.length > 0 && !ops.includes(op)) continue;
  const g = buildStationGraph(
    data.sections.filter((s) => s.op === op && s.line === line),
    data.stations.filter((s) => s.op === op && s.line === line),
  );
  const ordered = orderStations(g, {
    hubScore: (id) => linesOfGroup.get(id)!.size,
    tieBreak: (id) => haversine(posOf.get(id)!, TOKYO),
  });
  const segs = new Map<number, string[]>();
  for (const o of ordered) {
    if (!segs.has(o.seg)) segs.set(o.seg, []);
    segs.get(o.seg)!.push(nameOf.get(o.id)!);
  }
  console.log(`\n■ ${op} / ${line}（${ordered.length}駅）`);
  for (const [seg, names] of segs) console.log(`  [${seg}] ${names.join(' ')}`);
}
