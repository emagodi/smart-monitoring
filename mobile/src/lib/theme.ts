/** TIAS brand: the web app's navy-to-blue (ZESA / Powertel) with Powertel red as the alert accent. */
export const C = {
  navy: '#0A2A6B',
  blue: '#0B4FC4',
  sky: '#2A86C6',
  brand: '#2563EB',
  brandSoft: '#EFF6FF',
  red: '#DC2626',
  redSoft: '#FEF2F2',
  powertelRed: '#E63B3F',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  green: '#059669',
  greenSoft: '#ECFDF5',
  violet: '#7C3AED',
  violetSoft: '#F5F3FF',
  indigo: '#4F46E5',
  bg: '#F4F7FC',
  card: '#FFFFFF',
  line: '#E2E8F0',
  lineSoft: '#F1F5F9',
  text: '#0F172A',
  sub: '#475569',
  muted: '#94A3B8',
  white: '#FFFFFF',
} as const;

export const R = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const shadow = {
  shadowColor: '#0A2A6B',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export type Tone = 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'slate' | 'indigo';

export const TONE: Record<Tone, { fg: string; bg: string; dot: string }> = {
  red: { fg: '#B91C1C', bg: '#FEF2F2', dot: '#EF4444' },
  amber: { fg: '#B45309', bg: '#FFFBEB', dot: '#F59E0B' },
  green: { fg: '#047857', bg: '#ECFDF5', dot: '#10B981' },
  blue: { fg: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  violet: { fg: '#6D28D9', bg: '#F5F3FF', dot: '#8B5CF6' },
  indigo: { fg: '#4338CA', bg: '#EEF2FF', dot: '#6366F1' },
  slate: { fg: '#475569', bg: '#F1F5F9', dot: '#94A3B8' },
};
