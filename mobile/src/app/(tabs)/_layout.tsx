import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useAlerts } from '@/lib/alerts';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

export default function TabsLayout() {
  const { user, can } = useAuth();
  const { pending, openCount } = useAlerts();
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/login" />;
  const canRespond = can('response.acknowledge') || can('response.read') || can('response.close');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.line,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 10,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'home' : 'home-outline'} size={23} color={color} /> }} />
      <Tabs.Screen
        name="respond"
        options={{
          title: 'Respond',
          href: canRespond ? undefined : null,
          tabBarBadge: pending.length ? pending.length : openCount ? openCount : undefined,
          tabBarBadgeStyle: { backgroundColor: pending.length ? C.powertelRed : C.blue, fontSize: 11, fontWeight: '800' },
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={23} color={color} />,
        }}
      />
      <Tabs.Screen name="assets" options={{ title: 'Assets', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'flash' : 'flash-outline'} size={23} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'grid' : 'grid-outline'} size={22} color={color} /> }} />
    </Tabs>
  );
}
