import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { BellOff, Check, Loader2, Siren, Volume2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cachedGet, invalidateCache } from "../../lib/cache";

const API = import.meta.env.VITE_API_BASE_URL || "";
const POLL_MS = 15_000;
const MUTE_KEY = "tais.siren.mutedUntil";
const OFF_KEY = "tais.siren.off";

type BoardAlert = { id: number; transformerName?: string | null; value?: string | null; depotName?: string | null; caseStatus?: string | null; createdAt?: string | null };
type Board = { open: Array<{ alert: BoardAlert }> };
type DutyMe = { onDuty: boolean; rosterConfigured: boolean };

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Siren for the reaction team: rings on every page while there are alerts nobody has acknowledged, until someone
 * acknowledges them (here, on the Response Desk, on WhatsApp or USSD) or the user mutes it for 5 minutes.
 * Rings for people on duty; when no duty roster has been set up yet, for everyone who can acknowledge alerts.
 */
export default function AlertSiren() {
  const { token, hasPermission } = useAuth();
  const location = useLocation();
  const canAck = hasPermission("response.acknowledge");
  const [pending, setPending] = useState<BoardAlert[]>([]);
  const [duty, setDuty] = useState<DutyMe | null>(null);
  const [mutedUntil, setMutedUntil] = useState<number>(() => Number(read(MUTE_KEY) || 0));
  const [off, setOff] = useState(() => read(OFF_KEY) === "1");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  // ---- data
  const poll = useCallback(async () => {
    if (!token || !canAck) return;
    try {
      const b = await cachedGet<Board>(`${API}/api/v1/response/board`, token, 10_000, true);
      setPending((b?.open ?? []).map((c) => c.alert).filter((a) => !a.caseStatus || a.caseStatus === "NEW"));
    } catch {
      /* keep the last state */
    }
  }, [token, canAck]);

  useEffect(() => {
    if (!token || !canAck) return;
    void poll();
    const t = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(t);
  }, [poll, token, canAck]);

  useEffect(() => {
    if (!token || !canAck) return;
    const load = () =>
      cachedGet<DutyMe>(`${API}/api/v1/duty/me`, token, 60_000)
        .then(setDuty)
        .catch(() => setDuty({ onDuty: false, rosterConfigured: false }));
    load();
    const t = window.setInterval(load, 120_000);
    return () => window.clearInterval(t);
  }, [token, canAck]);

  const shouldRing = canAck && !off && pending.length > 0 && Date.now() > mutedUntil && (duty == null || duty.onDuty || !duty.rosterConfigured);

  // ---- sound: a rising / falling siren sweep, repeated every 3 s
  const sweep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
        if (ctx.state === "suspended") {
          setBlocked(true);
          return;
        }
      }
      setBlocked(false);
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(650, t0);
      for (let i = 0; i < 4; i++) {
        osc.frequency.linearRampToValueAtTime(1250, t0 + i * 0.6 + 0.3);
        osc.frequency.linearRampToValueAtTime(650, t0 + i * 0.6 + 0.6);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.05);
      gain.gain.setValueAtTime(0.18, t0 + 2.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 2.45);
    } catch {
      /* audio unavailable */
    }
  }, []);

  useEffect(() => {
    if (!shouldRing) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    sweep();
    timerRef.current = window.setInterval(sweep, 3000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [shouldRing, sweep]);

  // Browsers only allow sound after a click: the first click anywhere unlocks it.
  useEffect(() => {
    const unlock = () => {
      if (ctxRef.current?.state === "suspended") void ctxRef.current.resume().then(() => setBlocked(false));
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const mute = () => {
    const until = Date.now() + 5 * 60_000;
    setMutedUntil(until);
    write(MUTE_KEY, String(until));
  };

  const acknowledge = async (id: number) => {
    setBusy(id);
    try {
      await axios.post(`${API}/api/v1/response/cases/${id}/acknowledge`, { note: "Acknowledged from the siren banner (web)" }, { headers: { Authorization: `Bearer ${token}` } });
      invalidateCache("/api/v1/response");
      setPending((p) => p.filter((a) => a.id !== id));
      void poll();
    } catch {
      /* the Response Desk shows the error in detail */
    } finally {
      setBusy(null);
    }
  };

  if (!canAck || pending.length === 0 || (duty && duty.rosterConfigured && !duty.onDuty)) return null;
  const first = pending[0];
  const muted = Date.now() <= mutedUntil;

  return (
    <div className="sticky top-0 z-[60] -mx-3 mb-2 md:-mx-4 xl:-mx-6">
      <div className={`flex flex-wrap items-center gap-2 px-3 py-2 text-white shadow-lg md:px-4 xl:px-6 ${muted || off ? "bg-red-700" : "animate-[pulse_1.2s_ease-in-out_infinite] bg-red-600"}`} role="alert">
        <Siren className="h-5 w-5 shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          <b>{pending.length} unacknowledged alert{pending.length === 1 ? "" : "s"}</b>
          <span className="hidden sm:inline">
            {" · "}#{first.id} {first.value ?? "Alert"} at {first.transformerName ?? "a transformer"}
            {first.depotName ? ` (${first.depotName})` : ""}
          </span>
        </p>
        <button
          type="button"
          onClick={() => void acknowledge(first.id)}
          disabled={busy != null}
          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 shadow hover:bg-red-50"
        >
          {busy === first.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Acknowledge #{first.id}
        </button>
        {location.pathname !== "/response" ? (
          <Link to="/response" className="rounded-full bg-red-800/60 px-3 py-1 text-xs font-semibold hover:bg-red-800">
            Open desk
          </Link>
        ) : null}
        {blocked && !muted && !off ? (
          <button type="button" onClick={sweep} className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
            <Volume2 className="h-3.5 w-3.5" /> Enable siren
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (off) {
              setOff(false);
              write(OFF_KEY, null);
            } else if (muted) {
              setOff(true);
              write(OFF_KEY, "1");
            } else mute();
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-red-100 hover:bg-red-800/60"
          title={off ? "Turn the siren back on" : muted ? "Turn the siren off on this device" : "Silence for 5 minutes"}
        >
          <BellOff className="h-3.5 w-3.5" />
          {off ? "Siren off · turn on" : muted ? "Muted · turn off" : "Mute 5 min"}
        </button>
      </div>
    </div>
  );
}
