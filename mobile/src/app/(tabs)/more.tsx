import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Icon, ListRow, Notice, Screen, Section } from '@/components/ui';
import { useAlerts } from '@/lib/alerts';
import { useAuth } from '@/lib/auth';
import { registerPush, testAlertNotification, type PushState } from '@/lib/push';
import { C } from '@/lib/theme';

export default function More() {
  const { user, can, isPartner, signOut, serverUrl, depotName } = useAuth();
  const { duty } = useAlerts();
  const [push, setPush] = useState<PushState | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') setPush({ status: 'unsupported', detail: 'Push alerts work on the phone app only.' });
    else void registerPush().then(setPush);
  }, []);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const role = (user?.roles ?? []).map((r) => String(r).replace(/^ROLE[_-]/, '').replace(/_/g, ' ').toLowerCase()).join(', ');
  const dutyDepots = (duty?.depotIds ?? []).map((d) => depotName(d) ?? `Depot ${d}`);

  return (
    <Screen eyebrow="Account" title="More" subtitle="Your profile, faults, installations and alert settings.">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}</Text>
            <Text style={s.email}>{user?.email}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {isPartner ? <Chip label={user?.supplierName ?? 'Partner'} tone="violet" icon="business-outline" small /> : null}
          {user?.depot ? <Chip label={user.depot} tone="blue" icon="location-outline" small /> : user?.region ? <Chip label={user.region} tone="blue" icon="map-outline" small /> : !isPartner ? <Chip label="National" tone="blue" icon="globe-outline" small /> : null}
          {role ? <Chip label={role} tone="slate" icon="person-outline" small /> : null}
        </View>
      </Card>

      {can('response.acknowledge') ? (
        <Card tone={duty?.onDuty ? 'green' : 'slate'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={duty?.onDuty ? 'shield-checkmark' : 'shield-outline'} size={26} color={duty?.onDuty ? C.green : C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={s.dutyTitle}>{duty?.onDuty ? 'You are on duty' : duty?.rosterConfigured ? 'You are off duty' : 'No duty roster yet'}</Text>
              <Text style={s.dutySub}>
                {duty?.onDuty
                  ? `Alerts for ${dutyDepots.join(', ') || 'your depots'} ring on this phone.`
                  : duty?.rosterConfigured
                    ? 'Alerts go to the people on duty. Loss Control sets the roster on the web.'
                    : 'Everyone who can acknowledge receives the alerts.'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Section title="Work">
        <Card style={{ paddingVertical: 4 }}>
          {can('response.acknowledge') || can('response.read') ? <ListRow icon="shield-checkmark-outline" iconTone="red" title="Response desk" subtitle="Open and recent incidents" onPress={() => router.push('/respond')} /> : null}
          {can('faults.read') ? <ListRow icon="construct-outline" iconTone="amber" title="Fault alarms" subtitle="Faulty sensors and kits, paused alerts" onPress={() => router.push('/faults')} /> : null}
          {can('installations.read') ? <ListRow icon="hammer-outline" iconTone="violet" title="Installations" subtitle={isPartner ? 'Mark your sites ready for commissioning' : 'Installed, ready and commissioned sites'} onPress={() => router.push('/installations')} /> : null}
          <ListRow icon="flash-outline" iconTone="blue" title="Transformers" subtitle="Status, alerts and devices" onPress={() => router.push('/assets')} />
          {!isPartner ? <ListRow icon="radio-outline" iconTone="indigo" title="Gateways" subtitle="Online status and transformers on each" onPress={() => router.push({ pathname: '/assets', params: { tab: 'gateways' } })} /> : null}
        </Card>
      </Section>

      <Section title="Alerts on this phone">
        <Card style={{ gap: 12 }}>
          {push?.status === 'ok' ? (
            <Notice tone="green" text="Push alerts are on. New alerts ring with the siren even when TIAS is closed." />
          ) : push ? (
            <Notice tone="amber" text={push.detail ?? 'Push alerts are not set up on this phone.'} />
          ) : (
            <Notice tone="blue" text="Checking push alerts…" />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Platform.OS !== 'web' ? <Button style={{ flex: 1 }} label="Test siren" icon="volume-high" variant="ghost" onPress={() => void testAlertNotification()} /> : null}
            <Button
              style={{ flex: 1 }}
              label="Set up again"
              icon="refresh"
              variant="ghost"
              busy={checking}
              onPress={async () => {
                setChecking(true);
                setPush(await registerPush());
                setChecking(false);
              }}
            />
          </View>
        </Card>
      </Section>

      <Section title="About">
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="information-circle-outline" iconTone="slate" title={`TIAS ${Constants.expoConfig?.version ?? ''}`} subtitle="Powertel Communications for ZESA · ZETDC" />
          <ListRow icon="server-outline" iconTone="slate" title="Server" subtitle={serverUrl} />
        </Card>
      </Section>

      <Button label="Sign out" icon="log-out-outline" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontWeight: '800', fontSize: 18 },
  name: { fontSize: 17, fontWeight: '800', color: C.text },
  email: { fontSize: 13, color: C.sub, marginTop: 2 },
  dutyTitle: { fontSize: 15.5, fontWeight: '800', color: C.text },
  dutySub: { fontSize: 13, color: C.sub, marginTop: 2, lineHeight: 18 },
});
