import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import CaseCard from '@/components/CaseCard';
import { Button, Card, Chip, Empty, HeaderIcon, Icon, Section, Screen, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { useAlerts } from '@/lib/alerts';
import { useAuth } from '@/lib/auth';
import { mins } from '@/lib/format';
import { C } from '@/lib/theme';
import type { AlertSummary, EstateStats, GatewaySummary, Page } from '@/lib/types';
import { useData } from '@/lib/useData';

type Home = { stats?: EstateStats; summary?: AlertSummary; gateways?: GatewaySummary; openFaults?: number };

const settled = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => undefined);

export default function HomeScreen() {
  const { user, can, isPartner } = useAuth();
  const { pending, board, duty, refresh } = useAlerts();
  const canRespond = can('response.acknowledge') || can('response.read') || can('response.close');

  const { data, refreshing, reload } = useData<Home>(
    async () => {
      const [stats, summary, gateways, faults] = await Promise.all([
        settled(api.get<EstateStats>('/api/v1/transformers/stats')),
        settled(api.get<AlertSummary>('/api/v1/alerts/summary')),
        isPartner ? Promise.resolve(undefined) : settled(api.get<GatewaySummary>('/api/v1/gateways/summary')),
        can('faults.read') ? settled(api.get<Page<unknown>>('/api/v1/faults', { status: 'OPEN', size: 1 })) : Promise.resolve(undefined),
      ]);
      return { stats, summary, gateways, openFaults: faults?.totalElements };
    },
    [isPartner, can],
    60_000
  );

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const scope = isPartner ? user?.supplierName || 'Partner' : user?.depot || user?.district || user?.region || 'National';
  const st = data?.stats;
  const open = board?.open ?? [];
  const inProgress = open.filter((c) => c.alert.caseStatus && c.alert.caseStatus !== 'NEW');

  return (
    <Screen
      eyebrow={greet}
      title={user?.firstName ? `${user.firstName} ${user.lastName}`.trim() : 'TIAS'}
      subtitle={scope}
      refreshing={refreshing}
      onRefresh={() => {
        void reload();
        void refresh();
      }}
      right={canRespond ? <HeaderIcon name="notifications-outline" badge={pending.length} onPress={() => router.push('/respond')} /> : null}
      hero={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {can('response.acknowledge') ? (
            <View style={[s.heroPill, duty?.onDuty && { backgroundColor: 'rgba(16,185,129,0.25)' }]}>
              <View style={[s.heroDot, { backgroundColor: duty?.onDuty ? '#34D399' : '#94A3B8' }]} />
              <Text style={s.heroPillText}>{duty?.onDuty ? 'On duty' : duty?.rosterConfigured ? 'Off duty' : 'Receiving all alerts'}</Text>
            </View>
          ) : null}
          {st ? (
            <View style={s.heroPill}>
              <Icon name="flash" size={13} color="#BFDBFE" />
              <Text style={s.heroPillText}>{st.transformers} transformers</Text>
            </View>
          ) : null}
          {st?.onlinePercent != null ? (
            <View style={s.heroPill}>
              <Icon name="pulse" size={13} color="#BFDBFE" />
              <Text style={s.heroPillText}>{Math.round(st.onlinePercent)}% online</Text>
            </View>
          ) : null}
        </View>
      }>
      {canRespond && pending.length > 0 ? (
        <Card tone="red" onPress={() => router.push('/respond')} style={{ backgroundColor: '#FEF2F2' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.alarmIcon}>
              <Icon name="alert" size={24} color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.alarmTitle}>
                {pending.length} new alert{pending.length === 1 ? '' : 's'} waiting
              </Text>
              <Text style={s.alarmSub}>Acknowledge so the team knows someone is on it.</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={C.red} />
          </View>
        </Card>
      ) : canRespond ? (
        <Card tone="green">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[s.alarmIcon, { backgroundColor: C.green }]}>
              <Icon name="shield-checkmark" size={22} color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.alarmTitle, { color: '#065F46' }]}>All alerts acknowledged</Text>
              <Text style={s.alarmSub}>{inProgress.length ? `${inProgress.length} incident${inProgress.length === 1 ? '' : 's'} still being handled.` : 'No open incidents right now.'}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Section title="Transformers">
        <View style={s.grid}>
          <Stat label="Online" value={st?.online ?? '—'} tone="green" icon="radio-button-on" onPress={() => router.push({ pathname: '/assets', params: { status: 'ONLINE' } })} />
          <Stat label="Offline" value={st?.offline ?? '—'} tone="red" icon="cloud-offline-outline" onPress={() => router.push({ pathname: '/assets', params: { status: 'OFFLINE' } })} />
          <Stat label="Delayed" value={st?.delayed ?? '—'} tone="amber" icon="time-outline" onPress={() => router.push({ pathname: '/assets', params: { status: 'DELAYED' } })} />
          <Stat label="With open alerts" value={st?.transformersAlerting ?? '—'} tone="violet" icon="warning-outline" onPress={() => router.push('/respond')} />
        </View>
      </Section>

      {data?.gateways || data?.openFaults != null ? (
        <Section title="Network & faults">
          <View style={s.grid}>
            {data?.gateways ? (
              <Stat
                label="Gateways online"
                value={`${data.gateways.online}/${data.gateways.total}`}
                sub={`${data.gateways.offline} offline`}
                tone="blue"
                icon="radio-outline"
                onPress={() => router.push({ pathname: '/assets', params: { tab: 'gateways' } })}
              />
            ) : null}
            {data?.openFaults != null ? (
              <Stat label="Open fault alarms" value={data.openFaults} sub="Equipment to fix" tone="amber" icon="construct-outline" onPress={() => router.push('/faults')} />
            ) : null}
          </View>
        </Section>
      ) : null}

      {data?.summary ? (
        <Section title="Response, last 30 days">
          <Card>
            <View style={s.perf}>
              <Perf label="To acknowledge" value={mins(data.summary.avgAcknowledgeMinutes)} />
              <View style={s.perfLine} />
              <Perf label="To arrive" value={mins(data.summary.avgArrivalMinutes)} />
              <View style={s.perfLine} />
              <Perf label="To close" value={mins(data.summary.avgCloseMinutes)} />
            </View>
            <View style={s.outcomes}>
              <Chip label={`${data.summary.realThreats30d} real threats`} tone="red" small />
              <Chip label={`${data.summary.falseAlarms30d} false alarms`} tone="slate" small />
              <Chip label={`${data.summary.technicalFaults30d} faults`} tone="amber" small />
            </View>
          </Card>
        </Section>
      ) : null}

      {canRespond ? (
        <Section title="Open incidents" action={open.length > 3 ? <Text style={s.link} onPress={() => router.push('/respond')}>See all {open.length}</Text> : null}>
          {open.length === 0 ? (
            <Card>
              <Empty title="Nothing open" text="New alerts appear here and ring the siren." />
            </Card>
          ) : (
            open.slice(0, 3).map((c) => <CaseCard key={c.alert.id} item={c} />)
          )}
        </Section>
      ) : (
        <Button label="Browse transformers" icon="flash-outline" variant="dark" onPress={() => router.push('/assets')} />
      )}
    </Screen>
  );
}

function Perf({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={s.perfValue}>{value}</Text>
      <Text style={s.perfLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  heroDot: { width: 8, height: 8, borderRadius: 8 },
  heroPillText: { color: C.white, fontSize: 12.5, fontWeight: '700' },
  alarmIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  alarmTitle: { fontSize: 16, fontWeight: '800', color: '#991B1B' },
  alarmSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  perf: { flexDirection: 'row', alignItems: 'center' },
  perfLine: { width: 1, height: 34, backgroundColor: C.line },
  perfValue: { fontSize: 19, fontWeight: '800', color: C.navy },
  perfLabel: { fontSize: 12, color: C.sub, fontWeight: '600' },
  outcomes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, justifyContent: 'center' },
  link: { color: C.blue, fontWeight: '800', fontSize: 13 },
});
