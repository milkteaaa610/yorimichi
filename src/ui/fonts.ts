/**
 * アプリに同梱する書体。ルートのレイアウトで読み込む。
 * パッケージの入口（@expo-google-fonts/xxx）から読むと全部の太さが同梱されるので、使う太さだけを読む。
 */
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { Geologica_300Light } from '@expo-google-fonts/geologica/300Light';
import { Geologica_400Regular } from '@expo-google-fonts/geologica/400Regular';
import { Geologica_500Medium } from '@expo-google-fonts/geologica/500Medium';
import { Geologica_600SemiBold } from '@expo-google-fonts/geologica/600SemiBold';
import { Geologica_700Bold } from '@expo-google-fonts/geologica/700Bold';
import { Hind_700Bold } from '@expo-google-fonts/hind/700Bold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Jost_600SemiBold } from '@expo-google-fonts/jost/600SemiBold';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3/700Bold';

export const APP_FONTS = {
  // 画面の文字
  Geologica_300Light,
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
  // 日本語は、使う文字だけに絞った Noto Sans JP（scripts/fonts/subset-jp.py で作る）
  NotoSansJP_400Regular: require('../../assets/fonts/NotoSansJP-400Regular-Subset.ttf'),
  NotoSansJP_500Medium: require('../../assets/fonts/NotoSansJP-500Medium-Subset.ttf'),
  NotoSansJP_700Bold: require('../../assets/fonts/NotoSansJP-700Bold-Subset.ttf'),
  // ナンバリング用の代替書体（src/data/operatorStyles.ts の BADGE_FONTS）
  Hind_700Bold,
  Barlow_700Bold,
  SourceSans3_700Bold,
  Jost_600SemiBold,
  Inter_700Bold,
  // M PLUS 1p は英数字だけに絞ったもの（バッジでしか使わないため）
  MPLUS1p_700Bold: require('../../assets/fonts/MPLUS1p-Bold-Badge.ttf'),
};
