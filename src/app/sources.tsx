/** データの出典（CC BY 4.0 の表示義務。docs/SPEC.md 7.1） */
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { MASTER_SOURCES, MASTER_VERSION } from '@/data/masterVersion';
import { HeaderBar, StackScreen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { IconButton } from '@/ui/controls';
import { colors } from '@/ui/theme';

const N02_YEAR = `20${MASTER_SOURCES.n02}`;
const N03_DATE = `${MASTER_SOURCES.n03.slice(0, 4)}年${Number(MASTER_SOURCES.n03.slice(4, 6))}月${Number(MASTER_SOURCES.n03.slice(6, 8))}日`;

const SOURCES: { title: string; body: string; license: string; url: string }[] = [
  {
    title: '国土数値情報（鉄道データ）',
    body: `「国土数値情報（鉄道データ）」（国土交通省）を加工して作成。駅名・路線名・運営会社・座標に使っています（${N02_YEAR}年度版）。`,
    license: 'CC BY 4.0',
    url: 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html',
  },
  {
    title: '国土数値情報（行政区域データ）',
    body: `「国土数値情報（行政区域データ）」（国土交通省）を加工して作成。駅の市区町村と、日本地図・市区町村の地図の形に使っています（${N03_DATE}時点）。`,
    license: 'CC BY 4.0',
    url: 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html',
  },
  {
    title: 'Wikidata',
    body: '駅名の読みがなとローマ字に使っています。',
    license: 'CC0',
    url: 'https://www.wikidata.org/',
  },
  {
    title: '駅ナンバリング',
    body: '路線記号・番号・路線色は、各社の公開資料をもとにエキログが作成したものです。形と書体は各社のものに近づけた表示で、公式のデザインではありません。',
    license: '',
    url: '',
  },
  {
    title: '書体',
    body: 'Geologica、Noto Sans JP、Hind、Barlow、M PLUS 1p、Source Sans 3、Jost、Inter（いずれも Google Fonts）',
    license: 'SIL Open Font License 1.1',
    url: 'https://openfontlicense.org/',
  },
];

export default function SourcesScreen() {
  return (
    <StackScreen
      testID="sources-screen"
      gap={22}
      header={<HeaderBar left={<IconButton icon="chevron-left" label="戻る" onPress={() => router.back()} />} />}>
      <Text size={26} weight={700} leading={1.3} accessibilityRole="header">
        データの出典
      </Text>
      {SOURCES.map((s) => (
        <View key={s.title} style={{ gap: 6, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <Text size={15} weight={700} style={{ flex: 1 }}>
              {s.title}
            </Text>
            {s.license !== '' && (
              <Text size={11} weight={600} color={colors.sub}>
                {s.license}
              </Text>
            )}
          </View>
          <Text size={13} leading={1.7} color={colors.body}>
            {s.body}
          </Text>
          {s.url !== '' && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(s.url)} style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text size={12} color={colors.sub} style={{ textDecorationLine: 'underline' }}>
                {s.url}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
      <Text size={11} color={colors.sub}>
        駅データの版 {MASTER_VERSION}
      </Text>
    </StackScreen>
  );
}
