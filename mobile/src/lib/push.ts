import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { storage } from './storage';

export type PushState = { status: 'ok' | 'denied' | 'unsupported' | 'error'; detail?: string };

let configured = false;

/** Expo Go has no custom sounds and no remote push on Android: use defaults there and skip push registration. */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const SIREN = inExpoGo ? 'default' : 'siren.wav';

/** Alerts arrive on the "alerts" channel: maximum importance, siren sound, strong vibration, shown on the lock screen. */
export async function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Intrusion alerts',
        description: 'New alerts for your depot. Plays the siren.',
        importance: Notifications.AndroidImportance.MAX,
        sound: SIREN,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        lightColor: '#E63B3F',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        enableVibrate: true,
      });
      await Notifications.setNotificationChannelAsync('general', {
        name: 'Updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      /* channel set-up is not available here (e.g. Expo Go); notifications use the default channel */
    }
  }
}

/** Ask for permission, get this phone's Expo push token and register it for the signed-in user. */
export async function registerPush(): Promise<PushState> {
  if (Platform.OS === 'web') return { status: 'unsupported', detail: 'Push alerts work on the phone app only.' };
  if (inExpoGo) return { status: 'unsupported', detail: 'Push alerts need the TIAS app build (EAS). In Expo Go only the in-app siren works.' };
  if (!Device.isDevice) return { status: 'unsupported', detail: 'Push alerts need a real phone (not an emulator).' };
  try {
    await configureNotifications();
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied', detail: 'Notifications are switched off for TIAS in the phone settings.' };
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return { status: 'error', detail: 'This build has no EAS project id. Run "eas init" and rebuild.' };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/api/v1/mobile/devices', {
      expoPushToken: token,
      platform: Platform.OS,
      appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
      deviceName: Device.deviceName ?? Device.modelName ?? null,
    });
    await storage.set('tias.pushToken', token);
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : 'Could not register for push alerts.' };
  }
}

export async function unregisterPush() {
  const token = await storage.get('tias.pushToken');
  if (!token) return;
  await api.post('/api/v1/mobile/devices/unregister', { expoPushToken: token }).catch(() => undefined);
  await storage.set('tias.pushToken', null);
}

/** A local test of the alert sound and banner, so the team can check their phone is set up. */
export async function testAlertNotification() {
  if (Platform.OS === 'web') return;
  await configureNotifications().catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'TIAS test alert',
      body: 'This is how an intrusion alert will sound and look on this phone.',
      sound: SIREN,
      data: { type: 'TEST' },
    },
    trigger: Platform.OS === 'android' ? { channelId: 'alerts', seconds: 1, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL } : null,
  });
}
