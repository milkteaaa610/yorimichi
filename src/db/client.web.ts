/**
 * データベースを開く（Web 版）。ブラウザで画面を確かめるための実装。
 *
 * iOS・Android は client.ts（expo-sqlite）を使う。Web では sql.js をメモリ上で動かし、
 * 駅マスタを読み込んだ同じデータベースの中に記録のテーブルを作る。
 * 記録はブラウザの localStorage に書き出して、開き直しても残るようにする。
 */
import { drizzle } from 'drizzle-orm/sql-js';
import { Asset } from 'expo-asset';
import initSqlJs, { type Database } from 'sql.js';

import migrations from '../../drizzle/migrations';
import { subscribeDataChanged } from './events';
import { type Db, schema } from './types';

const STORAGE_KEY = 'ekilog.records';
const RECORD_TABLES = ['visits', 'photos', 'auto_candidates', 'excluded_stations', 'settings'];

let opening: Promise<Db> | null = null;

function applyMigrations(client: Database): void {
  const entries = [...migrations.journal.entries].sort((a, b) => a.idx - b.idx);
  for (const entry of entries) {
    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const sqlText = (migrations.migrations as Record<string, string>)[key];
    for (const statement of sqlText.split('--> statement-breakpoint')) {
      if (statement.trim() !== '') client.run(statement);
    }
  }
}

function restore(client: Database): void {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const dump = JSON.parse(saved) as Record<string, Record<string, unknown>[]>;
    for (const table of RECORD_TABLES) {
      for (const row of dump[table] ?? []) {
        const cols = Object.keys(row);
        client.run(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] as string | number | null),
        );
      }
    }
  } catch (e) {
    console.warn('保存された記録を読み込めませんでした', e);
  }
}

function save(client: Database): void {
  const dump: Record<string, Record<string, unknown>[]> = {};
  for (const table of RECORD_TABLES) {
    const result = client.exec(`SELECT * FROM ${table}`)[0];
    dump[table] = result
      ? result.values.map((row) => Object.fromEntries(result.columns.map((c, i) => [c, row[i]])))
      : [];
  }
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(dump));
  } catch (e) {
    console.warn('記録を保存できませんでした', e);
  }
}

async function open(): Promise<Db> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wasm = Asset.fromModule(require('sql.js/dist/sql-wasm-browser.wasm')).uri;
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const masterUri = Asset.fromModule(require('../../assets/db/stations.db')).uri;
  const bytes = new Uint8Array(await (await fetch(masterUri)).arrayBuffer());
  const client = new SQL.Database(bytes);
  client.run('PRAGMA foreign_keys = ON');
  applyMigrations(client);
  restore(client);
  let timer: ReturnType<typeof setTimeout> | null = null;
  subscribeDataChanged(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => save(client), 200);
  });
  return drizzle(client, { schema }) as unknown as Db;
}

export function ensureDb(): Promise<Db> {
  if (!opening) {
    opening = open().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}
