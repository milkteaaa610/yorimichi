/** 下から出る選択肢。OS の Alert は Web でボタンを出せないので、自前で描く。 */
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors } from './theme';

export type SheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
};

export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="閉じる"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(24,24,27,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 8,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16),
          }}>
          {title && (
            <View style={{ paddingVertical: 14 }}>
              <Text size={13} weight={700} color={colors.sub}>
                {title}
              </Text>
            </View>
          )}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityState={{ selected: a.selected }}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={{
                minHeight: 52,
                justifyContent: 'center',
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
              }}>
              <Text size={16} weight={a.selected ? 700 : 500} color={a.destructive ? '#C8102E' : colors.ink}>
                {a.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{
              height: 52,
              marginTop: 8,
              borderRadius: 999,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text size={15} weight={600}>
              キャンセル
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
