/**
 * 地図用のデータを作る。
 *
 *  assets/map/japan.json      … 都道府県の形（日本地図）。南西諸島は左上の枠に移す
 *  assets/map/muni/<都道府県>.json … 都道府県ごとの市区町村の形
 *
 * 行政区域（N03）の境界を大きく簡略化し、画面にそのまま描ける SVG のパス文字列にしておく。
 * アプリ側では投影の計算をしない。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { OUT_MAP_DIR, OUT_MUNI_INDEX } from './config';
import { isUnassigned, mapshaper } from './muni';
import { type Coord } from './n02';

type Ring = Coord[];
type Feature = {
  properties: Record<string, string>;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] } | null;
};

const RAD = Math.PI / 180;
const VIEW_W = 1000;

function polygonsOf(f: Feature): Ring[][] {
  if (!f.geometry) return [];
  return f.geometry.type === 'Polygon'
    ? [f.geometry.coordinates as Ring[]]
    : (f.geometry.coordinates as Ring[][]);
}

function ringBbox(ring: Ring): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** 輪の面積（km²、おおよそ）。 */
function ringAreaKm2(ring: Ring): number {
  const lat0 = (ring[0][1] + ring[Math.floor(ring.length / 2)][1]) / 2;
  const kx = 111.32 * Math.cos(lat0 * RAD);
  const ky = 110.57;
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a[0] * kx * (b[1] * ky) - b[0] * kx * (a[1] * ky);
  }
  return Math.abs(s) / 2;
}

function pointInRing(p: Coord, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function ringsToPath(rings: Ring[], project: (c: Coord) => [number, number]): string {
  let d = '';
  for (const ring of rings) {
    let prev = '';
    let count = 0;
    let part = '';
    for (let i = 0; i < ring.length - 1; i++) {
      const [x, y] = project(ring[i]);
      const cur = `${fmt(x)} ${fmt(y)}`;
      if (cur === prev) continue;
      part += (count === 0 ? 'M' : 'L') + cur;
      prev = cur;
      count++;
    }
    if (count >= 3) d += `${part}Z`;
  }
  return d;
}

function readFeatures(file: string): Feature[] {
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { features: Feature[] }).features;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;

// ───────── 日本地図（都道府県）─────────

/** 南西諸島（奄美・沖縄）。本土と同じ縮尺のまま、左上の枠に移して描く。 */
const isNansei = (c: Coord) => c[1] < 30 && c[0] >= 122.5 && c[0] <= 130.3;
/** 小笠原・大東など、枠にも入れない離島 */
const isRemote = (c: Coord) => c[1] < 30 && !isNansei(c);

export type JapanMap = {
  width: number;
  height: number;
  inset: { x: number; y: number; width: number; height: number };
  prefs: { code: number; name: string; d: string; cx: number; cy: number }[];
};

type JapanFrame = {
  main: { x0: number; y0: number; x1: number; y1: number };
  nansei: { x0: number; y0: number; x1: number; y1: number };
};

/**
 * 日本地図を作る。frame を渡すと同じ投影で描く（拡大表示用の細かい地図を、粗い地図とぴったり重ねるため）。
 */
function buildJapan(prefFile: string, frame?: JapanFrame): { map: JapanMap; frame: JapanFrame } {
  const feats = readFeatures(prefFile);
  type Part = { code: number; rings: Ring[]; nansei: boolean; area: number };
  const parts: Part[] = [];
  for (const f of feats) {
    for (const poly of polygonsOf(f)) {
      const [x0, y0, x1, y1] = ringBbox(poly[0]);
      const center: Coord = [(x0 + x1) / 2, (y0 + y1) / 2];
      if (isRemote(center)) continue;
      parts.push({
        code: Number(f.properties.pref),
        rings: poly,
        nansei: isNansei(center),
        area: ringAreaKm2(poly[0]),
      });
    }
  }
  const bboxOf = (ps: Part[]) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of ps) {
      const b = ringBbox(p.rings[0]);
      x0 = Math.min(x0, b[0]);
      x1 = Math.max(x1, b[2]);
      y0 = Math.min(y0, mercY(b[1]));
      y1 = Math.max(y1, mercY(b[3]));
    }
    return { x0, y0, x1, y1 };
  };
  const main = frame?.main ?? bboxOf(parts.filter((p) => !p.nansei));
  const nansei = frame?.nansei ?? bboxOf(parts.filter((p) => p.nansei));
  const pad = 14;
  const scale = (VIEW_W - pad * 2) / (main.x1 - main.x0);
  const height = Math.ceil((main.y1 - main.y0) * scale + pad * 2);
  const insetPad = 10;
  const inset = {
    x: 0,
    y: 0,
    width: Math.ceil((nansei.x1 - nansei.x0) * scale + pad + insetPad * 2),
    height: Math.ceil((nansei.y1 - nansei.y0) * scale + pad + insetPad * 2),
  };
  const projectMain = (c: Coord): [number, number] => [
    pad + (c[0] - main.x0) * scale,
    pad + (main.y1 - mercY(c[1])) * scale,
  ];
  const projectInset = (c: Coord): [number, number] => [
    pad + insetPad + (c[0] - nansei.x0) * scale,
    pad + insetPad + (nansei.y1 - mercY(c[1])) * scale,
  ];

  const names = new Map(feats.map((f) => [Number(f.properties.pref), f.properties.N03_001]));
  const prefs = [...names.keys()]
    .sort((a, b) => a - b)
    .map((code) => {
      const mine = parts.filter((p) => p.code === code);
      const d = mine.map((p) => ringsToPath(p.rings, p.nansei ? projectInset : projectMain)).join('');
      const biggest = [...mine].sort((a, b) => b.area - a.area)[0];
      const b = ringBbox(biggest.rings[0]);
      const proj = biggest.nansei ? projectInset : projectMain;
      const [cx, cy] = proj([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
      return { code, name: names.get(code)!, d, cx: Math.round(cx), cy: Math.round(cy) };
    });
  return { map: { width: VIEW_W, height, inset, prefs }, frame: { main, nansei } };
}

// ───────── 市区町村の地図（都道府県ごと）─────────

export type MuniMap = {
  width: number;
  height: number;
  munis: { code: string; d: string }[];
};

function bboxGapKm(a: number[], b: number[]): number {
  const lat = (a[1] + a[3] + b[1] + b[3]) / 4;
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]) * 111.32 * Math.cos(lat * RAD);
  const dy = Math.max(0, a[1] - b[3], b[1] - a[3]) * 110.57;
  return Math.hypot(dx, dy);
}

