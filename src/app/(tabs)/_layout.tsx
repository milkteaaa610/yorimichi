import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/ui/TabBar';
import { colors } from '@/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.white } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="lines" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
