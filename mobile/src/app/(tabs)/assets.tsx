import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Empty, Icon, Notice, Pills, Screen, SearchBox, Segmented } from '@/components/ui';
import { useBannerSpace } from '@/lib/alerts';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { G_STATUS, T_STATUS, ago, gStatus } from '@/lib/format';
import { C, TONE } from '@/lib/theme';
import type { GStatus, Gateway, GatewayLink, Page, TStatus, Transformer, TransformerPage } from '@/lib/types';

const PAGE = 30;

export default function Assets() {
  const params = useLocalSearchParams<{ status?: string; tab?: string }>();
  const { isPartner } = useAuth();
  const [tab, setTab] = useState<'transformers' | 'gateways'>(params.tab === 'gateways' && !isPartner ? 'gateways' : 'transformers');

  useEffect(() => {
    if (params.tab === 'gateways' && !isPartner) setTab('gateways');
    else if (params.status) setTab('transformers');
  }, [params.tab, params.status, isPartner]);

  return (
    <Screen
      scroll={false}
      eyebrow="Assets"
      title={tab === 'transformers' ? 'Transformers' : 'Gateways'}
      subtitle={tab === 'transformers' ? 'Live status, alerts and the gateway each one reports through.' : 'LoRaWAN gateways and the transformers they receive.'}
      hero={
        isPartner ? undefined : (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: 'transformers', label: 'Transformers' },
              { key: 'gateways', label: 'Gateways' },
            ]}
          />
        )
      }>
      {tab === 'transformers' ? <TransformerList initialStatus={(params.status as TStatus) || ''} /> : <GatewayList />}
    </Screen>
  );
}

/** Shared paging list: search box + filter pills on top, infinite scroll, pull to refresh. */
function usePaged<T>(fetchPage: (page: number) => Promise<Page<T>>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = useRef(0);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(fetchPage, deps);

  const load = useCallback(
    async (mode: 'reset' | 'refresh' | 'more') => {
      const id = ++seq.current;
      const next = mode === 'more' ? page.current + 1 : 0;
      if (mode === 'reset') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setMore(true);
      try {
        const res = await fetcher(next);
        if (id !== seq.current) return;
        page.current = next;
        setItems((prev) => (next === 0 ? res.content : [...prev, ...res.content]));
        setTotal(res.totalElements ?? res.content.length);
        if (res.counts) setCounts(res.counts);
        setError(null);
      } catch (e) {
        if (id === seq.current) setError(errorText(e));
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
          setMore(false);
        }
      }
    },
    [fetcher]
  );

  useEffect(() => {
    const t = setTimeout(() => void load('reset'), 250);
    return () => clearTimeout(t);
  }, [load]);

  return {
    items,
    total,
    counts,
    loading,
    more,
    refreshing,
    error,
    refresh: () => load('refresh'),
    loadMore: () => {
      if (!loading && !more && items.length < total) void load('more');
    },
  };
}

function ListShell<T>({
  header,
  data,
  render,
  keyOf,
  paged,
  emptyTitle,
}: {
  header: React.ReactNode;
  data: T[];
  render: (item: T) => React.ReactElement;
  keyOf: (item: T) => string;
  paged: ReturnType<typeof usePaged<T>>;
  emptyTitle: string;
}) {
  const insets = useSafeAreaInsets();
  const bannerSpace = useBannerSpace();
  return (
    <FlatList
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 12 }}>
          {header}
          {paged.error ? <Notice text={paged.error} /> : null}
        </View>
      }
      ListEmptyComponent={paged.loading ? <ActivityIndicator color={C.blue} style={{ marginTop: 30 }} /> : <Empty icon="search-outline" title={emptyTitle} text="Try another search or filter." />}
      ListFooterComponent={paged.more ? <ActivityIndicator color={C.blue} style={{ marginVertical: 16 }} /> : data.length ? <Text style={s.foot}>{`${data.length} of ${paged.total}`}</Text> : undefined}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 + bannerSpace, gap: 10 }}
      onEndReachedThreshold={0.4}
      onEndReached={paged.loadMore}
      refreshControl={<RefreshControl refreshing={paged.refreshing} onRefresh={paged.refresh} tintColor={C.blue} colors={[C.blue]} />}
      keyboardShouldPersistTaps="handled"
    />
  );
}

