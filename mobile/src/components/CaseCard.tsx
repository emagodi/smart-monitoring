import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Chip, Icon } from '@/components/ui';
import { CASE, EVENT, elapsed, eventKind, eventText, isOpen, outcomeLabel, statusOf } from '@/lib/format';
import { C } from '@/lib/theme';
import type { BoardCase } from '@/lib/types';

/** One incident on the response list: what happened, where, how long ago, and where it is in the process. */
export default function CaseCard({ item }: { item: BoardCase }) {
  const a = item.alert;
  const st = statusOf(a);
  const meta = CASE[st];
  const ev = EVENT[eventKind(a)];
  const open = isOpen(st);
  const crew = item.dispatches?.find((d) => ['DISPATCHED', 'ACCEPTED', 'ON_SCENE'].includes(d.status));
  return (
    <Card tone={meta.tone} onPress={() => router.push(`/case/${a.id}`)}>
      <View style={s.row}>
        <View style={[s.icon, { backgroundColor: ev.color }]}>
          <Icon name={ev.icon} size={21} color={C.white} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={1}>
              {eventText(a)}
            </Text>
            <Text style={[s.time, st === 'NEW' && { color: C.red }]}>{elapsed(a.createdAt)}</Text>
          </View>
          <Text style={s.place} numberOfLines={1}>
            {a.transformerName ?? 'Transformer'}
            {a.transformerNumber ? ` · No. ${a.transformerNumber}` : ''}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            #{a.id}
            {a.depotName ? ` · ${a.depotName}` : ''}
            {a.supplierName ? ` · ${a.supplierName}` : ''}
          </Text>
        </View>
      </View>
      <View style={s.foot}>
        <Chip label={open ? meta.label : `${meta.label} · ${outcomeLabel(a.outcome)}`} tone={meta.tone} small />
        {(a.occurrenceCount ?? 0) > 1 ? <Chip label={`${a.occurrenceCount} events`} tone="amber" icon="repeat" small /> : null}
        {crew ? <Chip label={crew.vehicleCallSign || crew.vehicleRegistration || 'Crew'} tone="blue" icon="car-outline" small /> : null}
        {a.assignedToName && open ? <Chip label={a.assignedToName} tone="slate" icon="person-outline" small /> : null}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15.5, fontWeight: '800', color: C.text },
  time: { fontSize: 12.5, fontWeight: '800', color: C.sub },
  place: { fontSize: 14, color: C.text, fontWeight: '600' },
  meta: { fontSize: 12.5, color: C.sub },
  foot: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
});
