import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { HeroButton, HeroStat, HeroStats, MobileFilters, PageHero } from "../../components/ui/page";
import {
  AlertTriangle,
  CloudDownload,
  CloudOff,
  Eye,
  Loader2,
  MapPinOff,
  RefreshCw,
  Router,
  Search,
  Server,
  ServerCrash,
  CardSim,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { useGeography } from "../Registry/geo";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../../components/ui/modal";
import { EditGatewayModal } from "./EditGatewayModal";
import { AssignSimModal } from "./AssignSimModal";
import { GatewayDetailSheet } from "./GatewayDetailSheet";

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
  activeSimId?: number | null;
  assignedSimId?: number | null;
  assignedSimIccid?: string | null;
  assignedMsisdn?: string | null;
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
  simIccid?: string | null;
  simMsisdn?: string | null;
  slotNumber: number;
  active: boolean;
  status?: "ACTIVE" | "UNASSIGNED" | string | null;
  assignedAt?: string | null;
  unassignedAt?: string | null;
  assignedBy?: string | null;
  unassignedBy?: string | null;
  reason?: string | null;
}

type PagePayload<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

const normalizeGatewayItem = <T,>(raw: any): T => {
  const base = { ...(raw || {}) } as Record<string, unknown>;
  if (!("lat" in base) || typeof base.lat !== "number") {
    const lat = Number(base.latitude ?? base.lat);
    if (Number.isFinite(lat)) (base as any).lat = lat;
  }
  if (!("lng" in base) || typeof base.lng !== "number") {
    const lng = Number(base.longitude ?? base.lng);
    if (Number.isFinite(lng)) (base as any).lng = lng;
  }
  // The API names these macAddress / firmwareVersion; the screens use mac / fwVersion.
  if (base.mac == null && base.macAddress != null) (base as any).mac = base.macAddress;
  if (base.fwVersion == null && base.firmwareVersion != null) (base as any).fwVersion = base.firmwareVersion;
  return base as T;
};

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return (payload as unknown[]).map((it) =>
      typeof it === "object" && it !== null
        ? normalizeGatewayItem<T>(it)
        : (it as T)
    );
  }
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "value", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.map((it) =>
        typeof it === "object" && it !== null
          ? normalizeGatewayItem<T>(it)
          : (it as T)
      );
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
  const { isDepot, depotId: myDepot } = useScope();
  const myDepotName = useGeography(token).pathOf(myDepot).depotName;
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
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [statusHistory, setStatusHistory] = useState<GatewayStatusHistoryItem[]>([]);
  const [simAssignments, setSimAssignments] = useState<GatewaySimAssignment[]>([]);

  const [assignSimModalOpen, setAssignSimModalOpen] = useState(false);
  const [assignSimTargetGatewayId, setAssignSimTargetGatewayId] = useState<number | null>(null);

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

  const fetchGateways = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const params: Record<string, unknown> = { page, size: pageSize };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (selectedRegion !== "ALL") {
        if (!Number.isNaN(Number(selectedRegion))) params.regionId = Number(selectedRegion);
        params.regionName = selectedRegion;
      }
      if (selectedDepot !== "ALL") {
        if (!Number.isNaN(Number(selectedDepot))) params.depotId = Number(selectedDepot);
        params.depotName = selectedDepot;
      }
      if (selectedNetwork !== "ALL") {
        params.networkId = selectedNetwork;
        params.networkName = selectedNetwork;
      }
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

  // The server pulls from LORIOT every 2 minutes; refresh what is on screen every minute so it never lags.
  useEffect(() => {
    if (!token) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchSummary();
      void fetchGateways(true);
    }, 60_000);
    return () => window.clearInterval(t);
  }, [fetchSummary, fetchGateways, token]);

  const [syncingAll, setSyncingAll] = useState(false);
  const syncAllNow = async () => {
    if (!canSync || syncingAll) return;
    setSyncingAll(true);
    try {
      await axios.post(`${API_BASE_URL}/api/v1/gateways/sync`, {}, { headers });
    } catch (e) {
      const ax = e as { response?: { status?: number } };
      if (ax.response?.status !== 409) setError("Could not start a LORIOT sync.");
    }
    // The sync runs in the background (a few seconds for ~100 gateways): pick up the results.
    for (const wait of [4000, 8000, 15000]) {
      await new Promise((r) => setTimeout(r, wait));
      await Promise.all([fetchSummary(), fetchGateways(true)]);
    }
    setSyncingAll(false);
  };

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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.effectiveStatus !== statusFilter) return false;

      if (selectedRegion !== "ALL") {
        const match =
          (item.regionId != null && String(item.regionId) === selectedRegion) ||
          (item.regionName != null && item.regionName.toLowerCase() === selectedRegion.toLowerCase());
        if (!match) return false;
      }

      if (selectedDepot !== "ALL") {
        const match =
          (item.depotId != null && String(item.depotId) === selectedDepot) ||
          (item.depotName != null && item.depotName.toLowerCase() === selectedDepot.toLowerCase());
        if (!match) return false;
      }

      if (selectedNetwork !== "ALL") {
        const match =
          (item.networkId != null && item.networkId.toLowerCase() === selectedNetwork.toLowerCase()) ||
          (item.networkName != null && item.networkName.toLowerCase() === selectedNetwork.toLowerCase());
        if (!match) return false;
      }

      if (selectedModel !== "ALL") {
        if (
          !item.model ||
          !item.model.toLowerCase().includes(selectedModel.toLowerCase())
        ) return false;
      }

      if (selectedOperator !== "ALL") {
        if (
          !item.operator ||
          item.operator.toLowerCase() !== selectedOperator.toLowerCase()
        ) return false;
      }

      if (hasLocationFilter === "YES") {
        const has =
          (typeof item.lat === "number" && !Number.isNaN(item.lat)) &&
          (typeof item.lng === "number" && !Number.isNaN(item.lng));
        if (!has) return false;
      } else if (hasLocationFilter === "NO") {
        const missing =
          !(typeof item.lat === "number" && !Number.isNaN(item.lat)) ||
          !(typeof item.lng === "number" && !Number.isNaN(item.lng));
        if (!missing) return false;
      }

      if (hasSimFilter === "YES") {
        const has =
          !!item.simAssigned ||
          item.activeSimId != null ||
          item.assignedSimId != null;
        if (!has) return false;
      } else if (hasSimFilter === "NO") {
        const missing =
          !item.simAssigned &&
          item.activeSimId == null &&
          item.assignedSimId == null;
        if (!missing) return false;
      }

      if (q) {
        const haystack = [
          item.name,
          item.gatewayEui,
          item.mac,
          item.model,
          item.address,
          item.regionName,
          item.depotName,
          item.networkName,
          item.operator,
        ]
          .filter((x): x is string => typeof x === "string" && x.length > 0)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    items,
    statusFilter,
    selectedRegion,
    selectedDepot,
    selectedNetwork,
    selectedModel,
    selectedOperator,
    hasLocationFilter,
    hasSimFilter,
    search,
  ]);

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

  const openDetailModal = async (gateway: GatewayItem, startInEdit = false) => {
    setSelectedGateway(gateway);
    setDetailModalOpen(true);
    setDetailMode(startInEdit ? "edit" : "view");
    setStatusHistory([]);
    setSimAssignments([]);
    setDetailLoading(true);
    try {
      const [historyResp, simResp] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/gateways/${gateway.id}/status-history`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/gateways/${gateway.id}/sims`, { headers }),
      ]);
      setStatusHistory(normalizeList<GatewayStatusHistoryItem>(historyResp.data));
      setSimAssignments(normalizeList<GatewaySimAssignment>(simResp.data));
    } catch (detailError) {
      console.error(detailError);
    } finally {
      setDetailLoading(false);
    }
  };

  /** Refresh the detail lists in place (no loading spinner), e.g. after a SIM change. */
  const reloadDetailLists = async (gatewayId: number) => {
    try {
      const [historyResp, simResp] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/gateways/${gatewayId}/status-history`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/gateways/${gatewayId}/sims`, { headers }),
      ]);
      setStatusHistory(normalizeList<GatewayStatusHistoryItem>(historyResp.data));
      setSimAssignments(normalizeList<GatewaySimAssignment>(simResp.data));
    } catch (e) {
      console.error(e);
    }
  };

  // Deep link from the gateway map: /gateways?open=<id> opens that gateway's detail view.
  const openParam = searchParams.get("open");
  useEffect(() => {
    if (!openParam || !token) return;
    let alive = true;
    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("open");
      setSearchParams(next, { replace: true });
    };
    axios
      .get(`${API_BASE_URL}/api/v1/gateways/${openParam}`, { headers })
      .then((r) => {
        clearParam();
        if (alive && r.data) void openDetailModal(normalizeGatewayItem<GatewayItem>(r.data));
      })
      .catch((e) => {
        clearParam();
        console.error(e);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, token]);

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedGateway(null);
    setStatusHistory([]);
    setSimAssignments([]);
    setDetailMode("view");
  };

  const refreshSelectedGateway = async () => {
    if (!selectedGateway || !token) return;
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/v1/gateways/${selectedGateway.id}`, { headers });
      const refreshed = normalizeGatewayItem<GatewayItem>(resp.data);
      setSelectedGateway(refreshed);
      setItems((prev) => prev.map((it) => (it.id === refreshed.id ? refreshed : it)));
    } catch (e) {
      console.error(e);
    }
  };

  const closeAssignSimModal = () => {
    setAssignSimModalOpen(false);
    setAssignSimTargetGatewayId(null);
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

  const paginatedItems = filteredItems;

  const pageStart = totalElements === 0 ? 0 : page * pageSize + 1;
  const pageEnd = totalElements === 0 ? 0 : Math.min(page * pageSize + pageSize, totalElements);
  const totalFiltered = totalElements;
  const totalPagesComputed = Math.max(totalPages, 1);

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Assets · Gateways"
        title={isDepot ? `Gateways · ${myDepotName}` : "LoRaWAN gateways"}
        subtitle={`${isDepot ? `Gateways assigned to ${myDepotName} depot. ` : ""}Kept in step with LORIOT automatically every 2 minutes. Last sync: ${syncStatusLabel(summary.lastSyncStatus).toLowerCase()} · ${formatDateTime(summary.lastSyncAt)}.`}
        actions={
          <>
            <HeroButton
              onClick={() => {
                void fetchSummary();
                void fetchGateways();
              }}
            >
              Refresh
            </HeroButton>
            {canSync ? (
              <HeroButton icon={<CloudDownload className={`h-4 w-4 ${syncingAll ? "animate-bounce" : ""}`} />} onClick={() => void syncAllNow()}>
                {syncingAll ? "Syncing with LORIOT…" : "Sync with LORIOT now"}
              </HeroButton>
            ) : null}
          </>
        }
      >
        <HeroStats cols={8}>
          <HeroStat icon={<Router className="h-3.5 w-3.5" />} label="Gateways" value={summary.total.toLocaleString()} sub="in inventory" />
          <HeroStat icon={<Wifi className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={summary.online.toLocaleString()} sub="healthy and reachable" tone="good" />
          <HeroStat icon={<WifiOff className="h-3.5 w-3.5 text-red-300" />} label="Offline" value={summary.offline.toLocaleString()} sub="past the grace period" tone={summary.offline ? "bad" : undefined} />
          <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />} label="Degraded" value={summary.degraded.toLocaleString()} sub="likely to go offline" tone={summary.degraded ? "warn" : undefined} />
          <HeroStat icon={<CloudOff className="h-3.5 w-3.5" />} label="Never seen" value={summary.neverSeen.toLocaleString()} sub={`${summary.unknown} unknown`} />
          <HeroStat icon={<MapPinOff className="h-3.5 w-3.5 text-amber-300" />} label="No location" value={summary.missingLocation.toLocaleString()} sub="missing coordinates" tone={summary.missingLocation ? "warn" : undefined} />
          <HeroStat icon={<CardSim className="h-3.5 w-3.5 text-red-300" />} label="No SIM" value={summary.missingSim.toLocaleString()} sub="no active SIM card" tone={summary.missingSim ? "bad" : undefined} />
          <HeroStat
            icon={summary.lastSyncStatus === "FAILED" ? <ServerCrash className="h-3.5 w-3.5 text-red-300" /> : <Server className="h-3.5 w-3.5" />}
            label="Last sync"
            value={syncStatusLabel(summary.lastSyncStatus)}
            sub={formatDateTime(summary.lastSyncAt)}
            tone={summary.lastSyncStatus === "FAILED" ? "bad" : summary.lastSyncStatus === "PARTIAL" ? "warn" : "good"}
          />
        </HeroStats>
      </PageHero>

      <section className="ui-panel overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3">
            {/* One horizontal line of filters (scrolls sideways on small screens) */}
            <div className="no-scrollbar flex items-center gap-3 overflow-x-auto pb-1">
              <span className="hidden shrink-0 text-[11px] sm:inline font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Filters</span>
              <div className="flex shrink-0 flex-nowrap gap-2">
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
              <span className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
              <div className="flex shrink-0 flex-nowrap gap-2 whitespace-nowrap">
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
            {/* Search and rows per page on one line */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2">
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
              <label className="inline-flex shrink-0 items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
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
          <div className="mt-3">
          <MobileFilters active={[selectedRegion, selectedDepot, selectedNetwork, selectedModel, selectedOperator].filter((v) => v !== "ALL").length + (lastSeenFrom ? 1 : 0) + (lastSeenTo ? 1 : 0)}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {isDepot ? null : (
            <>
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
            </>
            )}
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
          </MobileFilters>
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
            <table className="min-w-[920px] w-full">
              <thead className="bg-gradient-to-r from-blue-50/80 via-white to-red-50/70 dark:from-blue-500/10 dark:via-slate-900 dark:to-red-500/10">
                <tr className="text-left">
                  <Th>Status</Th>
                  <Th>Gateway</Th>
                  <Th>Depot</Th>
                  <Th>Network / Operator</Th>
                  <Th>SIM</Th>
                  <Th>Last Seen</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
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
                      <p className="text-slate-700 dark:text-slate-200">{item.depotName || "—"}</p>
                    </Td>
                    <Td>
                      <div className="space-y-0.5">
                        <p className="text-slate-700 dark:text-slate-200">{item.networkName || "—"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.operator || "—"}</p>
                      </div>
                    </Td>
                    <Td>
                      {(() => {
                        const isAssigned =
                          !!item.simAssigned ||
                          item.activeSimId != null ||
                          item.assignedSimId != null;
                        const hint = item.assignedMsisdn || item.assignedSimIccid || null;
                        const content = (
                          <div className="flex flex-col gap-0.5">
                            {isAssigned ? (
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
                            {hint ? (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {hint}
                              </span>
                            ) : null}
                          </div>
                        );
                        if (!canEdit) return content;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignSimModalOpen(true);
                              setAssignSimTargetGatewayId(item.id);
                            }}
                            className="w-full cursor-pointer text-left transition hover:opacity-80"
                          >
                            {content}
                          </button>
                        );
                      })()}
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
                          title="View / Edit"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {canSync ? (
                          <button
                            type="button"
                            disabled={syncingId === item.id}
                            onClick={() => void triggerSync(item.id)}
                            title="Sync Now"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${syncingId === item.id ? "animate-spin" : ""}`} />
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
              Showing {pageStart}-{pageEnd} of {totalFiltered.toLocaleString()}
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
                Page {totalFiltered === 0 ? 0 : page + 1} of {totalPagesComputed}
              </span>
              <button
                type="button"
                disabled={loading || page + 1 >= totalPagesComputed}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {detailMode === "edit" ? (
        <Modal
          isOpen={detailModalOpen && Boolean(selectedGateway)}
          onClose={closeDetailModal}
          className="max-w-4xl overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
          backdropBlur
        >
          {selectedGateway ? (
            <EditGatewayModal
              isOpen={true}
              onClose={closeDetailModal}
              gateway={selectedGateway}
              onSaved={async () => {
                void fetchSummary();
                void fetchGateways();
                setDetailMode("view");
                await refreshSelectedGateway();
              }}
              token={token!}
              apiBaseUrl={API_BASE_URL}
              headers={headers!}
              depotOptions={depotOptions}
              regionOptions={regionOptions}
              networkOptions={networkOptions}
              operatorOptions={operatorOptions}
              embed
              canSave={canEdit}
              onCancel={() => setDetailMode("view")}
            />
          ) : null}
        </Modal>
      ) : null}

      <GatewayDetailSheet
        open={detailModalOpen && detailMode === "view"}
        gateway={selectedGateway}
        history={statusHistory}
        sims={simAssignments}
        loading={detailLoading}
        canEdit={canEdit}
        canSync={canSync}
        syncing={selectedGateway ? syncingId === selectedGateway.id : false}
        onClose={closeDetailModal}
        onEdit={() => setDetailMode("edit")}
        onSync={async () => {
          if (!selectedGateway) return;
          await triggerSync(selectedGateway.id);
          await refreshSelectedGateway();
          await reloadDetailLists(selectedGateway.id);
        }}
        onAssignSim={() => {
          if (!selectedGateway) return;
          setAssignSimTargetGatewayId(selectedGateway.id);
          setAssignSimModalOpen(true);
        }}
        onUnassign={async (assignment) => {
          if (!selectedGateway) return;
          await axios.post(
            `${API_BASE_URL}/api/v1/gateways/${selectedGateway.id}/sims/unassign?assignmentId=${assignment.id}`,
            { reason: "Removed from gateway details" },
            { headers }
          );
          await reloadDetailLists(selectedGateway.id);
          await Promise.all([fetchSummary(), fetchGateways()]);
        }}
      />

      {assignSimTargetGatewayId !== null ? (
        <AssignSimModal
          isOpen={assignSimModalOpen}
          onClose={closeAssignSimModal}
          gatewayId={assignSimTargetGatewayId}
          gatewayName={selectedGateway?.id === assignSimTargetGatewayId ? selectedGateway?.name : items.find((g) => g.id === assignSimTargetGatewayId)?.name}
          onSaved={() => {
            void fetchSummary();
            void fetchGateways();
            if (selectedGateway && selectedGateway.id === assignSimTargetGatewayId) {
              void reloadDetailLists(selectedGateway.id);
            }
          }}
          headers={headers!}
          apiBaseUrl={API_BASE_URL}
        />
      ) : null}
    </div>
  );
}
