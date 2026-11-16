/** 設定の読み書き。値は settings テーブルに JSON で入れる。 */
import { eq } from 'drizzle-orm';

import { settings } from './schema';
import type { Db } from './types';

export type AutoMode = 'confirm' | 'instant';

export type Settings = {
  /** 自動チェックイン */
  autoEnabled: boolean;
  /** 確認してから記録／すぐに記録 */
  autoMode: AutoMode;
  /** 乗り換えも記録する */
  autoTransfer: boolean;
  /** 通過した駅も記録する（v1.1） */
  autoPass: boolean;
  /** 「降りた」と判定する時間（分） */
  dwellMinutes: number;
  /** 省電力モード */
  batterySaver: boolean;
  /** 記録するとき、近くで撮った写真を提案する */
  suggestPhotos: boolean;
  /** 共有するとき撮影場所を消す */
  stripLocationOnShare: boolean;
  /** 「通過」を達成率に数える */
  countPass: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  autoEnabled: false,
  autoMode: 'confirm',
  autoTransfer: true,
  autoPass: false,
  dwellMinutes: 5,
  batterySaver: false,
  suggestPhotos: true,
  stripLocationOnShare: true,
  countPass: false,
};

export const DWELL_OPTIONS = [3, 5, 10] as const;

export function loadSettings(db: Db): Settings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of db.select().from(settings).all()) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      // 壊れた値は初期値のままにする
    }
  }
  return out as Settings;
}

export function saveSetting<K extends keyof Settings>(db: Db, key: K, value: Settings[K]): void {
  const json = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } })
    .run();
}

/** 設定以外の小さな状態（自動チェックインの途中経過など）を入れる。 */
export function getState<T>(db: Db, key: string): T | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function setState(db: Db, key: string, value: unknown): void {
  const json = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } })
    .run();
}

export function clearState(db: Db, key: string): void {
  db.delete(settings).where(eq(settings.key, key)).run();
}
