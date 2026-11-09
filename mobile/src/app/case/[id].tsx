import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert as RNAlert, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Choice, Chip, Field, Icon, KV, Loading, Notice, Screen, Section, Sheet } from '@/components/ui';
import { api, errorText } from '@/lib/api';
import { useAlerts } from '@/lib/alerts';
import { useAuth } from '@/lib/auth';
import { CASE, EVENT, OUTCOMES, dateTime, directionsUrl, elapsed, eventKind, eventText, isOpen, outcomeLabel, statusOf } from '@/lib/format';
import { C, TONE } from '@/lib/theme';
import type { Alert, Dispatch, Outcome, TimelineItem, Transformer } from '@/lib/types';
import { useData } from '@/lib/useData';

type CaseData = { alert: Alert; dispatches: Dispatch[]; timeline: TimelineItem[]; device: Transformer | null };

const STEPS: Array<{ label: string; at: (a: Alert) => string | null | undefined }> = [
  { label: 'Detected', at: (a) => a.createdAt },
  { label: 'Acknowledged', at: (a) => a.acknowledgedAt },
  { label: 'On site', at: (a) => a.onSceneAt },
  { label: 'Closed', at: (a) => a.closedAt || a.resolvedAt || a.falseAlarmAt },
];

const ACTIVITY: Record<string, string> = {
  ACKNOWLEDGED: 'Acknowledged',
  ACKNOWLEDGE: 'Acknowledged',
  DISPATCHED: 'Vehicle dispatched',
  ON_SCENE: 'Team on site',
  RESOLVED: 'Closed',
  CLOSED: 'Closed',
  FALSE_ALARM: 'Closed as false alarm',
  NOTE: 'Note',
  ESCALATED: 'Escalated',
  REOPENED: 'Re-opened',
};

