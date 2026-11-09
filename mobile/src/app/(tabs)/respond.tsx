import { useState } from 'react';
import { Text, View } from 'react-native';

import CaseCard from '@/components/CaseCard';
import { Card, Empty, Screen, Segmented } from '@/components/ui';
import { useAlerts } from '@/lib/alerts';
import { C } from '@/lib/theme';

type Lane = 'new' | 'progress' | 'closed';

export default function Respond() {
  const { board, refresh } = useAlerts();
  const [lane, setLane] = useState<Lane>('new');
  const [refreshing, setRefreshing] = useState(false);
  const open = board?.open ?? [];
  const lanes = {
    new: open.filter((c) => !c.alert.caseStatus || c.alert.caseStatus === 'NEW'),
    progress: open.filter((c) => c.alert.caseStatus && c.alert.caseStatus !== 'NEW'),
    closed: board?.recentlyClosed ?? [],
  };
  const list = lanes[lane];

  return (
    <Screen
      eyebrow="Response desk"
      title="Respond"
      subtitle="Acknowledge, go to site, close with what you found."
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
      }}
      hero={
        <Segmented
          value={lane}
          onChange={setLane}
          options={[
            { key: 'new', label: 'New', count: lanes.new.length },
            { key: 'progress', label: 'In progress', count: lanes.progress.length },
            { key: 'closed', label: 'Closed 24h', count: lanes.closed.length },
          ]}
        />
      }>
      {!board ? (
        <Card>
          <Empty icon="sync-outline" title="Loading the response desk…" />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <Empty
            icon={lane === 'closed' ? 'archive-outline' : 'shield-checkmark-outline'}
            title={lane === 'new' ? 'No new alerts' : lane === 'progress' ? 'Nothing in progress' : 'Nothing closed in the last 24 hours'}
            text={lane === 'new' ? 'You will hear the siren as soon as one comes in.' : undefined}
          />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {list.map((c) => (
            <CaseCard key={c.alert.id} item={c} />
          ))}
          <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12 }}>Updates every 15 seconds</Text>
        </View>
      )}
    </Screen>
  );
}