type Viewport = { x0: number; y0: number; x1: number; y1: number; widthKm: number; heightKm: number };

/** 描く範囲。本土（いちばん大きい陸地）と、駅のある島、本土のすぐ近くの大きな島を入れる。 */
function muniViewport(prefOutline: Feature, stations: Coord[]): Viewport {
  const outline = polygonsOf(prefOutline).map((poly) => ({
    ring: poly[0],
    bbox: ringBbox(poly[0]),
    area: ringAreaKm2(poly[0]),
  }));
  outline.sort((a, b) => b.area - a.area);
  const mainland = outline[0];
  const kept = outline.filter(
    (o) =>
      o === mainland ||
      stations.some((s) => pointInRing(s, o.ring)) ||
      (o.area >= 100 && bboxGapKm(o.bbox, mainland.bbox) <= 20),
  );
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const k of kept) {
    x0 = Math.min(x0, k.bbox[0]);
    y0 = Math.min(y0, k.bbox[1]);
    x1 = Math.max(x1, k.bbox[2]);
    y1 = Math.max(y1, k.bbox[3]);
  }
  const lat0 = (y0 + y1) / 2;
  return {
    x0, y0, x1, y1,
    widthKm: (x1 - x0) * 111.32 * Math.cos(lat0 * RAD),
    heightKm: (y1 - y0) * 110.57,
  };
}

