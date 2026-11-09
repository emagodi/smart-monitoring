import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBannerSpace } from '@/lib/alerts';
import { signal } from '@/lib/format';
import { C, R, TONE, shadow, type Tone } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 18, color = C.sub }: { name: string; size?: number; color?: import("react-native").ColorValue }) {
  return <Ionicons name={name as IconName} size={size} color={(color ?? undefined) as string | undefined} />;
}

/** Page with the navy brand header, pull-to-refresh and content cards below. */
export function Screen({
  title,
  subtitle,
  eyebrow,
  back,
  right,
  hero,
  children,
  refreshing,
  onRefresh,
  scroll = true,
}: {
  title: string;
  subtitle?: string | null;
  eyebrow?: string;
  back?: boolean;
  right?: ReactNode;
  hero?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bannerSpace = useBannerSpace();
  const header = (
    <LinearGradient colors={[C.navy, C.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 10 }]}>
      <View style={s.heroRow}>
        {back ? (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={s.heroBtn}>
            <Icon name="chevron-back" size={22} color={C.white} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
          <Text style={s.heroTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.heroSub} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {hero ? <View style={{ marginTop: 14 }}>{hero}</View> : null}
    </LinearGradient>
  );
  if (!scroll) {
    return (
      <View style={s.page}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <View style={s.page}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 + bannerSpace }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.white} colors={[C.blue]} /> : undefined}
        keyboardShouldPersistTaps="handled">
        {header}
        <View style={s.body}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function Card({ children, style, onPress, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: Tone }) {
  const border = tone ? { borderColor: TONE[tone].dot + '55', borderLeftWidth: 4, borderLeftColor: TONE[tone].dot } : null;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, border, pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, border, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Chip({ label, tone = 'slate', icon, small }: { label: string; tone?: Tone; icon?: string; small?: boolean }) {
  const t = TONE[tone];
  return (
    <View style={[s.chip, { backgroundColor: t.bg }, small && { paddingVertical: 2, paddingHorizontal: 7 }]}>
      {icon ? <Icon name={icon} size={small ? 11 : 13} color={t.fg} /> : <View style={[s.dot, { backgroundColor: t.dot }]} />}
      <Text style={[s.chipText, { color: t.fg }, small && { fontSize: 11 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Dot({ tone, size = 9 }: { tone: Tone; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size, backgroundColor: TONE[tone].dot }} />;
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  busy,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  variant?: 'primary' | 'danger' | 'success' | 'ghost' | 'light' | 'dark';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = {
    primary: { bg: C.blue, fg: C.white, border: C.blue },
    danger: { bg: C.red, fg: C.white, border: C.red },
    success: { bg: C.green, fg: C.white, border: C.green },
    dark: { bg: C.navy, fg: C.white, border: C.navy },
    light: { bg: C.white, fg: C.navy, border: C.white },
    ghost: { bg: C.white, fg: C.text, border: C.line },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.btn, { backgroundColor: v.bg, borderColor: v.border }, (disabled || busy) && { opacity: 0.55 }, pressed && { opacity: 0.85 }, style]}>
      {busy ? <ActivityIndicator color={v.fg} size="small" /> : icon ? <Icon name={icon} size={19} color={v.fg} /> : null}
      <Text style={[s.btnText, { color: v.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ key: T; label: string; count?: number | null }>; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: C.navy }]} numberOfLines={1}>
              {o.label}
            </Text>
            {o.count != null ? (
              <View style={[s.segCount, on && { backgroundColor: C.blue }]}>
                <Text style={[s.segCountText, on && { color: C.white }]}>{o.count > 99 ? '99+' : o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontally scrolling filter pills. */
export function Pills<T extends string>({ value, options, onChange }: { value: T; options: Array<{ key: T; label: string; count?: number | null; tone?: Tone }>; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.pill, on && { backgroundColor: C.navy, borderColor: C.navy }]}>
            {o.tone ? <Dot tone={o.tone} size={7} /> : null}
            <Text style={[s.pillText, on && { color: C.white }]}>{o.label}</Text>
            {o.count != null ? <Text style={[s.pillCount, on && { color: '#BFDBFE' }]}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SearchBox(props: TextInputProps) {
  return (
    <View style={s.search}>
      <Icon name="search" size={17} color={C.muted} />
      <TextInput placeholderTextColor={C.muted} style={s.searchInput} autoCorrect={false} autoCapitalize="none" returnKeyType="search" {...props} />
      {props.value ? (
        <Pressable onPress={() => props.onChangeText?.('')} hitSlop={10}>
          <Icon name="close-circle" size={17} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.muted} style={[s.input, props.multiline && { minHeight: 84, textAlignVertical: 'top' }]} {...props} />
    </View>
  );
}

export function Notice({ text, tone = 'red', icon }: { text: string; tone?: Tone; icon?: string }) {
  const t = TONE[tone];
  return (
    <View style={[s.notice, { backgroundColor: t.bg, borderColor: t.dot + '40' }]}>
      <Icon name={icon ?? (tone === 'green' ? 'checkmark-circle' : tone === 'red' ? 'alert-circle' : 'information-circle')} size={18} color={t.fg} />
      <Text style={[s.noticeText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function Empty({ icon = 'checkmark-done-circle-outline', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={30} color={C.blue} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator color={C.blue} />
    </View>
  );
}

export function Stat({ label, value, sub, tone, icon, onPress }: { label: string; value: string | number; sub?: string; tone?: Tone; icon?: string; onPress?: () => void }) {
  const t = tone ? TONE[tone] : null;
  return (
    <Card onPress={onPress} style={s.stat}>
      <View style={s.statTop}>
        {icon ? (
          <View style={[s.statIcon, { backgroundColor: t?.bg ?? C.brandSoft }]}>
            <Icon name={icon} size={16} color={t?.fg ?? C.blue} />
          </View>
        ) : null}
        <Text style={s.statLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[s.statValue, t && { color: t.fg }]}>{value}</Text>
      {sub ? (
        <Text style={s.statSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

/** A label / value line inside a card. */
export function KV({ k, v, mono }: { k: string; v?: ReactNode; mono?: boolean }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number' || v == null ? (
        <Text style={[s.kvV, mono && { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13 }]} selectable>
          {v == null || v === '' ? '—' : v}
        </Text>
      ) : (
        v
      )}
    </View>
  );
}

export function ListRow({ icon, iconTone = 'blue', title, subtitle, right, onPress }: { icon: string; iconTone?: Tone; title: string; subtitle?: string | null; right?: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: C.lineSoft }]}>
      <View style={[s.rowIcon, { backgroundColor: TONE[iconTone].bg }]}>
        <Icon name={icon} size={19} color={TONE[iconTone].fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={C.muted} /> : null)}
    </Pressable>
  );
}

/** Bottom sheet for short forms (close with outcome, raise fault, notes). */
export function Sheet({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.grabber} />
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={s.sheetSub}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.sheetClose}>
              <Icon name="close" size={20} color={C.sub} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Choice tile used in sheets (outcome, fault type). */
export function Choice({ label, hint, icon, tone = 'blue', on, onPress }: { label: string; hint?: string; icon?: string; tone?: Tone; on: boolean; onPress: () => void }) {
  const t = TONE[tone];
  return (
    <Pressable onPress={onPress} style={[s.choice, on && { borderColor: t.dot, backgroundColor: t.bg }]}>
      {icon ? (
        <View style={[s.choiceIcon, { backgroundColor: on ? t.dot : t.bg }]}>
          <Icon name={icon} size={18} color={on ? C.white : t.fg} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.choiceLabel, on && { color: t.fg }]}>{label}</Text>
        {hint ? <Text style={s.choiceHint}>{hint}</Text> : null}
      </View>
      <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? t.dot : C.muted} />
    </Pressable>
  );
}

export function Toggle({ label, hint, on, onChange, tone = 'amber', icon }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; tone?: Tone; icon?: string }) {
  const t = TONE[tone];
  return (
    <Pressable onPress={() => onChange(!on)} style={[s.choice, on && { borderColor: t.dot, backgroundColor: t.bg }]}>
      <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.dot : C.muted} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Icon name={icon} size={15} color={t.fg} /> : null}
          <Text style={[s.choiceLabel, on && { color: t.fg }]}>{label}</Text>
        </View>
        {hint ? <Text style={s.choiceHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export function HeaderIcon({ name, onPress, badge }: { name: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={s.heroBtn}>
      <Icon name={name} size={21} color={C.white} />
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function SignalBars({ rssi }: { rssi?: number | null }) {
  const q = signal(rssi);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: 4, height: 4 + i * 3, borderRadius: 1, backgroundColor: i <= q.bars ? TONE[q.tone].dot : C.line }} />
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  hero: { paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 3 },
  heroTitle: { color: C.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: '#C7D7F5', fontSize: 13.5, marginTop: 3, lineHeight: 19 },
  body: { padding: 16, gap: 18 },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.line, ...shadow },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.3, color: C.sub, textTransform: 'uppercase' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 9, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 7 },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50, paddingHorizontal: 16, borderRadius: R.md, borderWidth: 1 },
  btnText: { fontSize: 15.5, fontWeight: '800' },
  seg: { flexDirection: 'row', backgroundColor: '#E8EEF8', borderRadius: R.md, padding: 4, gap: 4 },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 11 },
  segOn: { backgroundColor: C.white, ...shadow, shadowOpacity: 0.06 },
  segText: { fontSize: 13, fontWeight: '700', color: C.sub },
  segCount: { minWidth: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#CBD5E1', alignItems: 'center' },
  segCountText: { fontSize: 11, fontWeight: '800', color: C.text, lineHeight: 18 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  pillText: { fontSize: 13, fontWeight: '700', color: C.sub },
  pillCount: { fontSize: 12, fontWeight: '700', color: C.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, height: 46 },
  label: { fontSize: 13, fontWeight: '700', color: C.sub },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5, color: C.text },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: R.md, borderWidth: 1 },
  noticeText: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  empty: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 24, gap: 6 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' },
  emptyText: { fontSize: 13.5, color: C.sub, textAlign: 'center', lineHeight: 19 },
  stat: { flex: 1, minWidth: '46%', gap: 6, padding: 13 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: C.sub },
  statValue: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  statSub: { fontSize: 12, color: C.muted, fontWeight: '600' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  kvK: { fontSize: 13.5, color: C.sub, fontWeight: '600' },
  kvV: { flex: 1, textAlign: 'right', fontSize: 14, color: C.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  rowSub: { fontSize: 12.5, color: C.sub, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,42,107,0.45)' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 5, backgroundColor: '#CBD5E1', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: C.text },
  sheetSub: { fontSize: 13, color: C.sub, marginTop: 3, lineHeight: 18 },
  sheetClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white },
  choiceIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontSize: 15, fontWeight: '800', color: C.text },
  choiceHint: { fontSize: 12.5, color: C.sub, marginTop: 2, lineHeight: 17 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.powertelRed, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.navy },
  badgeText: { color: C.white, fontSize: 10, fontWeight: '800' },
});