function TransformerList({ initialStatus }: { initialStatus: TStatus | '' }) {
  const { depotName, can } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TStatus | ''>(initialStatus);
  const [gw, setGw] = useState<Record<string, GatewayLink>>({});
  const [faults, setFaults] = useState<Record<string, number>>({});

  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => {
    api.get<Record<string, GatewayLink>>('/api/v1/gateways/links/by-transformer').then(setGw).catch(() => undefined);
    if (can('faults.read')) api.get<Record<string, number>>('/api/v1/faults/open-by-transformer').then(setFaults).catch(() => undefined);
  }, [can]);

  const paged = usePaged<Transformer>(
    (page) =>
      api.get<TransformerPage>('/api/v1/transformers/registry/page', { page, size: PAGE, sort: 'name', dir: 'asc', q: q.trim(), status }) as Promise<Page<Transformer>>,
    [q, status]
  );
  const c = paged.counts as Partial<Record<TStatus, number>>;
  const all = Object.values(c).reduce((x: number, y) => x + (y ?? 0), 0);

  return (
    <ListShell
      paged={paged}
      data={paged.items}
      keyOf={(t) => String(t.id)}
      emptyTitle="No transformers found"
      header={
        <>
          <SearchBox value={q} onChangeText={setQ} placeholder="Name, number, device EUI…" />
          <Pills
            value={status}
            onChange={setStatus}
            options={[
              { key: '', label: 'All', count: all || null },
              { key: 'ONLINE', label: 'Online', count: c.ONLINE ?? null, tone: 'green' },
              { key: 'OFFLINE', label: 'Offline', count: c.OFFLINE ?? null, tone: 'red' },
              { key: 'DELAYED', label: 'Delayed', count: c.DELAYED ?? null, tone: 'amber' },
              { key: 'NEVER_SEEN', label: 'Never seen', count: c.NEVER_SEEN ?? null, tone: 'slate' },
              { key: 'NO_DEVICE', label: 'No device', count: c.NO_DEVICE ?? null, tone: 'slate' },
            ]}
          />
        </>
      }
      render={(t) => {
        const st = T_STATUS[t.status] ?? T_STATUS.NO_DEVICE;
        const link = gw[String(t.id)];
        const openFaults = faults[String(t.id)] ?? 0;
        return (
          <Pressable onPress={() => router.push(`/transformer/${t.id}`)} style={({ pressed }) => [s.item, pressed && { opacity: 0.85 }]}>
            <View style={[s.badge, { backgroundColor: TONE[st.tone].bg }]}>
              <Icon name="flash" size={19} color={TONE[st.tone].fg} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.name} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={s.sub} numberOfLines={1}>
                {t.transformerNumber ? `No. ${t.transformerNumber} · ` : ''}
                {depotName(t.depotId) ?? t.supplierName ?? '—'}
              </Text>
              <View style={s.chips}>
                <Chip label={`${st.label} · ${ago(t.lastSignalAt, t.minutesSinceSignal)}`} tone={st.tone} small />
                {t.openAlerts ? <Chip label={`${t.openAlerts} open`} tone="red" icon="alert-circle" small /> : null}
                {openFaults ? <Chip label={`${openFaults} fault`} tone="amber" icon="construct" small /> : null}
                {link ? <Chip label={link.name} tone={gStatus(link.status).tone} icon="radio-outline" small /> : null}
              </View>
            </View>
            <Icon name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        );
      }}
    />
  );
}

type RelayCounts = Record<string, { transformers: number; lastHeardAt?: string | null }>;

function GatewayList() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'' | GStatus | 'RELAYING' | 'SILENT'>('');
  const [relays, setRelays] = useState<RelayCounts>({});
  useEffect(() => {
    api.get<RelayCounts>('/api/v1/gateways/links/counts').then(setRelays).catch(() => undefined);
  }, []);

  const paged = usePaged<Gateway>(
    (page) =>
      api.get<Page<Gateway>>('/api/v1/gateways', {
        page,
        size: PAGE,
        sort: 'name,asc',
        search: q.trim(),
        status: filter && filter !== 'RELAYING' && filter !== 'SILENT' ? filter : undefined,
        relaying: filter === 'RELAYING' ? true : filter === 'SILENT' ? false : undefined,
      }),
    [q, filter]
  );

  return (
    <ListShell
      paged={paged}
      data={paged.items}
      keyOf={(g) => String(g.id)}
      emptyTitle="No gateways found"
      header={
        <>
          <SearchBox value={q} onChangeText={setQ} placeholder="Name, EUI, serial…" />
          <Pills
            value={filter}
            onChange={setFilter}
            options={[
              { key: '', label: 'All' },
              { key: 'ONLINE', label: 'Online', tone: 'green' },
              { key: 'OFFLINE', label: 'Offline', tone: 'red' },
              { key: 'DEGRADED', label: 'Degraded', tone: 'amber' },
              { key: 'RELAYING', label: 'Receiving transformers', tone: 'violet' },
              { key: 'SILENT', label: 'Never received', tone: 'slate' },
            ]}
          />
        </>
      }
      render={(g) => {
        const st = G_STATUS[(g.effectiveStatus as GStatus) ?? 'UNKNOWN'] ?? G_STATUS.UNKNOWN;
        const n = relays[String(g.id)]?.transformers ?? 0;
        return (
          <Pressable onPress={() => router.push(`/gateway/${g.id}`)} style={({ pressed }) => [s.item, pressed && { opacity: 0.85 }]}>
            <View style={[s.badge, { backgroundColor: TONE[st.tone].bg }]}>
              <Icon name="radio" size={19} color={TONE[st.tone].fg} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.name} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={s.sub} numberOfLines={1}>
                {[g.depotName, g.regionName].filter(Boolean).join(' · ') || g.gatewayEui || '—'}
              </Text>
              <View style={s.chips}>
                <Chip label={`${st.label} · ${ago(g.lastTrafficSeenAt || g.lastLoriotSeenAt)}`} tone={st.tone} small />
                <Chip label={n ? `${n} transformer${n === 1 ? '' : 's'}` : 'No transformers'} tone={n ? 'violet' : 'slate'} icon="flash-outline" small />
              </View>
            </View>
            <Icon name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        );
      }}
    />
  );
}


const s = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 13, borderWidth: 1, borderColor: C.line },
  badge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15.5, fontWeight: '800', color: C.text },
  sub: { fontSize: 12.5, color: C.sub },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  foot: { textAlign: 'center', color: C.muted, fontSize: 12, marginVertical: 12 },
});
