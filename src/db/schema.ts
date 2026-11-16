/**
 * 記録DB（ekilog.db）のテーブル。ユーザーの記録はすべてここに入る。
 * 変更したら `npm run db:generate` でマイグレーションを作る（手で ALTER しない）。
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const VISIT_KINDS = ['got_off', 'transfer', 'pass'] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

export const VISIT_SOURCES = ['manual', 'bulk', 'auto', 'photo'] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

export const CANDIDATE_STATUSES = ['pending', 'recorded', 'dismissed'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

/** 記録。1回の訪問が1行。 */
export const visits = sqliteTable(
  'visits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** 駅マスタ（stations.db）の駅ID */
    stationId: integer('station_id').notNull(),
    kind: text('kind', { enum: VISIT_KINDS }).notNull(),
    /** 訪れた日（YYYY-MM-DD）。まとめて登録では日付なしも可 */
    visitedOn: text('visited_on'),
    source: text('source', { enum: VISIT_SOURCES }).notNull(),
    memo: text('memo'),
    /** 記録を作った時刻（ミリ秒） */
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('visits_station_idx').on(t.stationId), index('visits_date_idx').on(t.visitedOn)],
);

/** 記録に付けた写真。写真そのものは持たず、端末の写真ライブラリのIDを持つ。 */
export const photos = sqliteTable(
  'photos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    visitId: integer('visit_id')
      .notNull()
      .references(() => visits.id, { onDelete: 'cascade' }),
    /** 写真ライブラリのID。取れなかった写真は NULL で、uri にアプリ内のコピーを持つ */
    assetId: text('asset_id'),
    uri: text('uri'),
    takenAt: integer('taken_at'),
    lat: real('lat'),
    lng: real('lng'),
  },
  (t) => [index('photos_visit_idx').on(t.visitId)],
);

/** 自動チェックインの候補。確認されるまでは記録（visits）に入れない。 */
export const autoCandidates = sqliteTable(
  'auto_candidates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    stationId: integer('station_id').notNull(),
    detectedAt: integer('detected_at').notNull(),
    kindGuess: text('kind_guess', { enum: VISIT_KINDS }).notNull(),
    dwellSec: integer('dwell_sec').notNull(),
    status: text('status', { enum: CANDIDATE_STATUSES }).notNull().default('pending'),
    /** 記録したときの visits.id */
    visitId: integer('visit_id'),
  },
  (t) => [index('auto_candidates_status_idx').on(t.status, t.detectedAt)],
);

/** 自動記録から外す駅（毎日使う駅など）。 */
export const excludedStations = sqliteTable('excluded_stations', {
  stationId: integer('station_id').primaryKey(),
});

/** 設定。値は JSON 文字列。 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type AutoCandidate = typeof autoCandidates.$inferSelect;
