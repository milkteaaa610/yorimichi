/** 日付を選ぶ行（Web 版）。ブラウザの日付入力を使う。 */
import { createElement, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { formatLong, todayKey } from '../lib/date';
import { Icon } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

export function DateField({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <Pressable
      testID="date-field"
      accessibilityRole="button"
      accessibilityLabel={`日付 ${formatLong(value)} 変更`}
      onPress={() => {
        const el = input.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') el.showPicker();
        else el.focus();
      }}
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.hairline,
      }}>
      <Icon name="calendar" size={20} strokeWidth={1.7} />
      <Text size={15} weight={500} style={{ flex: 1 }}>
        {formatLong(value)}
      </Text>
      <Text size={13} color={colors.sub}>
        変更
      </Text>
      <View style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
        {createElement('input', {
          ref: input,
          type: 'date',
          value,
          max: todayKey(),
          'aria-label': '日付',
          onChange: (e: { target: { value: string } }) => {
            if (e.target.value) onChange(e.target.value);
          },
        })}
      </View>
    </Pressable>
  );
}