function buildMuniMap(muniFeats: Feature[], view: Viewport): MuniMap {
  const { x0, y0, x1, y1 } = view;
  const lat0 = (y0 + y1) / 2;
  const kx = Math.cos(lat0 * RAD);
  const pad = 12;
  const w = (x1 - x0) * kx;
  const h = y1 - y0;
  // 縦長すぎる県でも画面に収まるよう、高さは幅の1.25倍まで
  const scale = Math.min((VIEW_W - pad * 2) / w, (VIEW_W * 1.25 - pad * 2) / h);
  const width = VIEW_W;
  const height = Math.ceil(h * scale + pad * 2);
  const offsetX = (width - w * scale) / 2;
  const project = (c: Coord): [number, number] => [
    offsetX + (c[0] - x0) * kx * scale,
    pad + (y1 - c[1]) * scale,
  ];
  const eps = 0.02;
  const inView = (b: number[]) =>
    b[0] >= x0 - eps && b[2] <= x1 + eps && b[1] >= y0 - eps && b[3] <= y1 + eps;

  const munis = muniFeats
    .map((f) => {
      const polys = polygonsOf(f).filter((poly) => inView(ringBbox(poly[0])));
      return {
        code: String(f.properties.N03_007).padStart(5, '0'),
        d: polys.map((poly) => ringsToPath(poly, project)).join(''),
      };
    })
    .filter((m) => m.d !== '' && !isUnassigned(m.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return { width, height, munis };
}

export function buildMapShapes(
  shp: string,
  stationsByPref: Map<number, Coord[]>,
): { japanBytes: number; muniBytes: number } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ekilog-map-'));
  const prefFile = path.join(tmp, 'pref.geojson');
  const muniFile = path.join(tmp, 'muni.geojson');
  const outlineFile = path.join(tmp, 'outline.geojson');
  const prefExpr = 'pref = N03_007 ? String(N03_007).substring(0, 2) : null';
  // mapshaper は「簡略化」と「まとめる」を1回の実行で続けると簡略化が効かないことがあるので、
  // 途中の結果をいったんファイルに書き出して、段階ごとに実行する。
  const rawFile = path.join(tmp, 'raw.geojson');
  // 1. 境界を共有したまま簡略化（市区町村の地図の細かさ）
  mapshaper([
    '-i', shp, 'encoding=utf8',
    '-each', prefExpr,
    '-filter', '!!pref',
    '-simplify', 'interval=100',
    '-o', 'precision=0.00001', rawFile,
  ]);
  // 2. 市区町村ごと、都道府県ごとにまとめる
  mapshaper([
    '-i', rawFile,
    '-dissolve2', 'N03_007', 'copy-fields=pref,N03_001',
    '-filter-islands', 'min-area=2km2',
    '-clean',
    '-o', 'precision=0.0001', muniFile,
    '-dissolve2', 'pref', 'copy-fields=N03_001',
    '-o', 'precision=0.0001', outlineFile,
  ]);
  // 3. 日本地図：都道府県の形をさらに粗く簡略化
  mapshaper([
    '-i', outlineFile,
    '-simplify', 'interval=1100',
    '-filter-islands', 'min-area=30km2',
    '-clean',
    '-o', 'precision=0.001', prefFile,
  ]);

  // 4. 拡大表示用の細かい日本地図
  const prefDetailFile = path.join(tmp, 'pref-detail.geojson');
  mapshaper([
    '-i', outlineFile,
    '-simplify', 'interval=350',
    '-filter-islands', 'min-area=4km2',
    '-clean',
    '-o', 'precision=0.0005', prefDetailFile,
  ]);

  fs.mkdirSync(path.join(OUT_MAP_DIR, 'muni'), { recursive: true });
  const japan = buildJapan(prefFile);
  const japanJson = JSON.stringify(japan.map);
  fs.writeFileSync(path.join(OUT_MAP_DIR, 'japan.json'), japanJson);
  const detail = buildJapan(prefDetailFile, japan.frame);
  fs.writeFileSync(path.join(OUT_MAP_DIR, 'japan-detail.json'), JSON.stringify(detail.map));

  const outlines = new Map(readFeatures(outlineFile).map((f) => [Number(f.properties.pref), f]));
  let muniBytes = 0;
  for (const [code, outline] of [...outlines].sort((a, b) => a[0] - b[0])) {
    const view = muniViewport(outline, stationsByPref.get(code) ?? []);
    // 広い県ほど粗くしてよい（画面の1点が表す距離が長いので）。県の幅 1km につき 1.5m。
    const extentKm = Math.max(view.widthKm, view.heightKm / 1.25);
    const interval = Math.round(Math.min(1000, Math.max(100, extentKm * 1.5)));
    const pref2 = String(code).padStart(2, '0');
    const coarse = path.join(tmp, `muni-${pref2}.geojson`);
    mapshaper([
      '-i', muniFile,
      '-filter', `pref == "${pref2}"`,
      '-simplify', `interval=${interval}`,
      '-clean',
      '-o', 'precision=0.0001', coarse,
    ]);
    const feats = readFeatures(coarse);
    const json = JSON.stringify(buildMuniMap(feats, view));
    muniBytes += json.length;
    fs.writeFileSync(path.join(OUT_MAP_DIR, 'muni', `${pref2}.json`), json);
  }
  // アプリから都道府県コードで引けるように、読み込み口をまとめたファイルも書き出す
  const codes = [...outlines.keys()].sort((a, b) => a - b);
  fs.writeFileSync(
    OUT_MUNI_INDEX,
    `// npm run build:master -- --map が書き出す。手で編集しない。\n` +
      `import type { MuniMapData } from '../ui/maps/types';\n\n` +
      `/** 都道府県ごとの市区町村の地図。開いた県のぶんだけ読み込む。 */\n` +
      `export const MUNI_MAPS: Record<number, () => MuniMapData> = {\n` +
      codes
        .map((c) => `  ${c}: () => require('../../assets/map/muni/${String(c).padStart(2, '0')}.json'),\n`)
        .join('') +
      `};\n`,
  );
  fs.rmSync(tmp, { recursive: true });
  return { japanBytes: japanJson.length, muniBytes };
}
