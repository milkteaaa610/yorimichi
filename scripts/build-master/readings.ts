/**
 * 駅名の読みがなとローマ字。N02 には入っていないので、Wikidata（CC0）から作った
 * data/readings.csv を使い、駅名と位置が合うものを当てはめる。
 *
 * data/readings.csv を作り直すとき:  npx tsx scripts/build-master/readings.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import { DATA_DIR, USER_AGENT } from './config';
import { parseCsv, readCsv, writeCsv } from './csv';
import { type Coord, haversine } from './n02';
import { normalizeName } from './numbering';

export type Reading = { kana: string | null; romaji: string | null };

const READINGS_CSV = path.join(DATA_DIR, 'readings.csv');

const QUERY = `
SELECT ?s ?ja ?kana ?en ?coord WHERE {
  ?s wdt:P17 wd:Q17 ; wdt:P625 ?coord ; wdt:P31 ?cls .
  ?cls wdt:P279* wd:Q12819564 .
  OPTIONAL { ?s wdt:P1814 ?kana }
  OPTIONAL { ?s rdfs:label ?ja FILTER(lang(?ja)='ja') }
  OPTIONAL { ?s rdfs:label ?en FILTER(lang(?en)='en') }
}`;

function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function cleanName(label: string): string {
  return label
    .replace(/\s*[（(].*?[）)]\s*$/, '')
    .replace(/(駅|停留場|停留所|電停)$/, '')
    .trim();
}

function cleanKana(kana: string): string | null {
  const k = toHiragana(kana.trim())
    .replace(/\s+/g, '')
    .replace(/(えき|ていりゅうじょう|ていりゅうじょ|でんてい)$/, '');
  return /^[ぁ-ゖー・]+$/.test(k) ? k : null;
}

function cleanRomaji(en: string): string | null {
  const r = en
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s+(Station|Stop|Tram Stop|station|stop)$/, '')
    .trim();
  return /^[\x20-\x7EĀ-ž]+$/.test(r) && r.length > 0 ? r : null;
}

/** Wikidata から読みがなを取り直して data/readings.csv に保存する。 */
export async function fetchReadings(): Promise<void> {
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/csv',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `query=${encodeURIComponent(QUERY)}`,
  });
  if (!res.ok) throw new Error(`Wikidata の取得に失敗しました（${res.status}）`);
  saveReadings(await res.text());
}

export function saveReadings(wikidataCsv: string): void {
  const seen = new Map<string, (string | number)[]>();
  for (const r of parseCsv(wikidataCsv)) {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord ?? '');
    if (!m || !r.ja) continue;
    const name = cleanName(r.ja);
    const kana = r.kana ? cleanKana(r.kana) : null;
    const romaji = r.en ? cleanRomaji(r.en) : null;
    if (!name || (!kana && !romaji)) continue;
    const lng = Number(m[1]).toFixed(4);
    const lat = Number(m[2]).toFixed(4);
    const key = `${name}\t${lat}\t${lng}`;
    const prev = seen.get(key);
    if (!prev || (!prev[3] && kana)) seen.set(key, [name, lat, lng, kana ?? '', romaji ?? '']);
  }
  const rows = [...seen.values()].sort((a, b) =>
    `${a[0]}${a[1]}${a[2]}`.localeCompare(`${b[0]}${b[1]}${b[2]}`),
  );
  writeCsv(
    READINGS_CSV,
    ['name', 'lat', 'lng', 'kana', 'romaji'],
    rows,
    '駅名の読みがなとローマ字。Wikidata（CC0）から scripts/build-master/readings.ts で生成。',
  );
  console.log(`  読みがな ${rows.length}件を ${READINGS_CSV} に保存しました`);
}

export type ReadingIndex = (name: string, pos: Coord) => Reading;

export function loadReadings(): ReadingIndex {
  const byName = new Map<string, { pos: Coord; kana: string | null; romaji: string | null }[]>();
  for (const r of readCsv(READINGS_CSV)) {
    const key = normalizeName(r.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push({
      pos: [Number(r.lng), Number(r.lat)],
      kana: r.kana || null,
      romaji: r.romaji || null,
    });
  }
  return (name, pos) => {
    const found = (byName.get(normalizeName(name)) ?? [])
      .map((c) => ({ c, d: haversine(c.pos, pos) }))
      .filter((x) => x.d < 2500)
      .sort((a, b) => a.d - b.d);
    return {
      kana: found.find((x) => x.c.kana)?.c.kana ?? null,
      romaji: found.find((x) => x.c.romaji)?.c.romaji ?? null,
    };
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const local = process.argv[2];
  if (local) saveReadings(fs.readFileSync(local, 'utf8'));
  else fetchReadings().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
