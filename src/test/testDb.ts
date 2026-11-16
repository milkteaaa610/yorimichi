/**
 * テスト用のデータベース。同梱の駅マスタ（stations.db）をメモリに読み込み、
 * その中に記録DBのテーブルをマイグレーションで作る（アプリでは ATTACH している2つを1つにまとめた形）。
 */
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { getMaster } from '../data/master';
import { type Db, schema } from '../db/types';

const ROOT = path.resolve(__dirname, '../..');
const MASTER_BYTES = fs.readFileSync(path.join(ROOT, 'assets/db/stations.db'));

function migrationSql(): string[] {
  const dir = path.join(ROOT, 'drizzle');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('--> statement-breakpoint'))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createTestDb() {
  const client = new Database(MASTER_BYTES);
  client.pragma('foreign_keys = ON');
  for (const statement of migrationSql()) client.exec(statement);
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, client, master: getMaster(db) };
}
