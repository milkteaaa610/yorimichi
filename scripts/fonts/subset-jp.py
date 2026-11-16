"""
Noto Sans JP を、アプリで使う文字だけに絞る（1つの太さで 5.6MB → 約2MB）。

  python3 scripts/fonts/subset-jp.py   （fonttools が必要: pip install fonttools）

入れる文字：JIS 第1・第2水準（かな・漢字・記号）、ASCII、駅名・市区町村名・読みがなに出てくる文字、
src/ の画面の文字。入っていない文字は、端末の日本語フォントで表示される（iOS・Android とも自動）。
"""
import os
import re
import sqlite3
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'noto-sans-jp')
OUT = os.path.join(ROOT, 'assets', 'fonts')
WEIGHTS = ['400Regular', '500Medium', '700Bold']


def jis_chars():
    chars = set()
    for hi in range(0xA1, 0xFF):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('euc_jp'))
            except UnicodeDecodeError:
                pass
    return chars


def data_chars():
    chars = set()
    db = sqlite3.connect(os.path.join(ROOT, 'assets', 'db', 'stations.db'))
    for table, cols in [('stations', ['name', 'kana']), ('municipalities', ['name', 'city', 'county']),
                        ('lines', ['name']), ('operators', ['name']), ('prefectures', ['name'])]:
        for row in db.execute(f"SELECT {', '.join(cols)} FROM {table}"):
            for v in row:
                if v:
                    chars.update(v)
    for dirpath, _, files in os.walk(os.path.join(ROOT, 'src')):
        for f in files:
            if f.endswith(('.ts', '.tsx')):
                chars.update(open(os.path.join(dirpath, f), encoding='utf-8').read())
    return chars


def main():
    chars = jis_chars() | data_chars() | {chr(c) for c in range(0x20, 0x7F)}
    chars |= set('　、。・ー〜「」『』（）！？％＋－／：　…‥ヶヵ々〆〇')
    chars = {c for c in chars if not re.match(r'[\x00-\x1f]', c)}
    text_file = os.path.join(OUT, '.jp-chars.txt')
    os.makedirs(OUT, exist_ok=True)
    with open(text_file, 'w', encoding='utf-8') as f:
        f.write(''.join(sorted(chars)))
    pyftsubset = os.environ.get('PYFTSUBSET', 'pyftsubset')
    for w in WEIGHTS:
        src = os.path.join(SRC, w, f'NotoSansJP_{w}.ttf')
        dst = os.path.join(OUT, f'NotoSansJP-{w}-Subset.ttf')
        subprocess.run([pyftsubset, src, f'--text-file={text_file}', f'--output-file={dst}',
                        '--layout-features=palt,kern,liga,vert', '--no-hinting'], check=True)
        print(f'{w}: {os.path.getsize(dst) / 1024:.0f}KB')
    os.remove(text_file)
    print(f'{len(chars)} 文字')


if __name__ == '__main__':
    sys.exit(main())
