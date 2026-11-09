import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Empty, Field, Loading, Notice, Pills, Screen, SearchBox, Sheet } from '@/components/ui';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { INSTALL, dateOnly, dateTime } from '@/lib/format';
import { C } from '@/lib/theme';
import type { Installation, Page } from '@/lib/types';
import { useData } from '@/lib/useData';

type Filter = '' | Installation['status'];

/** Installation and commissioning progress. Partners mark their sites ready for commissioning from here. */
export default function Installations() {
  const { can, depotName, isPartner } = useAuth();
  const [status, setStatus] = useState<Filter>('');
  const [q, setQ] = useState('');
  const [ready, setReady] = useState<Installation | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'green' | 'red' } | null>(null);

  const { data, loading, error, refreshing, reload, silentReload } = useData<Page<Installation>>(
    () => api.get<Page<Installation>>('/api/v1/lifecycle/installations', { status, q: q.trim(), size: 50, page: 0 }),
    [status, q],
    60_000
  );
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const markReady = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/lifecycle/installations/${ready.id}/ready`, { note: note.trim() || undefined });
      setNotice({ text: `${ready.transformerName} is ready for commissioning. ZESA will set a date.`, tone: 'green' });
      setReady(null);
      setNote('');
      await silentReload();
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'red' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back
      eyebrow="Lifecycle"
      title="Installations"
      subtitle={isPartner ? 'Your installed sites. Mark each one ready once you have tested it.' : 'Installed, ready, scheduled and commissioned sites.'}
      refreshing={refreshing}
      onRefresh={reload}>
      <SearchBox value={q} onChangeText={setQ} placeholder="Transformer, number, device EUI…" />
      <Pills
        value={status}
        onChange={setStatus}
        options={[
          { key: '', label: 'All', count: total || null },
          { key: 'INSTALLED', label: 'Installed', count: counts.INSTALLED ?? null, tone: 'blue' },
          { key: 'READY', label: 'Ready', count: counts.READY ?? null, tone: 'violet' },
          { key: 'SCHEDULED', label: 'Scheduled', count: counts.SCHEDULED ?? null, tone: 'indigo' },
          { key: 'COMMISSIONED', label: 'Commissioned', count: counts.COMMISSIONED ?? null, tone: 'green' },
          { key: 'FAILED', label: 'Failed', count: counts.FAILED ?? null, tone: 'red' },
        ]}
      />
      {notice ? <Notice text={notice.text} tone={notice.tone} /> : null}
      {error ? <Notice text={error} /> : null}
      {loading && !data ? (
        <Loading />
      ) : !data?.content.length ? (
        <Card>
          <Empty icon="construct-outline" title="No installations" text="Installations recorded on the web appear here." />
        </Card>
      ) : (
        data.content.map((i) => {
          const st = INSTALL[i.status] ?? INSTALL.INSTALLED;
          const canReady = can('installations.ready') && (i.status === 'INSTALLED' || i.status === 'FAILED');
          return (
            <Card key={i.id} tone={st.tone} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title} onPress={() => router.push(`/transformer/${i.transformerId}`)}>
                    {i.transformerName}
                  </Text>
                  <Text style={s.sub}>{[i.transformerNumber ? `No. ${i.transformerNumber}` : null, depotName(i.depotId), i.supplierName].filter(Boolean).join(' · ')}</Text>
                </View>
                <Chip label={st.label} tone={st.tone} small />
              </View>
              <View style={s.dates}>
                <DateCell label="Installed" value={dateOnly(i.installedOn)} />
                <DateCell label="Ready" value={i.readyAt ? dateOnly(i.readyAt) : '—'} />
                <DateCell label="Commissioning" value={i.commissionedAt ? dateOnly(i.commissionedAt) : i.tentativeDate ? dateOnly(i.tentativeDate) : '—'} />
              </View>
              {(i.attempts ?? 0) > 0 ? <Text style={s.meta}>{i.attempts} commissioning attempt{i.attempts === 1 ? '' : 's'}{i.lastAttemptStatus ? ` · last: ${i.lastAttemptStatus.toLowerCase()}` : ''}</Text> : null}
              {i.status === 'FAILED' && i.failedAt ? <Notice tone="red" text={`Failed commissioning on ${dateTime(i.failedAt)}. Fix the issues, then mark it ready again.`} /> : null}
              {canReady ? <Button label="Ready for commissioning" icon="checkmark-done" variant="primary" onPress={() => setReady(i)} /> : null}
            </Card>
          );
        })
      )}

      <Sheet open={!!ready} onClose={() => setReady(null)} title="Ready for commissioning" subtitle={ready ? `${ready.transformerName}: confirm you have tested the installation. ZESA then sets a commissioning date.` : undefined}>
        <Field label="Note for ZESA (optional)" value={note} onChangeText={setNote} multiline placeholder="e.g. All sensors tested, siren OK, door contact aligned" />
        <Button label="Mark ready" icon="checkmark-done" busy={busy} onPress={() => void markReady()} />
      </Sheet>
    </Screen>
  );
}

function DateCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.dLabel}>{label}</Text>
      <Text style={s.dValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 15.5, fontWeight: '800', color: C.text },
  sub: { fontSize: 12.5, color: C.sub, marginTop: 2 },
  dates: { flexDirection: 'row', gap: 8, backgroundColor: C.lineSoft, borderRadius: 12, padding: 10 },
  dLabel: { fontSize: 11, color: C.sub, fontWeight: '700' },
  dValue: { fontSize: 13, color: C.text, fontWeight: '700', marginTop: 2 },
  meta: { fontSize: 12.5, color: C.sub },
});
