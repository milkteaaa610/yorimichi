import { Image } from 'expo-image';
import { View } from 'react-native';

import { colors } from './theme';

/** 写真のサムネイル。写真ライブラリのID（ph:// や content://）もそのまま表示できる。 */
export function PhotoThumb({
  uri,
  size,
  radius = 12,
  fill,
}: {
  uri: string | null;
  size?: number;
  radius?: number;
  /** 親の幅いっぱいの正方形にする */
  fill?: boolean;
}) {
  const box = fill ? ({ width: '100%', aspectRatio: 1 } as const) : { width: size, height: size };
  return (
    <View style={[box, { borderRadius: radius, overflow: 'hidden', backgroundColor: '#D8D3C8' }]}>
      {uri && (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={120}
          style={{ width: '100%', height: '100%', backgroundColor: colors.surface }}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}
