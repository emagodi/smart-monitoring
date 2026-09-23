import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  CloudOff,
  Eye,
  HelpCircle,
  Loader2,
  MapPinned,
  MapPinOff,
  Pencil,
  RefreshCw,
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
import { Modal } from "../../components/ui/modal";

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

interface GatewayItem {
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
  lat?: number;
  lng?: number;
  address?: string | null;
  locationSource?: string | null;
  simAssigned?: boolean;
  assignedSimId?: number | null;
  assignedSimIccid?: string | null;
  decommissioned?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface GatewayStatusHistoryItem {
  id: number;
  previousStatus?: GatewayStatus | null;
  newStatus: GatewayStatus;
  reason?: string | null;
  source?: string | null;
  observedAt?: string | null;
}

interface GatewaySimAssignment {
  id: number;
  simId: number;
  iccid?: string | null;
  slotNumber: number;
  active: boolean;
  assignedAt?: string | null;
  unassignedAt?: string | null;
}

type PagePayload<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return [];
};

const normalizePage = <T,>(payload: unknown) => {
  const obj = payload as PagePayload<T> | null;
  const items = normalizeList<T>(payload);
  return {
    items,
    totalElements: typeof obj?.totalElements === "number" ? obj.totalElements : items.length,
    totalPages: typeof obj?.totalPages === "number" ? obj.totalPages : 1,
    page: typeof obj?.number === "number" ? obj.number : 0,
    size: typeof obj?.size === "number" ? obj.size : items.length || 25,
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const statusTone = (status: GatewayStatus) => {
  switch (status) {
    case "ONLINE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "OFFLINE":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
    case "DEGRADED":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300";
    case "NEVER_SEEN":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
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
    case "SUCCESS":
      return "Success";
    case "PARTIAL":
      return "Partial";
    case "FAILED":
      return "Failed";
    case "RUNNING":
      return "Running";
    default:
      return "Unknown";
  }
};

const getMarkerColors = (status: GatewayStatus): { fillColor: string; strokeColor: string } => {
  switch (status) {
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

const STATUS_FILTERS: Array<{ value: GatewayStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "NEVER_SEEN", label: "Never Seen" },
  { value: "UNKNOWN", label: "Unknown" },
];

const DETAIL_TABS: Array<{ value: string; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "status", label: "Status History" },
  { value: "sim", label: "SIM Assignments" },
  { value: "sync", label: "Sync Log" },
  { value: "audit", label: "Audit" },
];

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  highlight,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: ReactNode;
  highlight?: "blue" | "red" | "emerald" | "amber" | "neutral" | "slate";
}) => {
  const hl = highlight || "neutral";
  const valueTone =
    hl === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : hl === "red"
        ? "text-red-600 dark:text-red-300"
        : hl === "emerald"
          ? "text-emerald-600 dark:text-emerald-300"
          : hl === "amber"
            ? "text-amber-600 dark:text-amber-300"
            : hl === "slate"
              ? "text-slate-600 dark:text-slate-300"
              : "text-slate-950 dark:text-slate-50";
  const iconTone =
    hl === "red"
      ? "border border-red-100 bg-red-50/90 text-red-600 dark:border-red-500/10 dark:bg-red-500/10 dark:text-red-300"
      : hl === "emerald"
        ? "border border-emerald-100 bg-emerald-50/80 text-emerald-600 dark:border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300"
        : hl === "amber"
          ? "border border-amber-100 bg-amber-50/80 text-amber-600 dark:border-amber-500/10 dark:bg-amber-500/10 dark:text-amber-300"
          : hl === "slate"
            ? "border border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            : "border border-blue-100 bg-blue-50/80 text-blue-600 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300";
  return (
    <div className="enterprise-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={`mt-2 text-[28px] font-semibold tracking-tight ${valueTone}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="mt-1.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${iconTone}`}>{icon}</div>
      </div>
    </div>
  );
};

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-xs text-slate-700 dark:text-slate-200 ${className}`}>{children}</td>;
}

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

