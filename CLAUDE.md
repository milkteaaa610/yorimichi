# エキログ
- 仕様: docs/SPEC.md ／ 画面: デザインキャンバス（docs/SPEC.md 冒頭のリンク）と docs/screenshots/*.png
- 構成と判断の記録: README.md

# コマンド
- 型チェック: npm run typecheck
- lint: npm run lint
- テスト: npm test -- <ファイル>
- 起動: npx expo run:ios ／ npx expo run:android （開発ビルド。Expo Goは使わない）
- 画面の確認（ブラウザ）: npm run web
- 駅マスタの再生成: npm run build:master （地図の形も作り直すときは -- --map）
- 記録DBのマイグレーション: npm run db:generate
- E2E: maestro test e2e/

# ルール
- 画面の文字は Text（src/ui/Text.tsx）で描く。英数字は Geologica、日本語は Noto Sans JP に自動で分かれる
- 駅ナンバリングは NumberingBadge だけで描く。形・書体は src/data/operatorStyles.ts の表、色と番号は data/numbering/*.csv で決める
- assets/db/stations.db・assets/map・src/data/masterVersion.ts・src/data/muniMaps.ts は手で編集しない（npm run build:master で作り直す）
- data/station_ids.csv は駅IDの台帳。消さない（記録が別の駅を指してしまう）
- 記録DBの変更は必ず src/db/schema.ts を直してマイグレーションで行う
- 達成率は保存しない。src/db/queries.ts で visits と駅マスタから数える
- 自動チェックインの判定は src/auto/ に置き、変えたら必ず src/auto/__tests__ にテストを足す
- 画面は src/app（Expo Router）。画面以外のコードを src/app に置かない
