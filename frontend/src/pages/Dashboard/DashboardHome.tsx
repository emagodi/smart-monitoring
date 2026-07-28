import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Building2,
  Gauge,
  MapPinned,
  Search,
  ShieldCheck,
  Waves,
  Warehouse,
  Zap,
} from "lucide-react";
import axios from "axios";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Link } from "react-router-dom";
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

const formatTime = (value?: string | number) => {
  if (!value) return "Unknown";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  tone: string;
}) => (
  <div className="enterprise-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <p className="mt-2 text-[30px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {value.toLocaleString()}
        </p>
        <p className="mt-1.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className={`rounded-xl p-2.5 ${tone}`}>{icon}</div>
    </div>
  </div>
);

const ExecutiveChartCard = ({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
  footer,
}: ExecutiveChartCardProps) => (
  <div className="enterprise-card flex h-full flex-col p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{icon}</div>
    </div>
    <div className="mt-4 flex-1">{children}</div>
    {footer ? <div className="mt-4">{footer}</div> : null}
  </div>
);

const buildDonutOptions = (
  theme: "light" | "dark",
  labels: string[],
  colors: string[]
): ApexOptions => ({
  chart: {
    type: "donut",
    height: 280,
    toolbar: { show: false },
    fontFamily: "Inter, Poppins, sans-serif",
  },
  labels,
  colors,
  dataLabels: { enabled: false },
  legend: {
    position: "bottom",
    fontSize: "12px",
    labels: {
      colors: theme === "dark" ? "#CBD5E1" : "#475569",
    },
  },
  stroke: {
    width: 0,
  },
  plotOptions: {
    pie: {
      donut: {
        size: "72%",
        labels: {
          show: true,
          name: {
            show: true,
            color: theme === "dark" ? "#CBD5E1" : "#64748B",
          },
          value: {
            show: true,
            color: theme === "dark" ? "#F8FAFC" : "#0F172A",
            fontSize: "24px",
            fontWeight: 700,
          },
          total: {
            show: true,
            label: "Total",
            color: theme === "dark" ? "#CBD5E1" : "#64748B",
            formatter: (w) =>
              w.globals.seriesTotals.reduce((sum: number, value: number) => sum + value, 0).toLocaleString(),
          },
        },
      },
    },
  },
  tooltip: { theme },
});

const buildHorizontalBarOptions = (
  theme: "light" | "dark",
  categories: string[],
  colors: string[]
): ApexOptions => ({
  chart: {
    type: "bar",
    height: 280,
    toolbar: { show: false },
    fontFamily: "Inter, Poppins, sans-serif",
  },
  colors,
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 6,
      barHeight: "56%",
      distributed: true,
    },
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: "11px",
      fontWeight: 700,
    },
  },
  grid: {
    borderColor: theme === "dark" ? "#334155" : "#E2E8F0",
    strokeDashArray: 4,
    xaxis: {
      lines: { show: true },
    },
  },
  xaxis: {
    categories,
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
        fontSize: "12px",
      },
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
        fontSize: "12px",
      },
    },
  },
  tooltip: {
    theme,
  },
  legend: { show: false },
});

const buildGroupedBarOptions = (
  theme: "light" | "dark",
  categories: string[],
  colors: string[]
): ApexOptions => ({
  chart: {
    type: "bar",
    height: 280,
    toolbar: { show: false },
    fontFamily: "Inter, Poppins, sans-serif",
  },
  colors,
  plotOptions: {
    bar: {
      borderRadius: 7,
      columnWidth: "48%",
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: theme === "dark" ? "#334155" : "#E2E8F0",
    strokeDashArray: 4,
  },
  xaxis: {
    categories,
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
        fontSize: "12px",
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
        fontSize: "12px",
      },
    },
  },
  tooltip: { theme },
  legend: {
    position: "top",
    horizontalAlign: "right",
    labels: {
      colors: theme === "dark" ? "#CBD5E1" : "#475569",
    },
  },
});

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

