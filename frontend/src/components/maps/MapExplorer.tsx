import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, ArrowLeft, Cpu, ExternalLink, Layers, Loader2, LocateFixed, MapPin, Radio, ShieldCheck, ShieldOff, Siren, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { useGeography } from "../../pages/Registry/geo";
import { Chips, SearchBox, STATUS_META, StatusPill, timeAgo } from "../ui/page";
import TransformerMap, { type MapCluster, type MapFocus, type MapPoint, type MapView } from "./TransformerMap";

const API = import.meta.env.VITE_API_BASE_URL || "";
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export type ExplorerPoint = MapPoint & {
  type?: string | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  armState?: string | null;
};

type MapResponse = {
  total: number;
  inView: number;
  unmapped: number;
  mode: "points" | "clusters";
  points: ExplorerPoint[];
  clusters: MapCluster[];
  counts?: Record<string, number>;
};

type Detail = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  type?: string | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lat?: number | null;
  lng?: number | null;
  status: string;
  lastSignalAt?: string | null;
  controllerEuis?: string[];
  controllerCount?: number;
  lastCommandAction?: string | null;
  lastCommandAt?: string | null;
  openAlerts?: number;
  totalAlerts?: number;
  lastAlertAt?: string | null;
  lastAlertMessage?: string | null;
};

type RecentAlert = { id: number; value?: string; message?: string; createdAt?: string; lastSeenAt?: string; caseStatus?: string; occurrenceCount?: number };

type StatusFilter = "ALL" | "ONLINE" | "OFFLINE" | "DELAYED" | "NEVER_SEEN";

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Map workspace: a list of the transformers on screen beside a map of status dots.
 * Only the visible area is loaded; large areas come back as numbered groups to zoom into.
 * Selecting a transformer (in the list or on the map) opens its details in the side panel,
 * and "Back to map" returns to the list at the same place. The selection is kept in the URL
 * (?t=id), so the browser Back button also returns to the map.
 */
