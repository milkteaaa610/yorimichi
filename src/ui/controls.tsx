/** ボタン・スイッチ・切り替えなど、画面で共通に使う部品。 */
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

const cardShadow: ViewStyle = {
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
};

/** 灰色の地に白い選択肢が乗る切り替え。 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  height = 40,
  fontSize = 14,
  pill = false,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  height?: number;
  fontSize?: number;
  /** 丸い小さめの形（地図のヘッダー用） */
  pill?: boolean;
}) {
  return (
    <View
      accessibilityRole={pill ? 'tablist' : 'radiogroup'}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        padding: pill ? 3 : 4,
        gap: pill ? 2 : 4,
        borderRadius: pill ? 999 : 14,
        backgroundColor: colors.surface,
      }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole={pill ? 'tab' : 'radio'}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(o.id)}
            style={[
              {
                height,
                borderRadius: pill ? 999 : 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? colors.white : 'transparent',
              },
              pill ? { paddingHorizontal: 14 } : { flex: 1 },
              on && cardShadow,
            ]}>
            <Text size={fontSize} weight={on ? 700 : 500} color={on ? colors.ink : colors.segmentOff}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** オン・オフのスイッチ（51×31）。 */
export function Switch({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{
        width: 51,
        height: 31,
        padding: 2,
        borderRadius: 999,
        backgroundColor: value ? colors.ink : colors.switchOff,
        alignItems: value ? 'flex-end' : 'flex-start',
        opacity: disabled ? 0.4 : 1,
      }}>
      <View
        style={{
          width: 27,
          height: 27,
          borderRadius: 999,
          backgroundColor: colors.white,
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </Pressable>
  );
}

/** 四角いチェックボックス（24×24）。タップできる範囲は44×44。 */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
}) {
  const box = (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: checked ? colors.ink : colors.white,
        borderWidth: checked ? 0 : 1.5,
        borderColor: colors.control,
      }}>
      {checked && <Icon name="check" size={16} color={colors.white} strokeWidth={2.6} />}
    </View>
  );
  if (!onChange) return box;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      {box}
    </Pressable>
  );
}

/** 進み具合の棒。segments を渡すと色分けして並べる。 */
export function ProgressBar({
  value,
  color = colors.ink,
  height = 6,
  label,
  extra,
}: {
  /** 0〜1 */
  value: number;
  color?: string;
  height?: number;
  label?: string;
  /** 2本目（選択中の駅など）。0〜1 */
  extra?: { value: number; color: string };
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%` as const;
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'progressbar' : undefined}
      accessibilityLabel={label}
      style={{
        height,
        borderRadius: 999,
        backgroundColor: colors.hairline,
        overflow: 'hidden',
        flexDirection: 'row',
      }}>
      <View
        style={{
          width: pct(value),
          height: '100%',
          backgroundColor: color,
          borderRadius: extra ? 0 : 999,
        }}
      />
      {extra && <View style={{ width: pct(extra.value), height: '100%', backgroundColor: extra.color }} />}
    </View>
  );
}

/** 画面下の大きな黒いボタン。 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
  height = 54,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          height,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          backgroundColor: disabled ? colors.disabled : colors.ink,
        },
        style,
      ]}>
      <Text size={16} weight={700} color={disabled ? colors.sub : colors.white}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 44×44 のアイコンボタン。 */
export function IconButton({
  icon,
  label,
  onPress,
  filled,
  size = 22,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** 灰色の丸い地を付ける */
  filled?: boolean;
  size?: number;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.surface : 'transparent',
      }}>
      <Icon name={icon} size={size} />
    </Pressable>
  );
}

/** 黒い小さなラベル（「はじめて」など）。 */
export function Tag({ label, tone = 'dark' }: { label: string; tone?: 'dark' | 'light' }) {
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: tone === 'dark' ? colors.ink : colors.hairline,
      }}>
      <Text size={10} weight={700} leading={1.2} color={tone === 'dark' ? colors.white : colors.body}>
        {label}
      </Text>
    </View>
  );
}

/** 設定の1行。右側にスイッチや値を置く。 */
export function SettingRow({
  title,
  description,
  right,
  onPress,
  last,
  testID,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  testID?: string;
}) {
  const body = (
    <>
      <View style={{ flex: 1, gap: 3 }}>
        <Text size={15} weight={500}>
          {title}
        </Text>
        {description && (
          <Text size={12} leading={1.5} color={colors.sub}>
            {description}
          </Text>
        )}
      </View>
      {right}
      {onPress && <Icon name="chevron-right" size={18} color={colors.mute} />}
    </>
  );
  const style: ViewStyle = {
    minHeight: 64,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: last ? 0 : 1,
    borderBottomColor: colors.hairline,
  };
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={style}>
        {body}
      </Pressable>
    );
  }
  return <View style={style}>{body}</View>;
}

/** 灰色の地の説明文。 */
export function Note({ children }: { children: string }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surface }}>
      <Text size={12} leading={1.6} color={colors.body}>
        {children}
      </Text>
    </View>
  );
}
