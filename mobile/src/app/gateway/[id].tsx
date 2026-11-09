import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Empty, Icon, KV, ListRow, Loading, Notice, Screen, Section, SignalBars } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ago, dateTime, directionsUrl, gStatus, signal } from '@/lib/format';
import { C, TONE } from '@/lib/theme';
import type { Gateway, GatewayTransformer } from '@/lib/types';
import { useData } from '@/lib/useData';

type Data = { g: Gateway; transformers: GatewayTransformer[] };

export default function GatewayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { depotName } = useAuth();
  const { data, loading, error, refreshing, reload } = useData<Data>(
    async () => {
      const [g, links] = await Promise.all([
        api.get<Gateway>(`/api/v1/gateways/${id}`),
        api.get<{ transformers: GatewayTransformer[] }>(`/api/v1/gateways/${id}/transformers`).catch(() => ({ transformers: [] as GatewayTransformer[] })),
      ]);
      return { g, transformers: links?.transformers ?? [] };
    },
    [id],
    60_000
  );

  if (!data) {
    return (
      <Screen back eyebrow="Gateway" title="Gateway" refreshing={refreshing} onRefresh={reload}>
        {loading ? <Loading /> : <Notice text={error ?? 'Could not load this gateway.'} />}
      </Screen>
    );
  }
  const g = data.g;
  const st = gStatus(g.effectiveStatus);
  const recent = data.transformers.filter((t) => t.lastHeardAt && Date.now() - new Date(t.lastHeardAt).getTime() < 24 * 3600_000).length;
  const relaying = /relaying/i.test(g.statusReason ?? '');

  return (
    <Screen
      back
      eyebrow="LoRaWAN gateway"
      title={g.name}
      subtitle={[g.depotName, g.regionName].filter(Boolean).join(' · ') || g.gatewayEui}
      refreshing={refreshing}
      onRefresh={reload}
      hero={
        <View style={s.heroRow}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: TONE[st.tone].dot }} />
              <Text style={s.tileValue}>{st.label}</Text>
            </View>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Last seen</Text>
            <Text style={s.tileValue}>{ago(g.lastTrafficSeenAt || g.lastLoriotSeenAt)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Transformers</Text>
            <Text style={s.tileValue}>{data.transformers.length}</Text>
          </View>
        </View>
      }>
      {relaying ? <Notice tone="blue" icon="pulse" text="Online because it is passing on sensor messages right now, even if LORIOT last reported it offline." /> : null}

      <Section title={`Transformers on this gateway · ${recent} heard in 24 h`}>
        <Card style={{ paddingVertical: 4 }}>
          {data.transformers.length === 0 ? (
            <Empty icon="flash-outline" title="No transformer heard yet" text="Links appear after the first message from a device linked to a transformer." />
          ) : (
            data.transformers.map((t) => {
              const q = signal(t.lastRssi);
              const stale = !t.lastHeardAt || Date.now() - new Date(t.lastHeardAt).getTime() > 24 * 3600_000;
              return (
                <ListRow
                  key={`${t.transformerId}-${t.source}`}
                  icon="flash"
                  iconTone={stale ? 'slate' : 'blue'}
                  title={t.transformerName}
                  subtitle={`${q.label}${t.lastRssi != null ? ` ${t.lastRssi} dBm` : ''} · heard ${ago(t.lastHeardAt)}${(t.gatewaysHearing ?? 0) > 1 ? ` · ${t.gatewaysHearing} gateways` : ''}${t.depotId ? ` · ${depotName(t.depotId) ?? ''}` : ''}`}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <SignalBars rssi={t.lastRssi} />
                      <Icon name="chevron-forward" size={18} color={C.muted} />
                    </View>
                  }
                  onPress={() => router.push(`/transformer/${t.transformerId}`)}
                />
              );
            })
          )}
        </Card>
      </Section>

      <Section title="Details">
        <Card style={{ paddingVertical: 4 }}>
          <KV k="Status reason" v={g.statusReason?.startsWith('status-engine') ? 'Status engine' : g.statusReason} />
          <KV k="Status since" v={dateTime(g.statusChangedAt)} />
          <KV k="LORIOT says" v={g.loriotReportedStatus ? g.loriotReportedStatus.toLowerCase() : '—'} />
          <KV k="Last LORIOT check" v={dateTime(g.lastLoriotSeenAt)} />
          <KV k="Last traffic" v={dateTime(g.lastTrafficSeenAt)} />
          <KV k="Gateway EUI" v={g.gatewayEui} mono />
          <KV k="Model" v={[g.manufacturer, g.model].filter(Boolean).join(' ')} />
          <KV k="Network" v={g.networkName} />
          <KV k="Location" v={g.latitude != null && g.longitude != null ? `${Number(g.latitude).toFixed(5)}, ${Number(g.longitude).toFixed(5)}` : 'Not set'} mono />
        </Card>
      </Section>

      {g.latitude != null && g.longitude != null ? (
        <Button label="Directions to gateway" icon="navigate" variant="dark" onPress={() => void Linking.openURL(directionsUrl(Number(g.latitude), Number(g.longitude)))} />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  heroRow: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 10, gap: 3 },
  tileLabel: { color: '#BFDBFE', fontSize: 11, fontWeight: '700' },
  tileValue: { color: C.white, fontSize: 14, fontWeight: '800' },
});
