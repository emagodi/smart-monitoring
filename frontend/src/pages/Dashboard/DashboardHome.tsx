import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Lock,
  MapPinned,
  Router,
  Search,
  ShieldCheck,
  CardSim,
  Unlock,
  Waves,
  Zap,
  RefreshCw,
} from "lucide-react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserAccess } from "../../hooks/useUserAccess";
import { useRealtimeUpdates } from "../../services/realtimeService";
import GoogleAssetMap from "../../components/maps/GoogleAssetMap";

interface DashboardStats {
  totalRegions: number;
  totalDepots: number;
  totalTransformers: number;
  activeTransformers: number;
  offlineTransformers: number;
  totalSensors: number;
  activeSensors: number;
  totalAlerts: number;
}

interface Region {
  id: number;
  name: string;
}

interface District {
  id: number;
  name: string;
  regionId?: number;
  region_id?: number;
}

interface Depot {
  id: number;
  name: string;
  districtId?: number;
  district_id?: number;
}

interface Transformer {
  id: number;
  name: string;
  type?: string;
  capacity?: number;
  depotId?: number;
  depot_id?: number;
  isActive?: boolean;
  active?: boolean;
  supplierCode?: string;
  supplierName?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Sensor {
  id: number;
  isActive?: boolean;
  is_active?: boolean;
}

interface AlertItem {
  id: number;
  message?: string;
  severity?: string;
  transformerId?: number;
  transformerName?: string;
  createdAt?: string;
  timestamp?: string;
}

interface GatewaySummary {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  neverSeen: number;
  unknown: number;
  missingLocation: number;
  missingSim: number;
  lastSyncStatus?: string | null;
  lastSyncAt?: string | null;
}

interface SensorUpdate {
  transformer_id: number;
  transformer_name: string;
  sensor_name: string;
  sensor_type: string;
  value: number | string;
  is_alert: boolean;
  timestamp: number;
}

interface OculusControlSummaryRow {
  transformerId: number;
  transformerName?: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  armState?: "ARMED" | "DISARMED" | "UNKNOWN" | null;
  effectiveArmState?: "ARMED" | "DISARMED" | "UNKNOWN" | null;
  controllerStatus?: "ONLINE" | "DELAYED" | "OFFLINE" | "NO_KEEPALIVE" | null;
}

type ExecutiveChartCardProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

type DashboardTransformerRow = Transformer & {
  depotName: string;
  districtName: string;
  regionName: string;
  supplierLabel: string;
  armState: "ARMED" | "DISARMED" | "UNKNOWN";
  onlineLabel: string;
  onlineTone: string;
  armTone: string;
  latestAlertLabel: string;
  latestAlertTime?: string;
};

const getSupplierLabel = (supplierName?: string | null, supplierCode?: string | null) => {
  if (supplierName?.trim()) return supplierName.trim();
  if (supplierCode?.trim()) return supplierCode.trim().toUpperCase();
  return "Internal";
};

const getControlArmState = (row?: OculusControlSummaryRow | null) => row?.effectiveArmState || row?.armState || "UNKNOWN";

const controllerStatusTone = (status?: string | null) => {
  if (status === "ONLINE") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DELAYED") return "border border-amber-200 bg-amber-50 text-amber-700";
  if (status === "OFFLINE") return "border border-red-200 bg-red-50 text-red-700";
  return "border border-slate-200 bg-slate-50 text-slate-700";
};

const controllerStatusLabel = (status?: string | null, isActive?: boolean) => {
  if (status === "ONLINE") return "Online";
  if (status === "DELAYED") return "Delayed";
  if (status === "OFFLINE") return "Offline";
  return isActive === false ? "Offline" : "Online";
};

const armStateLabel = (state?: string | null) => {
  if (state === "ARMED") return "Armed";
  if (state === "DISARMED") return "Disarmed";
  return "Unknown";
};

const armStateTone = (state?: string | null) => {
  if (state === "ARMED") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "DISARMED") return "border border-amber-200 bg-amber-50 text-amber-700";
  return "border border-slate-200 bg-slate-50 text-slate-700";
};

const compactAlertLabel = (message?: string) => {
  if (!message?.trim()) return "No alert history";
  if (message.length <= 54) return message;
  return `${message.slice(0, 51)}...`;
};

const WATCHLIST_STORAGE_KEY = "dashboard-transformer-watchlist";

const normalizedTransformerType = (value?: string | null) => {
  const type = value?.trim();
  if (!type) return "Transformer";
  const normalized = type.toUpperCase().replace(/\s+/g, " ").trim();

  if (["POLE MOUNTED", "POLE MOUNTED TRANSFORMER", "PMT"].includes(normalized)) {
    return "PMT";
  }

  if (["GROUND MOUNTED", "GROUND MOUNTED TRANSFORMER", "GMT"].includes(normalized)) {
    return "GMT";
  }

  return normalized;
};

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["content", "data", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return [];
};

const getPagedTotal = (payload: unknown, fallback: number) => {
  const obj = payload as Record<string, unknown> | null;
  if (obj && typeof obj.totalElements === "number") {
    return obj.totalElements;
  }
  return fallback;
};

