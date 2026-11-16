#!/usr/bin/env bash
# ファイルを編集するたびに、型チェックと lint を走らせる（docs/SPEC.md 8.1）。
# 問題があれば終了コード 2 で Claude に知らせる。
set -u
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path??"")}catch{}})')
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
cd "$(dirname "$0")/../.." || exit 0
out=$(npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  printf '型チェックでエラーが出ました:\n%s\n' "$out" | head -40 >&2
  exit 2
fi
out=$(npx eslint --max-warnings=0 "$file" 2>&1)
if [ $? -ne 0 ]; then
  printf 'lint でエラーが出ました:\n%s\n' "$out" | head -40 >&2
  exit 2
fi
exit 0
