import { View } from 'react-native';

import type { LineInfo } from '../data/master';
import { NumberingBadge } from './NumberingBadge';
import { colors } from './theme';

/** 路線の印。ナンバリングがあればバッジ、なければ路線色の丸。 */
export function LineMark({ line, number, size }: { line: LineInfo; number: string | null; size: number }) {
  if (line.code && (number || number === '')) {
    return (
      <NumberingBadge
        code={line.code}
        num={number}
        color={line.color ?? colors.sub}
        ink={line.ink}
        kind={line.badgeStyle}
        font={line.badgeFont}
        size={size}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.16,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: size * 0.36,
          height: size * 0.36,
          borderRadius: 999,
          borderWidth: Math.max(2, size * 0.08),
          borderColor: line.color ?? colors.mute,
        }}
      />
    </View>
  );
}
