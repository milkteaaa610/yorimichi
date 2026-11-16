/**
 * 画面にデータベースを渡す。
 *
 * 記録が変わったら version が1つ進み、useLive で読んでいる画面が読み直す。
 * クエリは同期で数ミリ秒なので、読み込み中の表示は持たない。
 */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { type MasterData, getMaster } from '../data/master';
import { ensureDb } from './client';
import { getDataVersion, notifyDataChanged, subscribeDataChanged } from './events';
import { type Settings, loadSettings, saveSetting } from './settings';
import type { Db } from './types';

type AppData = { db: Db; master: MasterData };

const DbContext = createContext<AppData | null>(null);

export { notifyDataChanged };

export function DbProvider({
  children,
  fallback = null,
  onReady,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  onReady?: () => void;
}) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    ensureDb()
      .then((db) => {
        if (!alive) return;
        setData({ db, master: getMaster(db) });
        onReady?.();
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
    // 起動時に1回だけ開く
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アプリを開き直したとき、閉じている間の自動チェックインを反映する
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') notifyDataChanged();
    });
    return () => sub.remove();
  }, []);

  if (error) throw error;
  if (!data) return <>{fallback}</>;
  return <DbContext.Provider value={data}>{children}</DbContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('DbProvider の外で useAppData が呼ばれました');
  return ctx;
}

export function useDb(): Db {
  return useAppData().db;
}

export function useMaster(): MasterData {
  return useAppData().master;
}

/** データベースから読む。記録が変わるたびに読み直す。 */
export function useLive<T>(read: (db: Db, master: MasterData) => T, deps: unknown[] = []): T {
  const { db, master } = useAppData();
  const v = useSyncExternalStore(subscribeDataChanged, getDataVersion, getDataVersion);
  // read は毎回新しい関数なので依存に入れない（deps で指定する）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => read(db, master), [db, master, v, ...deps]);
}

/** データベースに書く。書いたあと、読んでいる画面に知らせる。 */
export function useMutate(): <T>(write: (db: Db) => T) => T {
  const db = useDb();
  return useCallback(
    (write) => {
      const result = write(db);
      notifyDataChanged();
      return result;
    },
    [db],
  );
}

export function useSettings(): [Settings, <K extends keyof Settings>(key: K, value: Settings[K]) => void] {
  const settings = useLive((db) => loadSettings(db));
  const mutate = useMutate();
  const set = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => mutate((db) => saveSetting(db, key, value)),
    [mutate],
  );
  return [settings, set];
}
