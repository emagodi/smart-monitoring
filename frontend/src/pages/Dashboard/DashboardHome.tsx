import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  MapPinned,
  ShieldCheck,
  Waves,
  Warehouse,
  Zap,
} from "lucide-react";
import axios from "axios";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Link } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserAccess } from "../../hooks/useUserAccess";
import { useRealtimeUpdates } from "../../services/realtimeService";

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
  depotId?: number;
  depot_id?: number;
  isActive?: boolean;
  active?: boolean;
  lat?: number;
  lng?: number;
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

type TrendConfig = {
  title: string;
  subtitle: string;
  color: string;
  keywords: string[];
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
  <div className="enterprise-card p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {value.toLocaleString()}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className={`rounded-2xl p-3 ${tone}`}>{icon}</div>
    </div>
  </div>
);

const buildTrendOptions = (
  theme: "light" | "dark",
  categories: string[],
  color: string
): ApexOptions => ({
  chart: {
    type: "area",
    height: 240,
    toolbar: { show: false },
    fontFamily: "Inter, Poppins, sans-serif",
    sparkline: { enabled: false },
  },
  colors: [color],
  stroke: {
    curve: "smooth",
    width: 3,
  },
  fill: {
    type: "gradient",
    gradient: {
      opacityFrom: 0.42,
      opacityTo: 0.04,
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
  tooltip: {
    theme,
  },
  legend: { show: false },
});

export default function DashboardHome() {
  const { token, user, hasPermission } = useAuth();
  const { theme } = useTheme();
  const { hasNationalAccess, hasRegionAccess, hasDepotAccess, loading: accessLoading } = useUserAccess();
  const { realtimeData } = useRealtimeUpdates(token);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";

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
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);
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

  const latestRealtime = useMemo(() => {
    return [...realtimeData]
      .sort((a: SensorUpdate, b: SensorUpdate) => b.timestamp - a.timestamp)
      .slice(0, 6);
  }, [realtimeData]);

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const [regionsRes, districtsRes, depotsRes, transformersRes, sensorsRes, alertsRes] = await Promise.all([
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
        ]);

        const regionsList = normalizeList<Region>(regionsRes.data);
        const districtsList = normalizeList<District>(districtsRes.data);
        const depotsList = normalizeList<Depot>(depotsRes.data);
        const transformersList = normalizeList<Transformer>(transformersRes.data);
        const sensorsList = normalizeList<Sensor>(sensorsRes.data);
        const alertsList = normalizeList<AlertItem>(alertsRes.data);

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

  const depotToRegion = useMemo(() => {
    return new Map(
      depots.map((depot) => {
        const districtId = depot.districtId ?? depot.district_id;
        const regionId = districtId ? districtToRegion.get(districtId) ?? null : null;
        return [depot.id, regionId];
      })
    );
  }, [depots, districtToRegion]);

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

  const mapPoints = useMemo(() => {
    return transformers
      .filter(
        (item) =>
          typeof item.lat === "number" &&
          typeof item.lng === "number" &&
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng)
      )
      .slice(0, 60);
  }, [transformers]);

  const trendCards = useMemo(() => {
    const configs: TrendConfig[] = [
      {
        title: "Load Trend",
        subtitle: "Transformer loading behaviour across recent telemetry updates.",
        color: "#2563EB",
        keywords: ["load", "current", "amps"],
      },
      {
        title: "Temperature Trend",
        subtitle: "Thermal monitoring across oil and winding telemetry streams.",
        color: "#F59E0B",
        keywords: ["temp", "temperature", "thermal"],
      },
      {
        title: "Voltage Trend",
        subtitle: "Voltage stability snapshot from monitored field devices.",
        color: "#4F46E5",
        keywords: ["volt", "voltage"],
      },
      {
        title: "Oil Level Trend",
        subtitle: "Oil and insulation condition indicators from live sensors.",
        color: "#10B981",
        keywords: ["oil", "level", "insulation"],
      },
    ];

    return configs.map((config) => {
      const matches = [...realtimeData]
        .filter((item: SensorUpdate) => {
          const searchText = `${item.sensor_name} ${item.sensor_type}`.toLowerCase();
          return config.keywords.some((keyword) => searchText.includes(keyword));
        })
        .sort((a: SensorUpdate, b: SensorUpdate) => a.timestamp - b.timestamp)
        .slice(-8);

      return {
        ...config,
        categories: matches.map((item) =>
          new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        ),
        data: matches
          .map((item) => Number(item.value))
          .filter((value) => Number.isFinite(value)),
      };
    });
  }, [realtimeData]);

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
    <div className="space-y-6">
      <section className="enterprise-card overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-6 py-6 text-white md:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
              <ShieldCheck className="h-4 w-4" />
              Utility Monitoring Platform
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Enterprise-grade transformer monitoring for ZESA, Powertel, and field operators.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50/90">
              Welcome {user?.first_name || user?.firstname || user?.username || "Operator"}.
              Your current access scope is{" "}
              <span className="font-semibold text-white">{accessLabel}</span>, with live telemetry,
              alerts, and asset visibility across the grid estate.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:w-[340px]">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-100">Regions</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalRegions}</p>
              <p className="mt-1 text-xs text-blue-100">Operational coverage</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-100">Depots</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalDepots}</p>
              <p className="mt-1 text-xs text-blue-100">Field service hubs</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-100">Sensors</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalSensors}</p>
              <p className="mt-1 text-xs text-blue-100">Connected devices</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-100">Live Alerts</p>
              <p className="mt-2 text-3xl font-semibold">{liveAlertCount}</p>
              <p className="mt-1 text-xs text-blue-100">Current event stream</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Transformers"
          value={stats.totalTransformers}
          subtitle="Monitored utility assets across the network."
          icon={<Zap className="h-6 w-6 text-white" />}
          tone="bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
        />
        <MetricCard
          title="Online"
          value={stats.activeTransformers}
          subtitle="Active transformer nodes reporting as healthy."
          icon={<Activity className="h-6 w-6 text-white" />}
          tone="bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25"
        />
        <MetricCard
          title="Offline"
          value={stats.offlineTransformers}
          subtitle="Assets requiring communication or field attention."
          icon={<Waves className="h-6 w-6 text-white" />}
          tone="bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-900/25"
        />
        <MetricCard
          title="Critical Alerts"
          value={Math.max(stats.totalAlerts, liveAlertCount)}
          subtitle="Alarm activity requiring operator awareness."
          icon={<AlertTriangle className="h-6 w-6 text-white" />}
          tone="bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-red-500/25"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="enterprise-card overflow-hidden p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
                Network Map
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Interactive transformer footprint
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Visualize monitored sites and transform grid coverage into a field operations view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/sites"
                className="enterprise-chip inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
              >
                <MapPinned className="h-4 w-4" />
                Open Sites
              </Link>
              <Link
                to="/transformers"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                View Assets
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-slate-200/80 dark:border-slate-800">
            <div className="h-[420px]">
              <MapContainer
                center={[-19.0154, 29.1549]}
                zoom={6}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapPoints.map((item) => (
                  <CircleMarker
                    key={item.id}
                    center={[item.lat as number, item.lng as number]}
                    radius={8}
                    pathOptions={{
                      color: item.isActive === false ? "#EF4444" : "#2563EB",
                      fillColor: item.isActive === false ? "#F87171" : "#3B82F6",
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div className="min-w-[180px]">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Status: {item.isActive === false ? "Offline" : "Online"}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
                  Regional Snapshot
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Transformers by region
                </h3>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Warehouse className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {regionalSummary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Region analytics become available after asset and district data loads.
                </div>
              ) : (
                regionalSummary.map((region) => {
                  const width = Math.max(
                    14,
                    stats.totalTransformers ? (region.transformers / stats.totalTransformers) * 100 : 0
                  );

                  return (
                    <div key={region.id} className="enterprise-subtle-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{region.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {region.districts} districts, {region.depots} depots
                          </p>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {region.alerts} alerts
                        </div>
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Transformers</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {region.transformers}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
                  Incident Feed
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                  Latest alerts
                </h3>
              </div>
              {hasPermission("alerts.read") && (
                <Link to="/alerts" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300">
                  View all
                </Link>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {recentAlerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No alerts recorded yet.
                </div>
              ) : (
                recentAlerts.map((alert) => (
                  <div key={alert.id} className="enterprise-subtle-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {alert.message || "Monitoring alert"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {alert.transformerName || "Transformer event"}
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {alert.severity || "Alert"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                      {formatTime(alert.createdAt || alert.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {trendCards.map((trend) => (
          <div key={trend.title} className="enterprise-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
                  Telemetry Trend
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                  {trend.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {trend.subtitle}
                </p>
              </div>
              <div className="rounded-2xl p-3" style={{ backgroundColor: `${trend.color}18`, color: trend.color }}>
                <Gauge className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5">
              {trend.data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No live telemetry for this metric yet.
                </div>
              ) : (
                <Chart
                  type="area"
                  height={240}
                  options={buildTrendOptions(theme, trend.categories, trend.color)}
                  series={[{ name: trend.title, data: trend.data }]}
                />
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="enterprise-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
              Live Telemetry
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Recent sensor stream
            </h3>
          </div>
          <div className="enterprise-chip inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
            <Activity className="h-4 w-4 text-emerald-500" />
            {latestRealtime.length} recent events captured
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {latestRealtime.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 xl:col-span-3">
              Waiting for live telemetry from connected field devices.
            </div>
          ) : (
            latestRealtime.map((item, index) => (
              <div key={`${item.transformer_id}-${item.sensor_name}-${index}`} className="enterprise-subtle-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.transformer_name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.sensor_name} · {item.sensor_type}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.is_alert
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    }`}
                  >
                    {item.is_alert ? "Alert" : "Normal"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-blue-600 dark:text-blue-300">
                    {String(item.value)}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    {formatTime(item.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
