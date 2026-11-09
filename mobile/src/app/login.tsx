import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, Icon, Notice, Sheet } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

export default function Login() {
  const { user, signIn, serverUrl, setServerUrl } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [server, setServer] = useState(serverUrl);

  if (user) return <Redirect href="/" />;

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your e-mail and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      const m = errorText(e, 'Sign-in failed.');
      setError(/invalid credentials|401/i.test(m) ? 'Wrong e-mail or password.' : m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[C.navy, C.blue, C.sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <View style={st.brand}>
            <Image source={require('@/assets/images/icon.png')} style={st.appIcon} />
            <Text style={st.appName}>TIAS</Text>
            <Text style={st.tagline}>Transformer monitoring and alert response</Text>
          </View>

          <View style={st.card}>
            <Text style={st.cardTitle}>Sign in</Text>
            <Text style={st.cardSub}>Use the same e-mail and password as the TIAS web portal.</Text>
            <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="name@zesa.co.zw" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" />
            <View style={{ gap: 6 }}>
              <Text style={st.label}>Password</Text>
              <View style={st.pwd}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  placeholder="Password"
                  placeholderTextColor={C.muted}
                  style={st.pwdInput}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <Pressable onPress={() => setShow(!show)} hitSlop={10}>
                  <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.sub} />
                </Pressable>
              </View>
            </View>
            {error ? <Notice text={error} /> : null}
            <Button label="Sign in" icon="log-in-outline" onPress={submit} busy={busy} />
          </View>

          <View style={st.footer}>
            <View style={st.partner}>
              <Image source={require('@/assets/images/powertel.png')} style={st.powertel} resizeMode="contain" />
            </View>
            <Text style={st.footText}>Powertel Communications for ZESA · ZETDC</Text>
            <Pressable onPress={() => setServerOpen(true)} hitSlop={8} style={st.serverBtn}>
              <Icon name="server-outline" size={13} color="#BFDBFE" />
              <Text style={st.serverText}>{serverUrl.replace(/^https?:\/\//, '')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet open={serverOpen} onClose={() => setServerOpen(false)} title="TIAS server" subtitle="Only change this if your administrator tells you to.">
        <Field label="Server address" value={server} onChangeText={setServer} autoCapitalize="none" keyboardType="url" placeholder="http://154.73.80.22" />
        <Button
          label="Save"
          icon="checkmark"
          onPress={async () => {
            await setServerUrl(server);
            setServerOpen(false);
          }}
        />
      </Sheet>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 20, gap: 22, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 6 },
  appIcon: { width: 84, height: 84, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  appName: { color: C.white, fontSize: 34, fontWeight: '900', letterSpacing: 4, marginTop: 8 },
  tagline: { color: '#C7D7F5', fontSize: 14.5, fontWeight: '600' },
  card: { backgroundColor: C.bg, borderRadius: 26, padding: 18, gap: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  cardTitle: { fontSize: 21, fontWeight: '800', color: C.text },
  cardSub: { fontSize: 13.5, color: C.sub, marginTop: -8 },
  label: { fontSize: 13, fontWeight: '700', color: C.sub },
  pwd: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 },
  pwdInput: { flex: 1, paddingVertical: 12, fontSize: 15.5, color: C.text },
  footer: { alignItems: 'center', gap: 8 },
  partner: { backgroundColor: C.white, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8 },
  powertel: { width: 150, height: 56 },
  footText: { color: '#C7D7F5', fontSize: 12, fontWeight: '600' },
  serverBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  serverText: { color: '#BFDBFE', fontSize: 11.5 },
});
