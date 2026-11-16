/** scripts/build-master/mapshapes.ts が書き出す地図データの形。 */

export type JapanMapData = {
  width: number;
  height: number;
  /** 南西諸島を移して描く、左上の枠 */
  inset: { x: number; y: number; width: number; height: number };
  prefs: { code: number; name: string; d: string; cx: number; cy: number }[];
};

export type MuniMapData = {
  width: number;
  height: number;
  munis: { code: string; d: string }[];
};
