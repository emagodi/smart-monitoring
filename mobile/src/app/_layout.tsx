import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SirenBanner from '@/components/SirenBanner';
import { AlertsProvider } from '@/lib/alerts';
import { AuthProvider, useAuth } from '@/lib/auth';
import { configureNotifications, registerPush } from '@/lib/push';
import { C } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function openFromNotification(data: unknown) {
  const d = (data ?? {}) as { type?: string; alertId?: number | string };
  if (d.type === 'ALERT' && d.alertId != null) router.push(`/case/${d.alertId}`);
}

function Shell() {
  const { ready, user } = useAuth();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // Register this phone for push alerts once signed in.
  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    void configureNotifications();
    void registerPush();
  }, [user]);

  // Tapping an alert notification opens that incident.
  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      openFromNotification(last.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => openFromNotification(r.notification.request.content.data));
    return () => sub.remove();
  }, [user]);

  if (!ready) return null;
  return (
    <AlertsProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {user ? <SirenBanner /> : null}
    </AlertsProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
