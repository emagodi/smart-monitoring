import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CardSim,
  CloudOff,
  Cpu,
  History,
  LocateFixed,
  MapPin,
  MapPinOff,
  Network,
  Radio,
  Router,
  Server,
  ServerCrash,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { useGeography } from "../Registry/geo";
import { useCachedGet } from "../../lib/cache";
import GoogleAssetMap, { type GoogleAssetMapPoint } from "../../components/maps/GoogleAssetMap";
import { HeroButton, HeroStat, HeroStats, Notice, PageHero, SearchBox, SelectBox, fmtNum, timeAgo } from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const ZIM_CENTER = { lat: -19.0, lng: 29.8 };

type GatewayStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "NEVER_SEEN" | "UNKNOWN";
type SyncStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";

type Summary = {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  neverSeen: number;
  unknown: number;
  missingLocation: number;
  missingSim: number;
  lastSyncStatus?: SyncStatus | null;
  lastSyncAt?: string | null;
};

type Gateway = GoogleAssetMapPoint & {
  id: number;
  name: string;
  loriotGatewayId?: string | null;
  gatewayEui?: string | null;
  macAddress?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  firmwareVersion?: string | null;
  regionName?: string | null;
  districtName?: string | null;
  depotName?: string | null;
  networkId?: string | null;
  networkName?: string | null;
  operator?: string | null;
  address?: string | null;
  effectiveStatus?: GatewayStatus | null;
  statusReason?: string | null;
  statusChangedAt?: string | null;
  lastTrafficSeenAt?: string | null;
  lastLoriotSeenAt?: string | null;
  lastSeenAt?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationVerified?: boolean;
  simAssigned?: boolean;
  assignedSimIccid?: string | null;
  assignedMsisdn?: string | null;
  commissioningDate?: string | null;
};

type HistoryRow = { id: number; prevStatus?: string | null; newStatus?: string | null; reason?: string | null; source?: string | null; observedAt?: string | null };

