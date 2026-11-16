/**
 * データベースを開く。
 *
 *  - 記録DB（ekilog.db）   … ユーザーの記録。マイグレーションで育てる
 *  - 駅マスタ（stations.db）… アプリに同梱。版が変わっていたら丸ごと入れ替える
 *
 * 駅マスタは記録DBに `master` として ATTACH するので、達成率などは1本のSQLで数えられる。
 * 駅マスタを入れ替えても記録DBには触らないので、記録は消えない。
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as SQLite from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { MASTER_VERSION } from '../data/masterVersion';
import { type Db, schema } from './types';

const RECORDS_DB = 'ekilog.db';
const MASTER_DB = 'stations.db';

let opening: Promise<Db> | null = null;

async function installedMasterVersion(): Promise<string | null> {
  try {
    const db = await SQLite.openDatabaseAsync(MASTER_DB);
    try {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM meta WHERE key = 'version'",
      );
      return row?.value ?? null;
    } finally {
      await db.closeAsync();
    }
  } catch {
    return null;
  }
}

async function open(): Promise<Db> {
  if ((await installedMasterVersion()) !== MASTER_VERSION) {
    await SQLite.importDatabaseFromAssetAsync(MASTER_DB, {
      assetId: require('../../assets/db/stations.db'),
      forceOverwrite: true,
    });
  }
  const client = await SQLite.openDatabaseAsync(RECORDS_DB);
  await client.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const masterPath = `${SQLite.defaultDatabaseDirectory}/${MASTER_DB}`.replace(/'/g, "''");
  await client.execAsync(`ATTACH DATABASE '${masterPath}' AS master`);
  const db = drizzle(client, { schema });
  await migrate(db, migrations);
  return db;
}

/** データベースを開く。画面からもバックグラウンドのタスクからも、同じ接続を使い回す。 */
export function ensureDb(): Promise<Db> {
  if (!opening) {
    opening = open().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}
