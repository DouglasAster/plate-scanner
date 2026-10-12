import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AlarmOverlay } from '../components/AlarmOverlay';
import { AppStateProvider } from '../lib/AppState';
import { protectScreen, sweepCameraCache } from '../lib/privacy';

export default function RootLayout() {
  useEffect(() => {
    sweepCameraCache();
    protectScreen();
  }, []);

  return (
    <AppStateProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle/[id]" options={{ title: 'Vehicle' }} />
        <Stack.Screen name="sighting/[id]" options={{ title: 'Sighting' }} />
      </Stack>
      <AlarmOverlay />
    </AppStateProvider>
  );
}
