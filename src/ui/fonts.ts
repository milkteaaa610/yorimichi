/** アプリに同梱する書体。ルートのレイアウトで読み込む。 */
import { Barlow_700Bold } from '@expo-google-fonts/barlow';
import {
  Geologica_300Light,
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
} from '@expo-google-fonts/geologica';
import { Hind_700Bold } from '@expo-google-fonts/hind';
import { Inter_700Bold } from '@expo-google-fonts/inter';
import { Jost_600SemiBold } from '@expo-google-fonts/jost';
import {
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_700Bold,
} from '@expo-google-fonts/noto-sans-jp';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3';

export const APP_FONTS = {
  // 画面の文字
  Geologica_300Light,
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_700Bold,
  // ナンバリング用の代替書体（src/data/operatorStyles.ts の BADGE_FONTS）
  Hind_700Bold,
  Barlow_700Bold,
  SourceSans3_700Bold,
  Jost_600SemiBold,
  Inter_700Bold,
  // M PLUS 1p は英数字だけに絞ったもの（バッジでしか使わないため）
  MPLUS1p_700Bold: require('../../assets/fonts/MPLUS1p-Bold-Badge.ttf'),
};
