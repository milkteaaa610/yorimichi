/** 地図データの読み込み。日本地図は起動後に1回、市区町村は開いた県のぶんだけ読む。 */
import { MUNI_MAPS } from '../../data/muniMaps';
import type { Region } from './RegionMap';
import type { JapanMapData, MuniMapData } from './types';

let japan: { data: JapanMapData; regions: Region[]; guide: string } | null = null;

export function getJapanMap() {
  if (!japan) {
    const data = require('../../../assets/map/japan.json') as JapanMapData;
    japan = {
      data,
      regions: data.prefs.map((p) => ({ id: String(p.code), d: p.d, label: p.name })),
      // 南西諸島の枠（右と下の線）
      guide: `M${data.inset.width} 0V${data.inset.height}H0`,
    };
  }
  return japan;
}

const muniCache = new Map<number, { data: MuniMapData; regions: Region[] }>();

export function getMuniMap(prefCode: number, nameOf: (code: string) => string) {
  let hit = muniCache.get(prefCode);
  if (!hit) {
    const load = MUNI_MAPS[prefCode];
    if (!load) return null;
    const data = load();
    hit = { data, regions: data.munis.map((m) => ({ id: m.code, d: m.d, label: nameOf(m.code) })) };
    muniCache.set(prefCode, hit);
  }
  return hit;
}
