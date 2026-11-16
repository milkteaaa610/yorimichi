-- 駅マスタ（assets/db/stations.db）のテーブル。アプリからは読むだけ。
-- 列を変えたら src/db/masterSchema.ts も合わせる。

CREATE TABLE prefectures (
  code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  muni_count INTEGER NOT NULL,     -- 駅のある市区町村の数（達成率の分母）
  station_count INTEGER NOT NULL
);

CREATE TABLE municipalities (
  code TEXT PRIMARY KEY,           -- 全国地方公共団体コード（5けた）
  pref_code INTEGER NOT NULL,
  name TEXT NOT NULL,              -- 政令指定都市の区は区の名前
  city TEXT,                       -- 政令指定都市の区なら市の名前
  county TEXT,
  kind TEXT NOT NULL,              -- special-ward / ward / city / town / village
  has_station INTEGER NOT NULL,
  station_count INTEGER NOT NULL
);

CREATE TABLE operators (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind INTEGER NOT NULL,           -- 1=新幹線 2=JR 3=公営 4=民営 5=第三セクター
  badge_style TEXT,                -- ナンバリングの形の上書き（なければ路線記号から判定）
  badge_font TEXT,
  sort INTEGER NOT NULL
);

CREATE TABLE lines (
  id INTEGER PRIMARY KEY,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  name TEXT NOT NULL,
  code TEXT,                       -- 路線記号（JY など）
  color TEXT,
  ink TEXT,                        -- ナンバリングの文字色（枠の色と違うとき）
  is_loop INTEGER NOT NULL,
  station_count INTEGER NOT NULL,
  sort INTEGER NOT NULL
);

CREATE TABLE stations (
  id INTEGER PRIMARY KEY,          -- アプリ独自の駅ID（data/station_ids.csv）
  name TEXT NOT NULL,
  kana TEXT,
  romaji TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  pref_code INTEGER NOT NULL,
  muni_code TEXT NOT NULL,
  underground INTEGER NOT NULL
);

CREATE TABLE station_lines (
  station_id INTEGER NOT NULL REFERENCES stations(id),
  line_id INTEGER NOT NULL REFERENCES lines(id),
  number TEXT,                     -- ナンバリングの番号（17 など）。なければ NULL
  seq INTEGER NOT NULL,            -- 路線内の並び順
  seg INTEGER NOT NULL,            -- 枝分かれの区間番号
  PRIMARY KEY (line_id, seq)
);

CREATE INDEX station_lines_station ON station_lines (station_id);
CREATE INDEX stations_pref ON stations (pref_code);
CREATE INDEX stations_muni ON stations (muni_code);
CREATE INDEX municipalities_pref ON municipalities (pref_code);
CREATE INDEX lines_operator ON lines (operator_id);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
