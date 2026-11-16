/** 日付の表示。記録の日付は「YYYY-MM-DD」の文字列で持つ（時差でずれないように）。 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 2026年11月16日（月） */
export function formatLong(key: string): string {
  const d = fromDateKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 今年なら「11月10日」、それ以外は「2024年8月12日」 */
export function formatShort(key: string, now = new Date()): string {
  const d = fromDateKey(key);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

/** 2026.11.10 */
export function formatDotted(key: string): string {
  const d = fromDateKey(key);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 11月16日（月） */
export function formatMonthDay(key: string): string {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 10:41 */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function isToday(key: string, now = new Date()): boolean {
  return key === toDateKey(now);
}

export const KIND_LABEL = { got_off: '降りた', transfer: '乗り換え', pass: '通過' } as const;
