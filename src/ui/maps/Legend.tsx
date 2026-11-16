import { View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../theme';

/** 塗りの凡例。 */
export function Legend({
  items,
  align = 'flex-end',
}: {
  items: { label: string; color: string; outlined?: boolean }[];
  align?: 'flex-end' | 'flex-start';
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: align, columnGap: 12, rowGap: 6 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: it.color,
              borderWidth: it.outlined ? 1 : 0,
              borderColor: '#E2E2DF',
            }}
          />
          <Text size={11} color={colors.sub}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
