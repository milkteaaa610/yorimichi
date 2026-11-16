/**
 * 駅マスタ（assets/db/stations.db）と地図データ（assets/map）を作る。
 *
 *   npm run build:master            … 駅マスタだけ作り直す
 *   npm run build:master -- --map   … 地図の形も作り直す（数十秒かかる）
 *
 * 入力: 国土数値情報 N02（鉄道）・N03（行政区域）、data/ 以下の自前CSV
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { CACHE_DIR, DATA_DIR, N02_EDITION, N03_EDITION, OUT_DB, OUT_MAP_DIR, OUT_VERSION } from './config';
import { readCsv } from './csv';
import { ensureSources, n03Shapefile } from './fetch';
import { buildStationGraph, orderStations } from './graph';
import { assignStationIds } from './ids';
import { buildMapShapes } from './mapshapes';
import { assignMunicipalities, loadMunicipalities } from './muni';
import { type Coord, haversine, lineKey, loadN02, midpoint } from './n02';
import { applyLineDef, loadLineDefs } from './numbering';
import { loadReadings } from './readings';
import { validateMaster } from './validate';

const TOKYO: Coord = [139.7671, 35.6812];

/** 地下を走る路線（ジオフェンスの円を広めにするための目印） */
const SUBWAY_OPERATORS = new Set([
  '東京地下鉄', '大阪市高速電気軌道', '埼玉高速鉄道', '横浜高速鉄道', '東京臨海高速鉄道',
  '東京都', '横浜市', '名古屋市', '京都市', '神戸市', '福岡市', '札幌市', '仙台市',
]);
const NOT_SUBWAY_LINES = /荒川線|舎人|軌道|山鼻|一条|都心線/;

function cleanLineName(name: string): string {
  // 「3号線銀座線」→「銀座線」。「1号線」だけの名前はそのまま。
  return name.replace(/^\d+号線(?=.)/, '').replace(/^[（(](.+)[）)]$/, '$1');
}

type StationOut = {
  group: string;
  id: number;
  name: string;
  pos: Coord;
  muni: string;
  underground: boolean;
  kana: string | null;
  romaji: string | null;
};

type LineOut = {
  operator: string;
  name: string;
  code: string | null;
  color: string | null;
  ink: string | null;
  loop: boolean;
  numbered: boolean;
  entries: { group: string; number: string | null; seg: number }[];
};

