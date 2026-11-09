import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert as RNAlert, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import RaiseFaultSheet from '@/components/RaiseFaultSheet';
import { Button, Card, Chip, Empty, Icon, KV, ListRow, Loading, Notice, Screen, Section, SignalBars } from '@/components/ui';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CASE, FAULT_TYPES, T_STATUS, ago, dateTime, directionsUrl, eventText, gStatus, isOpen, statusOf } from '@/lib/format';
import { C, TONE } from '@/lib/theme';
import type { Alert, Fault, GatewayLink, Page, Transformer } from '@/lib/types';
import { useData } from '@/lib/useData';

type Data = { t: Transformer; gateways: GatewayLink[]; alerts: Alert[]; faults: Fault[] };

export default function TransformerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, depotName, isPartner } = useAuth();
  const [faultOpen, setFaultOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'green' | 'red' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, refreshing, reload, silentReload } = useData<Data>(
    async () => {
      const t = await api.get<Transformer>(`/api/v1/transformers/registry/${id}`);
      const [gateways, alerts, faults] = await Promise.all([
        isPartner ? Promise.resolve([] as GatewayLink[]) : api.get<GatewayLink[]>(`/api/v1/transformers/${id}/gateways`).catch(() => [] as GatewayLink[]),
        api
          .get<Page<Alert> | Alert[]>('/api/v1/alerts', { transformerId: id, size: 8, page: 0 })
          .then((r) => (Array.isArray(r) ? r : r?.content ?? []))
          .catch(() => [] as Alert[]),
        can('faults.read')
          ? api
              .get<Page<Fault>>('/api/v1/faults', { transformerId: id, status: 'OPEN', size: 10 })
              .then((r) => r.content ?? [])
              .catch(() => [] as Fault[])
          : Promise.resolve([] as Fault[]),
      ]);
      return { t, gateways, alerts, faults };
    },
    [id, isPartner, can],
    30_000
  );

  if (!data) {
    return (
      <Screen back eyebrow="Transformer" title="Transformer" refreshing={refreshing} onRefresh={reload}>
        {loading ? <Loading /> : <Notice text={error ?? 'Could not load this transformer.'} />}
      </Screen>
    );
  }

  const t = data.t;
  const st = T_STATUS[t.status] ?? T_STATUS.NO_DEVICE;
  const control = (action: 'arm' | 'disarm') => {
    const go = async () => {
      setBusy(action);
      try {
        await api.post(`/api/v1/oculus-control/transformers/${t.id}/${action}`);
        setNotice({ text: action === 'arm' ? 'Arm command sent to the site.' : 'Disarm command sent to the site.', tone: 'green' });
        void silentReload();
      } catch (e) {
        setNotice({ text: errorText(e), tone: 'red' });
      } finally {
        setBusy(null);
      }
    };
    if (Platform.OS === 'web') return void go();
    RNAlert.alert(action === 'arm' ? 'Arm the site?' : 'Disarm the site?', action === 'arm' ? 'The site siren sounds on the next intrusion.' : 'The site siren stays silent until armed again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: action === 'arm' ? 'Arm' : 'Disarm', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <Screen
      back
      eyebrow={t.type === 'POLE_MOUNTED' ? 'Pole-mounted transformer' : t.type === 'GROUND_MOUNTED' ? 'Ground-mounted transformer' : 'Transformer'}
      title={t.name}
      subtitle={[t.transformerNumber ? `No. ${t.transformerNumber}` : null, depotName(t.depotId), t.supplierName].filter(Boolean).join(' · ')}
      refreshing={refreshing}
      onRefresh={reload}
      hero={
        <View style={s.heroRow}>
          <HeroTile label="Status" value={st.label} dot={TONE[st.tone].dot} />
          <HeroTile label="Last signal" value={ago(t.lastSignalAt, t.minutesSinceSignal)} />
          <HeroTile label="Site alarm" value={t.reportedArmState === 'ARMED' ? 'Armed' : t.reportedArmState === 'DISARMED' ? 'Disarmed' : '—'} />
        </View>
      }>
      {notice ? <Notice text={notice.text} tone={notice.tone} /> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {t.lat != null && t.lng != null ? (
          <Button style={{ flex: 1 }} label="Directions" icon="navigate" variant="dark" onPress={() => void Linking.openURL(directionsUrl(Number(t.lat), Number(t.lng)))} />
        ) : null}
        {can('faults.record') ? <Button style={{ flex: 1 }} label="Raise fault" icon="construct" variant="ghost" onPress={() => setFaultOpen(true)} /> : null}
      </View>

      {data.faults.length ? (
        <Section title="Open fault alarms">
          {data.faults.map((f) => {
            const paused = f.suppressAlerts === true || f.suppressAlerts === 1;
            return (
              <Card key={f.id} tone="amber" onPress={() => router.push('/faults')}>
                <Text style={s.cardTitle}>{FAULT_TYPES[f.faultType] ?? f.faultType}</Text>
                {f.description ? <Text style={s.cardSub}>{f.description}</Text> : null}
                <View style={s.chips}>
                  <Chip label={`Raised ${ago(f.reportedAt)}`} tone="amber" small />
                  {paused ? <Chip label={`Alerts paused · ${f.suppressedTriggers ?? 0} ignored`} tone="amber" icon="notifications-off" small /> : <Chip label="Alerts active" tone="slate" icon="notifications" small />}
                </View>
              </Card>
            );
          })}
        </Section>
      ) : null}

      <Section title="Recent alerts">
        <Card style={{ paddingVertical: 4 }}>
          {data.alerts.length === 0 ? (
            <Empty title="No alerts" text="Nothing has been triggered on this transformer." />
          ) : (
            data.alerts.map((a) => {
              const cs = statusOf(a);
              return (
                <ListRow
                  key={a.id}
                  icon={isOpen(cs) ? 'alert-circle' : 'checkmark-circle'}
                  iconTone={isOpen(cs) ? CASE[cs].tone : 'green'}
                  title={`#${a.id} ${eventText(a)}`}
                  subtitle={`${CASE[cs].label} · ${dateTime(a.createdAt)}`}
                  onPress={() => router.push(`/case/${a.id}`)}
                />
              );
            })
          )}
        </Card>
      </Section>

      {!isPartner ? (
        <Section title="Reports through gateway">
          <Card style={{ paddingVertical: 4 }}>
            {data.gateways.length === 0 ? (
              <Empty icon="radio-outline" title="Not heard yet" text="The gateway appears after the first message from its device." />
            ) : (
              data.gateways.map((g) => {
                const gs = gStatus(g.effectiveStatus ?? g.status);
                return (
                  <ListRow
                    key={g.gatewayId}
                    icon="radio"
                    iconTone={gs.tone}
                    title={g.name}
                    subtitle={`${gs.label} · heard ${ago(g.lastHeardAt)}${g.lastRssi != null ? ` · ${g.lastRssi} dBm` : ''}`}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <SignalBars rssi={g.lastRssi ?? g.rssi} />
                        <Icon name="chevron-forward" size={18} color={C.muted} />
                      </View>
                    }
                    onPress={() => router.push(`/gateway/${g.gatewayId}`)}
                  />
                );
              })
            )}
          </Card>
        </Section>
      ) : null}

      <Section title="Devices">
        <Card style={{ paddingVertical: 4 }}>
          <KV k="Controllers" v={String(t.controllerCount)} />
          {t.controllerEuis.map((e) => (
            <KV key={e} k="Device EUI" v={e} mono />
          ))}
          <KV k="Partner" v={t.supplierName} />
          {t.lastCommandAction ? <KV k="Last command" v={`${t.lastCommandAction.toLowerCase()} · ${t.lastCommandStatus?.toLowerCase() ?? ''} · ${ago(t.lastCommandAt)}`} /> : null}
          {t.lat != null && t.lng != null ? <KV k="Location" v={`${Number(t.lat).toFixed(5)}, ${Number(t.lng).toFixed(5)}`} mono /> : <KV k="Location" v="Not mapped" />}
        </Card>
      </Section>

      {can('control.arm') || can('control.disarm') ? (
        <Section title="Site alarm">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {can('control.arm') ? <Button style={{ flex: 1 }} label="Arm" icon="lock-closed" variant="dark" busy={busy === 'arm'} onPress={() => control('arm')} /> : null}
            {can('control.disarm') ? <Button style={{ flex: 1 }} label="Disarm" icon="lock-open" variant="ghost" busy={busy === 'disarm'} onPress={() => control('disarm')} /> : null}
          </View>
        </Section>
      ) : null}

      <RaiseFaultSheet
        open={faultOpen}
        onClose={() => setFaultOpen(false)}
        transformer={{ id: t.id, name: t.name, openAlerts: t.openAlerts }}
        onDone={(m) => {
          setFaultOpen(false);
          setNotice({ text: m, tone: 'green' });
          void silentReload();
        }}
      />
    </Screen>
  );
}

function HeroTile({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {dot ? <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: dot }} /> : null}
        <Text style={s.tileValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heroRow: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 10, gap: 3 },
  tileLabel: { color: '#BFDBFE', fontSize: 11, fontWeight: '700' },
  tileValue: { color: C.white, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  cardSub: { fontSize: 13, color: C.sub, marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});
