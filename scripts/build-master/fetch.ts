/** 国土数値情報（N02・N03）を .cache/ksj に用意する。すでにあれば何もしない。 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { CACHE_DIR, N02_EDITION, N02_URL, N03_EDITION, N03_URL, USER_AGENT } from './config';

async function download(url: string, dest: string): Promise<void> {
  console.log(`  ダウンロード: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`ダウンロードに失敗しました（${res.status}）: ${url}`);
  const file = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    await new Promise<void>((resolve, reject) =>
      file.write(value, (err) => (err ? reject(err) : resolve())),
    );
  }
  await new Promise<void>((resolve) => file.end(resolve));
}

function unzip(zip: string, members: string[], dir: string): void {
  // -j: フォルダ構造を無視して取り出す
  execFileSync('unzip', ['-o', '-j', zip, ...members, '-d', dir], { stdio: 'ignore' });
}

export async function ensureSources(): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const n02 = [`N02-${N02_EDITION}_Station.geojson`, `N02-${N02_EDITION}_RailroadSection.geojson`];
  if (!n02.every((f) => fs.existsSync(path.join(CACHE_DIR, f)))) {
    const zip = path.join(CACHE_DIR, 'n02.zip');
    await download(N02_URL, zip);
    unzip(zip, n02.map((f) => `N02-${N02_EDITION}_GML/UTF-8/${f}`), CACHE_DIR);
    fs.rmSync(zip);
  }

  const n03 = ['shp', 'dbf', 'shx', 'prj', 'cpg'].map((ext) => `N03-${N03_EDITION}.${ext}`);
  if (!n03.every((f) => fs.existsSync(path.join(CACHE_DIR, f)))) {
    const zip = path.join(CACHE_DIR, 'n03.zip');
    await download(N03_URL, zip);
    unzip(zip, n03, CACHE_DIR);
    fs.rmSync(zip);
  }
}

export function n03Shapefile(): string {
  return path.join(CACHE_DIR, `N03-${N03_EDITION}.shp`);
}