const formatTime = (value?: string | number) => {
  if (!value) return "Unknown";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  tone,
  highlight,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: string;
  highlight?: "blue" | "red" | "emerald" | "amber" | "neutral";
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
            : "text-slate-950 dark:text-slate-50";
  const iconTone =
    tone ||
    (hl === "red"
      ? "border border-red-100 bg-red-50/90 text-red-600 dark:border-red-500/10 dark:bg-red-500/10 dark:text-red-300"
      : hl === "emerald"
        ? "border border-emerald-100 bg-emerald-50/80 text-emerald-600 dark:border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300"
        : hl === "amber"
          ? "border border-amber-100 bg-amber-50/80 text-amber-600 dark:border-amber-500/10 dark:bg-amber-500/10 dark:text-amber-300"
          : "border border-blue-100 bg-blue-50/80 text-blue-600 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300");
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

export default function DashboardHome() {
  const { token, user, hasPermission } = useAuth();
  const { hasNationalAccess, hasRegionAccess, hasDepotAccess, loading: accessLoading } = useUserAccess();
  const { realtimeData } = useRealtimeUpdates(token);
  const [searchParams, setSearchParams] = useSearchParams();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
  const persistedWatchlistState = (() => {
    const paramsSearch = searchParams.get("watchlistSearch");
    const paramsDepot = searchParams.get("watchlistDepot");
    const paramsStatus = searchParams.get("watchlistStatus");
    const paramsType = searchParams.get("watchlistType");
    const paramsPage = Number.parseInt(searchParams.get("watchlistPage") || "", 10);

    if (
      paramsSearch !== null ||
      paramsDepot !== null ||
      paramsStatus !== null ||
      paramsType !== null ||
      Number.isFinite(paramsPage)
    ) {
      return {
        transformerSearch: paramsSearch ?? "",
        selectedDepotFilter: paramsDepot || "ALL",
        selectedStatusFilter: paramsStatus || "ALL",
        selectedTypeFilter: paramsType || "ALL",
        watchlistPage: Number.isFinite(paramsPage) && paramsPage > 0 ? paramsPage : 1,
      };
    }

    if (typeof window === "undefined") {
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!rawValue) return null;
      const parsed = JSON.parse(rawValue) as Partial<{
        transformerSearch: string;
        selectedDepotFilter: string;
        selectedStatusFilter: string;
        selectedTypeFilter: string;
        watchlistPage: number;
      }>;

      return {
        transformerSearch: parsed.transformerSearch ?? "",
        selectedDepotFilter: parsed.selectedDepotFilter ?? "ALL",
        selectedStatusFilter: parsed.selectedStatusFilter ?? "ALL",
        selectedTypeFilter: parsed.selectedTypeFilter ?? "ALL",
        watchlistPage: typeof parsed.watchlistPage === "number" && parsed.watchlistPage > 0 ? parsed.watchlistPage : 1,
      };
    } catch {
      return null;
    }
  })();

  const [stats, setStats] = useState<DashboardStats>({
    totalRegions: 0,
    totalDepots: 0,
    totalTransformers: 0,
    activeTransformers: 0,
    offlineTransformers: 0,
    totalSensors: 0,
    activeSensors: 0,
    totalAlerts: 0,
  });
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [controlRows, setControlRows] = useState<OculusControlSummaryRow[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);
  const [selectedTransformerId, setSelectedTransformerId] = useState<number | null>(null);
  const [transformerSearch, setTransformerSearch] = useState(() => persistedWatchlistState?.transformerSearch ?? "");
  const [selectedDepotFilter, setSelectedDepotFilter] = useState(() => persistedWatchlistState?.selectedDepotFilter ?? "ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(() => persistedWatchlistState?.selectedStatusFilter ?? "ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(() => persistedWatchlistState?.selectedTypeFilter ?? "ALL");
  const [watchlistPage, setWatchlistPage] = useState(() => persistedWatchlistState?.watchlistPage ?? 1);
  const [gatewaySummary, setGatewaySummary] = useState<GatewaySummary | null>(null);

  const [fastStatsLoading, setFastStatsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessLabel = useMemo(() => {
    if (isSupplierUser) return user?.supplierName || "Supplier";
    if (hasNationalAccess()) return "National";
    if (hasRegionAccess()) return "Regional";
    if (hasDepotAccess()) return "Depot";
    return "Limited";
  }, [hasDepotAccess, hasNationalAccess, hasRegionAccess, isSupplierUser, user?.supplierName]);

  const liveAlertCount = useMemo(
    () => realtimeData.filter((item: SensorUpdate) => item.is_alert).length,
    [realtimeData]
  );

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const safeGet = async <T,>(request: Promise<{ data: T }>, fallback: T) => {
      try {
        const response = await request;
        return response.data;
      } catch (requestError) {
        console.error(requestError);
        return fallback;
      }
    };

    const abortFast = new AbortController();
    const fetchFastStats = async () => {
      try {
        setFastStatsLoading(true);
        setError(null);

        const [transformersData, sensorsData] = await Promise.all([
          safeGet(
            axios.get(`${API_BASE_URL}/api/v1/transformers`, {
              headers,
              params: { page: 0, size: 1 },
              signal: abortFast.signal,
            }),
            { content: [], totalElements: 0 }
          ),
          safeGet(
            axios.get(`${API_BASE_URL}/api/v1/sensors`, {
              headers,
              params: { page: 0, size: 1 },
              signal: abortFast.signal,
            }),
            { content: [], totalElements: 0 }
          ),
        ]);

        const pageTotalTf = (transformersData as any)?.totalElements;
        const nestedPageTotalTf = (transformersData as any)?.page?.totalElements;
        const totalTransformers =
          typeof pageTotalTf === "number"
            ? pageTotalTf
            : typeof nestedPageTotalTf === "number"
              ? nestedPageTotalTf
              : normalizeList<Transformer>(transformersData).length;

        const pageTotalSn = (sensorsData as any)?.totalElements;
        const nestedPageTotalSn = (sensorsData as any)?.page?.totalElements;
        const totalSensors =
          typeof pageTotalSn === "number"
            ? pageTotalSn
            : typeof nestedPageTotalSn === "number"
              ? nestedPageTotalSn
              : normalizeList<Sensor>(sensorsData).length;

        const transformersSample = normalizeList<Transformer>(transformersData);
        const activeTransformers = transformersSample.filter(
          (item) => item?.isActive === true || item?.active === true
        ).length;

        const sensorsSample = normalizeList<Sensor>(sensorsData);
        const activeSensors = sensorsSample.filter(
          (item) => item?.isActive !== false && item?.is_active !== false
        ).length;

        setStats((prev) => ({
          ...prev,
          totalTransformers,
          totalSensors,
          activeTransformers,
          offlineTransformers: Math.max(totalTransformers - activeTransformers, 0),
          activeSensors,
        }));
      } catch (fastError) {
        console.error(fastError);
      } finally {
        setFastStatsLoading(false);
      }
    };

    void fetchFastStats();
    return () => abortFast.abort();
  }, [API_BASE_URL, token]);

  const loadDetailPanel = useCallback(async () => {
    if (!token) return;
    if (detailsLoaded) return;

    const headers = { Authorization: `Bearer ${token}` };
    const safeGet = async <T,>(request: Promise<{ data: T }>, fallback: T) => {
      try {
        const response = await request;
        return response.data;
      } catch (requestError) {
        console.error(requestError);
        return fallback;
      }
    };

    try {
      setDetailLoading(true);
      setError(null);

      const [
        regionsData,
        districtsData,
        depotsData,
        transformersData,
        sensorsData,
        alertsData,
        oculusControlData,
        gatewaysData,
      ] = await Promise.all([
        hasPermission("regions.read")
          ? safeGet(axios.get(`${API_BASE_URL}/api/v1/regions`, { headers }), [])
          : Promise.resolve([]),
        hasPermission("regions.read")
          ? safeGet(axios.get(`${API_BASE_URL}/api/v1/districts?page=0&size=1000`, { headers }), [])
          : Promise.resolve([]),
        hasPermission("depots.read")
          ? safeGet(axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }), [])
          : Promise.resolve([]),
        safeGet(axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers }), []),
        safeGet(axios.get(`${API_BASE_URL}/api/v1/sensors`, { headers }), []),
        safeGet(
          axios.get(`${API_BASE_URL}/api/v1/alerts`, {
            headers,
            params: { page: 0, size: 50 },
          }),
          { content: [], totalElements: 0 }
        ),
        hasPermission("controllers.read") || hasPermission("controllers.update")
          ? safeGet(axios.get(`${API_BASE_URL}/api/v1/oculus-control/transformers`, { headers }), [])
          : Promise.resolve([]),
        hasPermission("gateways.view")
          ? safeGet(axios.get(`${API_BASE_URL}/api/v1/gateways/summary`, { headers }), null)
          : Promise.resolve(null),
      ]);

      const regionsList = normalizeList<Region>(regionsData);
      const districtsList = normalizeList<District>(districtsData);
      const depotsList = normalizeList<Depot>(depotsData);
      const transformersList = normalizeList<Transformer>(transformersData);
      const sensorsList = normalizeList<Sensor>(sensorsData);
      const alertsList = normalizeList<AlertItem>(alertsData);
      const totalAlerts = getPagedTotal(alertsData, alertsList.length);
      const oculusControlList = normalizeList<OculusControlSummaryRow>(oculusControlData);

      const activeTransformers = transformersList.filter(
        (item) => item?.isActive === true || item?.active === true
      ).length;
      const activeSensors = sensorsList.filter(
        (item) => item?.isActive !== false && item?.is_active !== false
      ).length;

      setRegions(regionsList);
      setDistricts(districtsList);
      setDepots(depotsList);
      setTransformers(transformersList);
      setControlRows(oculusControlList);
      setAlerts(alertsList);
      setRecentAlerts(
        [...alertsList]
          .sort(
            (a, b) =>
              new Date(b.createdAt || b.timestamp || 0).getTime() -
              new Date(a.createdAt || a.timestamp || 0).getTime()
          )
          .slice(0, 5)
      );

      setStats((prev) => ({
        ...prev,
        totalRegions: regionsList.length,
        totalDepots: depotsList.length,
        totalTransformers: transformersList.length,
        activeTransformers,
        offlineTransformers: Math.max(transformersList.length - activeTransformers, 0),
        totalSensors: sensorsList.length,
        activeSensors,
        totalAlerts,
      }));

      if (gatewaysData) {
        const gw = gatewaysData as Partial<GatewaySummary>;
        setGatewaySummary({
          total: typeof gw.total === "number" ? gw.total : 0,
          online: typeof gw.online === "number" ? gw.online : 0,
          offline: typeof gw.offline === "number" ? gw.offline : 0,
          degraded: typeof gw.degraded === "number" ? gw.degraded : 0,
          neverSeen: typeof gw.neverSeen === "number" ? gw.neverSeen : 0,
          unknown: typeof gw.unknown === "number" ? gw.unknown : 0,
          missingLocation: typeof gw.missingLocation === "number" ? gw.missingLocation : 0,
          missingSim: typeof gw.missingSim === "number" ? gw.missingSim : 0,
          lastSyncStatus: gw.lastSyncStatus ?? null,
          lastSyncAt: gw.lastSyncAt ?? null,
        });
      } else {
        setGatewaySummary(null);
      }

      setDetailsLoaded(true);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load dashboard details.");
    } finally {
      setDetailLoading(false);
    }
  }, [API_BASE_URL, detailsLoaded, hasPermission, token]);

  const districtToRegion = useMemo(() => {
    return new Map(
      districts.map((district) => [
        district.id,
        district.regionId ?? district.region_id ?? null,
      ])
    );
  }, [districts]);

  const regionalSummary = useMemo(() => {
    const summary = regions.map((region) => {
      const regionDistricts = districts.filter(
        (district) => (district.regionId ?? district.region_id) === region.id
      );
      const districtIds = new Set(regionDistricts.map((district) => district.id));
      const regionDepots = depots.filter((depot) =>
        districtIds.has(depot.districtId ?? depot.district_id ?? -1)
      );
      const depotIds = new Set(regionDepots.map((depot) => depot.id));
      const regionTransformers = transformers.filter((transformer) =>
        depotIds.has(transformer.depotId ?? transformer.depot_id ?? -1)
      );
      const regionAlerts = recentAlerts.filter((alert) => {
        if (!alert.transformerId) return false;
        const transformer = transformers.find((item) => item.id === alert.transformerId);
        return depotIds.has(transformer?.depotId ?? transformer?.depot_id ?? -1);
      });

      return {
        id: region.id,
        name: region.name,
        districts: regionDistricts.length,
        depots: regionDepots.length,
        transformers: regionTransformers.length,
        alerts: regionAlerts.length,
      };
    });

    return summary
      .sort((a, b) => b.transformers - a.transformers)
      .slice(0, 5);
  }, [regions, districts, depots, transformers, recentAlerts]);

  const supplierRanking = useMemo(() => {
    const supplierMap = new Map<string, number>();

    transformers.forEach((transformer) => {
      const label = getSupplierLabel(transformer.supplierName, transformer.supplierCode);
      supplierMap.set(label, (supplierMap.get(label) || 0) + 1);
    });

    const entries = [...supplierMap.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalSuppliers: supplierMap.size,
      topSuppliers: entries.slice(0, 5),
      leadingSupplier: entries[0] || null,
    };
  }, [transformers]);

  const controlStateSummary = useMemo(() => {
    const summary = {
      monitored: transformers.length,
      controlEstate: controlRows.length,
      armed: 0,
      disarmed: 0,
      unknown: 0,
      onlineControllers: 0,
      delayedControllers: 0,
      offlineControllers: 0,
    };

    controlRows.forEach((row) => {
      const state = getControlArmState(row);
      if (state === "ARMED") summary.armed += 1;
      else if (state === "DISARMED") summary.disarmed += 1;
      else summary.unknown += 1;

      if (row.controllerStatus === "ONLINE") summary.onlineControllers += 1;
      else if (row.controllerStatus === "DELAYED") summary.delayedControllers += 1;
      else if (row.controllerStatus === "OFFLINE") summary.offlineControllers += 1;
    });

    return summary;
  }, [controlRows, transformers.length]);

  const alertSummary = useMemo(() => {
    const severityCounts = {
      critical: 0,
      warning: 0,
      informational: 0,
    };

    alerts.forEach((alert) => {
      const severity = (alert.severity || "").toLowerCase();
      if (severity.includes("critical") || severity.includes("high") || severity.includes("alert")) {
        severityCounts.critical += 1;
      } else if (severity.includes("warn") || severity.includes("medium")) {
        severityCounts.warning += 1;
      } else {
        severityCounts.informational += 1;
      }
    });

    return {
      ...severityCounts,
      total: alerts.length,
      live: liveAlertCount,
      recent: recentAlerts.length,
    };
  }, [alerts, liveAlertCount, recentAlerts.length]);

  const topRegionalCoverage = useMemo(() => regionalSummary.slice(0, 5), [regionalSummary]);

  const depotById = useMemo(() => new Map(depots.map((depot) => [depot.id, depot])), [depots]);

  const latestAlertByTransformerId = useMemo(() => {
    const latest = new Map<number, AlertItem>();
    [...alerts]
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.timestamp || 0).getTime() -
          new Date(a.createdAt || a.timestamp || 0).getTime()
      )
      .forEach((alert) => {
        if (!alert.transformerId || latest.has(alert.transformerId)) return;
        latest.set(alert.transformerId, alert);
      });
    return latest;
  }, [alerts]);

  const controlRowByTransformerId = useMemo(() => {
    return new Map(controlRows.map((row) => [row.transformerId, row]));
  }, [controlRows]);

  const transformerOperations = useMemo<DashboardTransformerRow[]>(() => {
    return [...transformers]
      .sort((a, b) => b.id - a.id)
      .map((transformer) => {
        const depot = depotById.get(transformer.depotId ?? transformer.depot_id ?? -1);
        const districtId = depot?.districtId ?? depot?.district_id ?? null;
        const regionId = districtId != null ? districtToRegion.get(districtId) : null;
        const region = regions.find((item) => item.id === regionId);
        const district = districts.find((item) => item.id === districtId);
        const controlRow = controlRowByTransformerId.get(transformer.id);
        const latestAlert = latestAlertByTransformerId.get(transformer.id);
        const armState = getControlArmState(controlRow);
        const onlineLabel = controllerStatusLabel(controlRow?.controllerStatus, transformer.isActive ?? transformer.active);

        return {
          ...transformer,
          depotName: depot?.name || "Unassigned Depot",
          districtName: district?.name || "Unassigned District",
          regionName: region?.name || "Unassigned Region",
          supplierLabel: getSupplierLabel(
            controlRow?.supplierName ?? transformer.supplierName,
            controlRow?.supplierCode ?? transformer.supplierCode
          ),
          armState,
          onlineLabel,
          onlineTone: controllerStatusTone(controlRow?.controllerStatus ?? (onlineLabel === "Offline" ? "OFFLINE" : "ONLINE")),
          armTone: armStateTone(armState),
          latestAlertLabel: compactAlertLabel(latestAlert?.message),
          latestAlertTime: latestAlert?.createdAt || latestAlert?.timestamp,
        };
      });
  }, [alerts, controlRowByTransformerId, depotById, districtToRegion, districts, latestAlertByTransformerId, regions, transformers]);

  const availableDepotFilters = useMemo(() => {
    return [...new Set(transformerOperations.map((item) => item.depotName))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [transformerOperations]);

  const availableTypeFilters = useMemo(() => {
    return [...new Set(transformerOperations.map((item) => normalizedTransformerType(item.type)))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [transformerOperations]);

  useEffect(() => {
    if (selectedDepotFilter !== "ALL" && !availableDepotFilters.includes(selectedDepotFilter)) {
      setSelectedDepotFilter("ALL");
    }
  }, [availableDepotFilters, selectedDepotFilter]);

  useEffect(() => {
    if (selectedTypeFilter !== "ALL" && !availableTypeFilters.includes(selectedTypeFilter)) {
      setSelectedTypeFilter("ALL");
    }
  }, [availableTypeFilters, selectedTypeFilter]);

  const watchlistSummary = useMemo(() => {
    const summary = {
      online: 0,
      offline: 0,
      delayed: 0,
      armed: 0,
      disarmed: 0,
      unknown: 0,
    };

    transformerOperations.forEach((item) => {
      if (item.onlineLabel === "Online") summary.online += 1;
      else if (item.onlineLabel === "Offline") summary.offline += 1;
      else if (item.onlineLabel === "Delayed") summary.delayed += 1;

      if (item.armState === "ARMED") summary.armed += 1;
      else if (item.armState === "DISARMED") summary.disarmed += 1;
      else summary.unknown += 1;
    });

    return summary;
  }, [transformerOperations]);

  const topDepotCounts = useMemo(() => {
    const depotMap = new Map<string, number>();

    transformerOperations.forEach((item) => {
      depotMap.set(item.depotName, (depotMap.get(item.depotName) || 0) + 1);
    });

    return [...depotMap.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [transformerOperations]);

  const activeWatchlistFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = [];

    if (selectedStatusFilter !== "ALL") {
      filters.push({ key: "status", label: "Status", value: selectedStatusFilter });
    }

    if (selectedTypeFilter !== "ALL") {
      filters.push({ key: "type", label: "Type", value: selectedTypeFilter });
    }

    if (selectedDepotFilter !== "ALL") {
      filters.push({ key: "depot", label: "Depot", value: selectedDepotFilter });
    }

    if (transformerSearch.trim()) {
      filters.push({ key: "search", label: "Search", value: transformerSearch.trim() });
    }

    return filters;
  }, [selectedDepotFilter, selectedStatusFilter, selectedTypeFilter, transformerSearch]);

  const filteredTransformerOperations = useMemo(() => {
    const query = transformerSearch.trim().toLowerCase();
    return transformerOperations.filter((item) => {
      const matchesQuery =
        !query ||
        [
          item.name,
          item.depotName,
          item.districtName,
          item.regionName,
          item.supplierLabel,
          item.latestAlertLabel,
          item.onlineLabel,
          armStateLabel(item.armState),
          normalizedTransformerType(item.type),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDepot = selectedDepotFilter === "ALL" || item.depotName === selectedDepotFilter;
      const matchesType =
        selectedTypeFilter === "ALL" || normalizedTransformerType(item.type) === selectedTypeFilter;

      const matchesStatus =
        selectedStatusFilter === "ALL" ||
        (selectedStatusFilter === "ONLINE" && item.onlineLabel === "Online") ||
        (selectedStatusFilter === "OFFLINE" && item.onlineLabel === "Offline") ||
        (selectedStatusFilter === "DELAYED" && item.onlineLabel === "Delayed") ||
        (selectedStatusFilter === "ARMED" && item.armState === "ARMED") ||
        (selectedStatusFilter === "DISARMED" && item.armState === "DISARMED") ||
        (selectedStatusFilter === "UNKNOWN" && item.armState === "UNKNOWN");

      return matchesQuery && matchesDepot && matchesType && matchesStatus;
    });
  }, [selectedDepotFilter, selectedStatusFilter, selectedTypeFilter, transformerOperations, transformerSearch]);

  useEffect(() => {
    setWatchlistPage(1);
  }, [selectedDepotFilter, selectedStatusFilter, selectedTypeFilter, transformerSearch]);

  const watchlistPageSize = 10;
  const totalWatchlistPages = Math.max(1, Math.ceil(filteredTransformerOperations.length / watchlistPageSize));

  useEffect(() => {
    if (watchlistPage > totalWatchlistPages) {
      setWatchlistPage(totalWatchlistPages);
    }
  }, [totalWatchlistPages, watchlistPage]);

  useEffect(() => {
    const persistedState = {
      transformerSearch,
      selectedDepotFilter,
      selectedStatusFilter,
      selectedTypeFilter,
      watchlistPage,
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(persistedState));
    }

    const nextParams = new URLSearchParams(searchParams);

    if (transformerSearch.trim()) nextParams.set("watchlistSearch", transformerSearch.trim());
    else nextParams.delete("watchlistSearch");

    if (selectedDepotFilter !== "ALL") nextParams.set("watchlistDepot", selectedDepotFilter);
    else nextParams.delete("watchlistDepot");

    if (selectedStatusFilter !== "ALL") nextParams.set("watchlistStatus", selectedStatusFilter);
    else nextParams.delete("watchlistStatus");

    if (selectedTypeFilter !== "ALL") nextParams.set("watchlistType", selectedTypeFilter);
    else nextParams.delete("watchlistType");

    if (watchlistPage > 1) nextParams.set("watchlistPage", String(watchlistPage));
    else nextParams.delete("watchlistPage");

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    searchParams,
    selectedDepotFilter,
    selectedStatusFilter,
    selectedTypeFilter,
    setSearchParams,
    transformerSearch,
    watchlistPage,
  ]);

  const paginatedTransformerOperations = useMemo(() => {
    const start = (watchlistPage - 1) * watchlistPageSize;
    return filteredTransformerOperations.slice(start, start + watchlistPageSize);
  }, [filteredTransformerOperations, watchlistPage]);

  const watchlistRangeStart = filteredTransformerOperations.length === 0 ? 0 : (watchlistPage - 1) * watchlistPageSize + 1;
  const watchlistRangeEnd = Math.min(watchlistPage * watchlistPageSize, filteredTransformerOperations.length);

  const visibleWatchlistPages = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, watchlistPage - 1);
    const end = Math.min(totalWatchlistPages, start + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (!pages.includes(totalWatchlistPages)) {
      if (totalWatchlistPages - (pages[pages.length - 1] || 0) > 1) {
        pages.push(-1);
      }
      pages.push(totalWatchlistPages);
    }

    return pages;
  }, [totalWatchlistPages, watchlistPage]);

  const mapPoints = useMemo(() => {
    return transformerOperations
      .filter(
        (item) =>
          typeof item.lat === "number" &&
          typeof item.lng === "number" &&
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng)
      )
      .slice(0, 60);
  }, [transformerOperations]);

  const selectedTransformer = useMemo(() => {
    if (selectedTransformerId == null) return null;
    return transformerOperations.find((item) => item.id === selectedTransformerId) || null;
  }, [selectedTransformerId, transformerOperations]);

  useEffect(() => {
    if (selectedTransformerId == null) return;
    if (!transformerOperations.some((item) => item.id === selectedTransformerId)) {
      setSelectedTransformerId(null);
    }
  }, [selectedTransformerId, transformerOperations]);

  if (fastStatsLoading || accessLoading) {
    return (
      <div className="enterprise-card px-5 py-10 text-sm text-slate-500 dark:text-slate-300">
        Loading dashboard overview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="powertel-dashboard space-y-5">
      <section className="powertel-hero-panel enterprise-card relative overflow-hidden px-5 py-5 backdrop-blur-sm">
        <div className="pointer-events-none absolute -left-10 top-12 h-32 w-32 rounded-full bg-red-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_420px] xl:items-start">
          <div className="relative max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="powertel-logo-badge">
                <img src="/images/powertel.png" alt="Powertel" />
                <div className="powertel-logo-copy">
                  <span className="powertel-kicker">Powertel</span>
                </div>
              </div>
              <div className="enterprise-chip inline-flex items-center gap-2 border border-blue-100/80 bg-blue-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300">
                <ShieldCheck className="h-4 w-4" />
                Utility Monitoring Platform
              </div>
            </div>
            <h2 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-[32px]">
              Grid operations overview
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Welcome {user?.first_name || user?.firstname || user?.username || "Operator"}.
              Your current access scope is{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{accessLabel}</span>, with live telemetry,
              alerts, and asset visibility across the grid estate.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <div className="enterprise-subtle-card inline-flex items-center gap-2 border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Regions: {stats.totalRegions}</span>
              </div>
              <div className="enterprise-subtle-card inline-flex items-center gap-2 border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Depots: {stats.totalDepots}</span>
              </div>
              <div className="enterprise-subtle-card inline-flex items-center gap-2 border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Sensors: {stats.totalSensors}</span>
              </div>
              <div className="powertel-red-chip enterprise-subtle-card inline-flex items-center gap-2 border px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium">Live alerts: {liveAlertCount}</span>
              </div>
            </div>
          </div>
          <div className="relative grid grid-cols-2 gap-3">
            <div className="enterprise-subtle-card border border-slate-200/80 bg-white/75 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Regions</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-blue-700 dark:text-blue-300">{stats.totalRegions}</p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Operational coverage</p>
            </div>
            <div className="enterprise-subtle-card border border-slate-200/80 bg-white/75 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Depots</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-blue-700 dark:text-blue-300">{stats.totalDepots}</p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Field service hubs</p>
            </div>
            <div className="enterprise-subtle-card border border-slate-200/80 bg-white/75 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Sensors</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-blue-700 dark:text-blue-300">{stats.totalSensors}</p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Connected devices</p>
            </div>
            <div className="enterprise-subtle-card border border-slate-200/80 bg-white/75 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Live Alerts</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-red-600 dark:text-red-300">{liveAlertCount}</p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Current event stream</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          title="Total Transformers"
          value={stats.totalTransformers}
          subtitle="Monitored utility assets across the network."
          icon={<Zap className="h-5 w-5" />}
          highlight="blue"
        />
        <StatCard
          title="Online"
          value={stats.activeTransformers}
          subtitle="Active transformer nodes reporting as healthy."
          icon={<Activity className="h-5 w-5" />}
          highlight="emerald"
        />
        <StatCard
          title="Offline"
          value={stats.offlineTransformers}
          subtitle="Assets requiring communication or field attention."
          icon={<Waves className="h-5 w-5" />}
          highlight="amber"
        />
        <StatCard
          title="Live Alerts"
          value={detailsLoaded ? Math.max(stats.totalAlerts, liveAlertCount) : liveAlertCount}
          subtitle={detailsLoaded ? "Alarm activity requiring operator awareness." : "Live events only — click below for history."}
          icon={<AlertTriangle className="h-5 w-5" />}
          highlight="red"
        />
      </section>

      <section className="space-y-4">
        <div className="enterprise-card overflow-hidden p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="powertel-section-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">
                Network Map
              </p>
              <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Interactive transformer footprint
              </h3>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                Visualize monitored sites and transform grid coverage into a field operations view.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topRegionalCoverage.length === 0 ? (
                  <span className="enterprise-chip inline-flex items-center px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Region coverage appears after transformer and depot data loads.
                  </span>
                ) : (
                  topRegionalCoverage.map((region) => (
                    <span
                      key={region.id}
                      className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                    >
                      <span className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-red-500" />
                      {region.name} - {region.transformers} transformers - {region.alerts} alerts
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/sites"
                className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
              >
                <MapPinned className="h-4 w-4" />
                Open Sites
              </Link>
              <Link
                to="/transformers"
                className="powertel-blue-button rounded-full px-3.5 py-1.5 text-sm font-medium text-white transition"
              >
                View Assets
              </Link>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="enterprise-subtle-card px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Visible Regions
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {stats.totalRegions}
              </p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Geographic operating footprint</p>
            </div>
            <div className="enterprise-subtle-card px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Mapped Transformers
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {mapPoints.length}
              </p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Assets with location coordinates available</p>
            </div>
            <div className="enterprise-subtle-card px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Region Leader
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {topRegionalCoverage[0]?.name || "No region data"}
              </p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                {topRegionalCoverage[0]?.transformers || 0} transformers currently visible
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-slate-200/80 dark:border-slate-800">
            <GoogleAssetMap
              apiKey={GOOGLE_MAPS_API_KEY}
              className="h-[460px]"
              points={mapPoints}
              selectedPointId={selectedTransformerId}
              onPointSelect={(item) => setSelectedTransformerId(Number(item.id))}
              emptyLabel="No transformer coordinates are available for the current dashboard scope."
              renderDetails={(item) => (
                <div className="space-y-1.5 text-sm text-slate-600">
                  <p>
                    Depot: <span className="font-medium text-slate-900">{item.depotName}</span>
                  </p>
                  <p>
                    Supplier:{" "}
                    <span className="font-medium text-slate-900">
                      {item.supplierLabel}
                    </span>
                  </p>
                  <p>
                    Status: <span className="font-medium text-slate-900">{item.onlineLabel}</span>
                  </p>
                  <p>
                    Armed: <span className="font-medium text-slate-900">{armStateLabel(item.armState)}</span>
                  </p>
                  <p>
                    Last alert: <span className="font-medium text-slate-900">{item.latestAlertLabel}</span>
                  </p>
                  <p>
                    Alert time: <span className="font-medium text-slate-900">{formatTime(item.latestAlertTime)}</span>
                  </p>
                </div>
              )}
            />
          </div>
        </div>

      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Regions"
          value={detailsLoaded ? stats.totalRegions : "—"}
          subtitle={detailsLoaded ? "Operational coverage" : "Click below to load"}
          icon={<MapPinned className="h-4.5 w-4.5" />}
          highlight="blue"
        />
        <StatCard
          title="Depots"
          value={detailsLoaded ? stats.totalDepots : "—"}
          subtitle={detailsLoaded ? "Field service hubs" : "Click below to load"}
          icon={<Waves className="h-4.5 w-4.5" />}
          highlight="blue"
        />
        <StatCard
          title="Online Ctl"
          value={detailsLoaded ? controlStateSummary.onlineControllers : "—"}
          subtitle="Controllers currently online"
          icon={<Activity className="h-4.5 w-4.5" />}
          highlight="emerald"
        />
        <StatCard
          title="Offline Ctl"
          value={detailsLoaded ? controlStateSummary.offlineControllers : "—"}
          subtitle="Controllers currently offline"
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
          highlight="amber"
        />
        <StatCard
          title="Armed"
          value={detailsLoaded ? watchlistSummary.armed : "—"}
          subtitle={detailsLoaded ? "Control estate armed" : "Click below to load"}
          icon={<Lock className="h-4.5 w-4.5" />}
          highlight="blue"
        />
        <StatCard
          title="Disarmed"
          value={detailsLoaded ? watchlistSummary.disarmed : "—"}
          subtitle={detailsLoaded ? "Control estate disarmed" : "Click below to load"}
          icon={<Unlock className="h-4.5 w-4.5" />}
          highlight="red"
        />
      </section>

      {!detailsLoaded ? (
        <section className="enterprise-card p-5">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="powertel-section-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">
                Supplier & Watchlist Details
              </p>
              <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Estate operations and supplier monitoring
              </h3>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                The heavy transformer/supplier/depot/alert matrix is loaded on demand so your dashboard overview renders instantly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDetailPanel()}
                disabled={detailLoading}
                className="powertel-blue-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
              >
                {detailLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading supplier matrix...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    Load estate & supplier details
                  </>
                )}
              </button>
              <Link
                to="/oculus-control"
                className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
              >
                Go to Oqulus Control →
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="enterprise-card p-4">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setSelectedStatusFilter("ONLINE")}
                className={`enterprise-subtle-card px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50 ${
                  selectedStatusFilter === "ONLINE" ? "border-blue-200 bg-blue-50/70" : ""
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Online</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-300">{watchlistSummary.online}</p>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Controllers reporting healthy</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter("OFFLINE")}
                className={`enterprise-subtle-card px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50 ${
                  selectedStatusFilter === "OFFLINE" ? "border-blue-200 bg-blue-50/70" : ""
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Offline</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-red-600 dark:text-red-300">{watchlistSummary.offline}</p>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Needs comms or field attention</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter("ARMED")}
                className={`enterprise-subtle-card px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50 ${
                  selectedStatusFilter === "ARMED" ? "border-blue-200 bg-blue-50/70" : ""
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Armed</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-blue-700 dark:text-blue-300">{watchlistSummary.armed}</p>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Control estate currently armed</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter("DISARMED")}
                className={`enterprise-subtle-card px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50 ${
                  selectedStatusFilter === "DISARMED" ? "border-blue-200 bg-blue-50/70" : ""
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Disarmed</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-300">{watchlistSummary.disarmed}</p>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Control estate currently disarmed</p>
              </button>
          </div>

          {gatewaySummary && gatewaySummary.total > 0 ? (
            <div className="space-y-3 rounded-[22px] border border-blue-100/70 bg-gradient-to-r from-blue-50/60 via-white to-red-50/50 p-3 dark:border-blue-500/15 dark:from-blue-500/8 dark:via-slate-950 dark:to-red-500/8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-slate-900 dark:text-blue-300">
                    <Router className="h-3.5 w-3.5" />
                    Gateway Estate
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    LoRaWAN monitoring
                  </span>
                </div>
                <Link
                  to="/gateways"
                  className="enterprise-chip inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  Open Gateways →
                </Link>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Link
                  to="/gateways?status=ONLINE"
                  className="enterprise-subtle-card flex items-center justify-between gap-2 px-3 py-2 transition hover:border-emerald-200 hover:bg-emerald-50/60"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Online</p>
                    <p className="mt-0.5 text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-300">{gatewaySummary.online}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-2 text-emerald-600 dark:border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Activity className="h-4 w-4" />
                  </div>
                </Link>

                <Link
                  to="/gateways?status=OFFLINE"
                  className="enterprise-subtle-card flex items-center justify-between gap-2 px-3 py-2 transition hover:border-red-200 hover:bg-red-50/60"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Offline</p>
                    <p className="mt-0.5 text-xl font-semibold tracking-tight text-red-600 dark:text-red-300">{gatewaySummary.offline}</p>
                  </div>
                  <div className="rounded-xl border border-red-100 bg-red-50/80 p-2 text-red-600 dark:border-red-500/10 dark:bg-red-500/10 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </Link>

                <Link
                  to="/gateways?status=DEGRADED"
                  className="enterprise-subtle-card flex items-center justify-between gap-2 px-3 py-2 transition hover:border-amber-200 hover:bg-amber-50/60"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Degraded</p>
                    <p className="mt-0.5 text-xl font-semibold tracking-tight text-amber-600 dark:text-amber-300">{gatewaySummary.degraded}</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-2 text-amber-600 dark:border-amber-500/10 dark:bg-amber-500/10 dark:text-amber-300">
                    <Waves className="h-4 w-4" />
                  </div>
                </Link>
              </div>

              {(gatewaySummary.offline > 0 || gatewaySummary.degraded > 0 || gatewaySummary.missingSim > 0) ? (
                <div className="rounded-[20px] border border-white/70 bg-white/85 p-3 dark:border-slate-800 dark:bg-slate-950/80">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-300" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                        Requiring attention
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {gatewaySummary.offline > 0 ? (
                      <Link
                        to="/gateways?status=OFFLINE"
                        className="flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/70 px-3 py-1.5 text-xs transition hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{gatewaySummary.offline} gateway{gatewaySummary.offline === 1 ? "" : "s"} offline — needs comms or field attention</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-300">
                          Filter →
                        </span>
                      </Link>
                    ) : null}
                    {gatewaySummary.degraded > 0 ? (
                      <Link
                        to="/gateways?status=DEGRADED"
                        className="flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-1.5 text-xs transition hover:bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{gatewaySummary.degraded} gateway{gatewaySummary.degraded === 1 ? "" : "s"} degraded — grace period holding</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                          Filter →
                        </span>
                      </Link>
                    ) : null}
                    {gatewaySummary.missingSim > 0 ? (
                      <Link
                        to="/sims"
                        className="flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-xs transition hover:bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10"
                      >
                        <span className="inline-flex items-center gap-2">
                          <CardSim className="h-3 w-3 text-blue-600 dark:text-blue-300" />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{gatewaySummary.missingSim} gateway{gatewaySummary.missingSim === 1 ? "" : "s"} missing active SIM assignment</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                          SIMs →
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="sticky top-3 z-10 -mx-1 rounded-3xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-sm">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 rounded-l-3xl bg-gradient-to-r from-white/95 to-transparent xl:hidden" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 rounded-r-3xl bg-gradient-to-l from-white/95 to-transparent xl:hidden" />
                <div className="flex gap-2 overflow-x-auto px-1 pb-1 pt-0.5 xl:flex-wrap xl:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="shrink-0 self-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Status</span>
                  {[
                    { value: "ALL", label: "All", count: transformerOperations.length },
                    { value: "ONLINE", label: "Online", count: watchlistSummary.online },
                    { value: "OFFLINE", label: "Offline", count: watchlistSummary.offline },
                    { value: "ARMED", label: "Armed", count: watchlistSummary.armed },
                    { value: "DISARMED", label: "Disarmed", count: watchlistSummary.disarmed },
                    { value: "DELAYED", label: "Delayed", count: watchlistSummary.delayed },
                  ].map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setSelectedStatusFilter(chip.value)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedStatusFilter === chip.value
                          ? "border-blue-200 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                      }`}
                    >
                      {chip.label} · {chip.count}
                    </button>
                  ))}
                  <span className="mx-1 hidden h-5 w-px bg-slate-200 xl:inline-flex" />
                  <span className="shrink-0 self-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Transformer Type</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTypeFilter("ALL")}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedTypeFilter === "ALL"
                        ? "border-blue-200 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    All types · {transformerOperations.length}
                  </button>
                  {availableTypeFilters.map((typeName) => {
                    const total = transformerOperations.filter((item) => normalizedTransformerType(item.type) === typeName).length;
                    return (
                      <button
                        key={typeName}
                        type="button"
                        onClick={() => setSelectedTypeFilter(typeName)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          selectedTypeFilter === typeName
                            ? "border-blue-200 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                        }`}
                      >
                        {typeName} · {total}
                      </button>
                    );
                  })}

                  <span className="mx-1 hidden h-5 w-px bg-slate-200 xl:inline-flex" />
                  <span className="shrink-0 self-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top Depots</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDepotFilter("ALL")}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedDepotFilter === "ALL"
                        ? "border-blue-200 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    All depots · {availableDepotFilters.length}
                  </button>
                  {topDepotCounts.map((depot) => (
                    <button
                      key={depot.name}
                      type="button"
                      onClick={() => setSelectedDepotFilter(depot.name)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedDepotFilter === depot.name
                          ? "border-blue-200 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                      }`}
                    >
                      {depot.name} · {depot.total}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="relative min-w-[280px] flex-1 xl:max-w-2xl">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={transformerSearch}
                onChange={(event) => setTransformerSearch(event.target.value)}
                placeholder="Search by transformer, depot, supplier, alert, or arm state"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                {filteredTransformerOperations.length} transformers shown
              </span>
              <span className="enterprise-chip px-3 py-1.5">Page {watchlistPage} of {totalWatchlistPages}</span>
              <span className="enterprise-chip px-3 py-1.5">
                Showing {watchlistRangeStart}-{watchlistRangeEnd} of {filteredTransformerOperations.length}
              </span>
              {activeWatchlistFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTransformerSearch("");
                    setSelectedDepotFilter("ALL");
                    setSelectedStatusFilter("ALL");
                    setSelectedTypeFilter("ALL");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex min-w-[180px] flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Depot</span>
              <select
                value={selectedDepotFilter}
                onChange={(event) => setSelectedDepotFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All depots</option>
                {availableDepotFilters.map((depotName) => (
                  <option key={depotName} value={depotName}>
                    {depotName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[180px] flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status</span>
              <select
                value={selectedStatusFilter}
                onChange={(event) => setSelectedStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All states</option>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="DELAYED">Delayed</option>
                <option value="ARMED">Armed</option>
                <option value="DISARMED">Disarmed</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>

            <label className="flex min-w-[180px] flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Transformer Type</span>
              <select
                value={selectedTypeFilter}
                onChange={(event) => setSelectedTypeFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All types</option>
                {availableTypeFilters.map((typeName) => (
                  <option key={typeName} value={typeName}>
                    {typeName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeWatchlistFilters.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Active Filters</span>
                {activeWatchlistFilters.map((filter) => (
                  <button
                    key={`${filter.key}-${filter.value}`}
                    type="button"
                    onClick={() => {
                      if (filter.key === "status") setSelectedStatusFilter("ALL");
                      if (filter.key === "type") setSelectedTypeFilter("ALL");
                      if (filter.key === "depot") setSelectedDepotFilter("ALL");
                      if (filter.key === "search") setTransformerSearch("");
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <span className="text-slate-400">{filter.label}</span>
                    <span>{filter.value}</span>
                    <span className="text-slate-400">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {filteredTransformerOperations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No transformers match the current search.
            </div>
          ) : (
            paginatedTransformerOperations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTransformerId(item.id)}
                className={`enterprise-subtle-card w-full p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40 ${
                  selectedTransformer?.id === item.id ? "border-blue-200 bg-blue-50/60" : ""
                }`}
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.onlineTone}`}>
                        {item.onlineLabel}
                      </span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.armTone}`}>
                        {armStateLabel(item.armState)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                      {item.depotName} • {item.districtName} • {item.regionName}
                    </p>
                  </div>
                  <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <MapPinned className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                    {selectedTransformer?.id === item.id ? "Focused on map" : "Click to focus on map"}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Supplier Monitoring</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{item.supplierLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Depot</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{item.depotName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Last Alert</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{item.latestAlertLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Alert Time</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{formatTime(item.latestAlertTime)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Asset Notes</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {normalizedTransformerType(item.type)}{typeof item.capacity === "number" ? ` • ${item.capacity.toLocaleString()} kVA` : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {filteredTransformerOperations.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Browse the filtered estate and keep the map focused on the currently selected transformer.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWatchlistPage((page) => Math.max(1, page - 1))}
                disabled={watchlistPage === 1}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              {visibleWatchlistPages.map((page, index) =>
                page === -1 ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-sm text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setWatchlistPage(page)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      watchlistPage === page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setWatchlistPage((page) => Math.min(totalWatchlistPages, page + 1))}
                disabled={watchlistPage === totalWatchlistPages}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