const GW_STATUS: Record<GatewayStatus, { label: string; dot: string; pill: string; fill: string; stroke: string }> = {
  ONLINE: { label: "Online", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", fill: "#10b981", stroke: "#047857" },
  OFFLINE: { label: "Offline", dot: "bg-red-500", pill: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30", fill: "#ef4444", stroke: "#b91c1c" },
  DEGRADED: { label: "Degraded", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30", fill: "#f59e0b", stroke: "#b45309" },
  NEVER_SEEN: { label: "Never seen", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700", fill: "#94a3b8", stroke: "#475569" },
  UNKNOWN: { label: "Unknown", dot: "bg-slate-300", pill: "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700", fill: "#cbd5e1", stroke: "#64748b" },
};
const statusOf = (g?: Gateway | null): GatewayStatus => (g?.effectiveStatus && GW_STATUS[g.effectiveStatus] ? g.effectiveStatus : "UNKNOWN");

function GwPill({ status }: { status?: string | null }) {
  const m = GW_STATUS[(status as GatewayStatus) || "UNKNOWN"] ?? GW_STATUS.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim()) return Number(v.trim().replace(/[^\d.\-+eE]/g, ""));
  return NaN;
};

const normalize = (raw: Record<string, unknown>): Gateway => {
  const lat = num(raw.latitude ?? raw.lat);
  const lng = num(raw.longitude ?? raw.lng ?? raw.lon);
  return { ...(raw as unknown as Gateway), lat, lng, isActive: raw.effectiveStatus === "ONLINE" };
};

const listOf = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const o = payload as Record<string, unknown> | null;
  for (const k of ["content", "data", "items"]) if (o && Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  return [];
};

const lastHeard = (g: Gateway) => g.lastTrafficSeenAt || g.lastSeenAt || g.lastLoriotSeenAt || null;
const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

type StatusFilter = GatewayStatus | "ALL";
type YesNo = "ALL" | "YES" | "NO";

/** Gateway map: hero tiles drill into the map, one line of filters, and a side panel for the gateway you click. */
export default function GatewaysMapIndex() {
  const { token } = useAuth();
  const { isDepot, depotId: myDepot } = useScope();
  const myDepotName = useGeography(token).pathOf(myDepot).depotName;
  const [params, setParams] = useSearchParams();

  const summary = useCachedGet<Summary>(token ? `${API}/api/v1/gateways/summary` : null, token, { maxAgeMs: 30_000, refreshMs: 60_000 });
  // The estate is a few hundred gateways at most: load once, filter in the browser so every filter is instant.
  const list = useCachedGet<unknown>(token ? `${API}/api/v1/gateways?page=0&size=1000` : null, token, {
    maxAgeMs: 30_000,
    refreshMs: 60_000,
    errorText: "Could not load gateways for the map.",
  });
  const all = useMemo(() => listOf(list.data).map(normalize), [list.data]);

  const [status, setStatus] = useState<StatusFilter>(() => (params.get("status") as StatusFilter) || "ALL");
  const [hasLocation, setHasLocation] = useState<YesNo>(() => (params.get("location") as YesNo) || "ALL");
  const [hasSim, setHasSim] = useState<YesNo>(() => (params.get("sim") as YesNo) || "ALL");
  const [region, setRegion] = useState("");
  const [depot, setDepot] = useState("");
  const [network, setNetwork] = useState("");
  const [model, setModel] = useState("");
  const [operator, setOperator] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");

  const selectedId = params.get("g") ? Number(params.get("g")) : null;
  const select = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id == null) next.delete("g");
    else next.set("g", String(id));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const next = new URLSearchParams(params);
    const put = (k: string, v: string, empty: string) => (v && v !== empty ? next.set(k, v) : next.delete(k));
    put("status", status, "ALL");
    put("location", hasLocation, "ALL");
    put("sim", hasSim, "ALL");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hasLocation, hasSim]);

  const options = useMemo(() => {
    const uniq = (f: (g: Gateway) => string | null | undefined) => [...new Set(all.map(f).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
    return {
      regions: uniq((g) => g.regionName),
      depots: uniq((g) => (region && g.regionName !== region ? null : g.depotName)),
      networks: uniq((g) => g.networkName || g.networkId),
      models: uniq((g) => g.model),
      operators: uniq((g) => g.operator),
    };
  }, [all, region]);

  // Everything except the status filter, so the chip counts tell you what each status would show.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return all.filter((g) => {
      const located = Number.isFinite(g.lat) && Number.isFinite(g.lng);
      if (hasLocation === "YES" && !located) return false;
      if (hasLocation === "NO" && located) return false;
      if (hasSim === "YES" && !g.simAssigned) return false;
      if (hasSim === "NO" && g.simAssigned) return false;
      if (region && g.regionName !== region) return false;
      if (depot && g.depotName !== depot) return false;
      if (network && (g.networkName || g.networkId) !== network) return false;
      if (model && g.model !== model) return false;
      if (operator && g.operator !== operator) return false;
      if (fromMs != null || toMs != null) {
        const t = lastHeard(g) ? new Date(lastHeard(g)!).getTime() : NaN;
        if (Number.isNaN(t)) return false;
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
      }
      if (q) {
        const hay = [g.name, g.gatewayEui, g.macAddress, g.loriotGatewayId, g.address, g.serialNumber, g.depotName, g.regionName].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, hasLocation, hasSim, region, depot, network, model, operator, from, to, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    base.forEach((g) => (c[statusOf(g)] = (c[statusOf(g)] ?? 0) + 1));
    return c;
  }, [base]);
  const filtered = useMemo(() => (status === "ALL" ? base : base.filter((g) => statusOf(g) === status)), [base, status]);
  const points = useMemo(() => filtered.filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng)), [filtered]);
  const unmapped = filtered.length - points.length;

  const filtersOn = status !== "ALL" || hasLocation !== "ALL" || hasSim !== "ALL" || !!(region || depot || network || model || operator || from || to || query);
  const clearAll = () => {
    setStatus("ALL");
    setHasLocation("ALL");
    setHasSim("ALL");
    setRegion("");
    setDepot("");
    setNetwork("");
    setModel("");
    setOperator("");
    setFrom("");
    setTo("");
    setQuery("");
  };

  const [focus, setFocus] = useState<{ key: number; lat: number; lng: number; zoom?: number } | null>(null);
  const focusKey = useRef(1);
  const s = summary.data;
  const sLoading = !s && summary.loading;
  const syncTone = s?.lastSyncStatus === "FAILED" ? "bad" : s?.lastSyncStatus === "PARTIAL" ? "warn" : "good";
  const syncLabel = s?.lastSyncStatus ? s.lastSyncStatus.charAt(0) + s.lastSyncStatus.slice(1).toLowerCase() : "—";

  const tile = (st: StatusFilter, extra?: () => void) => () => {
    setStatus(st);
    extra?.();
    select(null);
  };

  const chips: Array<{ value: StatusFilter; label: string; dot?: string }> = [
    { value: "ALL", label: "All" },
    { value: "ONLINE", label: "Online", dot: GW_STATUS.ONLINE.dot },
    { value: "OFFLINE", label: "Offline", dot: GW_STATUS.OFFLINE.dot },
    { value: "DEGRADED", label: "Degraded", dot: GW_STATUS.DEGRADED.dot },
    { value: "NEVER_SEEN", label: "Never seen", dot: GW_STATUS.NEVER_SEEN.dot },
    { value: "UNKNOWN", label: "Unknown", dot: GW_STATUS.UNKNOWN.dot },
  ];

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Assets · Gateway map"
        title={isDepot ? `Gateways in ${myDepotName} depot` : "Geographic gateway footprint"}
        subtitle={
          isDepot
            ? "The LoRaWAN gateways assigned to your depot. Click a tile to filter, or a gateway to see its details beside the map."
            : "Every LoRaWAN gateway on one map. Click a tile to filter, or a gateway to see its details beside the map."
        }
        actions={
          <HeroButton
            onClick={() => {
              void summary.reload();
              void list.reload();
            }}
            busy={summary.refreshing || list.refreshing}
          >
            Refresh
          </HeroButton>
        }
      >
        <HeroStats cols={8}>
          <Clickable onClick={tile("ALL", () => { setHasLocation("ALL"); setHasSim("ALL"); })}>
            <HeroStat icon={<Router className="h-3.5 w-3.5" />} label="Gateways" value={fmtNum(s?.total)} sub="in inventory" loading={sLoading} />
          </Clickable>
          <Clickable onClick={tile("ONLINE")}>
            <HeroStat icon={<Wifi className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={fmtNum(s?.online)} sub="healthy and reachable" tone="good" loading={sLoading} />
          </Clickable>
          <Clickable onClick={tile("OFFLINE")}>
            <HeroStat icon={<WifiOff className="h-3.5 w-3.5 text-red-300" />} label="Offline" value={fmtNum(s?.offline)} sub="past the grace period" tone={s?.offline ? "bad" : undefined} loading={sLoading} />
          </Clickable>
          <Clickable onClick={tile("DEGRADED")}>
            <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />} label="Degraded" value={fmtNum(s?.degraded)} sub="likely to go offline" tone={s?.degraded ? "warn" : undefined} loading={sLoading} />
          </Clickable>
          <Clickable onClick={tile("NEVER_SEEN")}>
            <HeroStat icon={<CloudOff className="h-3.5 w-3.5" />} label="Never seen" value={fmtNum(s?.neverSeen)} sub={s ? `${s.unknown} unknown` : undefined} loading={sLoading} />
          </Clickable>
          <Clickable onClick={tile("ALL", () => setHasLocation("NO"))}>
            <HeroStat icon={<MapPinOff className="h-3.5 w-3.5 text-amber-300" />} label="No location" value={fmtNum(s?.missingLocation)} sub="not on the map" tone={s?.missingLocation ? "warn" : undefined} loading={sLoading} />
          </Clickable>
          <Clickable onClick={tile("ALL", () => setHasSim("NO"))}>
            <HeroStat icon={<CardSim className="h-3.5 w-3.5 text-red-300" />} label="No SIM" value={fmtNum(s?.missingSim)} sub="no active SIM card" tone={s?.missingSim ? "bad" : undefined} loading={sLoading} />
          </Clickable>
          <HeroStat
            icon={s?.lastSyncStatus === "FAILED" ? <ServerCrash className="h-3.5 w-3.5 text-red-300" /> : <Server className="h-3.5 w-3.5" />}
            label="Last LORIOT sync"
            value={syncLabel}
            sub={s?.lastSyncAt ? timeAgo(s.lastSyncAt) : "never"}
            tone={syncTone}
            loading={sLoading}
          />
        </HeroStats>
      </PageHero>

      {list.error && !list.data ? <Notice>{list.error}</Notice> : null}

      <section className="ui-panel overflow-hidden">
        {/* Filters: one line (scrolls sideways on narrow screens) */}
        <div className="space-y-2.5 border-b border-slate-200/80 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {chips.filter((c) => c.value !== "UNKNOWN" || (counts.UNKNOWN ?? 0) > 0 || status === "UNKNOWN").map((c) => {
              const on = status === c.value;
              const n = c.value === "ALL" ? base.length : counts[c.value] ?? 0;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setStatus(c.value)}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition ${
                    on ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {c.dot ? <span className={`h-2 w-2 rounded-full ${c.dot}`} /> : null}
                  {c.label}
                  {c.value !== "ALL" ? <span className={`text-[10px] font-medium ${on ? "text-white/80" : "text-slate-400"}`}>{n}</span> : null}
                </button>
              );
            })}
            <span className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
            <SelectBox value={hasLocation} onChange={(v) => setHasLocation(v as YesNo)} className="shrink-0">
              <option value="ALL">Any location</option>
              <option value="YES">On the map</option>
              <option value="NO">No location</option>
            </SelectBox>
            <SelectBox value={hasSim} onChange={(v) => setHasSim(v as YesNo)} className="shrink-0">
              <option value="ALL">Any SIM</option>
              <option value="YES">Has SIM</option>
              <option value="NO">No SIM</option>
            </SelectBox>
            {isDepot ? null : (
            <>
            <SelectBox value={region} onChange={(v) => { setRegion(v); setDepot(""); }} className="shrink-0">
              <option value="">All regions</option>
              {options.regions.map((x) => <option key={x} value={x}>{x}</option>)}
            </SelectBox>
            <SelectBox value={depot} onChange={setDepot} className="shrink-0">
              <option value="">All depots</option>
              {options.depots.map((x) => <option key={x} value={x}>{x}</option>)}
            </SelectBox>
            </>
            )}
            <SelectBox value={network} onChange={setNetwork} className="shrink-0">
              <option value="">All networks</option>
              {options.networks.map((x) => <option key={x} value={x}>{x}</option>)}
            </SelectBox>
            <SelectBox value={model} onChange={setModel} className="shrink-0">
              <option value="">All models</option>
              {options.models.map((x) => <option key={x} value={x}>{x}</option>)}
            </SelectBox>
            <SelectBox value={operator} onChange={setOperator} className="shrink-0">
              <option value="">All operators</option>
              {options.operators.map((x) => <option key={x} value={x}>{x}</option>)}
            </SelectBox>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchBox value={query} onChange={setQuery} placeholder="Search gateway name, EUI, MAC, address…" />
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pl-3 pr-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                <span className="font-medium">Last heard</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-xs font-medium text-slate-800 outline-none dark:text-slate-100" aria-label="Last heard from" />
                <span>to</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-xs font-medium text-slate-800 outline-none dark:text-slate-100" aria-label="Last heard to" />
              </label>
              {filtersOn ? (
                <button type="button" onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              ) : null}
              <span className="text-xs text-slate-500">
                <b className="text-slate-800 dark:text-slate-100">{points.length.toLocaleString()}</b> on the map
                {unmapped ? ` · ${unmapped} without coordinates` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Map with the selected gateway in a floating side panel (same pattern as Sites) */}
        <div className="relative h-[calc(100vh-300px)] min-h-[560px]">
          {list.loading && !list.data ? (
            <div className="ui-skeleton absolute inset-0 rounded-none" />
          ) : (
            <GoogleAssetMap<Gateway>
              apiKey={MAPS_KEY}
              className="h-full !rounded-none"
              points={points}
              defaultCenter={ZIM_CENTER}
              defaultZoom={7}
              selectedPointId={selectedId}
              onPointSelect={(p) => select(Number(p.id))}
              showSelectedCard={false}
              focus={focus}
              emptyLabel={filtersOn ? "No gateway with coordinates matches these filters." : isDepot ? "No gateway with coordinates is assigned to your depot yet." : "No gateway has coordinates yet."}
              getMarkerColors={(p) => {
                const m = GW_STATUS[statusOf(p)];
                return { fillColor: m.fill, strokeColor: m.stroke };
              }}
            />
          )}

          <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-wrap gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow ring-1 ring-slate-200 dark:bg-slate-900/95 dark:text-slate-300 dark:ring-slate-700">
            {(["ONLINE", "OFFLINE", "DEGRADED", "NEVER_SEEN"] as GatewayStatus[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${GW_STATUS[k].dot}`} />
                {GW_STATUS[k].label}
              </span>
            ))}
          </div>

          {selectedId ? (
            <aside className="absolute bottom-3 left-3 top-3 z-20 flex w-[380px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700">
              <GatewayPanel
                id={selectedId}
                token={token}
                fallback={all.find((g) => g.id === selectedId) ?? null}
                onBack={() => select(null)}
                onLocate={(lat, lng) => setFocus({ key: focusKey.current++, lat, lng, zoom: 14 })}
              />
            </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Makes a HeroStat tile clickable without changing its look. */
function Clickable({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-2xl text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 [&>*]:h-full">
      {children}
    </button>
  );
}

function Fact({ icon, label, value, sub, mono }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 ${mono ? "font-mono text-[12px]" : ""}`} title={typeof value === "string" ? value : undefined}>
        {value || "—"}
      </p>
      {sub ? <p className="truncate text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function GatewayPanel({
  id,
  token,
  fallback,
  onBack,
  onLocate,
}: {
  id: number;
  token: string | null;
  fallback: Gateway | null;
  onBack: () => void;
  onLocate: (lat: number, lng: number) => void;
}) {
  const [gw, setGw] = useState<Gateway | null>(fallback);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setGw(fallback);
    setHistory(null);
    setError(null);
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    axios
      .get(`${API}/api/v1/gateways/${id}`, { headers })
      .then((r) => alive && setGw(normalize((r.data || {}) as Record<string, unknown>)))
      .catch(() => alive && !fallback && setError("Could not load this gateway."));
    axios
      .get(`${API}/api/v1/gateways/${id}/status-history`, { headers, params: { size: 5 } })
      .then((r) => alive && setHistory(listOf(r.data) as unknown as HistoryRow[]))
      .catch(() => alive && setHistory([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const located = gw && Number.isFinite(gw.lat) && Number.isFinite(gw.lng);
  const where = gw ? [gw.regionName, gw.districtName, gw.depotName].filter(Boolean) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to map
        </button>
        {located ? (
          <button type="button" onClick={() => onLocate(gw!.lat, gw!.lng)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <LocateFixed className="h-3.5 w-3.5" /> Centre
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!gw && !error ? (
          <div className="space-y-3">
            <div className="ui-skeleton h-5 w-3/4" />
            <div className="ui-skeleton h-3 w-1/2" />
            <div className="ui-skeleton h-24 w-full" />
          </div>
        ) : null}
        {gw ? (
          <>
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-50">{gw.name}</h3>
                <GwPill status={gw.effectiveStatus} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{where.length ? where.join(" › ") : "Not assigned to a region or depot yet"}</p>
              {gw.statusReason ? <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{gw.statusReason}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Fact icon={<Radio className="h-3.5 w-3.5" />} label="Last heard" value={timeAgo(lastHeard(gw))} sub={fmtDate(lastHeard(gw))} />
              <Fact icon={<History className="h-3.5 w-3.5" />} label="Status since" value={gw.statusChangedAt ? timeAgo(gw.statusChangedAt) : "—"} sub={gw.statusChangedAt ? fmtDate(gw.statusChangedAt) : undefined} />
              <Fact icon={<Cpu className="h-3.5 w-3.5" />} label="Model" value={[gw.manufacturer, gw.model].filter(Boolean).join(" ") || "—"} sub={gw.firmwareVersion ? `Firmware ${gw.firmwareVersion}` : undefined} />
              <Fact icon={<Network className="h-3.5 w-3.5" />} label="Network" value={gw.networkName || gw.networkId || "—"} sub={gw.operator || undefined} />
              <Fact
                icon={<CardSim className={`h-3.5 w-3.5 ${gw.simAssigned ? "" : "text-red-500"}`} />}
                label="SIM card"
                value={gw.simAssigned ? gw.assignedMsisdn || "Assigned" : "No SIM"}
                sub={gw.assignedSimIccid ? `ICCID ${gw.assignedSimIccid}` : undefined}
              />
              <Fact
                icon={located ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5 text-amber-500" />}
                label="Location"
                value={located ? `${gw.lat.toFixed(4)}, ${gw.lng.toFixed(4)}` : "No coordinates"}
                sub={located ? (gw.locationVerified ? "Verified" : "Not verified") : undefined}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Identifiers</p>
              <dl className="mt-1.5 space-y-1 text-xs">
                {[
                  ["Gateway EUI", gw.gatewayEui],
                  ["MAC", gw.macAddress],
                  ["LORIOT ID", gw.loriotGatewayId],
                  ["Serial", gw.serialNumber],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="truncate font-mono text-[11px] text-slate-800 dark:text-slate-200">{v}</dd>
                    </div>
                  ))}
                {gw.address ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Address</dt>
                    <dd className="truncate text-right text-slate-800 dark:text-slate-200">{gw.address}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recent status changes</p>
              {history == null ? (
                <div className="mt-2 space-y-2">
                  <div className="ui-skeleton h-3 w-full" />
                  <div className="ui-skeleton h-3 w-2/3" />
                </div>
              ) : history.length ? (
                <ul className="mt-2 space-y-2">
                  {history.slice(0, 5).map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-2 text-xs">
                      <span className="flex min-w-0 flex-wrap items-center gap-1">
                        {h.prevStatus ? <GwPill status={h.prevStatus} /> : null}
                        {h.prevStatus ? <span className="text-slate-400">→</span> : null}
                        <GwPill status={h.newStatus} />
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500" title={fmtDate(h.observedAt)}>
                        {timeAgo(h.observedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-500">No status changes recorded.</p>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
        <Link
          to={`/gateways?open=${id}`}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0a2a6b] to-[#0b4fc4] text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110"
        >
          Full details <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
