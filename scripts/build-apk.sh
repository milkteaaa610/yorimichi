#!/usr/bin/env bash
# Android の APK（リリース版、そのまま端末に入れられるもの）を作る。
#
#   ANDROID_HOME=~/android-sdk scripts/build-apk.sh            # arm64-v8a（いまの Android のほとんど）
#   ARCHS=armeabi-v7a,arm64-v8a scripts/build-apk.sh           # 古い 32bit の端末にも入れたいとき
#
# 必要なもの：JDK 17 以上、Android SDK（platforms;android-37.0、build-tools;37.0.0、ndk;27.1.12297006）
# 署名はデバッグ用の鍵（android/app/debug.keystore）。ストアに出すときは自分の鍵か EAS Build を使う。
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ANDROID_HOME:?ANDROID_HOME に Android SDK の場所を入れてください}"
ARCHS="${ARCHS:-arm64-v8a}"
VERSION=$(node -p "require('./app.json').expo.version")

npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
sed -i.bak 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m/' android/gradle.properties
rm -f android/gradle.properties.bak

(cd android && NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures="$ARCHS" --console=plain)

mkdir -p dist
OUT="dist/ekilog-${VERSION}-${ARCHS//,/-}.apk"
cp android/app/build/outputs/apk/release/app-release.apk "$OUT"
echo "できました: $OUT"
