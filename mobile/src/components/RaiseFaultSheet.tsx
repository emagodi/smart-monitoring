import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Field, Notice, Sheet, Toggle } from '@/components/ui';
import { api, errorText } from '@/lib/api';
import { FAULT_TYPES } from '@/lib/format';
import { C } from '@/lib/theme';

/** Equipment fault on a transformer's monitoring kit; optionally pauses its alerts until the partner fixes it. */
export default function RaiseFaultSheet({
  open,
  onClose,
  onDone,
  transformer,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  transformer: { id: number; name: string; openAlerts?: number };
}) {
  const [type, setType] = useState('SENSOR_FAULT');
  const [desc, setDesc] = useState('');
  const [pause, setPause] = useState(true);
  const [closeOpen, setCloseOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/v1/faults', {
        transformerId: transformer.id,
        faultType: type,
        description: desc.trim() || undefined,
        suppressAlerts: pause,
        closeOpenAlerts: closeOpen && (transformer.openAlerts ?? 0) > 0,
      });
      setDesc('');
      onDone(pause ? 'Fault raised. Alerts from this transformer are paused until it is fixed.' : 'Fault raised.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Raise a fault alarm" subtitle={`${transformer.name}: an equipment problem (not an intrusion). The partner is expected to fix it.`}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.sub }}>What is wrong?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(FAULT_TYPES).map(([k, v]) => (
          <Pressable
            key={k}
            onPress={() => setType(k)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: type === k ? C.amber : C.line,
              backgroundColor: type === k ? '#FFFBEB' : C.white,
            }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: type === k ? '#B45309' : C.sub }}>{v}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Details" value={desc} onChangeText={setDesc} multiline placeholder="e.g. Door sensor triggers every night at about 02:00 with nobody on site" />
      <Toggle
        on={pause}
        onChange={setPause}
        icon="notifications-off-outline"
        label="Pause alerts until it is fixed"
        hint="Its triggers stop paging the team and ringing the siren; they are only counted on the fault. Alerts resume when it is marked fixed."
      />
      {(transformer.openAlerts ?? 0) > 0 ? (
        <Toggle
          on={closeOpen}
          onChange={setCloseOpen}
          tone="blue"
          icon="checkmark-done-outline"
          label={`Close its open alerts as technical fault (${transformer.openAlerts})`}
          hint="Clears the alerts this fault already caused from the response desk."
        />
      ) : null}
      {error ? <Notice text={error} /> : null}
      <Button label="Raise fault" icon="construct" variant="primary" busy={busy} onPress={submit} />
    </Sheet>
  );
}
