import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  Filter,
  Globe,
  Hash,
  Loader2,
  Map as MapIcon,
  MapPinned,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Modal } from "../../components/ui/modal";
import Alert from "../../components/ui/alert/Alert";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";

interface Region {
  id: number;
  name: string;
  districts?: unknown[];
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
}

interface AlertItem {
  id: number;
  transformerId?: number;
  message?: string;
  createdAt?: string;
  timestamp?: string;
}

type RegionRollup = {
  id: number;
  name: string;
  districts: number;
  depots: number;
  transformers: number;
  activeTransformers: number;
  alerts: number;
  healthScore: number;
  status: "Active" | "Monitoring" | "Idle";
};

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

const formatMonth = (value?: string) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], { month: "short" });
};

const buildBarOptions = (
  theme: "light" | "dark",
  categories: string[],
  stacked = false
): ApexOptions => ({
  chart: {
    type: "bar",
    height: 320,
    stacked,
    toolbar: { show: false },
    fontFamily: "Inter, Poppins, sans-serif",
  },
  colors: stacked ? ["#2563EB", "#F59E0B"] : ["#2563EB"],
  plotOptions: {
    bar: {
      borderRadius: 10,
      columnWidth: "48%",
    },
  },
  dataLabels: { enabled: false },
  legend: {
    show: stacked,
    position: "top",
    horizontalAlign: "left",
    labels: {
      colors: theme === "dark" ? "#CBD5E1" : "#475569",
    },
  },
  xaxis: {
    categories,
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
      },
    },
  },
  grid: {
    borderColor: theme === "dark" ? "#334155" : "#E2E8F0",
    strokeDashArray: 4,
  },
  tooltip: { theme },
});

const buildDonutOptions = (theme: "light" | "dark", labels: string[]): ApexOptions => ({
  chart: {
    type: "donut",
    height: 320,
    fontFamily: "Inter, Poppins, sans-serif",
  },
  labels,
  colors: ["#2563EB", "#4F46E5", "#10B981", "#F59E0B", "#F97316", "#EF4444"],
  dataLabels: { enabled: false },
  legend: {
    position: "bottom",
    labels: {
      colors: theme === "dark" ? "#CBD5E1" : "#475569",
    },
  },
  stroke: {
    colors: [theme === "dark" ? "#0F172A" : "#FFFFFF"],
  },
  tooltip: { theme },
});

const buildAreaOptions = (theme: "light" | "dark", categories: string[]): ApexOptions => ({
  chart: {
    type: "area",
    height: 320,
    toolbar: { show: false },
    fontFamily: "Inter, Poppins, sans-serif",
  },
  colors: ["#4F46E5"],
  stroke: {
    curve: "smooth",
    width: 3,
  },
  fill: {
    type: "gradient",
    gradient: {
      opacityFrom: 0.42,
      opacityTo: 0.06,
    },
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories,
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: {
        colors: theme === "dark" ? "#94A3B8" : "#64748B",
      },
    },
  },
  grid: {
    borderColor: theme === "dark" ? "#334155" : "#E2E8F0",
    strokeDashArray: 4,
  },
  tooltip: { theme },
});

const buildGaugeOptions = (theme: "light" | "dark"): ApexOptions => ({
  chart: {
    type: "radialBar",
    height: 320,
    fontFamily: "Inter, Poppins, sans-serif",
  },
  colors: ["#10B981"],
  plotOptions: {
    radialBar: {
      hollow: {
        size: "62%",
      },
      track: {
        background: theme === "dark" ? "#1E293B" : "#E2E8F0",
      },
      dataLabels: {
        name: {
          color: theme === "dark" ? "#94A3B8" : "#64748B",
        },
        value: {
          color: theme === "dark" ? "#F8FAFC" : "#0F172A",
          fontSize: "32px",
          fontWeight: "600",
          formatter: (value: number) => `${Math.round(value)}%`,
        },
      },
    },
  },
  labels: ["Health"],
});

