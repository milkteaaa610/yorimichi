/** 記録や設定が変わったことを、読んでいる画面に知らせる仕組み。 */

let version = 0;
const listeners = new Set<() => void>();

/** 記録や設定が変わったことを知らせる。バックグラウンドのタスクからも呼べる。 */
export function notifyDataChanged(): void {
  version++;
  for (const l of listeners) l();
}

export function subscribeDataChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getDataVersion = () => version;
