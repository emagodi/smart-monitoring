import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  BellRing,
  CarFront,
  Clock3,
  Filter,
  Gauge,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Siren,
  Truck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import IncidentDrawer from "./IncidentDrawer";
import {
  API_BASE_URL,
  Board,
  BoardCase,
  CaseStatus,
  EVENT_META,
  STAGES,
  STATUS_META,
  Vehicle,
  activeDispatch,
  apiError,
  eventKind,
  eventText,
  formatElapsed,
  formatTime,
  minutesSince,
  normalizeList,
  outcomeChip,
  outcomeLabel,
  slaTone,
  stageStartedAt,
  statusOf,
  vehicleLabel,
} from "./shared";

type Summary = {
  open: number;
  newCount: number;
  last24h: number;
  realThreats30d: number;
  falseAlarms30d: number;
  technicalFaults30d: number;
  avgAcknowledgeMinutes?: number | null;
  avgDispatchMinutes?: number | null;
  avgArrivalMinutes?: number | null;
  avgCloseMinutes?: number | null;
};

const REFRESH_MS = 15000;
const SOUND_KEY = "responseDesk.sound";

/** Short two-tone chime via WebAudio: no audio file needed. */
const chime = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.22);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio unavailable */
  }
};

export default function ResponseDesk() {
  const { token, hasPermission } = useAuth();
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const [board, setBoard] = useState<Board | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState("all");
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const knownNew = useRef<Set<number> | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const [b, v, s] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/response/board`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/response/vehicles`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/v1/alerts/summary`, { headers }).catch(() => ({ data: null })),
        ]);
        const next = b.data as Board;
        // Chime when an alert we have not seen before lands in "New".
        const newIds = new Set(next.open.filter((c) => statusOf(c.alert) === "NEW").map((c) => c.alert.id));
        if (knownNew.current && sound) {
          for (const id of newIds) {
            if (!knownNew.current.has(id)) {
              chime();
              break;
            }
          }
        }
        knownNew.current = newIds;
        setBoard(next);
        setVehicles(normalizeList<Vehicle>(v.data));
        setSummary(s.data as Summary | null);
        setError(null);
      } catch (e) {
        setError(apiError(e, "Could not load the response board."));
      } finally {
        setLoading(false);
      }
    },
    [headers, sound]
  );

  useEffect(() => {
    if (!token) return;
    void load();
    const poll = window.setInterval(() => void load(true), REFRESH_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load, token]);

  const toggleSound = () => {
    setSound((s) => {
      try {
        localStorage.setItem(SOUND_KEY, s ? "off" : "on");
      } catch {
        /* ignore */
      }
      if (!s) chime();
      return !s;
    });
  };

  const depots = useMemo(() => {
    const names = new Set<string>();
    board?.open.forEach((c) => c.alert.depotName && names.add(c.alert.depotName));
    return [...names].sort();
  }, [board]);

  const matches = useCallback(
    (c: BoardCase) => {
      const q = search.trim().toLowerCase();
      const a = c.alert;
      const textOk =
        !q ||
        [a.transformerName, a.depotName, a.deviceName, a.value, a.message, a.supplierName]
          .filter(Boolean)
          .some((t) => String(t).toLowerCase().includes(q));
      return textOk && (depotFilter === "all" || a.depotName === depotFilter);
    },
    [depotFilter, search]
  );

  const lanes = useMemo(() => {
    const out: Record<string, BoardCase[]> = {};
    STAGES.forEach((s) => (out[s.key] = []));
    board?.open.filter(matches).forEach((c) => {
      const st = statusOf(c.alert);
      (out[st] ||= []).push(c);
    });
    // Oldest in stage first: that is the one breaching its target.
    Object.values(out).forEach((list) =>
      list.sort((x, y) => new Date(stageStartedAt(x.alert) || 0).getTime() - new Date(stageStartedAt(y.alert) || 0).getTime())
    );
    return out;
  }, [board, matches]);

  const selected = useMemo(() => {
    if (selectedId == null || !board) return null;
    return [...board.open, ...board.recentlyClosed].find((c) => c.alert.id === selectedId) || null;
  }, [board, selectedId]);

  const totalOpen = board?.open.length ?? 0;
  const vehiclesTotal = (board?.vehiclesAvailable ?? 0) + (board?.vehiclesDispatched ?? 0) + (board?.vehiclesOutOfService ?? 0);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] p-5 text-white shadow-[0_24px_60px_-28px_rgba(2,6,23,0.8)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live · refreshes every 15s
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Response Desk</h1>
            <p className="mt-1 max-w-xl text-sm text-blue-100/80">
              Every intrusion from detection to closure: acknowledge, dispatch the nearest vehicle, follow the crew, record what they found.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/15"
              title="Play a chime when a new alert arrives"
            >
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {sound ? "Chime on" : "Chime off"}
            </button>
            {hasPermission("fleet.read") ? (
              <Link to="/fleet" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/15">
                <Truck className="h-4 w-4" /> Fleet
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition hover:bg-blue-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <HeroStat icon={<Siren className="h-4 w-4" />} label="Open incidents" value={totalOpen} accent="text-red-300" />
          <HeroStat icon={<BellRing className="h-4 w-4" />} label="Waiting for ack" value={lanes.NEW?.length ?? 0} accent="text-amber-300" />
          <HeroStat
            icon={<CarFront className="h-4 w-4" />}
            label="Vehicles free"
            value={`${board?.vehiclesAvailable ?? 0}/${vehiclesTotal}`}
            accent="text-emerald-300"
          />
          <HeroStat icon={<Clock3 className="h-4 w-4" />} label="Avg to acknowledge" value={fmtMin(summary?.avgAcknowledgeMinutes)} />
          <HeroStat icon={<Gauge className="h-4 w-4" />} label="Avg to arrive" value={fmtMin(summary?.avgArrivalMinutes)} />
          <HeroStat
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Real threats · 30d"
            value={summary ? `${summary.realThreats30d} / ${summary.realThreats30d + summary.falseAlarms30d + summary.technicalFaults30d}` : "—"}
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</div>
      ) : null}

      {/* Filters */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="enterprise-chip flex flex-1 items-center gap-2 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transformer, depot, device, partner…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
        </div>
        <div className="enterprise-chip flex items-center gap-2 px-3 py-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select value={depotFilter} onChange={(e) => setDepotFilter(e.target.value)} className="bg-transparent text-sm outline-none dark:text-slate-100">
            <option value="all">All depots</option>
            {depots.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Lanes */}
      {loading && !board ? (
        <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" /> Loading response board…
        </div>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const list = lanes[stage.key] || [];
            return (
              <div
                key={stage.key}
                className={`flex min-h-[220px] flex-col rounded-[24px] border border-slate-200/80 bg-gradient-to-b ${STATUS_META[stage.key].lane} to-transparent p-2.5 dark:border-slate-800`}
              >
                <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <span className={`h-2 w-2 rounded-full ${STATUS_META[stage.key].dot}`} />
                      {stage.label}
                    </p>
                    <p className="text-[11px] text-slate-500">{stage.hint}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                    {list.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5 xl:max-h-[62vh]">
                  {list.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8 text-xs text-slate-400 dark:border-slate-800">
                      Nothing here
                    </div>
                  ) : (
                    list.map((c) => <IncidentCard key={c.alert.id} item={c} now={now} onOpen={() => setSelectedId(c.alert.id)} />)
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Recently closed */}
      <section className="enterprise-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Closed in the last 24 hours</h3>
            <p className="text-xs text-slate-500">Outcome recorded by the crew or dispatcher</p>
          </div>
          <span className="text-xs text-slate-500">{board?.recentlyClosed.length ?? 0} incidents</span>
        </div>
        {board && board.recentlyClosed.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {board.recentlyClosed.filter(matches).map((c) => {
              const d = c.dispatches[0];
              return (
                <button
                  key={c.alert.id}
                  type="button"
                  onClick={() => setSelectedId(c.alert.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className={`rounded-full border px-2 py-0.5 font-semibold ${outcomeChip(c.alert.outcome || (statusOf(c.alert) === "FALSE_ALARM" ? "FALSE_ALARM" : null))}`}>
                    {outcomeLabel(c.alert.outcome || (statusOf(c.alert) === "FALSE_ALARM" ? "FALSE_ALARM" : null))}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{c.alert.transformerName}</span>
                  <span className="text-slate-500">{eventText(c.alert)}</span>
                  <span className="text-slate-500">{c.alert.depotName}</span>
                  {d ? <span className="text-slate-500">{vehicleLabel(d)}</span> : null}
                  <span className="ml-auto text-slate-400">
                    {formatTime(c.alert.closedAt)} · {formatElapsed(minutesBetween(c.alert.createdAt, c.alert.closedAt))} total
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-slate-500">No incidents closed in the last 24 hours.</p>
        )}
      </section>

      <IncidentDrawer item={selected} vehicles={vehicles} onClose={() => setSelectedId(null)} onChanged={() => void load(true)} />
    </div>
  );
}

function IncidentCard({ item, now, onOpen }: { item: BoardCase; now: number; onOpen: () => void }) {
  const a = item.alert;
  const kind = eventKind(a);
  const ev = EVENT_META[kind];
  const d = activeDispatch(item.dispatches);
  const st: CaseStatus = statusOf(a);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
        st === "NEW" ? "border-red-200 ring-1 ring-red-500/10 dark:border-red-500/30" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ev.tone}`}>{ev.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{a.transformerName || "Unknown transformer"}</p>
          <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">{eventText(a)}</p>
        </div>
        {(a.occurrenceCount ?? 1) > 1 ? (
          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">×{a.occurrenceCount}</span>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-slate-500">{a.depotName || "No depot"}</span>
        <span className={`inline-flex shrink-0 items-center gap-1 ${slaTone(a, now)}`}>
          <Clock3 className="h-3 w-3" />
          {formatElapsed(minutesSince(stageStartedAt(a), now))}
        </span>
      </div>
      {d ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <Truck className="h-3.5 w-3.5" />
          <span className="truncate">{vehicleLabel(d)}</span>
        </div>
      ) : null}
    </button>
  );
}

function HeroStat({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 backdrop-blur">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-blue-100/75">
        <span className={accent || "text-blue-200"}>{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

const fmtMin = (m?: number | null) => (m == null ? "—" : m < 60 ? `${m.toFixed(m < 10 ? 1 : 0)} min` : `${(m / 60).toFixed(1)} h`);

const minutesBetween = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null;
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
};
