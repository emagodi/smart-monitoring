import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, Vibration } from 'react-native';

import { api } from './api';
import { useAuth } from './auth';
import { storage } from './storage';
import type { Alert, Board, DutyMe } from './types';

const POLL_MS = 15_000;

type AlertsState = {
  board: Board | null;
  pending: Alert[];
  openCount: number;
  duty: DutyMe | null;
  ringing: boolean;
  /** The red siren card is on screen: lists add room for it at the bottom. */
  bannerVisible: boolean;
  mutedUntil: number;
  mute: () => void;
  refresh: () => Promise<void>;
  acknowledge: (id: number, note?: string) => Promise<void>;
};

const Ctx = createContext<AlertsState | null>(null);
/** Extra bottom space so the floating siren card never hides the last item. */
export const useBannerSpace = () => (useContext(Ctx)?.bannerVisible ? 150 : 0);

export const useAlerts = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAlerts outside AlertsProvider');
  return c;
};

/**
 * The response desk in your pocket: polls the board while the app is open, rings the siren (sound + vibration) while
 * there are alerts nobody has acknowledged, for people on duty (or everyone who can acknowledge when no roster exists),
 * exactly like the web siren. When the app is closed, push notifications ring instead.
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth();
  const canAck = can('response.acknowledge');
  const canRead = canAck || can('response.read') || can('response.close') || can('response.dispatch');
  const [board, setBoard] = useState<Board | null>(null);
  const [duty, setDuty] = useState<DutyMe | null>(null);
  const [mutedUntil, setMutedUntil] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const player = useAudioPlayer(require('@/assets/sounds/siren.wav'));
  const playing = useRef(false);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'duckOthers' }).catch(() => undefined);
    void storage.get('tias.mutedUntil').then((v) => setMutedUntil(Number(v || 0)));
    const sub = AppState.addEventListener('change', (st) => setActive(st === 'active'));
    return () => sub.remove();
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !canRead) return;
    try {
      setBoard(await api.get<Board>('/api/v1/response/board'));
    } catch {
      /* keep the last board */
    }
  }, [user, canRead]);

  useEffect(() => {
    if (!user || !canRead || !active) return;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [user, canRead, active, refresh]);

  useEffect(() => {
    if (!user || !canAck) return;
    const load = () =>
      api
        .get<DutyMe>('/api/v1/duty/me')
        .then(setDuty)
        .catch(() => setDuty({ onDuty: false, depotIds: [], rosterConfigured: false }));
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [user, canAck]);

  const pending = useMemo(() => (board?.open ?? []).map((c) => c.alert).filter((a) => !a.caseStatus || a.caseStatus === 'NEW'), [board]);
  const responsible = !duty || duty.onDuty || !duty.rosterConfigured;
  const [, tick] = useState(0);
  const ringing = canAck && responsible && active && pending.length > 0 && Date.now() > mutedUntil;

  // Re-evaluate when a mute runs out.
  useEffect(() => {
    if (mutedUntil <= Date.now()) return;
    const t = setTimeout(() => tick((n) => n + 1), mutedUntil - Date.now() + 200);
    return () => clearTimeout(t);
  }, [mutedUntil]);

  useEffect(() => {
    if (ringing && !playing.current) {
      playing.current = true;
      try {
        player.loop = true;
        void player.seekTo(0);
        player.play();
      } catch {
        /* audio unavailable */
      }
      if (Platform.OS !== 'web') Vibration.vibrate([0, 700, 500], true);
    } else if (!ringing && playing.current) {
      playing.current = false;
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      if (Platform.OS !== 'web') Vibration.cancel();
    }
  }, [ringing, player]);

  const mute = useCallback(() => {
    const until = Date.now() + 5 * 60_000;
    setMutedUntil(until);
    void storage.set('tias.mutedUntil', String(until));
  }, []);

  const acknowledge = useCallback(
    async (id: number, note?: string) => {
      await api.post(`/api/v1/response/cases/${id}/acknowledge`, { note: note || 'Acknowledged on the TIAS mobile app' });
      await refresh();
    },
    [refresh]
  );

  const value = useMemo<AlertsState>(
    () => ({ board, pending, openCount: board?.open.length ?? 0, duty, ringing, bannerVisible: canAck && responsible && pending.length > 0, mutedUntil, mute, refresh, acknowledge }),
    [board, pending, duty, ringing, canAck, responsible, mutedUntil, mute, refresh, acknowledge]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
