import type { Alert, CaseStatus, GStatus, Outcome, TStatus } from './types';
import type { Tone } from './theme';

/** Backend times are local date-times without a zone (server and phones are both in CAT). */
export const toDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const minutesSince = (iso?: string | null) => {
  const d = toDate(iso);
  return d ? Math.max(0, (Date.now() - d.getTime()) / 60000) : null;
};

export const ago = (iso?: string | null, minutes?: number | null) => {
  const m = minutes ?? minutesSince(iso);
  if (m == null) return 'never';
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.floor(m)} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

export const elapsed = (iso?: string | null) => {
  const m = minutesSince(iso);
  if (m == null) return '—';
  if (m < 1) return 'now';
  if (m < 60) return `${Math.floor(m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${Math.floor(m % 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

export const mins = (m?: number | null) => (m == null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`);

export const dateTime = (iso?: string | null) => {
  const d = toDate(iso);
  if (!d) return '—';
  return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const dateOnly = (iso?: string | null) => {
  const d = toDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

export const statusOf = (a: Alert): CaseStatus => a.caseStatus || (a.isAlert ? 'NEW' : 'RESOLVED');
export const isOpen = (s: CaseStatus) => s !== 'RESOLVED' && s !== 'FALSE_ALARM';

export const CASE: Record<CaseStatus, { label: string; tone: Tone }> = {
  NEW: { label: 'Needs acknowledging', tone: 'red' },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'amber' },
  DISPATCHED: { label: 'Dispatched', tone: 'blue' },
  EN_ROUTE: { label: 'En route', tone: 'indigo' },
  ON_SCENE: { label: 'Team on site', tone: 'violet' },
  RESOLVED: { label: 'Closed', tone: 'green' },
  FALSE_ALARM: { label: 'False alarm', tone: 'slate' },
};

export const OUTCOMES: Array<{ key: Outcome; label: string; hint: string; tone: Tone; icon: string }> = [
  { key: 'FALSE_ALARM', label: 'False alarm', hint: 'Nothing found on site', tone: 'slate', icon: 'checkmark-done' },
  { key: 'REAL_THREAT', label: 'Real threat', hint: 'Intrusion, theft or vandalism', tone: 'red', icon: 'warning' },
  { key: 'TECHNICAL_FAULT', label: 'Technical fault', hint: 'Faulty sensor or controller', tone: 'amber', icon: 'construct' },
  { key: 'AUTHORISED_ACTIVITY', label: 'Authorised work', hint: 'ZESA / Powertel crew on site', tone: 'blue', icon: 'people' },
  { key: 'OTHER', label: 'Other', hint: 'Explain in the note', tone: 'violet', icon: 'ellipsis-horizontal' },
];

export const outcomeLabel = (o?: Outcome | null) => OUTCOMES.find((x) => x.key === o)?.label || 'Closed';

export type EventKind = 'door' | 'motion' | 'vibration' | 'temperature' | 'tilt' | 'other';

export const eventKind = (a: Pick<Alert, 'value' | 'message' | 'sensorType'>): EventKind => {
  const t = `${a.value || ''} ${a.message || ''} ${a.sensorType || ''}`.toLowerCase();
  if (t.includes('door') || t.includes('contact')) return 'door';
  if (t.includes('vibration')) return 'vibration';
  if (t.includes('motion')) return 'motion';
  if (t.includes('temp')) return 'temperature';
  if (t.includes('tilt')) return 'tilt';
  return 'other';
};

export const EVENT: Record<EventKind, { label: string; icon: string; color: string }> = {
  door: { label: 'Door opened', icon: 'exit-outline', color: '#DC2626' },
  motion: { label: 'Motion detected', icon: 'walk-outline', color: '#EA580C' },
  vibration: { label: 'Vibration', icon: 'pulse-outline', color: '#C026D3' },
  temperature: { label: 'High temperature', icon: 'thermometer-outline', color: '#D97706' },
  tilt: { label: 'Tilt / tamper', icon: 'hand-left-outline', color: '#E11D48' },
  other: { label: 'Security alert', icon: 'shield-outline', color: '#334155' },
};

export const eventText = (a: Alert) => a.value || EVENT[eventKind(a)].label;

export const T_STATUS: Record<TStatus, { label: string; tone: Tone }> = {
  ONLINE: { label: 'Online', tone: 'green' },
  DELAYED: { label: 'Delayed', tone: 'amber' },
  OFFLINE: { label: 'Offline', tone: 'red' },
  NEVER_SEEN: { label: 'Never seen', tone: 'slate' },
  NO_DEVICE: { label: 'No device', tone: 'slate' },
};

export const G_STATUS: Record<GStatus, { label: string; tone: Tone }> = {
  ONLINE: { label: 'Online', tone: 'green' },
  DEGRADED: { label: 'Degraded', tone: 'amber' },
  OFFLINE: { label: 'Offline', tone: 'red' },
  NEVER_SEEN: { label: 'Never seen', tone: 'slate' },
  UNKNOWN: { label: 'Unknown', tone: 'slate' },
};

export const gStatus = (s?: string | null) => G_STATUS[(s as GStatus) in G_STATUS ? (s as GStatus) : 'UNKNOWN'];

export const FAULT_TYPES: Record<string, string> = {
  FALSE_TRIGGERING: 'Keeps triggering falsely',
  SENSOR_FAULT: 'Sensor fault',
  POWER_SUPPLY: 'Power supply',
  BATTERY: 'Battery',
  COMMUNICATION: 'Communication / signal',
  SIREN_LIGHTS: 'Siren or flash lights',
  TAMPERED: 'Tampered / damaged',
  DEVICE_OFFLINE: 'Device offline',
  OTHER: 'Other',
};

export const signal = (rssi?: number | null): { label: string; bars: number; tone: Tone } => {
  if (rssi == null) return { label: '—', bars: 0, tone: 'slate' };
  if (rssi >= -90) return { label: 'Strong', bars: 4, tone: 'green' };
  if (rssi >= -105) return { label: 'Good', bars: 3, tone: 'green' };
  if (rssi >= -115) return { label: 'Weak', bars: 2, tone: 'amber' };
  return { label: 'Very weak', bars: 1, tone: 'red' };
};

export const INSTALL: Record<string, { label: string; tone: Tone }> = {
  INSTALLED: { label: 'Installed', tone: 'blue' },
  READY: { label: 'Ready for commissioning', tone: 'violet' },
  SCHEDULED: { label: 'Commissioning scheduled', tone: 'indigo' },
  COMMISSIONED: { label: 'Commissioned', tone: 'green' },
  FAILED: { label: 'Failed commissioning', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};

/** Opens turn-by-turn directions in Google / Apple Maps. */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
