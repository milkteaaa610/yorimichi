import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as master from './masterSchema';
import * as records from './schema';

export const schema = { ...records, ...master };
export type Schema = typeof schema;

/**
 * アプリ（expo-sqlite）とテスト（better-sqlite3）の両方で使えるデータベースの型。
 * 記録DBに駅マスタを `master` として ATTACH してあり、両方のテーブルを同じ接続から読める。
 */
export type Db = BaseSQLiteDatabase<'sync', any, Schema>;