export default function GatewaysIndex() {
  const { token, hasPermission } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedGateway, setSelectedGateway] = useState<GatewayItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<string>("overview");
  const [statusHistory, setStatusHistory] = useState<GatewayStatusHistoryItem[]>([]);
  const [simAssignments, setSimAssignments] = useState<GatewaySimAssignment[]>([]);

  const canSync = hasPermission("gateways.sync");
  const canEdit = hasPermission("gateways.edit");

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
      const params: Record<string, unknown> = { page, size: pageSize };
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
      const normalized = normalizePage<GatewayItem>(response.data);
      setItems(normalized.items);
      setTotalElements(normalized.totalElements);
      setTotalPages(Math.max(normalized.totalPages, 1));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load gateway inventory.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, token, page, pageSize, statusFilter, selectedRegion, selectedDepot, selectedNetwork, selectedModel, selectedOperator, hasLocationFilter, hasSimFilter, lastSeenFrom, lastSeenTo, search]);

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

  const filteredItems = useMemo(() => items, [items]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.regionName) set.add(item.regionName);
    });
    return [...set].sort();
  }, [items]);

  const depotOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.depotName) set.add(item.depotName);
    });
    return [...set].sort();
  }, [items]);

  const networkOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.networkName) set.add(item.networkName);
    });
    return [...set].sort();
  }, [items]);

  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.model) set.add(item.model);
    });
    return [...set].sort();
  }, [items]);

  const operatorOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.operator) set.add(item.operator);
    });
    return [...set].sort();
  }, [items]);

  const openDetailModal = async (gateway: GatewayItem) => {
    setSelectedGateway(gateway);
    setDetailModalOpen(true);
    setDetailTab("overview");
    setStatusHistory([]);
    setSimAssignments([]);
    setDetailLoading(true);
    try {
      const [historyResp, simResp] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/gateways/${gateway.id}/status-history`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/gateways/${gateway.id}/sim-assignments`, { headers }),
      ]);
      setStatusHistory(normalizeList<GatewayStatusHistoryItem>(historyResp.data));
      setSimAssignments(normalizeList<GatewaySimAssignment>(simResp.data));
    } catch (detailError) {
      console.error(detailError);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedGateway(null);
    setStatusHistory([]);
    setSimAssignments([]);
    setDetailTab("overview");
  };

  const triggerSync = async (gatewayId: number) => {
    if (!canSync) return;
    try {
      setSyncingId(gatewayId);
      await axios.post(`${API_BASE_URL}/api/v1/gateways/${gatewayId}/sync`, {}, { headers });
      await Promise.all([fetchSummary(), fetchGateways()]);
    } catch (syncError) {
      console.error(syncError);
      setError("Failed to trigger gateway sync.");
    } finally {
      setSyncingId(null);
    }
  };

  const pageStart = items.length === 0 ? 0 : page * pageSize + 1;
  const pageEnd = items.length === 0 ? 0 : page * pageSize + items.length;

  return (
    <div className="space-y-4">
      <section className="enterprise-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
              Gateway Inventory
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              LoRaWAN gateway estate
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              LORIOT-synced gateways with status engine, SIM assignments, and location tracking.
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
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        <StatCard
          title="Total Gateways"
          value={summary.total}
          subtitle="Registered gateway devices tracked in inventory."
          icon={<Router className="h-5 w-5" />}
          highlight="blue"
        />
        <StatCard
          title="Online"
          value={summary.online}
          subtitle="Gateways reporting as healthy and reachable."
          icon={<Wifi className="h-5 w-5" />}
          highlight="emerald"
        />
        <StatCard
          title="Degraded"
          value={summary.degraded}
          subtitle="Grace-period held offline, likely to flip soon."
          icon={<AlertTriangle className="h-5 w-5" />}
          highlight="amber"
        />
        <StatCard
          title="Last Sync"
          value={syncStatusLabel(summary.lastSyncStatus)}
          subtitle={`Ran ${formatDateTime(summary.lastSyncAt)}`}
          icon={summary.lastSyncStatus === "FAILED" ? <ServerCrash className="h-5 w-5" /> : <Server className="h-5 w-5" />}
          highlight={summary.lastSyncStatus === "FAILED" ? "red" : summary.lastSyncStatus === "PARTIAL" ? "amber" : "emerald"}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          title="Offline"
          value={summary.offline}
          subtitle="Offline beyond grace period — needs attention."
          icon={<WifiOff className="h-5 w-5" />}
          highlight="red"
        />
        <StatCard
          title="Never Seen"
          value={summary.neverSeen}
          subtitle="Created but never observed via LORIOT or traffic."
          icon={<CloudOff className="h-5 w-5" />}
          highlight="slate"
        />
        <StatCard
          title="Unknown"
          value={summary.unknown}
          subtitle="No signal, no uplink, no manual status."
          icon={<HelpCircle className="h-5 w-5" />}
          highlight="slate"
        />
        <StatCard
          title="Missing Location"
          value={summary.missingLocation}
          subtitle="Gateways without lat/lng coordinates set."
          icon={<MapPinOff className="h-5 w-5" />}
          highlight="amber"
        />
        <StatCard
          title="Missing SIM"
          value={summary.missingSim}
          subtitle="Gateways without an active SIM assignment."
          icon={<CardSim className="h-5 w-5" />}
          highlight="red"
        />
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
                  Filter the full-width compact gateway list
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={statusFilter === filter.value}
                    label={filter.label}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setPage(0);
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHasLocationFilter(hasLocationFilter === "YES" ? "ALL" : "YES");
                    setPage(0);
                  }}
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
                  onClick={() => {
                    setHasLocationFilter(hasLocationFilter === "NO" ? "ALL" : "NO");
                    setPage(0);
                  }}
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
                  onClick={() => {
                    setHasSimFilter(hasSimFilter === "YES" ? "ALL" : "YES");
                    setPage(0);
                  }}
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
                  onClick={() => {
                    setHasSimFilter(hasSimFilter === "NO" ? "ALL" : "NO");
                    setPage(0);
                  }}
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
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search gateway name, EUI, MAC, address..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 xl:col-span-2">
                  <label className="inline-flex items-center gap-2">
                    <span>Rows</span>
                    <select
                      value={pageSize}
                      onChange={(event) => {
                        setPage(0);
                        setPageSize(Number(event.target.value));
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Region</span>
              <select
                value={selectedRegion}
                onChange={(event) => {
                  setSelectedRegion(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All regions</option>
                {regionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Depot</span>
              <select
                value={selectedDepot}
                onChange={(event) => {
                  setSelectedDepot(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All depots</option>
                {depotOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Network</span>
              <select
                value={selectedNetwork}
                onChange={(event) => {
                  setSelectedNetwork(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All networks</option>
                {networkOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Model</span>
              <select
                value={selectedModel}
                onChange={(event) => {
                  setSelectedModel(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All models</option>
                {modelOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Operator</span>
              <select
                value={selectedOperator}
                onChange={(event) => {
                  setSelectedOperator(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All operators</option>
                {operatorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
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
                onChange={(event) => {
                  setLastSeenFrom(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Last Seen To</span>
              <input
                type="date"
                value={lastSeenTo}
                onChange={(event) => {
                  setLastSeenTo(event.target.value);
                  setPage(0);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-4 py-20 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span>Loading gateway inventory...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            No gateways match the current filters.
          </div>
        ) : (
          <div className="w-full col-span-full overflow-x-auto">
            <table className="min-w-[1280px] w-full">
              <thead className="bg-gradient-to-r from-blue-50/80 via-white to-red-50/70 dark:from-blue-500/10 dark:via-slate-900 dark:to-red-500/10">
                <tr className="text-left">
                  <Th>Status</Th>
                  <Th>Gateway</Th>
                  <Th>EUI / MAC</Th>
                  <Th>Region / Depot</Th>
                  <Th>Model / FW</Th>
                  <Th>Network / Operator</Th>
                  <Th>Location</Th>
                  <Th>SIM</Th>
                  <Th>Last Seen</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-200/80 text-xs transition hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-red-50/30 dark:border-slate-800 dark:hover:from-blue-500/5 dark:hover:to-red-500/5"
                  >
                    <Td>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(item.effectiveStatus)}`}>
                        {item.effectiveStatus.replace("_", " ")}
                      </span>
                    </Td>
                    <Td>
                      <div className="max-w-[260px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name || "Unnamed Gateway"}</p>
                        {item.loriotGatewayId ? (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {item.loriotGatewayId}
                        </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-0.5 font-mono text-[11px]">
                        {item.gatewayEui ? (
                          <p className="text-slate-700 dark:text-slate-200">{item.gatewayEui}</p>
                        ) : (
                          <p className="text-slate-400">—</p>
                        )}
                        {item.mac ? (
                          <p className="text-slate-500 dark:text-slate-400">{item.mac}</p>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-0.5">
                        <p className="text-slate-700 dark:text-slate-200">{item.regionName || "—"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.depotName || "—"}</p>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-0.5">
                        <p className="text-slate-700 dark:text-slate-200">{item.model || "—"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.fwVersion ? `FW ${item.fwVersion}` : "—"}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-0.5">
                        <p className="text-slate-700 dark:text-slate-200">{item.networkName || "—"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.operator || "—"}</p>
                      </div>
                    </Td>
                    <Td>
                      {typeof item.lat === "number" && typeof item.lng === "number" ? (
                        <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <MapPinned className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-[11px]">Mapped</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                          <MapPinOff className="h-3.5 w-3.5" />
                          <span className="text-[11px]">No coords</span>
                        </div>
                      )}
                    </Td>
                    <Td>
                      {item.simAssigned ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CardSim className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-medium">Assigned</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-300">
                          <CardSim className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-medium">Unassigned</span>
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="space-y-0.5">
                        <p className="text-slate-700 dark:text-slate-200">
                          {formatDateTime(item.lastTrafficSeenAt || item.lastLoriotSeenAt)}
                        </p>
                        {item.lastLoriotSeenAt ? (
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          LORIOT {formatDateTime(item.lastLoriotSeenAt)}
                        </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openDetailModal(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                        >
                          <Eye className="h-3 w-3" />
                          Details
                        </button>
                        {canEdit ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        ) : null}
                        {canSync ? (
                          <button
                            type="button"
                            disabled={syncingId === item.id}
                            onClick={() => void triggerSync(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            {syncingId === item.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Sync Now
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {pageStart}-{pageEnd} of {totalElements.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                className="enterprise-chip rounded-full px-3 py-2 text-xs font-medium text-slate-700 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {totalElements === 0 ? 0 : page + 1} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      <Modal
        isOpen={detailModalOpen}
        onClose={closeDetailModal}
        className="max-w-5xl overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
        backdropBlur
      >
        {!selectedGateway ? null : (
          <div className="flex max-h-[82vh] flex-col">
            <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-50 via-white to-red-50 px-5 py-4 dark:border-slate-800 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Gateway Detail
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {selectedGateway.name || "Unnamed Gateway"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedGateway.gatewayEui || selectedGateway.mac || selectedGateway.loriotGatewayId || "No identifiers"}
                  </p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(selectedGateway.effectiveStatus)}`}>
                  {selectedGateway.effectiveStatus.replace("_", " ")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <div className="flex flex-wrap gap-2">
                  <span className="enterprise-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <MapPinned className="h-3.5 w-3.5 text-blue-500" />
                  {selectedGateway.regionName || "No region"} · {selectedGateway.depotName || "No depot"}
                </span>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200/80 px-5 py-2 dark:border-slate-800">
              <div className="flex flex-wrap gap-1">
                {DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setDetailTab(tab.value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                      detailTab === tab.value
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  Loading detail...
                </div>
              ) : detailTab === "overview" ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <OverviewTile label="LORIOT ID" value={selectedGateway.loriotGatewayId || "—"} />
                  <OverviewTile label="Gateway EUI" value={selectedGateway.gatewayEui || "—"} mono />
                  <OverviewTile label="MAC Address" value={selectedGateway.mac || "—"} mono />
                  <OverviewTile label="Model" value={selectedGateway.model || "—"} />
                  <OverviewTile label="Firmware" value={selectedGateway.fwVersion || "—"} />
                  <OverviewTile label="Network" value={selectedGateway.networkName || "—"} />
                  <OverviewTile label="Operator" value={selectedGateway.operator || "—"} />
                  <OverviewTile label="Location Source" value={selectedGateway.locationSource || "—"} />
                  <OverviewTile label="Address" value={selectedGateway.address || "—"} full />
                  <OverviewTile label="Last Traffic" value={formatDateTime(selectedGateway.lastTrafficSeenAt)} />
                  <OverviewTile label="Last LORIOT" value={formatDateTime(selectedGateway.lastLoriotSeenAt)} />
                  <OverviewTile label="Created" value={formatDateTime(selectedGateway.createdAt)} />
                </div>
              ) : detailTab === "status" ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Status transition history
                  </div>
                  <div className="mt-3 space-y-2">
                    {statusHistory.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No status transitions recorded yet.</p>
                    ) : (
                      statusHistory.map((entry) => (
                        <div key={entry.id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${entry.previousStatus ? statusTone(entry.previousStatus) : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                                {entry.previousStatus ? entry.previousStatus.replace("_", " ") : "NEW"}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(entry.newStatus)}`}>
                                {entry.newStatus.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(entry.observedAt)}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Source: {entry.source || "System"}</span>
                            {entry.reason ? <span>· Reason: {entry.reason}</span> : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : detailTab === "sim" ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <CardSim className="h-4 w-4 text-blue-500" />
                    SIM card assignments
                  </div>
                  <div className="mt-3 space-y-2">
                    {simAssignments.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No SIM assignments on record.</p>
                    ) : (
                      simAssignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                              {assignment.iccid || `SIM #${assignment.simId}`}
                            </div>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              assignment.active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }`}>
                              {assignment.active ? "Active" : "Inactive"} · Slot {assignment.slotNumber}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-1 text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                            <p>Assigned: {formatDateTime(assignment.assignedAt)}</p>
                            <p>Unassigned: {formatDateTime(assignment.unassignedAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : detailTab === "sync" ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Server className="h-4 w-4 text-blue-500" />
                    LORIOT synchronization log
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Per-gateway sync run history will appear here when available from the backend sync engine.
                  </p>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <FileWarning className="h-4 w-4 text-blue-500" />
                    Audit trail
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Create/edit/sync/assign audit records will surface here when the backend audit table is wired.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OverviewTile({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={`rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900 ${full ? "sm:col-span-2 xl:col-span-4" : ""}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </p>
    </div>
  );
}
