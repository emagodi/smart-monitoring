import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  CloudOff,
  Eye,
  HelpCircle,
  Loader2,
  MapPinned,
  RefreshCcw,
  Router,
  Search,
  Server,
  ServerCrash,
  CardSim,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import GoogleAssetMap, { GoogleAssetMapPoint } from "../../components/maps/GoogleAssetMap";

type GatewayStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "NEVER_SEEN" | "UNKNOWN";

type GatewaySyncStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";

interface GatewaySummary {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  neverSeen: number;
  unknown: number;
  missingLocation: number;
  missingSim: number;
  lastSyncStatus: GatewaySyncStatus;
  lastSyncAt?: string | null;
}

interface GatewayItem extends GoogleAssetMapPoint {
  id: number;
  name: string;
  loriotGatewayId?: string | null;
  gatewayEui?: string | null;
  mac?: string | null;
  model?: string | null;
  fwVersion?: string | null;
  regionId?: number | null;
  regionName?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  networkId?: string | null;
  networkName?: string | null;
  operator?: string | null;
  effectiveStatus: GatewayStatus;
  lastTrafficSeenAt?: string | null;
  lastLoriotSeenAt?: string | null;
  simAssigned?: boolean;
  assignedSimIccid?: string | null;
}

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const syncStatusTone = (status?: GatewaySyncStatus | null) => {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700";
    case "RUNNING":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const syncStatusLabel = (status?: GatewaySyncStatus | null) => {
  switch (status) {
    case "SUCCESS": return "Success";
    case "PARTIAL": return "Partial";
    case "FAILED": return "Failed";
    case "RUNNING": return "Running";
    default: return "Unknown";
  }
};

const STATUS_FILTERS: Array<{ value: GatewayStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "NEVER_SEEN", label: "Never Seen" },
  { value: "UNKNOWN", label: "Unknown" },
];

const MetricTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "red" | "amber" | "blue" | "emerald" | "slate";
}) => {
  const toneClasses = {
    red: "bg-red-50 text-red-600 dark:bg-red-500/14 dark:text-red-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  }[tone];

  return (
    <div className="enterprise-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        <span className={`inline-flex rounded-xl px-2.5 py-1 ${toneClasses}`}>{value}</span>
      </div>
    </div>
  );
};

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
        active
          ? "border-blue-200 bg-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

const getMarkerColors = (point: GatewayItem): { fillColor: string; strokeColor: string } => {
  switch (point.effectiveStatus) {
    case "ONLINE":
      return { fillColor: "#22c55e", strokeColor: "#16a34a" };
    case "OFFLINE":
      return { fillColor: "#ef4444", strokeColor: "#dc2626" };
    case "DEGRADED":
      return { fillColor: "#f59e0b", strokeColor: "#d97706" };
    case "NEVER_SEEN":
      return { fillColor: "#94a3b8", strokeColor: "#64748b" };
    default:
      return { fillColor: "#64748b", strokeColor: "#475569" };
  }
};

export default function GatewaysMapIndex() {
  const { token, hasPermission } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<GatewayItem[]>([]);
  const [summary, setSummary] = useState<GatewaySummary>({
    total: 0,
    online: 0,
    offline: 0,
    degraded: 0,
    neverSeen: 0,
    unknown: 0,
    missingLocation: 0,
    missingSim: 0,
    lastSyncStatus: "SUCCESS",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GatewayStatus | "ALL">(
    () => (searchParams.get("status") as GatewayStatus) || "ALL"
  );
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [selectedDepot, setSelectedDepot] = useState<string>("ALL");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ALL");
  const [selectedModel, setSelectedModel] = useState<string>("ALL");
  const [selectedOperator, setSelectedOperator] = useState<string>("ALL");
  const [hasLocationFilter, setHasLocationFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [hasSimFilter, setHasSimFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [lastSeenFrom, setLastSeenFrom] = useState<string>("");
  const [lastSeenTo, setLastSeenTo] = useState<string>("");

  const [selectedMapPointId, setSelectedMapPointId] = useState<number | null>(null);

  const canSync = hasPermission("gateways.sync");

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/gateways/summary`, { headers });
      const data = (response.data || {}) as Partial<GatewaySummary>;
      setSummary({
        total: typeof data.total === "number" ? data.total : 0,
        online: typeof data.online === "number" ? data.online : 0,
        offline: typeof data.offline === "number" ? data.offline : 0,
        degraded: typeof data.degraded === "number" ? data.degraded : 0,
        neverSeen: typeof data.neverSeen === "number" ? data.neverSeen : 0,
        unknown: typeof data.unknown === "number" ? data.unknown : 0,
        missingLocation: typeof data.missingLocation === "number" ? data.missingLocation : 0,
        missingSim: typeof data.missingSim === "number" ? data.missingSim : 0,
        lastSyncStatus: data.lastSyncStatus || "SUCCESS",
        lastSyncAt: data.lastSyncAt ?? null,
      });
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, [API_BASE_URL, headers, token]);

  const fetchGateways = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = { page: 0, size: 500 };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (selectedRegion !== "ALL") params.regionId = selectedRegion;
      if (selectedDepot !== "ALL") params.depotId = selectedDepot;
      if (selectedNetwork !== "ALL") params.networkId = selectedNetwork;
      if (selectedModel !== "ALL") params.model = selectedModel;
      if (selectedOperator !== "ALL") params.operator = selectedOperator;
      if (hasLocationFilter !== "ALL") params.hasLocation = hasLocationFilter === "YES";
      if (hasSimFilter !== "ALL") params.hasSim = hasSimFilter === "YES";
      if (lastSeenFrom) params.lastSeenFrom = lastSeenFrom;
      if (lastSeenTo) params.lastSeenTo = lastSeenTo;
      if (search.trim()) params.search = search.trim();

      const response = await axios.get(`${API_BASE_URL}/api/v1/gateways`, { headers, params });
      setItems(normalizeList<GatewayItem>(response.data));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load gateway inventory for map.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, token, statusFilter, selectedRegion, selectedDepot, selectedNetwork, selectedModel, selectedOperator, hasLocationFilter, hasSimFilter, lastSeenFrom, lastSeenTo, search]);

  useEffect(() => {
    if (token) {
      void fetchSummary();
      void fetchGateways();
    }
  }, [fetchSummary, fetchGateways, token]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (statusFilter !== "ALL") {
      nextParams.set("status", statusFilter);
    } else {
      nextParams.delete("status");
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [statusFilter, searchParams, setSearchParams]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => { if (item.regionName) set.add(item.regionName); });
    return [...set].sort();
  }, [items]);

  const depotOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => { if (item.depotName) set.add(item.depotName); });
    return [...set].sort();
  }, [items]);

  const networkOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => { if (item.networkName) set.add(item.networkName); });
    return [...set].sort();
  }, [items]);

  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => { if (item.model) set.add(item.model); });
    return [...set].sort();
  }, [items]);

  const operatorOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => { if (item.operator) set.add(item.operator); });
    return [...set].sort();
  }, [items]);

  const mapPoints = useMemo<GatewayItem[]>(
    () =>
      items.filter(
        (item) =>
          typeof item.lat === "number" &&
          typeof item.lng === "number" &&
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng)
      ),
    [items]
  );

  const visibleMapPoint = selectedMapPointId != null ? items.find((i) => i.id === selectedMapPointId) ?? null : null;

  return (
    <div className="space-y-4">
      <section className="enterprise-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
              Gateway Map
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              Geographic gateway footprint
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ONLINE = green · OFFLINE = red · DEGRADED = amber · NEVER_SEEN = slate · UNKNOWN = grey
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold ${syncStatusTone(summary.lastSyncStatus)}`}>
              {syncStatusLabel(summary.lastSyncStatus)} sync · {formatDateTime(summary.lastSyncAt)}
            </span>
            <button
              type="button"
              onClick={() => {
                void fetchSummary();
                void fetchGateways();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <MetricTile label="Total" value={summary.total} tone="blue" />
          <MetricTile label="Online" value={summary.online} tone="emerald" />
          <MetricTile label="Offline" value={summary.offline} tone="red" />
          <MetricTile label="Degraded" value={summary.degraded} tone="amber" />
          <MetricTile label="Never Seen" value={summary.neverSeen} tone="slate" />
        </div>
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-50 via-white to-red-50 p-4 dark:border-slate-800 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Filters
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Filter the geographic gateway map
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={statusFilter === filter.value}
                    label={filter.label}
                    onClick={() => setStatusFilter(filter.value)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setHasLocationFilter(hasLocationFilter === "YES" ? "ALL" : "YES")}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                    hasLocationFilter === "YES"
                      ? "border-blue-200 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  Has Location
                </button>
                <button
                  type="button"
                  onClick={() => setHasLocationFilter(hasLocationFilter === "NO" ? "ALL" : "NO")}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                    hasLocationFilter === "NO"
                      ? "border-red-200 bg-red-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  Missing Location
                </button>
                <button
                  type="button"
                  onClick={() => setHasSimFilter(hasSimFilter === "YES" ? "ALL" : "YES")}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                    hasSimFilter === "YES"
                      ? "border-blue-200 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  Has SIM
                </button>
                <button
                  type="button"
                  onClick={() => setHasSimFilter(hasSimFilter === "NO" ? "ALL" : "NO")}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                    hasSimFilter === "NO"
                      ? "border-red-200 bg-red-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  Missing SIM
                </button>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 xl:max-w-[560px]">
              <div className="enterprise-chip flex items-center gap-3 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search gateway name, EUI, MAC, address..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Region</span>
              <select
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All regions</option>
                {regionOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Depot</span>
              <select
                value={selectedDepot}
                onChange={(event) => setSelectedDepot(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All depots</option>
                {depotOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Network</span>
              <select
                value={selectedNetwork}
                onChange={(event) => setSelectedNetwork(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All networks</option>
                {networkOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Model</span>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All models</option>
                {modelOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Operator</span>
              <select
                value={selectedOperator}
                onChange={(event) => setSelectedOperator(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All operators</option>
                {operatorOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Last Seen From</span>
              <input
                type="date"
                value={lastSeenFrom}
                onChange={(event) => setLastSeenFrom(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Last Seen To</span>
              <input
                type="date"
                value={lastSeenTo}
                onChange={(event) => setLastSeenTo(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-3 px-4 py-20 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span>Loading gateway map...</span>
          </div>
        ) : (
          <div className="p-4">
            <div className="overflow-hidden rounded-[22px] border border-slate-200/80 dark:border-slate-800">
              <GoogleAssetMap
                apiKey={GOOGLE_MAPS_API_KEY}
                className="h-[520px]"
                points={mapPoints}
                selectedPointId={selectedMapPointId}
                onPointSelect={(point) => setSelectedMapPointId(Number(point.id))}
                emptyLabel="No gateway coordinates are available for the current filters."
                getMarkerColors={(point) => getMarkerColors(point as GatewayItem)}
                renderDetails={(point) => {
                  const gw = point as GatewayItem;
                  return (
                    <div className="space-y-1.5 text-sm text-slate-600">
                      <p>Region: <span className="font-medium text-slate-900">{gw.regionName || "—"}</span></p>
                      <p>Depot: <span className="font-medium text-slate-900">{gw.depotName || "—"}</span></p>
                      <p>Model: <span className="font-medium text-slate-900">{gw.model || "—"}</span></p>
                      <p>SIM: <span className="font-medium text-slate-900">{gw.simAssigned ? "Assigned" : "Unassigned"}</span></p>
                      <p>Last seen: <span className="font-medium text-slate-900">{formatDateTime(gw.lastTrafficSeenAt || gw.lastLoriotSeenAt)}</span></p>
                    </div>
                  );
                }}
              />
            </div>
            {visibleMapPoint ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Selected: {visibleMapPoint.name}
                  </p>
                  <p className="text-[11px] text-blue-600/80 dark:text-blue-400">
                    {visibleMapPoint.regionName || "—"} · {visibleMapPoint.depotName || "—"}
                  </p>
                </div>
                {canSync ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    <Activity className="h-3 w-3" />
                    {visibleMapPoint.effectiveStatus}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