export default function MapExplorer({ height = "h-[620px]", showList = true }: { height?: string; showList?: boolean }) {
  const { token } = useAuth();
  const geo = useGeography(token);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("t") ? Number(params.get("t")) : null;

  const [view, setView] = useState<MapView | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<MapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const focusKey = useRef(1);
  const lastFitQuery = useRef<string>("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  // Load the transformers in the visible area (or matching the search anywhere).
  useEffect(() => {
    if (!token) return;
    const qs = new URLSearchParams();
    if (debounced) qs.set("q", debounced);
    else if (view) {
      qs.set("south", String(round(view.south)));
      qs.set("west", String(round(view.west)));
      qs.set("north", String(round(view.north)));
      qs.set("east", String(round(view.east)));
      qs.set("zoom", String(view.zoom));
    }
    if (status !== "ALL") qs.set("status", status);
    let cancelled = false;
    setLoading(true);
    cachedGet<MapResponse>(`${API}/api/v1/transformers/map?${qs.toString()}`, token, 20_000)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
        // A search jumps the map to what it found.
        if (debounced && debounced !== lastFitQuery.current && res.points.length) {
          lastFitQuery.current = debounced;
          const lats = res.points.map((p) => p.lat);
          const lngs = res.points.map((p) => p.lng);
          setFocus({ key: focusKey.current++, kind: "bounds", south: Math.min(...lats) - 0.01, north: Math.max(...lats) + 0.01, west: Math.min(...lngs) - 0.01, east: Math.max(...lngs) + 0.01 });
        }
      })
      .catch(() => !cancelled && setError("Could not load the map."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, status, token, view]);

  useEffect(() => {
    if (!debounced) lastFitQuery.current = "";
  }, [debounced]);

  const points = data?.points ?? [];
  const clusters = data?.mode === "clusters" ? data.clusters : [];

  const listRows = useMemo(
    () =>
      [...points].sort((a, b) => {
        const rank = (p: ExplorerPoint) => ((p.openAlerts ?? 0) > 0 ? 0 : p.status === "OFFLINE" ? 1 : p.status === "DELAYED" ? 2 : 3);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      }),
    [points]
  );

  const select = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(params);
      if (id == null) next.delete("t");
      else next.set("t", String(id));
      setParams(next, { replace: id == null ? false : Boolean(selectedId) });
    },
    [params, selectedId, setParams]
  );

  const onSelectPoint = useCallback(
    (id: number) => {
      select(id);
      const p = points.find((x) => x.id === id);
      if (p) setFocus({ key: focusKey.current++, kind: "point", lat: p.lat, lng: p.lng, zoom: 13 });
    },
    [points, select]
  );

  const zoomToCluster = useCallback((c: MapCluster) => {
    setFocus({ key: focusKey.current++, kind: "point", lat: c.lat, lng: c.lng, zoom: Math.min(19, (view?.zoom ?? 7) + 2) });
  }, [view?.zoom]);

  const counts = data?.counts;
  const chipOptions: Array<{ value: StatusFilter; label: string; dot?: string; count?: number }> = [
    { value: "ALL", label: "All" },
    { value: "ONLINE", label: "Online", dot: "bg-emerald-500", count: counts?.ONLINE },
    { value: "OFFLINE", label: "Offline", dot: "bg-red-500", count: counts?.OFFLINE },
    { value: "DELAYED", label: "Delayed", dot: "bg-amber-500", count: counts?.DELAYED },
    { value: "NEVER_SEEN", label: "Never seen", dot: "bg-slate-400", count: counts?.NEVER_SEEN },
  ];

  return (
    <section className={`ui-panel relative overflow-hidden ${showList ? "grid lg:grid-cols-[360px_minmax(0,1fr)]" : ""} ${height}`}>
      {/* Side panel: list of what is on the map, or the selected transformer.
          Without the list (dashboard) it only appears, over the map, while a transformer is open. */}
      {showList || selectedId ? (
      <aside
        className={
          showList
            ? "flex min-h-0 flex-col border-b border-slate-200/80 lg:border-b-0 lg:border-r dark:border-slate-800"
            : "absolute bottom-3 left-3 top-3 z-20 flex w-[380px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700"
        }
      >
        {selectedId ? (
          <DetailPanel id={selectedId} token={token} geo={geo} backLabel={showList ? "Back to map list" : "Back to map"} onBack={() => select(null)} onLocate={(lat, lng) => setFocus({ key: focusKey.current++, kind: "point", lat, lng, zoom: 15 })} />
        ) : (
          <>
            <div className="space-y-2 border-b border-slate-200/80 p-3 dark:border-slate-800">
              <SearchBox value={query} onChange={setQuery} placeholder="Find a transformer or device EUI…" />
              <Chips value={status} onChange={setStatus} options={chipOptions} />
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                {debounced
                  ? `${(data?.inView ?? 0).toLocaleString()} found for “${debounced}”`
                  : data
                    ? `${data.inView.toLocaleString()} in this area · ${data.total.toLocaleString()} in total${data.unmapped ? ` · ${data.unmapped} without coordinates` : ""}`
                    : "Loading…"}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {error ? <p className="p-4 text-sm text-red-600">{error}</p> : null}
              {data?.mode === "clusters" && !debounced ? (
                <div className="space-y-3 p-4 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Zoom in to list transformers</p>
                  <p className="text-xs text-slate-500">
                    This area holds {data.inView.toLocaleString()} transformers. Click a numbered circle on the map, or search above, to narrow it down.
                  </p>
                  <div className="space-y-1.5">
                    {[...clusters]
                      .sort((a, b) => b.offline - a.offline || b.count - a.count)
                      .slice(0, 8)
                      .map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => zoomToCluster(c)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:border-blue-300 dark:border-slate-700"
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-blue-600" />
                            Group of {c.count}
                          </span>
                          <span className="text-slate-500">
                            <b className="text-emerald-600">{c.online}</b> on · <b className="text-red-600">{c.offline}</b> off
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
              {data?.mode !== "clusters" || debounced ? (
                listRows.length ? (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listRows.slice(0, 300).map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => onSelectPoint(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-blue-50/50 dark:hover:bg-slate-900">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[p.status]?.dot ?? "bg-slate-300"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {geo.pathOf(p.depotId).depotName} · {displayPartner(p.supplierName, p.supplierCode)}
                            </span>
                          </span>
                          {(p.openAlerts ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300">
                              <Siren className="h-3 w-3" />
                              {p.openAlerts}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                    {listRows.length > 300 ? <li className="px-3 py-2 text-center text-[11px] text-slate-500">Showing 300 of {listRows.length}. Zoom in for the rest.</li> : null}
                  </ul>
                ) : !loading ? (
                  <p className="p-6 text-center text-sm text-slate-500">{debounced ? "Nothing matches that search." : "No transformers in this part of the map."}</p>
                ) : null
              ) : null}
            </div>
          </>
        )}
      </aside>
      ) : null}

      {/* Map */}
      <div className={`relative min-h-[360px] ${showList ? "" : "h-full"}`}>
        <TransformerMap
          apiKey={MAPS_KEY}
          points={points}
          clusters={clusters}
          selectedId={selectedId}
          focus={focus}
          onSelect={onSelectPoint}
          onClusterClick={zoomToCluster}
          onViewChange={setView}
          className="h-full"
        />
        <div className={`pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2 ${!showList && selectedId ? "hidden" : ""}`}>
          {!showList ? (
            <div className="pointer-events-auto w-72 rounded-full shadow-md">
              <SearchBox value={query} onChange={setQuery} placeholder="Find a transformer or device EUI…" />
            </div>
          ) : null}
          {!showList && debounced && data && !loading ? (
            <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md ring-1 ring-slate-200">
              {data.inView ? `${data.inView} found` : "Nothing matches"}
            </span>
          ) : null}
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md ring-1 ring-slate-200 dark:bg-slate-900/95 dark:text-slate-300 dark:ring-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Online
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Offline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Delayed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Never seen
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFocus({ key: focusKey.current++, kind: "home" })}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-md ring-1 ring-slate-200 hover:text-blue-700 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700"
        >
          <LocateFixed className="h-3.5 w-3.5" /> Whole country
        </button>
        {loading ? (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-slate-600 shadow ring-1 ring-slate-200 dark:bg-slate-900/95 dark:text-slate-300">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Loading area…
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DetailPanel({
  id,
  token,
  geo,
  onBack,
  onLocate,
  backLabel,
}: {
  backLabel: string;
  id: number;
  token: string | null;
  geo: ReturnType<typeof useGeography>;
  onBack: () => void;
  onLocate: (lat: number, lng: number) => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [alerts, setAlerts] = useState<RecentAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const located = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setD(null);
    setAlerts(null);
    setError(null);
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    cachedGet<Detail>(`${API}/api/v1/transformers/registry/${id}`, token, 15_000)
      .then((r) => {
        if (cancelled) return;
        setD(r);
        if (located.current !== id && r.lat != null && r.lng != null) {
          located.current = id;
          onLocate(Number(r.lat), Number(r.lng));
        }
      })
      .catch(() => !cancelled && setError("Could not load this transformer."));
    axios
      .get(`${API}/api/v1/alerts/transformer/${id}/recent`, { headers })
      .then((r) => {
        if (cancelled) return;
        const body = r.data as { recentAlerts?: RecentAlert[]; alerts?: RecentAlert[] } | RecentAlert[];
        setAlerts(Array.isArray(body) ? body : body.recentAlerts ?? body.alerts ?? []);
      })
      .catch(() => !cancelled && setAlerts([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const path = geo.pathOf(d?.depotId);
  const armed = d?.lastCommandAction ? d.lastCommandAction.toUpperCase().startsWith("ARM") : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
        {d?.lat != null && d?.lng != null ? (
          <button type="button" onClick={() => onLocate(Number(d.lat), Number(d.lng))} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <LocateFixed className="h-3.5 w-3.5" /> Centre
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!d && !error ? (
          <div className="space-y-3">
            <div className="ui-skeleton h-5 w-3/4" />
            <div className="ui-skeleton h-3 w-1/2" />
            <div className="ui-skeleton h-24 w-full" />
          </div>
        ) : null}
        {d ? (
          <>
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-50">{d.name}</h3>
                <StatusPill status={d.status} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {path.regionName} › {path.districtName} › <b className="font-semibold text-slate-700 dark:text-slate-300">{path.depotName}</b>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Fact icon={<Zap className="h-3.5 w-3.5" />} label="Type" value={`${d.type === "GROUND_MOUNTED" ? "Ground (GMT)" : d.type === "POLE_MOUNTED" ? "Pole (PMT)" : d.type || "—"}${d.transformerNumber ? ` · No. ${d.transformerNumber}` : ""}`} />
              <Fact icon={<Radio className="h-3.5 w-3.5" />} label="Partner" value={displayPartner(d.supplierName, d.supplierCode)} />
              <Fact icon={<Cpu className="h-3.5 w-3.5" />} label="Last signal" value={timeAgo(d.lastSignalAt)} />
              <Fact
                icon={armed ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldOff className="h-3.5 w-3.5" />}
                label="Site security"
                value={armed == null ? "Unknown" : armed ? "Armed" : "Disarmed"}
                sub={d.lastCommandAt ? timeAgo(d.lastCommandAt) : undefined}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Devices</p>
              {d.controllerEuis?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {d.controllerEuis.map((e) => (
                    <span key={e} className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {e}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">No device linked yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recent alerts</p>
                <span className={`text-[11px] font-semibold ${(d.openAlerts ?? 0) > 0 ? "text-red-600" : "text-slate-400"}`}>{d.openAlerts ?? 0} open</span>
              </div>
              {alerts == null ? (
                <div className="mt-2 space-y-2">
                  <div className="ui-skeleton h-3 w-full" />
                  <div className="ui-skeleton h-3 w-2/3" />
                </div>
              ) : alerts.length ? (
                <ul className="mt-2 space-y-2">
                  {alerts.slice(0, 3).map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-800 dark:text-slate-100">
                          {a.value || a.message || "Alert"}
                          {a.occurrenceCount && a.occurrenceCount > 1 ? <span className="ml-1 text-[10px] font-bold text-red-600">×{a.occurrenceCount}</span> : null}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {timeAgo(a.lastSeenAt || a.createdAt)}
                          {a.caseStatus ? ` · ${a.caseStatus.replace(/_/g, " ").toLowerCase()}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-500">No alerts recorded.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to={`/transformer/${d.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <ExternalLink className="h-3.5 w-3.5" /> Full details
              </Link>
              <Link
                to={`/alerts?q=${encodeURIComponent(d.name)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
              >
                <Siren className="h-3.5 w-3.5" /> Alerts
              </Link>
              <Link
                to={`/transformers?q=${encodeURIComponent(d.name)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
              >
                <Zap className="h-3.5 w-3.5" /> In registry
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{value}</p>
      {sub ? <p className="text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}