export default function DashboardHome() {
  const { token, user, hasPermission } = useAuth();
  const { theme } = useTheme();
  const { hasNationalAccess, hasRegionAccess, hasDepotAccess, loading: accessLoading } = useUserAccess();
  const { realtimeData } = useRealtimeUpdates(token);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
  const DEBUG_SERVER_URL = "http://127.0.0.1:7777/event";
  const DEBUG_SESSION_ID = "dashboard-fetch-failure";

  const reportDebugEvent = (hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) => {
    // #region debug-point A:report
    fetch(DEBUG_SERVER_URL, {
      method: "POST",
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: "pre-fix",
        hypothesisId,
        location,
        msg,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  };

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
  const [transformerSearch, setTransformerSearch] = useState("");
  const [loading, setLoading] = useState(true);
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

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        // #region debug-point A:dashboard-fetch-start
        reportDebugEvent("A", "DashboardHome:fetchDashboard", "[DEBUG] dashboard fetch started", {
          apiBaseUrl: API_BASE_URL,
          hasToken: Boolean(token),
          userType: user?.userType ?? null,
          supplierCode: user?.supplierCode ?? null,
          permissionsSample: (user?.permissions ?? []).slice(0, 10),
        });
        // #endregion

        const [regionsRes, districtsRes, depotsRes, transformersRes, sensorsRes, alertsRes, oculusControlRes] = await Promise.all([
          hasPermission("regions.read")
            ? axios.get(`${API_BASE_URL}/api/v1/regions`, { headers })
            : Promise.resolve({ data: [] }),
          hasPermission("regions.read")
            ? axios.get(`${API_BASE_URL}/api/v1/districts?page=0&size=1000`, { headers })
            : Promise.resolve({ data: [] }),
          hasPermission("depots.read")
            ? axios.get(`${API_BASE_URL}/api/v1/depots`, { headers })
            : Promise.resolve({ data: [] }),
          axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/sensors`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/alerts`, { headers }),
          hasPermission("controllers.read") || hasPermission("controllers.update")
            ? axios
                .get(`${API_BASE_URL}/api/v1/oculus-control/transformers`, { headers })
                .catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);

        const regionsList = normalizeList<Region>(regionsRes.data);
        const districtsList = normalizeList<District>(districtsRes.data);
        const depotsList = normalizeList<Depot>(depotsRes.data);
        const transformersList = normalizeList<Transformer>(transformersRes.data);
        const sensorsList = normalizeList<Sensor>(sensorsRes.data);
        const alertsList = normalizeList<AlertItem>(alertsRes.data);
        const oculusControlList = normalizeList<OculusControlSummaryRow>(oculusControlRes.data);
        // #region debug-point A:dashboard-fetch-success
        reportDebugEvent("A", "DashboardHome:fetchDashboard", "[DEBUG] dashboard fetch succeeded", {
          regions: regionsList.length,
          districts: districtsList.length,
          depots: depotsList.length,
          transformers: transformersList.length,
          sensors: sensorsList.length,
          alerts: alertsList.length,
          oculusRows: oculusControlList.length,
        });
        // #endregion

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
          alertsList
            .sort(
              (a, b) =>
                new Date(b.createdAt || b.timestamp || 0).getTime() -
                new Date(a.createdAt || a.timestamp || 0).getTime()
            )
            .slice(0, 5)
        );

        setStats({
          totalRegions: regionsList.length,
          totalDepots: depotsList.length,
          totalTransformers: transformersList.length,
          activeTransformers,
          offlineTransformers: Math.max(transformersList.length - activeTransformers, 0),
          totalSensors: sensorsList.length,
          activeSensors,
          totalAlerts: alertsList.length,
        });
      } catch (fetchError) {
        const isAxios = axios.isAxiosError(fetchError);
        const axiosStatus = isAxios ? fetchError.response?.status : null;
        const axiosUrl = isAxios ? fetchError.config?.url : null;
        // #region debug-point C:dashboard-fetch-failed
        reportDebugEvent("C", "DashboardHome:fetchDashboard", "[DEBUG] dashboard fetch failed", {
          apiBaseUrl: API_BASE_URL,
          isAxiosError: isAxios,
          status: axiosStatus,
          url: axiosUrl,
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        // #endregion
        console.error(fetchError);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [API_BASE_URL, hasPermission, token]);

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

  const filteredTransformerOperations = useMemo(() => {
    const query = transformerSearch.trim().toLowerCase();
    if (!query) return transformerOperations;
    return transformerOperations.filter((item) =>
      [
        item.name,
        item.depotName,
        item.districtName,
        item.regionName,
        item.supplierLabel,
        item.latestAlertLabel,
        item.onlineLabel,
        armStateLabel(item.armState),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [transformerOperations, transformerSearch]);

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

  if (loading || accessLoading) {
    return <div className="enterprise-card px-5 py-10 text-sm text-slate-500 dark:text-slate-300">Loading dashboard...</div>;
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
                  <span className="powertel-subcopy">Blue, red, and white executive command view</span>
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Transformers"
          value={stats.totalTransformers}
          subtitle="Monitored utility assets across the network."
          icon={<Zap className="h-5 w-5 text-blue-600 dark:text-blue-300" />}
          tone="border border-blue-100 bg-blue-50/80 text-blue-600 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300"
        />
        <MetricCard
          title="Online"
          value={stats.activeTransformers}
          subtitle="Active transformer nodes reporting as healthy."
          icon={<Activity className="h-5 w-5 text-blue-600 dark:text-blue-300" />}
          tone="border border-blue-100 bg-blue-50/80 text-blue-600 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300"
        />
        <MetricCard
          title="Offline"
          value={stats.offlineTransformers}
          subtitle="Assets requiring communication or field attention."
          icon={<Waves className="h-5 w-5 text-red-600 dark:text-red-300" />}
          tone="border border-red-100 bg-red-50/90 text-red-600 dark:border-red-500/10 dark:bg-red-500/10 dark:text-red-300"
        />
        <MetricCard
          title="Critical Alerts"
          value={Math.max(stats.totalAlerts, liveAlertCount)}
          subtitle="Alarm activity requiring operator awareness."
          icon={<AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />}
          tone="border border-red-100 bg-red-50/90 text-red-600 dark:border-red-500/10 dark:bg-red-500/10 dark:text-red-300"
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <ExecutiveChartCard
          eyebrow="Transformer Control"
          title="Armed and disarmed estate"
          subtitle="Executive control-state view across monitored control-enabled transformers."
          icon={<Gauge className="h-4.5 w-4.5" />}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <div className="enterprise-subtle-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Monitored</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{controlStateSummary.monitored}</p>
              </div>
              <div className="enterprise-subtle-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Controlled</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{controlStateSummary.controlEstate}</p>
              </div>
            </div>
          }
        >
          {controlStateSummary.controlEstate === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Control-state analytics will appear when Oculus-controlled transformers are available in the visible estate.
            </div>
          ) : (
            <Chart
              type="donut"
              height={280}
              options={buildDonutOptions(theme, ["Armed", "Disarmed", "Unknown"], ["#2563EB", "#EF4444", "#CBD5E1"])}
              series={[controlStateSummary.armed, controlStateSummary.disarmed, controlStateSummary.unknown]}
            />
          )}
        </ExecutiveChartCard>

        <ExecutiveChartCard
          eyebrow="Supplier Portfolio"
          title="Suppliers with highest monitored estate"
          subtitle="Shows supplier coverage as the platform grows beyond Oculus."
          icon={<Building2 className="h-4.5 w-4.5" />}
          footer={
            <div className="flex flex-wrap gap-2">
              <span className="enterprise-chip inline-flex items-center px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                Suppliers: {supplierRanking.totalSuppliers}
              </span>
              <span className="enterprise-chip inline-flex items-center px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                Leader: {supplierRanking.leadingSupplier?.name || "No supplier data"}
              </span>
            </div>
          }
        >
          {supplierRanking.topSuppliers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Supplier analytics become available after transformers with supplier ownership are loaded.
            </div>
          ) : (
            <Chart
              type="bar"
              height={280}
              options={buildHorizontalBarOptions(
                theme,
                supplierRanking.topSuppliers.map((item) => item.name),
                ["#1D4ED8", "#2563EB", "#3B82F6", "#DC2626", "#F87171"]
              )}
              series={[{ name: "Transformers", data: supplierRanking.topSuppliers.map((item) => item.total) }]}
            />
          )}
        </ExecutiveChartCard>

        <ExecutiveChartCard
          eyebrow="Alert Intelligence"
          title="Alert pressure and severity mix"
          subtitle="Operational alert mix across critical, warning, and informational activity."
          icon={<BellRing className="h-4.5 w-4.5" />}
          footer={
            <div className="grid grid-cols-3 gap-2">
              <div className="enterprise-subtle-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Total</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{alertSummary.total}</p>
              </div>
              <div className="enterprise-subtle-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Live</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{alertSummary.live}</p>
              </div>
              <div className="enterprise-subtle-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Recent</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{alertSummary.recent}</p>
              </div>
            </div>
          }
        >
          {alertSummary.total === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Alert analytics will populate when alarm history is available.
            </div>
          ) : (
            <Chart
              type="donut"
              height={280}
              options={buildDonutOptions(theme, ["Critical", "Warning", "Informational"], ["#DC2626", "#F87171", "#2563EB"])}
              series={[alertSummary.critical, alertSummary.warning, alertSummary.informational]}
            />
          )}
        </ExecutiveChartCard>

        <ExecutiveChartCard
          eyebrow="Regional Coverage"
          title="Transformers and alerts by region"
          subtitle="Highlights where monitored estate concentration and alert activity are currently highest."
          icon={<BarChart3 className="h-4.5 w-4.5" />}
          footer={
            <div className="flex flex-wrap gap-2">
              <span className="enterprise-chip inline-flex items-center px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                Regions tracked: {stats.totalRegions}
              </span>
              <span className="enterprise-chip inline-flex items-center px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                Depots: {stats.totalDepots}
              </span>
            </div>
          }
        >
          {topRegionalCoverage.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Regional coverage analytics appear after region, depot, and transformer data loads.
            </div>
          ) : (
            <Chart
              type="bar"
              height={280}
              options={buildGroupedBarOptions(
                theme,
                topRegionalCoverage.map((region) => region.name),
                ["#2563EB", "#EF4444"]
              )}
              series={[
                {
                  name: "Transformers",
                  data: topRegionalCoverage.map((region) => region.transformers),
                },
                {
                  name: "Alerts",
                  data: topRegionalCoverage.map((region) => region.alerts),
                },
              ]}
            />
          )}
        </ExecutiveChartCard>
      </section>

      <section className="enterprise-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="powertel-section-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">
              Transformer Watchlist
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-slate-50">
              Searchable transformer operations list
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              Newest assets first, with supplier monitoring, online status, last alert, and armed state.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={transformerSearch}
                onChange={(event) => setTransformerSearch(event.target.value)}
                placeholder="Search by transformer, depot, supplier, alert, or arm state"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              {filteredTransformerOperations.length} transformers shown
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredTransformerOperations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No transformers match the current search.
            </div>
          ) : (
            filteredTransformerOperations.map((item) => (
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
                      {item.type || "Transformer"}{typeof item.capacity === "number" ? ` • ${item.capacity.toLocaleString()} kVA` : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
