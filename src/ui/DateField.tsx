/** 日付を選ぶ行。iOS・Android は OS の日付ピッカーを使う。 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable } from 'react-native';

import { formatLong, fromDateKey, toDateKey } from '../lib/date';
import { Icon } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

export function DateField({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const picker = (
    <DateTimePicker
      value={fromDateKey(value)}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      maximumDate={new Date()}
      locale="ja-JP"
      onChange={(event, date) => {
        if (Platform.OS !== 'ios') setOpen(false);
        if (event.type === 'set' && date) onChange(toDateKey(date));
      }}
    />
  );
  return (
    <>
      <Pressable
        testID="date-field"
        accessibilityRole="button"
        accessibilityLabel={`日付 ${formatLong(value)} 変更`}
        onPress={() => setOpen(true)}
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
      </Pressable>
      {open && Platform.OS !== 'ios' && picker}
      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(24,24,27,0.4)', justifyContent: 'center', padding: 20 }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: colors.white, borderRadius: 24, padding: 12 }}>
              {picker}
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text size={15} weight={700}>
                  決定
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}
