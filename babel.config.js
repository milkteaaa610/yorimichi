module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['expo/internal/babel-preset'],
    // Drizzle のマイグレーション（.sql）を文字列として取り込む
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
