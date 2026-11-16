/** 画面の外枠。タブの画面と、戻る・閉じるのある画面の2種類。 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from './theme';

/** タブの画面。上の余白はステータスバーぶんを足す。 */
export function TabScreen({
  children,
  gap = 24,
  testID,
}: {
  children: ReactNode;
  gap?: number;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: colors.white }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24, gap }}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/** 戻る・閉じるのある画面。header は上に固定、footer は下に固定する。 */
export function StackScreen({
  header,
  footer,
  children,
  gap = 24,
  scroll = true,
  contentStyle,
  testID,
}: {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  gap?: number;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 28, gap }, contentStyle]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 12 }}>{header}</View>
      {body}
      {footer && (
        <View
          style={{
            paddingTop: 12,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
            backgroundColor: colors.white,
          }}>
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** ヘッダーの1行。左右にボタン、中央に題名。 */
export function HeaderBar({
  left,
  right,
  title,
}: {
  left?: ReactNode;
  right?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ minWidth: 44 }}>{left}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>{title}</View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
