import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  Cpu,
  Download,
  Eye,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  SignalHigh,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, districtRegionId, useGeography } from "./geo";
import { cachedGet, peekCache } from "../../lib/cache";
import AddFromEuiDrawer from "./AddFromEuiDrawer";

export type RegistryRow = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  type?: "GROUND_MOUNTED" | "POLE_MOUNTED" | null;
  active: boolean;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lat?: number | null;
  lng?: number | null;
  lastSignalAt?: string | null;
  minutesSinceSignal?: number | null;
  status: Status;
  controllerCount: number;
  controllerEuis: string[];
  lastCommandAction?: string | null;
  lastCommandStatus?: string | null;
  lastCommandAt?: string | null;
  openAlerts: number;
  totalAlerts: number;
  lastAlertAt?: string | null;
  lastAlertMessage?: string | null;
};

export type Unmatched = {
  id: number;
  devEui: string;
  name?: string | null;
  type?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lastReadingAt?: string | null;
  online: boolean;
  battery?: number | null;
  rssi?: number | null;
  createdAt?: string | null;
};

type Status = "ONLINE" | "DELAYED" | "OFFLINE" | "NEVER_SEEN" | "NO_DEVICE";

export const STATUS: Record<Status, { label: string; dot: string; chip: string }> = {
  ONLINE: { label: "Online", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" },
  DELAYED: { label: "Delayed", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30" },
  OFFLINE: { label: "Offline", dot: "bg-red-500", chip: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30" },
  NEVER_SEEN: { label: "Never seen", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" },
  NO_DEVICE: { label: "No device", dot: "bg-slate-300", chip: "bg-white text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700" },
};

const typeLabel = (t?: string | null) => (t === "GROUND_MOUNTED" ? "GMT" : t === "POLE_MOUNTED" ? "PMT" : "—");

export const ago = (minutes?: number | null, iso?: string | null) => {
  let m = minutes;
  if (m == null && iso) m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (m == null || Number.isNaN(m)) return "never";
  if (m < 1) return "just now";
  if (m < 60) return `${Math.floor(m)} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

type SortKey = "name" | "region" | "depot" | "partner" | "status" | "alerts" | "signal";
const PAGE = 50;

export default function TransformerRegistry() {
  const { token, hasPermission, user } = useAuth();
  const geo = useGeography(token);
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "unmatched">(params.get("tab") === "unmatched" ? "unmatched" : "all");
  const [regionId, setRegionId] = useState(params.get("region") || "");
  const [districtId, setDistrictId] = useState(params.get("district") || "");
  const [depotId, setDepotId] = useState(params.get("depot") || "");
  const [partner, setPartner] = useState(params.get("partner") || "");
  const [type, setType] = useState("");
  // Drill-down from the dashboard tiles: ?arm=ARMED|DISARMED, ?alerting=1
  const [arm, setArm] = useState((params.get("arm") || "").toUpperCase());
  const [alertingOnly, setAlertingOnly] = useState(params.get("alerting") === "1");
  const [statuses, setStatuses] = useState<Status[]>(() => {
    const st = (params.get("status") || "").toUpperCase();
    return st in STATUS ? [st as Status] : [];
  });
  const [search, setSearch] = useState(params.get("q") || "");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addEui, setAddEui] = useState<string | undefined>();
  const [matching, setMatching] = useState<Unmatched | null>(null);
  const isSupplier = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
  const canEdit = !isSupplier && (hasPermission("transformers.create") || hasPermission("transformers.update"));

  // Stale-while-revalidate: a revisit shows the last list at once, then refreshes in the background.
  const load = useCallback(
    async (force = true) => {
      try {
        if (!peekCache(`${API_BASE_URL}/api/v1/transformers/registry`, token)) setLoading(true);
        const [r, u] = await Promise.all([
          cachedGet<RegistryRow[]>(`${API_BASE_URL}/api/v1/transformers/registry`, token, 20_000, force),
          cachedGet<Unmatched[]>(`${API_BASE_URL}/api/v1/controllers/unmatched`, token, 20_000, force).catch(() => [] as Unmatched[]),
        ]);
        setRows(Array.isArray(r) ? r : []);
        setUnmatched(Array.isArray(u) ? u : []);
        setError(null);
      } catch {
        setError("Could not load the transformer registry.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    const cached = peekCache<RegistryRow[]>(`${API_BASE_URL}/api/v1/transformers/registry`, token);
    if (cached) {
      setRows(cached);
      setLoading(false);
    }
    void load(false);
  }, [load, token]);

  // keep filters in the URL so a filtered view can be shared or bookmarked
  useEffect(() => {
    const next = new URLSearchParams();
    if (tab === "unmatched") next.set("tab", "unmatched");
    if (regionId) next.set("region", regionId);
    if (districtId) next.set("district", districtId);
    if (depotId) next.set("depot", depotId);
    if (partner) next.set("partner", partner);
    setParams(next, { replace: true });
  }, [depotId, districtId, partner, regionId, setParams, tab]);

  const districtOptions = useMemo(
    () => geo.districts.filter((d) => !regionId || String(districtRegionId(d)) === regionId),
    [geo, regionId]
  );
  const depotOptions = useMemo(
    () =>
      geo.depots.filter((d) => {
        const path = geo.pathOf(d.id);
        if (districtId) return String(path.districtId) === districtId;
        if (regionId) return String(path.regionId) === regionId;
        return true;
      }),
    [districtId, geo, regionId]
  );

  const partners = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.supplierCode && m.set(r.supplierCode, r.supplierName || r.supplierCode));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const enriched = useMemo(() => rows.map((r) => ({ row: r, path: geo.pathOf(r.depotId) })), [geo, rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = enriched.filter(({ row, path }) => {
      if (regionId && String(path.regionId) !== regionId) return false;
      if (districtId && String(path.districtId) !== districtId) return false;
      if (depotId && String(row.depotId) !== depotId) return false;
      if (partner && row.supplierCode !== partner) return false;
      if (type && row.type !== type) return false;
      if (statuses.length && !statuses.includes(row.status)) return false;
      if (arm === "ARMED" && row.lastCommandAction !== "ARM") return false;
      if (arm === "DISARMED" && row.lastCommandAction !== "DISARM") return false;
      if (alertingOnly && !(row.openAlerts > 0)) return false;
      if (!q) return true;
      return [row.name, path.depotName, path.districtName, path.regionName, row.supplierName, ...row.controllerEuis]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q));
    });
    const statusRank: Record<Status, number> = { OFFLINE: 0, DELAYED: 1, NEVER_SEEN: 2, ONLINE: 3, NO_DEVICE: 4 };
    const val = (e: (typeof out)[number]): string | number => {
      switch (sort.key) {
        case "region":
          return `${e.path.regionName} ${e.path.districtName} ${e.path.depotName}`;
        case "depot":
          return e.path.depotName;
        case "partner":
          return e.row.supplierName || "";
        case "status":
          return statusRank[e.row.status];
        case "alerts":
          return e.row.openAlerts;
        case "signal":
          return e.row.minutesSinceSignal ?? 1e12;
        default:
          return e.row.name.toLowerCase();
      }
    };
    return out.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [alertingOnly, arm, depotId, districtId, enriched, partner, regionId, search, sort, statuses, type]);

  useEffect(() => setPage(0), [regionId, districtId, depotId, partner, type, statuses, search, arm, alertingOnly]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { ONLINE: 0, DELAYED: 0, OFFLINE: 0, NEVER_SEEN: 0, NO_DEVICE: 0 };
    filtered.forEach(({ row }) => (c[row.status] += 1));
    return c;
  }, [filtered]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const toggleStatus = (s: Status) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const sortBy = (key: SortKey) => setSort((cur) => ({ key, dir: cur.key === key ? (cur.dir === 1 ? -1 : 1) : 1 }));
  const clearFilters = () => {
    setRegionId("");
    setDistrictId("");
    setDepotId("");
    setPartner("");
    setType("");
    setStatuses([]);
    setSearch("");
    setArm("");
    setAlertingOnly(false);
  };
  const anyFilter = regionId || districtId || depotId || partner || type || statuses.length || search || arm || alertingOnly;

  const exportCsv = () => {
    const header = ["Transformer", "Type", "Region", "District", "Depot", "Partner", "Status", "Last signal", "Controllers", "Open alerts", "Lat", "Lng"];
    const lines = filtered.map(({ row, path }) =>
      [row.name, typeLabel(row.type), path.regionName, path.districtName, path.depotName, row.supplierName || "", STATUS[row.status].label, row.lastSignalAt || "", row.controllerEuis.join(" "), row.openAlerts, row.lat ?? "", row.lng ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transformers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-5 py-4 text-white shadow-[0_18px_40px_-24px_rgba(11,79,196,0.7)]">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">Asset register</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">Transformers</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100/80">
              Every ZESA transformer under monitoring, with its partner devices, live status and alerts. Filter by region, district and depot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/15">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/15">
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {canEdit ? (
              <>
                <Link to="/transformers/new" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/15">
                  <Pencil className="h-4 w-4" /> Manual entry
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setAddEui(undefined);
                    setAddOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" /> Add from device EUI
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Status composition of the current filter: label + count on every segment's legend */}
        <div className="relative mt-5 grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-blue-100/75">Transformers in view</p>
              <p className="text-2xl font-semibold">{filtered.length.toLocaleString()}</p>
            </div>
            <div className="mt-2 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-white/10">
              {(Object.keys(STATUS) as Status[]).map((s) =>
                counts[s] > 0 ? (
                  <div key={s} className={`${STATUS[s].dot} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(counts[s] / Math.max(filtered.length, 1)) * 100}%` }} title={`${STATUS[s].label}: ${counts[s]}`} />
                ) : null
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-blue-50/90">
              {(Object.keys(STATUS) as Status[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />
                  {STATUS[s].label} <b className="font-semibold">{counts[s]}</b>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab("unmatched")}
            className="flex items-center justify-between rounded-2xl bg-white/[0.07] p-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.12]"
          >
            <div>
              <p className="text-[11px] text-blue-100/75">Controllers waiting for a transformer</p>
              <p className="mt-0.5 text-2xl font-semibold">{unmatched.length}</p>
              <p className="text-[11px] text-blue-100/70">Auto-registered by partner feeds. Match them to a transformer.</p>
            </div>
            <Cpu className="h-8 w-8 text-amber-300" />
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
          All transformers <span className="ml-1 opacity-70">{rows.length}</span>
        </TabBtn>
        <TabBtn active={tab === "unmatched"} onClick={() => setTab("unmatched")}>
          Unmatched controllers{" "}
          <span className={`ml-1 rounded-full px-1.5 ${unmatched.length ? "bg-amber-500 text-white" : "opacity-70"}`}>{unmatched.length}</span>
        </TabBtn>
      </div>

      {tab === "all" ? (
        <>
          {/* Filters: one row, cascading Region -> District -> Depot */}
          <section className="enterprise-card space-y-3 p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.8fr]">
              <div className="enterprise-chip flex items-center gap-2 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, EUI, depot, partner…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
              <Select
                value={regionId}
                onChange={(v) => {
                  setRegionId(v);
                  setDistrictId("");
                  setDepotId("");
                }}
                placeholder="All regions"
                options={geo.regions.map((r) => [String(r.id), r.name])}
              />
              <Select
                value={districtId}
                onChange={(v) => {
                  setDistrictId(v);
                  setDepotId("");
                }}
                placeholder={regionId ? "All districts in region" : "All districts"}
                options={districtOptions.map((d) => [String(d.id), d.name])}
              />
              <Select value={depotId} onChange={setDepotId} placeholder={districtId ? "All depots in district" : "All depots"} options={depotOptions.map((d) => [String(d.id), d.name])} />
              <Select value={partner} onChange={setPartner} placeholder="All partners" options={partners} />
              <Select value={type} onChange={setType} placeholder="GMT & PMT" options={[["GROUND_MOUNTED", "Ground mounted (GMT)"], ["POLE_MOUNTED", "Pole mounted (PMT)"]]} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(STATUS) as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                    statuses.includes(s) ? `${STATUS[s].chip} ring-2` : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />
                  {STATUS[s].label}
                </button>
              ))}
              {arm ? (
                <button type="button" onClick={() => setArm("")} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                  {arm === "ARMED" ? "Armed sites" : "Disarmed sites"} <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {alertingOnly ? (
                <button type="button" onClick={() => setAlertingOnly(false)} className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                  With open alerts <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {anyFilter ? (
                <button type="button" onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              ) : null}
            </div>
          </section>

          {/* Table */}
          <section className="enterprise-card overflow-hidden">
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Loading transformers…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-xs">
                  <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900/60">
                    <tr>
                      <Th onClick={() => sortBy("name")} active={sort.key === "name"}>Transformer</Th>
                      <Th onClick={() => sortBy("region")} active={sort.key === "region"}>Region › District › Depot</Th>
                      <Th onClick={() => sortBy("partner")} active={sort.key === "partner"}>Partner</Th>
                      <Th>Devices</Th>
                      <Th onClick={() => sortBy("status")} active={sort.key === "status"}>Status</Th>
                      <Th>Arm state</Th>
                      <Th onClick={() => sortBy("alerts")} active={sort.key === "alerts"}>Alerts</Th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pageRows.map(({ row, path }) => (
                      <tr key={row.id} className="transition hover:bg-blue-50/40 dark:hover:bg-slate-900">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-bold ${row.type === "POLE_MOUNTED" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"}`}>
                              {typeLabel(row.type)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                              <p className="text-[11px] text-slate-500">
                                #{row.id}
                                {row.transformerNumber ? ` · No. ${row.transformerNumber}` : ""}
                                {row.lat != null && row.lng != null ? (
                                  <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600">
                                    <MapPin className="h-3 w-3" /> mapped
                                  </span>
                                ) : (
                                  <span className="ml-1 text-amber-600">no GPS</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{path.depotName}</p>
                          <p className="text-[11px] text-slate-500">
                            {path.regionName} › {path.districtName}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.supplierName || row.supplierCode || <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {row.controllerEuis.length ? row.controllerEuis.map((e) => <div key={e}>{e}</div>) : <span className="font-sans text-slate-400">None linked</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${STATUS[row.status].chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS[row.status].dot}`} />
                            {STATUS[row.status].label}
                          </span>
                          {row.status !== "NO_DEVICE" ? <p className="mt-1 text-[11px] text-slate-500">{ago(row.minutesSinceSignal, row.lastSignalAt)}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          {row.lastCommandAction ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                              {row.lastCommandAction === "ARM" ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldOff className="h-3.5 w-3.5 text-amber-600" />}
                              {row.lastCommandAction === "ARM" ? "Armed" : "Disarmed"}
                              <span className="text-slate-400">· {(row.lastCommandStatus || "").toLowerCase()}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.openAlerts > 0 ? (
                            <Link to="/response" className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
                              {row.openAlerts} open
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-400">{row.totalAlerts ? `${row.totalAlerts} past` : "None"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <IconLink to={`/transformer/${row.id}`} title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </IconLink>
                            {canEdit ? (
                              <IconLink to={`/transformers/${row.id}/edit`} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </IconLink>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">
                          No transformers match these filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
              <span>
                Showing {filtered.length === 0 ? 0 : page * PAGE + 1}–{Math.min(filtered.length, page * PAGE + PAGE)} of {filtered.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-slate-700">
                  Previous
                </button>
                <span>
                  Page {page + 1} of {pages}
                </span>
                <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-full bg-blue-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <UnmatchedQueue
          items={unmatched}
          canEdit={canEdit}
          onCreate={(c) => {
            setAddEui(c.devEui);
            setAddOpen(true);
          }}
          onMatch={setMatching}
        />
      )}

      <AddFromEuiDrawer
        open={addOpen}
        initialEui={addEui}
        geo={geo}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          void load();
        }}
      />
      <MatchModal
        controller={matching}
        rows={rows}
        geo={geo}
        onClose={() => setMatching(null)}
        onDone={() => {
          setMatching(null);
          void load();
        }}
      />
    </div>
  );
}

function UnmatchedQueue({
  items,
  canEdit,
  onCreate,
  onMatch,
}: {
  items: Unmatched[];
  canEdit: boolean;
  onCreate: (c: Unmatched) => void;
  onMatch: (c: Unmatched) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="enterprise-card flex flex-col items-center gap-2 px-6 py-16 text-center">
        <Cpu className="h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Every controller is matched</p>
        <p className="max-w-md text-xs text-slate-500">
          When a partner feed hears a device EUI it does not know, the controller is registered automatically and appears here until you link it to a transformer.
        </p>
      </div>
    );
  }
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <div key={c.id} className="enterprise-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{c.devEui}</p>
              <p className="text-[11px] text-slate-500">
                {c.supplierName || c.supplierCode || "Unknown partner"} {c.type ? `· ${c.type}` : ""}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${c.online ? STATUS.ONLINE.chip : STATUS.OFFLINE.chip}`}>
              <SignalHigh className="h-3 w-3" /> {c.online ? "Reporting" : "Quiet"}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Last heard {ago(null, c.lastReadingAt)} · first seen {ago(null, c.createdAt)}
            {c.battery != null ? ` · battery ${c.battery}` : ""}
            {c.rssi ? ` · RSSI ${c.rssi}` : ""}
          </p>
          {canEdit ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onCreate(c)} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700">
                <Zap className="h-3.5 w-3.5" /> New transformer from EUI
              </button>
              <button type="button" onClick={() => onMatch(c)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">
                <Link2 className="h-3.5 w-3.5" /> Link to existing
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function MatchModal({
  controller,
  rows,
  geo,
  onClose,
  onDone,
}: {
  controller: Unmatched | null;
  rows: RegistryRow[];
  geo: ReturnType<typeof useGeography>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [depotId, setDepotId] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQ("");
    setDepotId("");
    setError(null);
  }, [controller?.id]);

  const candidates = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (!depotId || String(r.depotId) === depotId) && (!s || r.name.toLowerCase().includes(s)))
      .sort((a, b) => Number(a.controllerCount > 0) - Number(b.controllerCount > 0) || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [depotId, q, rows]);

  if (!controller) return null;

  const link = async (transformerId: number) => {
    try {
      setBusy(transformerId);
      setError(null);
      await axios.post(`${API_BASE_URL}/api/v1/controllers/${controller.id}/assign`, { transformerId }, { headers: { Authorization: `Bearer ${token}` } });
      onDone();
    } catch (e) {
      const data = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setError(data?.message || "Could not link the controller.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">Link controller</p>
          <h3 className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">{controller.devEui}</h3>
          <p className="text-xs text-slate-500">Pick the transformer this device is installed on. Transformers without a device are listed first.</p>
        </div>
        <div className="grid gap-2 px-5 pt-4 sm:grid-cols-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transformer…" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="">All depots</option>
            {geo.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <div className="mx-5 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
        <div className="mt-3 flex-1 divide-y divide-slate-100 overflow-y-auto px-2 pb-3 dark:divide-slate-800">
          {candidates.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={busy != null}
              onClick={() => void link(r.id)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-blue-50 disabled:opacity-60 dark:hover:bg-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                <p className="text-[11px] text-slate-500">
                  {geo.pathOf(r.depotId).depotName} · {r.controllerCount ? `${r.controllerCount} device(s) already` : "no device yet"}
                </p>
              </div>
              {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 text-blue-600" />}
            </button>
          ))}
          {candidates.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No transformers match.</p> : null}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: Array<[string, string]> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`enterprise-chip w-full px-3 py-2 text-sm outline-none dark:text-slate-100 ${value ? "font-semibold text-blue-700 dark:text-blue-300" : "text-slate-600"}`}
    >
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Th({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <th className="px-4 py-3 font-semibold">
      {onClick ? (
        <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 uppercase ${active ? "text-blue-700 dark:text-blue-300" : ""}`}>
          {children}
          <ArrowDownUp className="h-3 w-3 opacity-60" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function IconLink({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <Link to={to} title={title} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">
      {children}
    </Link>
  );
}

