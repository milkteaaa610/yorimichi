const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle のマイグレーション（.sql）はソースとして、駅マスタ（.db）と SQLite の wasm はアセットとして扱う
config.resolver.sourceExts.push('sql');
for (const ext of ['db', 'wasm']) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}

// Web 版の expo-sqlite は SharedArrayBuffer を使うので、開発サーバーにも COOP / COEP ヘッダーを付ける
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
