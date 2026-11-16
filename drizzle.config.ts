import type { Config } from 'drizzle-kit';

// 記録DB（ekilog.db）のマイグレーション。スキーマを変えたら `npm run db:generate` を実行する。
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