const confirm = (title: string, message: string, ok: string) =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web') return resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? true);
    RNAlert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const alerts = useAlerts();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState('');

  const { data, loading, error: loadError, refreshing, reload, silentReload } = useData<CaseData>(
    async () => {
      const [alert, dispatches, timeline] = await Promise.all([
        api.get<Alert>(`/api/v1/alerts/${id}`),
        api.get<Dispatch[]>(`/api/v1/response/cases/${id}/dispatches`).catch(() => [] as Dispatch[]),
        api.get<TimelineItem[] | { content: TimelineItem[] }>(`/api/v1/alerts/${id}/timeline`).catch(() => [] as TimelineItem[]),
      ]);
      const device = alert.transformerId ? await api.get<Transformer>(`/api/v1/transformers/registry/${alert.transformerId}`).catch(() => null) : null;
      const tl = Array.isArray(timeline) ? timeline : timeline?.content ?? [];
      return { alert, dispatches: dispatches ?? [], timeline: tl.slice().sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))), device };
    },
    [id],
    15_000
  );

  const run = async (key: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      await fn();
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(message);
      await Promise.all([silentReload(), alerts.refresh()]);
    } catch (e) {
      setError(errorText(e));
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <Screen back eyebrow="Incident" title={`Alert #${id}`} refreshing={refreshing} onRefresh={reload}>
        {loading ? <Loading /> : <Notice text={loadError ?? 'Could not load this alert.'} />}
      </Screen>
    );
  }

  const a = data.alert;
  const st = statusOf(a);
  const meta = CASE[st];
  const ev = EVENT[eventKind(a)];
  const open = isOpen(st);
  const crew = data.dispatches.find((d) => ['DISPATCHED', 'ACCEPTED', 'ON_SCENE'].includes(d.status));
  const lat = a.lat ?? data.device?.lat;
  const lng = a.lng ?? data.device?.lng;

  const acknowledge = () => run('ack', () => api.post(`/api/v1/response/cases/${a.id}/acknowledge`, { note: 'Acknowledged on the TIAS mobile app' }), 'Acknowledged. The team can see you are on it.');
  const onSite = () => run('scene', () => api.post(`/api/v1/response/cases/${a.id}/on-scene`, { note: 'On site (TIAS mobile app)' }), 'Marked: team on site.');
  const close = () =>
    run(
      'close',
      async () => {
        await api.post(`/api/v1/response/cases/${a.id}/close`, { outcome, note: note.trim() || undefined });
        setCloseOpen(false);
        setNote('');
      },
      `Closed as ${outcomeLabel(outcome)}.${outcome === 'TECHNICAL_FAULT' ? ' A fault alarm was raised for the partner.' : ''}`
    );
  const control = async (action: 'arm' | 'disarm') => {
    const ok = await confirm(
      action === 'arm' ? 'Arm the site?' : 'Disarm the site?',
      action === 'arm' ? 'The site siren will sound on the next intrusion.' : 'The site siren stays silent until the site is armed again. Do this only when a crew is working on site.',
      action === 'arm' ? 'Arm' : 'Disarm'
    );
    if (ok) await run(action, () => api.post(`/api/v1/oculus-control/transformers/${a.transformerId}/${action}`, undefined, { alertId: a.id }), action === 'arm' ? 'Arm command sent to the site.' : 'Disarm command sent to the site.');
  };

  return (
    <Screen
      back
      eyebrow={`Incident #${a.id}`}
      title={eventText(a)}
      subtitle={`${a.transformerName ?? 'Transformer'}${a.depotName ? ` · ${a.depotName}` : ''}`}
      refreshing={refreshing}
      onRefresh={reload}
      hero={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={[s.heroChip, { backgroundColor: TONE[meta.tone].dot }]}>
            <Text style={s.heroChipText}>{open ? meta.label : `${meta.label} · ${outcomeLabel(a.outcome)}`}</Text>
          </View>
          <View style={s.heroChipSoft}>
            <Icon name="time-outline" size={13} color="#BFDBFE" />
            <Text style={s.heroChipText}>{elapsed(a.createdAt)} ago</Text>
          </View>
          {(a.occurrenceCount ?? 0) > 1 ? (
            <View style={s.heroChipSoft}>
              <Icon name="repeat" size={13} color="#BFDBFE" />
              <Text style={s.heroChipText}>{a.occurrenceCount} events</Text>
            </View>
          ) : null}
        </View>
      }>
      {error ? <Notice text={error} /> : null}
      {done ? <Notice text={done} tone="green" /> : null}

      {open ? (
        <Card style={{ gap: 10 }}>
          {st === 'NEW' && can('response.acknowledge') ? (
            <Button label="Acknowledge" icon="checkmark-circle" variant="danger" busy={busy === 'ack'} onPress={acknowledge} />
          ) : null}
          {st !== 'NEW' && st !== 'ON_SCENE' && can('response.acknowledge') ? (
            <Button label="We are on site" icon="location" variant="primary" busy={busy === 'scene'} onPress={onSite} />
          ) : null}
          {can('response.close') ? (
            <Button label="Close with outcome" icon="flag" variant={st === 'ON_SCENE' ? 'success' : 'ghost'} onPress={() => setCloseOpen(true)} />
          ) : null}
          {lat != null && lng != null ? (
            <Button label="Directions to site" icon="navigate" variant="ghost" onPress={() => void Linking.openURL(directionsUrl(Number(lat), Number(lng)))} />
          ) : null}
        </Card>
      ) : (
        <Card tone={meta.tone} style={{ gap: 6 }}>
          <Text style={s.closedTitle}>Closed as {outcomeLabel(a.outcome)}</Text>
          <Text style={s.closedText}>
            {a.closedByName ? `By ${a.closedByName} · ` : ''}
            {dateTime(a.closedAt || a.resolvedAt || a.falseAlarmAt)}
          </Text>
          {a.outcomeNote ? <Text style={s.closedNote}>“{a.outcomeNote}”</Text> : null}
        </Card>
      )}

      <Section title="Progress">
        <Card>
          {STEPS.map((step, i) => {
            const at = step.at(a);
            const doneStep = !!at;
            return (
              <View key={step.label} style={s.step}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[s.stepDot, doneStep && { backgroundColor: C.blue, borderColor: C.blue }]}>
                    {doneStep ? <Icon name="checkmark" size={13} color={C.white} /> : null}
                  </View>
                  {i < STEPS.length - 1 ? <View style={[s.stepLine, doneStep && { backgroundColor: '#93C5FD' }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < STEPS.length - 1 ? 14 : 0 }}>
                  <Text style={[s.stepLabel, !doneStep && { color: C.muted }]}>{step.label}</Text>
                  <Text style={s.stepAt}>{at ? dateTime(at) : 'Waiting'}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Details">
        <Card style={{ paddingVertical: 4 }}>
          <View style={s.evRow}>
            <View style={[s.evIcon, { backgroundColor: ev.color }]}>
              <Icon name={ev.icon} size={20} color={C.white} />
            </View>
            <Text style={s.evText}>{a.message || eventText(a)}</Text>
          </View>
          <KV k="Transformer" v={`${a.transformerName ?? '—'}${a.transformerNumber ? ` (No. ${a.transformerNumber})` : ''}`} />
          <KV k="Depot" v={a.depotName} />
          <KV k="Partner" v={a.supplierName} />
          <KV k="Device" v={a.deviceName} />
          <KV k="First detected" v={dateTime(a.createdAt)} />
          {a.lastSeenAt ? <KV k="Last event" v={dateTime(a.lastSeenAt)} /> : null}
          {data.device ? <KV k="Site alarm" v={data.device.reportedArmState === 'ARMED' ? 'Armed' : data.device.reportedArmState === 'DISARMED' ? 'Disarmed' : 'Unknown'} /> : null}
        </Card>
        {a.transformerId ? <Button label="Open transformer" icon="flash-outline" variant="ghost" onPress={() => router.push(`/transformer/${a.transformerId}`)} /> : null}
      </Section>

      {crew ? (
        <Section title="Crew">
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="car-sport" size={22} color={C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={s.crewTitle}>{crew.vehicleCallSign || crew.vehicleRegistration}</Text>
                <Text style={s.crewSub}>
                  {crew.crewLeadName ?? 'Crew lead'} · {crew.status.replace('_', ' ').toLowerCase()}
                </Text>
              </View>
              <Chip label={crew.status === 'ON_SCENE' ? 'On site' : crew.status === 'ACCEPTED' ? 'En route' : 'Dispatched'} tone="blue" small />
            </View>
            {crew.crewLeadPhone ? <Button label={`Call ${crew.crewLeadName ?? 'crew lead'}`} icon="call" variant="ghost" onPress={() => void Linking.openURL(`tel:${crew.crewLeadPhone}`)} /> : null}
          </Card>
        </Section>
      ) : null}

      {a.transformerId && (can('control.arm') || can('control.disarm')) && open ? (
        <Section title="Site alarm">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {can('control.arm') ? <Button style={{ flex: 1 }} label="Arm" icon="lock-closed" variant="dark" busy={busy === 'arm'} onPress={() => void control('arm')} /> : null}
            {can('control.disarm') ? <Button style={{ flex: 1 }} label="Disarm" icon="lock-open" variant="ghost" busy={busy === 'disarm'} onPress={() => void control('disarm')} /> : null}
          </View>
        </Section>
      ) : null}

      <Section title="Timeline">
        <Card>
          {data.timeline.length === 0 ? (
            <Text style={s.crewSub}>No actions recorded yet.</Text>
          ) : (
            data.timeline.slice(0, 30).map((t, i) => (
              <View key={t.id ?? i} style={[s.tl, i > 0 && { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
                <View style={s.tlDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.tlTitle}>{ACTIVITY[t.activityType] ?? (t.statusAfter ? CASE[t.statusAfter as keyof typeof CASE]?.label ?? t.activityType : t.activityType)}</Text>
                  <Text style={s.tlSub}>
                    {t.actorName || t.actorEmail || 'System'} · {dateTime(t.createdAt)}
                  </Text>
                  {t.note ? <Text style={s.tlNote}>{t.note}</Text> : null}
                </View>
              </View>
            ))
          )}
        </Card>
      </Section>

      <Sheet open={closeOpen} onClose={() => setCloseOpen(false)} title="Close the incident" subtitle="What did the team find on site?">
        {OUTCOMES.map((o) => (
          <Choice key={o.key} label={o.label} hint={o.hint} icon={o.icon} tone={o.tone} on={outcome === o.key} onPress={() => setOutcome(o.key)} />
        ))}
        {outcome === 'TECHNICAL_FAULT' ? <Notice tone="amber" text="A fault alarm is raised on this transformer so the partner fixes it." /> : null}
        <Field label={outcome === 'OTHER' ? 'What happened (required)' : 'What the team found (optional)'} value={note} onChangeText={setNote} multiline placeholder="e.g. Door found open, padlock cut. Police informed." />
        <Button
          label={outcome ? `Close as ${outcomeLabel(outcome)}` : 'Choose an outcome'}
          icon="flag"
          variant="success"
          disabled={!outcome || (outcome === 'OTHER' && !note.trim())}
          busy={busy === 'close'}
          onPress={close}
        />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  heroChipSoft: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: 'rgba(255,255,255,0.13)' },
  heroChipText: { color: C.white, fontSize: 12.5, fontWeight: '800' },
  closedTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  closedText: { fontSize: 13, color: C.sub },
  closedNote: { fontSize: 14, color: C.text, fontStyle: 'italic' },
  step: { flexDirection: 'row', gap: 12 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, backgroundColor: C.line, marginVertical: 2 },
  stepLabel: { fontSize: 14.5, fontWeight: '800', color: C.text },
  stepAt: { fontSize: 12.5, color: C.sub, marginTop: 1 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  evIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  crewTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  crewSub: { fontSize: 13, color: C.sub },
  tl: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue, marginTop: 6 },
  tlTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  tlSub: { fontSize: 12, color: C.sub, marginTop: 1 },
  tlNote: { fontSize: 13, color: C.text, marginTop: 4 },
});
