import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DbProvider } from '@/db/provider';
import { APP_FONTS } from '@/ui/fonts';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  const [dbReady, setDbReady] = useState(false);
  const ready = (fontsLoaded || !!fontError) && dbReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <DbProvider onReady={() => setDbReady(true)}>
          {(fontsLoaded || fontError) && (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="checkin" options={{ presentation: 'modal' }} />
              <Stack.Screen name="search" options={{ presentation: 'modal' }} />
              <Stack.Screen name="photo-import" options={{ presentation: 'modal' }} />
            </Stack>
          )}
        </DbProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