async function main() {
  const withMap = process.argv.includes('--map') || !fs.existsSync(path.join(OUT_MAP_DIR, 'japan.json'));
  console.log('1/6 元データを確認');
  await ensureSources();
  const data = loadN02(path.resolve(CACHE_DIR), N02_EDITION);
  const shp = n03Shapefile();

  console.log('2/6 駅をまとめる');
  const members = new Map<string, typeof data.stations>();
  for (const s of data.stations) {
    if (!members.has(s.group)) members.set(s.group, []);
    members.get(s.group)!.push(s);
  }
  const posOf = new Map<string, Coord>();
  const nameOf = new Map<string, string>();
  const linesOfGroup = new Map<string, Set<string>>();
  for (const [group, list] of members) {
    const pts = list.map((s) => midpoint(s.coords));
    posOf.set(group, [
      pts.reduce((a, p) => a + p[0], 0) / pts.length,
      pts.reduce((a, p) => a + p[1], 0) / pts.length,
    ]);
    // グループ内で名前が割れていたら、いちばん多い名前を使う
    const count = new Map<string, number>();
    for (const s of list) count.set(s.name, (count.get(s.name) ?? 0) + 1);
    nameOf.set(group, [...count].sort((a, b) => b[1] - a[1])[0][0]);
    linesOfGroup.set(group, new Set(list.map((s) => lineKey(s.op, s.line))));
  }

  console.log('3/6 市区町村を割り当てる');
  const municipalities = loadMunicipalities(shp);
  const muniOf = assignMunicipalities(
    [...posOf].map(([id, pos]) => ({ id, pos })),
    shp,
  );

  console.log('4/6 路線と駅の並びを作る');
  const operatorRows = readCsv(path.join(DATA_DIR, 'operators.csv'));
  const operatorLabel = new Map(operatorRows.filter((r) => r.n02_name).map((r) => [r.n02_name, r.name]));
  const operatorStyle = new Map(operatorRows.map((r) => [r.name, r]));
  const defs = loadLineDefs(DATA_DIR);
  const hidden = new Set<string>();
  for (const d of defs) for (const h of d.hides) hidden.add(lineKey(d.operator, h));

  const lines: LineOut[] = [];
  for (const def of defs) {
    lines.push({
      operator: def.operatorName ?? operatorLabel.get(def.operator) ?? def.operator,
      name: def.name,
      code: def.code,
      color: def.color,
      ink: def.ink,
      loop: def.loop,
      numbered: true,
      entries: applyLineDef(def, { data, posOf, nameOf }),
    });
  }
  const opType = new Map<string, number>();
  const n02Keys = [...new Set(data.stations.map((s) => lineKey(s.op, s.line)))].sort();
  for (const key of n02Keys) {
    const [op, line] = key.split('\t');
    const stationsOfLine = data.stations.filter((s) => s.op === op && s.line === line);
    const label = operatorLabel.get(op) ?? op;
    opType.set(label, Math.min(opType.get(label) ?? 9, stationsOfLine[0].opType));
    if (hidden.has(key)) continue;
    const g = buildStationGraph(
      data.sections.filter((s) => s.op === op && s.line === line),
      stationsOfLine,
    );
    const ordered = orderStations(g, {
      hubScore: (id) => linesOfGroup.get(id)!.size,
      tieBreak: (id) => haversine(posOf.get(id)!, TOKYO),
    });
    lines.push({
      operator: label,
      name: cleanLineName(line),
      code: null,
      color: null,
      ink: null,
      loop: false,
      numbered: false,
      entries: ordered.map((o) => ({ group: o.id, number: null, seg: o.seg })),
    });
  }
  for (const def of defs) {
    const label = def.operatorName ?? operatorLabel.get(def.operator) ?? def.operator;
    const base = operatorLabel.get(def.operator) ?? def.operator;
    opType.set(label, Math.min(opType.get(label) ?? 9, opType.get(base) ?? 4));
  }

  console.log('5/6 読みがな・駅IDを付ける');
  const reading = loadReadings();
  const ids = assignStationIds(
    [...posOf].map(([key, pos]) => ({ key, name: nameOf.get(key)!, pos })),
  );
  const stations: StationOut[] = [...members.entries()].map(([group, list]) => {
    const pos = posOf.get(group)!;
    const r = reading(nameOf.get(group)!, pos);
    return {
      group,
      id: ids.get(group)!,
      name: nameOf.get(group)!,
      pos,
      muni: muniOf.get(group)!,
      underground: list.some((s) => SUBWAY_OPERATORS.has(s.op) && !NOT_SUBWAY_LINES.test(s.line)),
      kana: r.kana,
      romaji: r.romaji,
    };
  });
  stations.sort((a, b) => a.id - b.id);
  const idOf = new Map(stations.map((s) => [s.group, s.id]));

  // 事業者の並び：JRを先に、あとは駅の多い順
  const opStations = new Map<string, Set<string>>();
  for (const l of lines) {
    if (!opStations.has(l.operator)) opStations.set(l.operator, new Set());
    for (const e of l.entries) opStations.get(l.operator)!.add(e.group);
  }
  const operators = [...opStations.keys()].sort((a, b) => {
    const ja = (opType.get(a) ?? 9) <= 2 ? 0 : 1;
    const jb = (opType.get(b) ?? 9) <= 2 ? 0 : 1;
    return ja - jb || opStations.get(b)!.size - opStations.get(a)!.size || a.localeCompare(b, 'ja');
  });
  const operatorId = new Map(operators.map((name, i) => [name, i + 1]));
  const lineOrder = [...lines].sort(
    (a, b) =>
      operatorId.get(a.operator)! - operatorId.get(b.operator)! ||
      Number(b.numbered) - Number(a.numbered) ||
      (a.numbered ? 0 : b.entries.length - a.entries.length || a.name.localeCompare(b.name, 'ja')),
  );

  console.log('6/6 SQLite に書き出す');
  fs.mkdirSync(path.dirname(OUT_DB), { recursive: true });
  for (const f of [OUT_DB, `${OUT_DB}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
  const db = new Database(OUT_DB);
  db.pragma('journal_mode = DELETE');
  db.pragma('page_size = 4096');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  const stationCountByMuni = new Map<string, number>();
  const stationCountByPref = new Map<number, number>();
  for (const s of stations) {
    stationCountByMuni.set(s.muni, (stationCountByMuni.get(s.muni) ?? 0) + 1);
    const pref = Number(s.muni.slice(0, 2));
    stationCountByPref.set(pref, (stationCountByPref.get(pref) ?? 0) + 1);
  }
  const prefNames = new Map(municipalities.map((m) => [m.prefCode, m.prefName]));
  const hash = crypto.createHash('sha1');
  const run = db.transaction(() => {
    const insPref = db.prepare('INSERT INTO prefectures VALUES (?, ?, ?, ?)');
    for (const [code, name] of [...prefNames].sort((a, b) => a[0] - b[0])) {
      const muniCount = municipalities.filter(
        (m) => m.prefCode === code && stationCountByMuni.has(m.code),
      ).length;
      insPref.run(code, name, muniCount, stationCountByPref.get(code) ?? 0);
    }
    const insMuni = db.prepare('INSERT INTO municipalities VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const m of municipalities) {
      const n = stationCountByMuni.get(m.code) ?? 0;
      const row = [m.code, m.prefCode, m.name, m.city, m.county, m.kind, n > 0 ? 1 : 0, n];
      insMuni.run(...row);
      hash.update(JSON.stringify(row));
    }
    const insOp = db.prepare('INSERT INTO operators VALUES (?, ?, ?, ?, ?, ?)');
    operators.forEach((name, i) => {
      const style = operatorStyle.get(name);
      const row = [i + 1, name, opType.get(name) ?? 4, style?.badge_style || null, style?.badge_font || null, i + 1];
      insOp.run(...row);
      hash.update(JSON.stringify(row));
    });
    const insStation = db.prepare('INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const s of stations) {
      const row = [
        s.id, s.name, s.kana, s.romaji,
        Number(s.pos[1].toFixed(5)), Number(s.pos[0].toFixed(5)),
        Number(s.muni.slice(0, 2)), s.muni, s.underground ? 1 : 0,
      ];
      insStation.run(...row);
      hash.update(JSON.stringify(row));
    }
    const insLine = db.prepare('INSERT INTO lines VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insSl = db.prepare('INSERT INTO station_lines VALUES (?, ?, ?, ?, ?)');
    lineOrder.forEach((l, i) => {
      const lineId = i + 1;
      const row = [lineId, operatorId.get(l.operator)!, l.name, l.code, l.color, l.ink, l.loop ? 1 : 0, l.entries.length, lineId];
      insLine.run(...row);
      hash.update(JSON.stringify(row));
      l.entries.forEach((e, seq) => {
        const r = [idOf.get(e.group)!, lineId, e.number, seq + 1, e.seg];
        insSl.run(...r);
        hash.update(JSON.stringify(r));
      });
    });
    const version = hash.digest('hex').slice(0, 12);
    const insMeta = db.prepare('INSERT INTO meta VALUES (?, ?)');
    insMeta.run('version', version);
    insMeta.run('n02_edition', N02_EDITION);
    insMeta.run('n03_edition', N03_EDITION);
    return version;
  });
  const version = run();
  db.exec('VACUUM');
  db.close();

  fs.mkdirSync(path.dirname(OUT_VERSION), { recursive: true });
  fs.writeFileSync(
    OUT_VERSION,
    `// npm run build:master が書き出す。手で編集しない。\n` +
      `export const MASTER_VERSION = '${version}';\n` +
      `export const MASTER_SOURCES = { n02: '${N02_EDITION}', n03: '${N03_EDITION}' } as const;\n`,
  );

  if (withMap) {
    console.log('地図の形を作る');
    const byPref = new Map<number, Coord[]>();
    for (const s of stations) {
      const pref = Number(s.muni.slice(0, 2));
      if (!byPref.has(pref)) byPref.set(pref, []);
      byPref.get(pref)!.push(s.pos);
    }
    const sizes = buildMapShapes(shp, byPref);
    console.log(
      `  日本地図 ${(sizes.japanBytes / 1024).toFixed(0)}KB、市区町村 ${(sizes.muniBytes / 1024).toFixed(0)}KB`,
    );
  }

  const report = validateMaster(OUT_DB);
  for (const line of report.info) console.log(`  ${line}`);
  if (report.errors.length > 0) {
    for (const e of report.errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`完了: ${OUT_DB}（版 ${version}、${(fs.statSync(OUT_DB).size / 1024).toFixed(0)}KB）`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
