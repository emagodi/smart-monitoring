import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useAlerts } from '@/lib/alerts';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/api';
import { eventText } from '@/lib/format';
import { C } from '@/lib/theme';

/** Floating red siren card while alerts wait for someone to acknowledge them. */
export default function SirenBanner() {
  const { pending, ringing, mute, mutedUntil, acknowledge, duty } = useAlerts();
  const { can } = useAuth();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const pulse = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ringing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ringing, pulse]);

  const responsible = !duty || duty.onDuty || !duty.rosterConfigured;
  if (!can('response.acknowledge') || !responsible || pending.length === 0) return null;
  const first = pending[0];
  if (path === `/case/${first.id}`) return null;
  const muted = Date.now() <= mutedUntil;
  const onTabs = !path.startsWith('/case') && !path.startsWith('/transformer') && !path.startsWith('/gateway') && path !== '/faults' && path !== '/installations';

  const ack = async () => {
    setBusy(true);
    setErr(null);
    try {
      await acknowledge(first.id);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={[st.wrap, { bottom: insets.bottom + (onTabs ? 74 : 14) }]}>
      <Animated.View style={[st.card, ringing && { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }]}>
        <Pressable style={st.top} onPress={() => router.push(`/case/${first.id}`)}>
          <View style={st.icon}>
            <Icon name="alert-circle" size={22} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>
              {pending.length} alert{pending.length === 1 ? '' : 's'} need{pending.length === 1 ? 's' : ''} acknowledging
            </Text>
            <Text style={st.sub} numberOfLines={1}>
              #{first.id} {eventText(first)} · {first.transformerName ?? 'Transformer'}
            </Text>
          </View>
        </Pressable>
        {err ? <Text style={st.err}>{err}</Text> : null}
        <View style={st.actions}>
          <Pressable onPress={ack} disabled={busy} style={[st.btn, { backgroundColor: C.white, flex: 1.4 }]}>
            {busy ? <ActivityIndicator color={C.red} size="small" /> : <Icon name="checkmark-circle" size={18} color={C.red} />}
            <Text style={[st.btnText, { color: C.red }]}>Acknowledge #{first.id}</Text>
          </Pressable>
          <Pressable onPress={mute} disabled={muted} style={[st.btn, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
            <Icon name={muted ? 'volume-mute' : 'notifications-off'} size={17} color={C.white} />
            <Text style={st.btnText}>{muted ? 'Muted' : 'Mute 5 min'}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  card: { backgroundColor: C.red, borderRadius: 22, padding: 12, gap: 10, shadowColor: '#7F1D1D', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  title: { color: C.white, fontWeight: '800', fontSize: 15 },
  sub: { color: '#FECACA', fontSize: 12.5, marginTop: 1 },
  err: { color: C.white, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 13 },
  btnText: { color: C.white, fontWeight: '800', fontSize: 13.5 },
});
