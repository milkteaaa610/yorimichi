/**
 * 行政区域（N03）から、市区町村の一覧と「駅がどの市区町村にあるか」を求める。
 * 境界の形はここで使うだけで、アプリには入れない（地図用の簡略化した形は mapshapes.ts）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseCsv } from './csv';
import { type Coord, haversine } from './n02';

export type Municipality = {
  code: string;
  prefCode: number;
  prefName: string;
  /** 表示名。政令指定都市の区は「鶴見区」のように区の名前 */
  name: string;
  /** 政令指定都市の区なら市の名前（横浜市）。それ以外は null */
  city: string | null;
  /** 郡の名前。なければ null */
  county: string | null;
  kind: 'special-ward' | 'ward' | 'city' | 'town' | 'village';
};

const MAPSHAPER = path.resolve('node_modules/.bin/mapshaper');

export function mapshaper(args: string[]): void {
  execFileSync(MAPSHAPER, [...args, '-quiet'], { stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 30 });
}

function kindOf(name: string, ward: string): Municipality['kind'] {
  if (ward) return 'ward';
  if (name.endsWith('区')) return 'special-ward';
  if (name.endsWith('市')) return 'city';
  if (name.endsWith('町')) return 'town';
  return 'village';
}

export function loadMunicipalities(shp: string): Municipality[] {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ekilog-muni-'));
  const out = path.join(tmp, 'muni.csv');
  mapshaper(['-i', shp, 'encoding=utf8', '-drop', 'geometry', '-filter', '!!N03_007', '-uniq', 'N03_007', '-o', out]);
  const rows = parseCsv(fs.readFileSync(out, 'utf8'));
  fs.rmSync(tmp, { recursive: true });
  return rows
    .map<Municipality>((r) => {
      const ward = r.N03_005 ?? '';
      const city = r.N03_004 ?? '';
      return {
        code: r.N03_007.padStart(5, '0'),
        prefCode: Number(r.N03_007.padStart(5, '0').slice(0, 2)),
        prefName: r.N03_001,
        name: ward || city,
        city: ward ? city : null,
        county: r.N03_003 || null,
        kind: kindOf(city, ward),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export type StationPoint = { id: string; pos: Coord };

/** 駅の座標がどの市区町村に入るかを調べる。海の上などで外れた駅は、いちばん近い駅に合わせる。 */
export function assignMunicipalities(points: StationPoint[], shp: string): Map<string, string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ekilog-join-'));
  const input = path.join(tmp, 'points.geojson');
  const output = path.join(tmp, 'joined.geojson');
  fs.writeFileSync(
    input,
    JSON.stringify({
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        properties: { id: p.id },
        geometry: { type: 'Point', coordinates: p.pos },
      })),
    }),
  );
  mapshaper(['-i', input, '-join', shp, 'encoding=utf8', 'fields=N03_007', '-o', output]);
  const joined = JSON.parse(fs.readFileSync(output, 'utf8')) as {
    features: { properties: { id: string; N03_007: string | null } }[];
  };
  fs.rmSync(tmp, { recursive: true });

  const result = new Map<string, string>();
  for (const f of joined.features) {
    if (f.properties.N03_007) result.set(f.properties.id, String(f.properties.N03_007).padStart(5, '0'));
  }
  const matched = points.filter((p) => result.has(p.id));
  for (const p of points) {
    if (result.has(p.id)) continue;
    let best: StationPoint | null = null;
    let bestDist = Infinity;
    for (const q of matched) {
      const d = haversine(p.pos, q.pos);
      if (d < bestDist) {
        bestDist = d;
        best = q;
      }
    }
    if (!best || bestDist > 3000) {
      throw new Error(`市区町村がわからない駅があります: ${p.id} (${p.pos.join(', ')})`);
    }
    result.set(p.id, result.get(best.id)!);
  }
  return result;
}
