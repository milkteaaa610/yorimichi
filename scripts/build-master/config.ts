/** 駅マスタ生成の設定。データの版を上げるときはここを変える。 */
export const N02_EDITION = '25';
export const N03_EDITION = '20260101';

export const N02_URL = `https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-${N02_EDITION}/N02-${N02_EDITION}_GML.zip`;
export const N03_URL = `https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-${N03_EDITION.slice(0, 4)}/N03-${N03_EDITION}_GML.zip`;

/** ダウンロードした元データの置き場所（git には入れない） */
export const CACHE_DIR = '.cache/ksj';

/** 出力先 */
export const OUT_DB = 'assets/db/stations.db';
export const OUT_MAP_DIR = 'assets/map';
export const OUT_VERSION = 'src/data/masterVersion.ts';
export const OUT_MUNI_INDEX = 'src/data/muniMaps.ts';

/** 入力（リポジトリで管理する自前データ） */
export const DATA_DIR = 'data';

export const USER_AGENT = 'ekilog-build/1.0 (station master build script)';
