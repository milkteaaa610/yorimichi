/**
 * 駅マスタ（assets/db/stations.db）のテーブル。アプリからは読むだけ。
 * 列は scripts/build-master/schema.sql と合わせる。
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const prefectures = sqliteTable('prefectures', {
  code: integer('code').primaryKey(),
  name: text('name').notNull(),
  muniCount: integer('muni_count').notNull(),
  stationCount: integer('station_count').notNull(),
});

export const municipalities = sqliteTable('municipalities', {
  code: text('code').primaryKey(),
  prefCode: integer('pref_code').notNull(),
  name: text('name').notNull(),
  city: text('city'),
  county: text('county'),
  kind: text('kind', { enum: ['special-ward', 'ward', 'city', 'town', 'village'] }).notNull(),
  hasStation: integer('has_station', { mode: 'boolean' }).notNull(),
  stationCount: integer('station_count').notNull(),
});

export const operators = sqliteTable('operators', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  kind: integer('kind').notNull(),
  badgeStyle: text('badge_style'),
  badgeFont: text('badge_font'),
  sort: integer('sort').notNull(),
});

export const lines = sqliteTable('lines', {
  id: integer('id').primaryKey(),
  operatorId: integer('operator_id').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  color: text('color'),
  ink: text('ink'),
  isLoop: integer('is_loop', { mode: 'boolean' }).notNull(),
  stationCount: integer('station_count').notNull(),
  sort: integer('sort').notNull(),
});

export const stations = sqliteTable('stations', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  kana: text('kana'),
  romaji: text('romaji'),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  prefCode: integer('pref_code').notNull(),
  muniCode: text('muni_code').notNull(),
  underground: integer('underground', { mode: 'boolean' }).notNull(),
});

export const stationLines = sqliteTable('station_lines', {
  stationId: integer('station_id').notNull(),
  lineId: integer('line_id').notNull(),
  number: text('number'),
  seq: integer('seq').notNull(),
  seg: integer('seg').notNull(),
});

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Station = typeof stations.$inferSelect;
export type Line = typeof lines.$inferSelect;
export type Operator = typeof operators.$inferSelect;
export type Municipality = typeof municipalities.$inferSelect;
export type Prefecture = typeof prefectures.$inferSelect;
