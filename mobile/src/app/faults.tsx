import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Empty, Field, Loading, Notice, Screen, Segmented, Sheet } from '@/components/ui';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FAULT_TYPES, ago, dateTime } from '@/lib/format';
import { C } from '@/lib/theme';
import type { Fault, Page } from '@/lib/types';
import { useData } from '@/lib/useData';

const paused = (f: Fault) => f.status === 'OPEN' && (f.suppressAlerts === true || f.suppressAlerts === 1);

export default function Faults() {
  const { can, depotName } = useAuth();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'green' | 'red' } | null>(null);
  const [fixing, setFixing] = useState<Fault | null>(null);
  const [note, setNote] = useState('');

  const { data, loading, error, refreshing, reload, silentReload } = useData<Page<Fault>>(
    () => api.get<Page<Fault>>('/api/v1/faults', { status, size: 50, page: 0 }),
    [status],
    60_000
  );

  const togglePause = async (f: Fault) => {
    setBusy(f.id);
    try {
      await api.post(`/api/v1/faults/${f.id}/suppress`, { suppress: !paused(f) });
      setNotice({ text: paused(f) ? `Alerts from ${f.transformerName} are active again.` : `Alerts from ${f.transformerName} are paused.`, tone: 'green' });
      await silentReload();
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'red' });
    } finally {
      setBusy(null);
    }
  };

  const resolve = async () => {
    if (!fixing) return;
    setBusy(fixing.id);
    try {
      await api.post(`/api/v1/faults/${fixing.id}/resolve`, { note: note.trim() || undefined });
      setNotice({ text: `${fixing.transformerName} marked fixed. Its alerts are active again.`, tone: 'green' });
      setFixing(null);
      setNote('');
      await silentReload();
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'red' });
    } finally {
      setBusy(null);
    }
  };

  const counts = data?.counts ?? {};
  return (
    <Screen
      back
      eyebrow="Reaction"
      title="Fault alarms"
      subtitle="Equipment faults on monitoring kits. The partner fixes them; alerts can be paused meanwhile."
      refreshing={refreshing}
      onRefresh={reload}
      hero={
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { key: 'OPEN', label: 'Open', count: counts.OPEN ?? null },
            { key: 'RESOLVED', label: 'Fixed', count: counts.RESOLVED ?? null },
          ]}
        />
      }>
      {notice ? <Notice text={notice.text} tone={notice.tone} /> : null}
      {error ? <Notice text={error} /> : null}
      {loading && !data ? (
        <Loading />
      ) : !data?.content.length ? (
        <Card>
          <Empty title={status === 'OPEN' ? 'No open faults' : 'No fixed faults yet'} text={status === 'OPEN' ? 'Raise one from a transformer when its kit misbehaves.' : undefined} />
        </Card>
      ) : (
        data.content.map((f) => (
          <Card key={f.id} tone={f.status === 'OPEN' ? 'amber' : 'green'} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.title} onPress={() => router.push(`/transformer/${f.transformerId}`)}>
                  {f.transformerName}
                  {f.transformerNumber ? <Text style={s.num}> No. {f.transformerNumber}</Text> : null}
                </Text>
                <Text style={s.sub}>{[depotName(f.depotId), f.supplierName].filter(Boolean).join(' · ')}</Text>
              </View>
              <Chip label={f.status === 'OPEN' ? `Open · ${ago(f.reportedAt).replace(' ago', '')}` : 'Fixed'} tone={f.status === 'OPEN' ? 'red' : 'green'} small />
            </View>
            <Text style={s.type}>{FAULT_TYPES[f.faultType] ?? f.faultType}</Text>
            {f.description ? <Text style={s.desc}>{f.description}</Text> : null}
            <View style={s.chips}>
              {f.status === 'OPEN' ? (
                paused(f) ? (
                  <Chip label={`Alerts paused · ${f.suppressedTriggers ?? 0} triggers ignored`} tone="amber" icon="notifications-off" small />
                ) : (
                  <Chip label="Alerts still active" tone="slate" icon="notifications" small />
                )
              ) : (
                <Chip label={`Fixed ${dateTime(f.resolvedAt)}${f.resolvedBy ? ` by ${f.resolvedBy}` : ''}`} tone="green" small />
              )}
              {f.alertsClosed ? <Chip label={`${f.alertsClosed} alerts closed`} tone="blue" small /> : null}
            </View>
            <Text style={s.meta}>
              Raised {dateTime(f.reportedAt)}
              {f.reportedBy ? ` by ${f.reportedBy}` : ''}
            </Text>
            {f.status === 'OPEN' && can('faults.record') ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button style={{ flex: 1, minHeight: 44 }} label={paused(f) ? 'Resume alerts' : 'Pause alerts'} icon={paused(f) ? 'notifications' : 'notifications-off'} variant="ghost" busy={busy === f.id && !fixing} onPress={() => void togglePause(f)} />
                <Button style={{ flex: 1, minHeight: 44 }} label="Mark fixed" icon="checkmark" variant="success" onPress={() => setFixing(f)} />
              </View>
            ) : null}
          </Card>
        ))
      )}

      <Sheet open={!!fixing} onClose={() => setFixing(null)} title="Mark fixed" subtitle={fixing ? `${fixing.transformerName}: alerts from this transformer resume.` : undefined}>
        <Field label="What was done (optional)" value={note} onChangeText={setNote} multiline placeholder="e.g. Door switch replaced by Oqulus technician" />
        <Button label="Mark fixed" icon="checkmark-circle" variant="success" busy={busy === fixing?.id} onPress={() => void resolve()} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 15.5, fontWeight: '800', color: C.text },
  num: { fontSize: 13, fontWeight: '600', color: C.sub },
  sub: { fontSize: 12.5, color: C.sub, marginTop: 2 },
  type: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  desc: { fontSize: 13.5, color: C.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 12, color: C.muted },
});
