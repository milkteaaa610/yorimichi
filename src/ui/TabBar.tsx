/** 下のタブ。ホーム・地図・（記録）・路線・マイ。中央の＋は「駅を記録」を開く。 */
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'ホーム', icon: 'home' },
  map: { label: '地図', icon: 'map' },
  lines: { label: '路線', icon: 'route' },
  settings: { label: 'マイ', icon: 'user' },
};

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const items = state.routes
    .map((route, index) => ({ route, index, def: TABS[route.name] }))
    .filter((x) => x.def);

  const tab = ({ route, index, def }: (typeof items)[number]) => {
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        accessibilityRole="tab"
        accessibilityLabel={def.label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <Icon
          name={def.icon}
          size={24}
          color={focused ? colors.ink : colors.sub}
          strokeWidth={focused ? 2 : 1.7}
        />
        <Text size={10} weight={focused ? 700 : 500} color={focused ? colors.ink : colors.sub}>
          {def.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 6,
        paddingHorizontal: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.white,
      }}>
      {items.slice(0, 2).map(tab)}
      <Pressable
        testID="tab-checkin"
        accessibilityRole="button"
        accessibilityLabel="駅を記録する"
        onPress={() => router.push('/checkin')}
        style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="plus" size={24} color={colors.white} strokeWidth={2} />
        </View>
      </Pressable>
      {items.slice(2).map(tab)}
    </View>
  );
}
