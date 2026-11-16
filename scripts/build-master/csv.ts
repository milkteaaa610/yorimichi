/** 小さなCSV読み書き。先頭行は見出し。# で始まる行と空行は読み飛ばす。 */
import fs from 'node:fs';

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const pushRow = () => {
    row.push(cell);
    cell = '';
    if (!(row.length === 1 && row[0].trim() === '') && !row[0].startsWith('#')) rows.push(row);
    row = [];
  };
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      pushRow();
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) pushRow();
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

export function readCsv(file: string): Record<string, string>[] {
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

function escapeCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(
  file: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
  comment?: string,
): void {
  const lines = rows.map((r) => r.map(escapeCell).join(','));
  const head = comment ? [`# ${comment}`, header.join(',')] : [header.join(',')];
  fs.writeFileSync(file, [...head, ...lines].join('\n') + '\n');
}
