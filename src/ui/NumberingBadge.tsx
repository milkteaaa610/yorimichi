/**
 * 駅ナンバリングのバッジ。全画面でこの部品だけを使う。
 * 形・書体は src/data/operatorStyles.ts の表で決まる。
 */
import { memo } from 'react';
import { Text, View } from 'react-native';

import type { BadgeInfo } from '../data/master';
import { badgeLayout, resolveBadgeStyle } from '../data/operatorStyles';

export type NumberingBadgeProps = {
  /** 路線記号（JY など） */
  code: string;
  /** 番号（17 など）。空文字なら路線記号だけのバッジになる */
  num?: string;
  /** 路線色 */
  color: string;
  /** 文字色（枠の色と違うとき） */
  ink?: string | null;
  size?: number;
  /** 駅データ側の上書き（operators.badge_style / badge_font） */
  kind?: string | null;
  font?: string | null;
};

export const NumberingBadge = memo(function NumberingBadge({
  code,
  num = '',
  color,
  ink,
  size = 26,
  kind,
  font,
}: NumberingBadgeProps) {
  const { shape, face } = resolveBadgeStyle(code, { shape: kind, face: font });
  const b = badgeLayout({ code, num, color, ink, size, shape, face });
  const text = { fontFamily: b.fontFamily, includeFontPadding: false } as const;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`駅ナンバリング ${code}${num}`}
      style={{
        width: b.size,
        height: b.size,
        borderRadius: b.radius,
        borderWidth: b.borderWidth,
        borderColor: b.borderColor,
        backgroundColor: b.background,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
      <View
        style={{
          height: b.topHeight,
          alignItems: 'center',
          justifyContent: b.codeAlign,
          paddingBottom: b.codePadBottom,
          backgroundColor: b.topBackground,
        }}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[text, { color: b.codeColor, fontSize: b.codeSize, lineHeight: b.codeSize, letterSpacing: b.codeSize * 0.01 }]}>
          {code}
        </Text>
      </View>
      {b.separator && (
        <View style={{ height: b.separator.height, marginHorizontal: b.separator.margin, backgroundColor: '#FFFFFF' }} />
      )}
      {b.hasNum && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              text,
              { color: b.numColor, fontSize: b.numSize, lineHeight: b.numSize, letterSpacing: b.numSize * -0.01, fontVariant: ['tabular-nums'] },
            ]}>
            {num}
          </Text>
        </View>
      )}
    </View>
  );
});

/** 駅マスタの BadgeInfo からそのまま描く。 */
export function StationBadge({ badge, size }: { badge: BadgeInfo; size?: number }) {
  return (
    <NumberingBadge
      code={badge.code}
      num={badge.num}
      color={badge.color}
      ink={badge.ink}
      kind={badge.kind}
      font={badge.font}
      size={size}
    />
  );
}

/** 一覧用。バッジを max 個まで出し、残りは「+8」のように省略する。 */
export function BadgeRow({ badges, max = 2, size = 26 }: { badges: BadgeInfo[]; max?: number; size?: number }) {
  if (badges.length === 0) return null;
  const rest = badges.length - max;
  return (
    <>
      {badges.slice(0, max).map((b) => (
        <StationBadge key={`${b.code}${b.num}`} badge={b} size={size} />
      ))}
      {rest > 0 && (
        <Text allowFontScaling={false} style={{ fontFamily: 'Geologica_600SemiBold', fontSize: 11, color: '#6B6B70' }}>
          +{rest}
        </Text>
      )}
    </>
  );
}
