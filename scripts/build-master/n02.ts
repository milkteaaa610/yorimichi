/**
 * 国土数値情報 鉄道データ（N02）の読み込み。
 * 駅は「グループコード」（300m以内の同名の駅）でまとめ、乗換駅を1駅として扱う。
 */
import fs from 'node:fs';
import path from 'node:path';

export type Coord = [number, number]; // [lng, lat]

export type N02StationFeature = {
  op: string;
  line: string;
  name: string;
  code: string;
  group: string;
  opType: number; // 1=新幹線 2=JR在来線 3=公営 4=民営 5=第三セクター
  railType: number;
  coords: Coord[];
};

export type N02Section = {
  op: string;
  line: string;
  coords: Coord[];
};

export type N02Data = {
  stations: N02StationFeature[];
  sections: N02Section[];
};

type RawFeature = {
  properties: Record<string, string>;
  geometry: { type: string; coordinates: Coord[] };
};

function readFeatures(file: string): RawFeature[] {
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: RawFeature[] };
  return json.features;
}

export function loadN02(cacheDir: string, edition: string): N02Data {
  const stationFile = path.join(cacheDir, `N02-${edition}_Station.geojson`);
  const sectionFile = path.join(cacheDir, `N02-${edition}_RailroadSection.geojson`);
  const stations = readFeatures(stationFile).map((f) => ({
    op: f.properties.N02_004,
    line: f.properties.N02_003,
    name: f.properties.N02_005,
    code: f.properties.N02_005c,
    group: f.properties.N02_005g,
    opType: Number(f.properties.N02_002),
    railType: Number(f.properties.N02_001),
    coords: f.geometry.coordinates,
  }));
  const sections = readFeatures(sectionFile).map((f) => ({
    op: f.properties.N02_004,
    line: f.properties.N02_003,
    coords: f.geometry.coordinates,
  }));
  return { stations, sections };
}

export function lineKey(op: string, line: string): string {
  return `${op}\t${line}`;
}

const R = 6371008.8;
const RAD = Math.PI / 180;

/** 2点間の距離（m）。 */
export function haversine(a: Coord, b: Coord): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 折れ線の中点（長さの半分の位置）。 */
export function midpoint(coords: Coord[]): Coord {
  if (coords.length === 1) return coords[0];
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const l = haversine(coords[i - 1], coords[i]);
    lens.push(l);
    total += l;
  }
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= total / 2) {
      const t = lens[i] === 0 ? 0 : (total / 2 - acc) / lens[i];
      return [
        coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
        coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t,
      ];
    }
    acc += lens[i];
  }
  return coords[coords.length - 1];
}