export default function RegionsIndex() {
  const { token, hasPermission } = useAuth();
  const { theme } = useTheme();
  const initialLoadTokenRef = useRef<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    variant: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showAlertCenter, setShowAlertCenter] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );
  const canCreate = hasPermission("regions.create");
  const canUpdate = hasPermission("regions.update");
  const canDelete = hasPermission("regions.delete");

  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [regionsRes, districtsRes, depotsRes, transformersRes, alertsRes] =
        await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/regions`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/districts?page=0&size=1000`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/alerts`, { headers }),
        ]);

      setRegions(normalizeList<Region>(regionsRes.data));
      setDistricts(normalizeList<District>(districtsRes.data));
      setDepots(normalizeList<Depot>(depotsRes.data));
      setTransformers(normalizeList<Transformer>(transformersRes.data));
      setAlerts(normalizeList<AlertItem>(alertsRes.data));
    } catch {
      setError("Failed to fetch regions");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (!token) {
      initialLoadTokenRef.current = null;
      return;
    }

    // React StrictMode re-runs mount effects in development. Guard the
    // initial load so the page does not issue duplicate API bursts.
    if (initialLoadTokenRef.current === token) return;

    initialLoadTokenRef.current = token;
    void fetchRegions();
  }, [token, fetchRegions]);

  const openCreate = () => {
    setNameInput("");
    setActiveRegion(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (region: Region) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions/${region.id}`, { headers });
      const nextRegion = (res.data as Region) || region;
      setActiveRegion(nextRegion);
      setNameInput(nextRegion.name);
    } catch {
      setActiveRegion(region);
      setNameInput(region.name);
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (region: Region) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions/${region.id}`, { headers });
      setActiveRegion(res.data as Region);
    } catch {
      setActiveRegion(region);
    }
    setShowView(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!nameInput || nameInput.trim().length < 2) {
        setFormError("Enter a valid name");
        return;
      }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(
        `${API_BASE_URL}/api/v1/regions/create`,
        { name: nameInput.trim() },
        { headers }
      );
      setShowCreate(false);
      setNameInput("");
      await fetchRegions();
      setNotice({
        variant: "success",
        title: "Region created",
        message: "The region was created successfully.",
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError("Failed to create region");
      setNotice({
        variant: "error",
        title: "Create failed",
        message: "Could not create the region.",
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeRegion) return;
      if (!nameInput || nameInput.trim().length < 2) {
        setFormError("Enter a valid name");
        return;
      }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/regions/${activeRegion.id}`,
        { name: nameInput.trim() },
        { headers }
      );
      setShowEdit(false);
      setActiveRegion(null);
      setNameInput("");
      await fetchRegions();
      setNotice({
        variant: "success",
        title: "Region updated",
        message: "Changes were saved successfully.",
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError("Failed to update region");
      setNotice({
        variant: "error",
        title: "Update failed",
        message: "Could not update the region.",
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (region: Region) => {
    setActiveRegion(region);
    setDeleteError(null);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!activeRegion) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await axios.delete(`${API_BASE_URL}/api/v1/regions/${activeRegion.id}`, { headers });
      setShowDelete(false);
      setActiveRegion(null);
      await fetchRegions();
      setNotice({
        variant: "success",
        title: "Region deleted",
        message: "The region was deleted successfully.",
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setDeleteError("Failed to delete region");
    } finally {
      setDeleting(false);
    }
  };

  const districtToRegion = useMemo(
    () =>
      new Map(
        districts.map((district) => [
          district.id,
          district.regionId ?? district.region_id ?? null,
        ])
      ),
    [districts]
  );

  const regionRollups = useMemo<RegionRollup[]>(() => {
    return regions.map((region) => {
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
      const activeTransformers = regionTransformers.filter(
        (transformer) => transformer.isActive === true || transformer.active === true
      ).length;
      const regionAlerts = alerts.filter((alert) => {
        if (!alert.transformerId) return false;
        const transformer = transformers.find((item) => item.id === alert.transformerId);
        return depotIds.has(transformer?.depotId ?? transformer?.depot_id ?? -1);
      });
      const transformerCount = regionTransformers.length;
      const healthScore = transformerCount
        ? Math.round((activeTransformers / transformerCount) * 100)
        : 0;

      return {
        id: region.id,
        name: region.name,
        districts:
          regionDistricts.length ||
          (Array.isArray(region.districts) ? region.districts.length : 0),
        depots: regionDepots.length,
        transformers: transformerCount,
        activeTransformers,
        alerts: regionAlerts.length,
        healthScore,
        status:
          transformerCount === 0
            ? "Idle"
            : regionAlerts.length > 0 || healthScore < 70
              ? "Monitoring"
              : "Active",
      };
    });
  }, [alerts, depots, districts, regions, transformers]);

  const filtered = regionRollups.filter((region) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${region.name} ${region.status}`.toLowerCase().includes(query);
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const totalRegions = regionRollups.length;
    const totalDistricts = regionRollups.reduce((sum, region) => sum + region.districts, 0);
    const totalDepots = regionRollups.reduce((sum, region) => sum + region.depots, 0);
    const totalTransformers = regionRollups.reduce(
      (sum, region) => sum + region.transformers,
      0
    );
    const totalAlerts = regionRollups.reduce((sum, region) => sum + region.alerts, 0);
    const totalActive = regionRollups.reduce(
      (sum, region) => sum + region.activeTransformers,
      0
    );

    return {
      totalRegions,
      totalDistricts,
      totalDepots,
      totalTransformers,
      totalAlerts,
      healthScore: totalTransformers ? Math.round((totalActive / totalTransformers) * 100) : 0,
    };
  }, [regionRollups]);

  const topRegions = useMemo(
    () =>
      regionRollups
        .slice()
        .sort((a, b) => b.transformers - a.transformers)
        .slice(0, 6),
    [regionRollups]
  );

  const monthlyFaults = useMemo(() => {
    const grouped = new Map<string, number>();
    alerts.forEach((alert) => {
      const label = formatMonth(alert.createdAt || alert.timestamp);
      grouped.set(label, (grouped.get(label) || 0) + 1);
    });
    const entries = Array.from(grouped.entries()).slice(-6);
    return {
      labels: entries.map(([label]) => label),
      data: entries.map(([, value]) => value),
    };
  }, [alerts]);

  const regionWithMostAlerts = useMemo(
    () => regionRollups.slice().sort((a, b) => b.alerts - a.alerts)[0],
    [regionRollups]
  );

  const activeRegionRollup = useMemo(
    () => regionRollups.find((region) => region.id === activeRegion?.id) ?? null,
    [activeRegion?.id, regionRollups]
  );

  const alertHeavyRegions = useMemo(
    () => regionRollups.filter((region) => region.alerts > 0).slice(0, 5),
    [regionRollups]
  );

  const emptyChartState = (
    <div className="flex h-[320px] items-center justify-center rounded-[22px] border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      No analytics available yet.
    </div>
  );

  if (loading) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading regions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Alert variant={notice.variant} title={notice.title} message={notice.message} />}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Regions",
            value: totals.totalRegions,
            subtitle: "Total operating regions",
            icon: <MapPinned className="h-6 w-6" />,
            tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300",
          },
          {
            label: "Districts",
            value: totals.totalDistricts,
            subtitle: "Coverage across all regions",
            icon: <Globe className="h-6 w-6" />,
            tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/14 dark:text-indigo-300",
          },
          {
            label: "Depots",
            value: totals.totalDepots,
            subtitle: "Maintenance and service hubs",
            icon: <Warehouse className="h-6 w-6" />,
            tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300",
          },
          {
            label: "Transformers",
            value: totals.totalTransformers,
            subtitle: "Installed monitoring footprint",
            icon: <Zap className="h-6 w-6" />,
            tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300",
          },
        ].map((card) => (
          <div key={card.label} className="enterprise-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.subtitle}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.tone}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Region Summary
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Coverage overview
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Active regions", regionRollups.filter((region) => region.status === "Active").length],
              ["Monitoring regions", regionRollups.filter((region) => region.status === "Monitoring").length],
              ["Active alerts", totals.totalAlerts],
              ["Health score", `${totals.healthScore}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="enterprise-subtle-card flex items-center justify-between px-3 py-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAlertCenter(true)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
          >
            Open Alert Center
          </button>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Leading Regions
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Highest transformer density
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {topRegions.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No region rollups available yet.
              </div>
            ) : (
              topRegions.slice(0, 4).map((region) => {
                const width = totals.totalTransformers
                  ? (region.transformers / totals.totalTransformers) * 100
                  : 0;

                return (
                  <div key={region.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{region.name}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {region.transformers.toLocaleString()} transformers
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                        style={{ width: `${Math.max(width, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
            Analytics Workspace
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
            Regional performance and fault intelligence
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAnalyticsModal(true)}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          Open Full Screen Analytics
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Regions Distribution
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Donut chart by transformer footprint
            </h3>
          </div>
          <div className="mt-4">
            {topRegions.length === 0 ? (
              emptyChartState
            ) : (
              <Chart
                type="donut"
                height={320}
                options={buildDonutOptions(theme, topRegions.map((region) => region.name))}
                series={topRegions.map((region) => region.transformers)}
              />
            )}
          </div>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Transformers by Region
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Bar chart across operating regions
            </h3>
          </div>
          <div className="mt-4">
            {topRegions.length === 0 ? (
              emptyChartState
            ) : (
              <Chart
                type="bar"
                height={320}
                options={buildBarOptions(theme, topRegions.map((region) => region.name))}
                series={[{ name: "Transformers", data: topRegions.map((region) => region.transformers) }]}
              />
            )}
          </div>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Alerts by Region
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Operational risk versus active capacity
            </h3>
          </div>
          <div className="mt-4">
            {topRegions.length === 0 ? (
              emptyChartState
            ) : (
              <Chart
                type="bar"
                height={320}
                options={buildBarOptions(theme, topRegions.map((region) => region.name), true)}
                series={[
                  { name: "Active Transformers", data: topRegions.map((region) => region.activeTransformers) },
                  { name: "Alerts", data: topRegions.map((region) => region.alerts) },
                ]}
              />
            )}
          </div>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Monthly Faults
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Alert trend over time
            </h3>
          </div>
          <div className="mt-4">
            {monthlyFaults.data.length === 0 ? (
              emptyChartState
            ) : (
              <Chart
                type="area"
                height={320}
                options={buildAreaOptions(theme, monthlyFaults.labels)}
                series={[{ name: "Faults", data: monthlyFaults.data }]}
              />
            )}
          </div>
        </div>
      </section>

      <section className="enterprise-card p-4">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Health Score
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Regional network health gauge
            </h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400 md:text-sm">
              Health is calculated from active versus total transformers across all monitored regions.
            </p>
            <div className="mt-4">
              <Chart
                type="radialBar"
                height={320}
                options={buildGaugeOptions(theme)}
                series={[totals.healthScore]}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Executive Highlights
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Operational insights
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="enterprise-subtle-card p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Most dense region</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {topRegions[0]?.name || "N/A"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {topRegions[0]?.transformers.toLocaleString() || 0} transformers
                </p>
              </div>
              <div className="enterprise-subtle-card p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Highest alert pressure</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {regionWithMostAlerts?.name || "N/A"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {regionWithMostAlerts?.alerts || 0} alerts
                </p>
              </div>
              <div className="enterprise-subtle-card p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Healthy regions</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {regionRollups.filter((region) => region.healthScore >= 80).length}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Regions above the 80% health threshold
                </p>
              </div>
              <div className="enterprise-subtle-card p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Monitoring required</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {regionRollups.filter((region) => region.status === "Monitoring").length}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Regions flagged for attention
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Regional Table
              </p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                Network coverage by region
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={fetchRegions}
                className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
              >
                <Filter className="h-4 w-4" />
                Reset
              </button>
              {canCreate && (
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Region
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="enterprise-chip inline-flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-sm outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.5 17.5L13.875 13.875M15.8333 9.16667C15.8333 12.8486 12.8486 15.8333 9.16667 15.8333C5.48477 15.8333 2.5 12.8486 2.5 9.16667C2.5 5.48477 5.48477 2.5 9.16667 2.5C12.8486 2.5 15.8333 5.48477 15.8333 9.16667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                type="text"
                placeholder="Search regions or statuses..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-4 pt-0">
          <table className="min-w-full border-separate border-spacing-y-2.5">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                <th className="px-3 py-2.5">Region</th>
                <th className="px-3 py-2.5">Districts</th>
                <th className="px-3 py-2.5">Depots</th>
                <th className="px-3 py-2.5">Transformers</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No regions found for the current filter.
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((region) => (
                  <tr key={region.id} className="enterprise-subtle-card">
                    <td className="rounded-l-[22px] px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                          <MapPinned className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{region.name}</p>
                          <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                            {region.alerts > 0
                              ? `${region.alerts} active alert${region.alerts === 1 ? "" : "s"}`
                              : "No active regional alerts"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          region.districts > 0
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {region.districts}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          region.depots > 0
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {region.depots}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1.5">
                        <div
                          className={`flex items-center gap-2 text-sm font-semibold ${
                            region.transformers > 0
                              ? "text-slate-900 dark:text-slate-100"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <Zap className={`h-4 w-4 ${region.transformers > 0 ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}`} />
                          {region.transformers.toLocaleString()}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                            style={{ width: `${Math.max(region.healthScore, 8)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              region.status === "Active"
                                ? "bg-emerald-500"
                                : region.status === "Monitoring"
                                  ? "bg-amber-500"
                                  : "bg-slate-400 dark:bg-slate-500"
                            }`}
                          />
                          {region.status}
                        </span>
                        <span className="text-[12px] text-slate-400 dark:text-slate-500">
                          Health score {region.healthScore}%
                        </span>
                      </div>
                    </td>
                    <td className="rounded-r-[22px] px-3 py-3 text-right">
                      <ActionMenu
                        placement="bottom-end"
                        onView={() => openView(region)}
                        onEdit={canUpdate ? () => openEdit(region) : undefined}
                        onDelete={canDelete ? () => openDelete(region) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} regions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
              >
                Previous
              </button>
              <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">{page}</div>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      <RegionsCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        name={nameInput}
        setName={setNameInput}
        saving={savingCreate}
        error={formError}
      />
      <RegionsEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        name={nameInput}
        setName={setNameInput}
        saving={savingEdit}
        error={formError}
      />
      <RegionsViewModal
        open={showView}
        onClose={() => setShowView(false)}
        region={activeRegion}
        rollup={activeRegionRollup}
      />
      <RegionsAlertModal
        open={showAlertCenter}
        onClose={() => setShowAlertCenter(false)}
        totalAlerts={totals.totalAlerts}
        monitoringRegions={regionRollups.filter((region) => region.status === "Monitoring").length}
        topAlertRegions={alertHeavyRegions}
        highlightedRegion={regionWithMostAlerts ?? null}
      />
      <RegionsAnalyticsModal
        open={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        theme={theme}
        topRegions={topRegions}
        monthlyFaults={monthlyFaults}
        totals={totals}
        regionWithMostAlerts={regionWithMostAlerts ?? null}
      />
      <RegionsDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
        region={activeRegion}
        deleting={deleting}
        error={deleteError}
      />
    </div>
  );
}

type RegionFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  name: string;
  setName: (v: string) => void;
  saving?: boolean;
  error?: string | null;
  mode: "create" | "edit";
};

function ModalErrorNotice({ error }: { error?: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
      {error}
    </div>
  );
}

function RegionsFormModal({
  open,
  onClose,
  onSubmit,
  name,
  setName,
  saving,
  error,
  mode,
}: RegionFormModalProps) {
  const isEdit = mode === "edit";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[90vh] max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                {isEdit ? <MapIcon className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  {isEdit ? "Edit Region" : "Create Region"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {isEdit ? "Update region information" : "Add a new operating region"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {isEdit
                    ? "Update the region in a centered modal without leaving the page."
                    : "Create a region in a centered modal without interrupting the operator workflow."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Workflow</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isEdit ? "Edit in modal" : "Create in modal"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Module</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Regions</p>
              </div>
            </div>

            <ModalErrorNotice error={error} />

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  Region Information
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Primary details
                </h4>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Region name *
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MapIcon className="h-4.5 w-4.5 text-blue-500" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter region name"
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Use a clear operational name such as `Harare`, `West`, or `Mashonaland East`.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save Changes"
                    : "Create Region"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function RegionsCreateModal(props: Omit<RegionFormModalProps, "mode">) {
  return <RegionsFormModal {...props} mode="create" />;
}

export function RegionsEditModal(props: Omit<RegionFormModalProps, "mode">) {
  return <RegionsFormModal {...props} mode="edit" />;
}

export function RegionsViewModal({
  open,
  onClose,
  region,
  rollup,
}: {
  open: boolean;
  onClose: () => void;
  region: Region | null;
  rollup?: RegionRollup | null;
}) {
  if (!region) return null;

  const metrics = [
    { label: "Districts", value: rollup?.districts ?? (Array.isArray(region.districts) ? region.districts.length : 0) },
    { label: "Depots", value: rollup?.depots ?? 0 },
    { label: "Transformers", value: rollup?.transformers ?? 0 },
    { label: "Alerts", value: rollup?.alerts ?? 0 },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[88vh] max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <MapIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Region Details
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{region.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Centered modal view for quick operational context.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Region health snapshot
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  (rollup?.status ?? "Idle") === "Active"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : (rollup?.status ?? "Idle") === "Monitoring"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {rollup?.status ?? "Idle"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Identifiers</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Region ID</p>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">#{region.id}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Coverage note</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    This centered modal keeps the operator in context while viewing details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function RegionsAlertModal({
  open,
  onClose,
  totalAlerts,
  monitoringRegions,
  topAlertRegions,
  highlightedRegion,
}: {
  open: boolean;
  onClose: () => void;
  totalAlerts: number;
  monitoringRegions: number;
  topAlertRegions: RegionRollup[];
  highlightedRegion: RegionRollup | null;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      showCloseButton={false}
      backdropBlur={true}
    >
      <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Alert Center</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              Regional alert and notification summary
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Center modal for operator notifications and risk visibility.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">Active alerts</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{totalAlerts}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring regions</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{monitoringRegions}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">Highest pressure</p>
            <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-50">
              {highlightedRegion?.name || "No active alert region"}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Attention Queue</p>
          <div className="mt-4 space-y-3">
            {topAlertRegions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No active alerts are mapped to regions right now.
              </div>
            ) : (
              topAlertRegions.map((region) => (
                <div
                  key={region.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{region.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {region.alerts} alert{region.alerts === 1 ? "" : "s"} across {region.transformers} transformers
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    {region.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function RegionsAnalyticsModal({
  open,
  onClose,
  theme,
  topRegions,
  monthlyFaults,
  totals,
  regionWithMostAlerts,
}: {
  open: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  topRegions: RegionRollup[];
  monthlyFaults: { labels: string[]; data: number[] };
  totals: {
    totalRegions: number;
    totalDistricts: number;
    totalDepots: number;
    totalTransformers: number;
    totalAlerts: number;
    healthScore: number;
  };
  regionWithMostAlerts: RegionRollup | null;
}) {
  const emptyState = (
    <div className="flex h-[260px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      No analytics available yet.
    </div>
  );

  return (
    <Modal isOpen={open} onClose={onClose} variant="fullscreen" showCloseButton={false}>
      <div className="flex min-h-full min-w-0 flex-col bg-slate-100 dark:bg-slate-950">
        <div className="shrink-0 border-b border-slate-200 bg-white/95 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Analytics Modal
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                Transformer network performance board
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Full screen modal for charts, summaries, and operational insight.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:block">
                Health score {totals.healthScore}%
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {[
              { label: "Total Regions", value: totals.totalRegions },
              { label: "Districts", value: totals.totalDistricts },
              { label: "Transformers", value: totals.totalTransformers },
              { label: "Alerts", value: totals.totalAlerts },
            ].map((card) => (
              <div key={card.label} className="enterprise-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                  {card.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="enterprise-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Transformers by Region
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                Full screen performance comparison
              </h4>
              <div className="mt-4">
                {topRegions.length === 0 ? (
                  emptyState
                ) : (
                  <Chart
                    type="bar"
                    height={300}
                    options={buildBarOptions(theme, topRegions.map((region) => region.name))}
                    series={[{ name: "Transformers", data: topRegions.map((region) => region.transformers) }]}
                  />
                )}
              </div>
            </div>

            <div className="enterprise-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Fault Trend
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                Alert volume over time
              </h4>
              <div className="mt-4">
                {monthlyFaults.data.length === 0 ? (
                  emptyState
                ) : (
                  <Chart
                    type="area"
                    height={300}
                    options={buildAreaOptions(theme, monthlyFaults.labels)}
                    series={[{ name: "Faults", data: monthlyFaults.data }]}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
            <div className="enterprise-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Distribution
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                Transformer footprint by region
              </h4>
              <div className="mt-4">
                {topRegions.length === 0 ? (
                  emptyState
                ) : (
                  <Chart
                    type="donut"
                    height={300}
                    options={buildDonutOptions(theme, topRegions.map((region) => region.name))}
                    series={topRegions.map((region) => region.transformers)}
                  />
                )}
              </div>
            </div>

            <div className="enterprise-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Health Score
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                Full network health gauge
              </h4>
              <div className="mt-4">
                <Chart
                  type="radialBar"
                  height={300}
                  options={buildGaugeOptions(theme)}
                  series={[totals.healthScore]}
                />
              </div>
            </div>

            <div className="enterprise-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Highlights
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                Operator briefing
              </h4>
              <div className="mt-4 space-y-3">
                <div className="enterprise-subtle-card p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Highest alert pressure</p>
                  <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-50">
                    {regionWithMostAlerts?.name || "N/A"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {regionWithMostAlerts?.alerts || 0} alerts
                  </p>
                </div>
                <div className="enterprise-subtle-card p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring coverage</p>
                  <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-50">
                    {totals.totalRegions ? Math.round((totals.totalAlerts / Math.max(totals.totalRegions, 1)) * 10) / 10 : 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Average alerts per region
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function RegionsDeleteModal({
  open,
  onClose,
  onConfirm,
  region,
  deleting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  region: Region | null;
  deleting: boolean;
  error?: string | null;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className="w-full max-w-md overflow-hidden rounded-[28px] border border-red-200 bg-white p-0 shadow-2xl dark:border-red-500/20 dark:bg-slate-900"
      showCloseButton={false}
      backdropBlur={true}
    >
      <div className="px-6 py-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
          !
        </div>
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete Region?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Are you sure you want to delete <span className="font-semibold text-slate-950 dark:text-slate-50">{region?.name || "this region"}</span>? This action cannot be undone.
        </p>

        <div className="mt-5">
          <ModalErrorNotice error={error} />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
