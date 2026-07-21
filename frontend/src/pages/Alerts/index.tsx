import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, BellRing, Loader2, RefreshCcw, Search, ShieldAlert, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";

type AlertItem = {
  id: number;
  sensorId?: number;
  transformerId?: number;
  transformerName?: string;
  message?: string;
  value?: string;
  isAlert?: boolean;
  sensorType?: string;
  deviceName?: string;
  deviceId?: string;
  supplierCode?: string;
  supplierName?: string;
};

type FilterMode = "all" | "active" | "info";

const normalizeList = (payload: unknown): AlertItem[] => {
  if (Array.isArray(payload)) return payload as AlertItem[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as AlertItem[];
    }
  }
  return [];
};

const isControllerTrigger = (item: AlertItem) =>
  (item.sensorType || "").toUpperCase() === "CONTROLLER_TRIGGER";

const getControllerTriggerSignals = (item: AlertItem) => {
  const signalText = `${item.value || ""} ${item.message || ""}`.toLowerCase();
  const signals: Array<{ label: string; tone: string }> = [];

  if (signalText.includes("motion detected")) {
    signals.push({
      label: "Motion",
      tone:
        "border border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
    });
  }
  if (signalText.includes("door open")) {
    signals.push({
      label: "Door Open",
      tone:
        "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
    });
  }
  if (signalText.includes("vibration detected")) {
    signals.push({
      label: "Vibration",
      tone:
        "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    });
  }
  if (signals.length === 0 && signalText.includes("trigger cleared")) {
    signals.push({
      label: "Cleared",
      tone:
        "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    });
  }

  return signals;
};

const getTransformerTypeLabel = (item: AlertItem) => {
  const signalText = `${item.value || ""} ${item.message || ""}`.toLowerCase();
  if (signalText.includes("gmt") || signalText.includes("door open")) return "GMT";
  if (signalText.includes("pmt") || signalText.includes("vibration detected")) return "PMT";
  return null;
};

const transformerTypeTone = (type?: string | null) => {
  if (type === "GMT") {
    return "border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300";
  }
  if (type === "PMT") {
    return "border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300";
  }
  return "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
};

const getStatusMeta = (isAlert?: boolean) =>
  isAlert
    ? {
        label: "Alert",
        dot: "bg-red-500",
        text: "text-red-700 dark:text-red-300",
      }
    : {
        label: "Info",
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-300",
      };

const getFilterLabel = (filterMode: FilterMode) => {
  if (filterMode === "active") return "Active alerts";
  if (filterMode === "info") return "Informational";
  return "All alerts";
};

export default function AlertsIndex() {
  const { token, user } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const isSupplierUser =
    Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";

  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/v1/alerts`, { headers });
      setItems(normalizeList(response.data));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (token) {
      void fetchAlerts();
    }
  }, [fetchAlerts, token]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        filterMode === "all"
          ? true
          : filterMode === "active"
            ? item.isAlert === true
            : item.isAlert !== true;
      const matchesQuery =
        !query ||
        (item.message || "").toLowerCase().includes(query) ||
        (item.transformerName || "").toLowerCase().includes(query) ||
        (item.deviceName || "").toLowerCase().includes(query) ||
        (item.deviceId || "").toLowerCase().includes(query) ||
        (item.sensorType || "").toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [filterMode, items, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.isAlert === true).length;
    const informational = Math.max(total - active, 0);
    const controllerTriggers = items.filter((item) => isControllerTrigger(item)).length;
    return { total, active, informational, controllerTriggers };
  }, [items]);

  const filteredStats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((item) => item.isAlert === true).length;
    const informational = Math.max(total - active, 0);
    const controllerTriggers = filtered.filter((item) => isControllerTrigger(item)).length;
    const uniqueTransformers = new Set(
      filtered
        .map((item) => item.transformerId ?? item.transformerName)
        .filter((value): value is number | string => Boolean(value))
    ).size;
    const uniqueDevices = new Set(
      filtered
        .map((item) => item.deviceId ?? item.deviceName)
        .filter((value): value is string => Boolean(value))
    ).size;

    return {
      total,
      active,
      informational,
      controllerTriggers,
      uniqueTransformers,
      uniqueDevices,
      activeShare: total ? Math.round((active / total) * 100) : 0,
    };
  }, [filtered]);

  const topSensorTypes = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((item) => {
      const key = item.sensorType || "Unknown";
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({
        label,
        count,
        share: filtered.length ? Math.round((count / filtered.length) * 100) : 0,
      }));
  }, [filtered]);

  const highlightedSignals = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((item) => {
      getControllerTriggerSignals(item).forEach((signal) => {
        grouped.set(signal.label, (grouped.get(signal.label) || 0) + 1);
      });
    });

    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }, [filtered]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [filterMode, search, pageSize]);

  if (loading && items.length === 0) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading alerts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error" title="Alerts" message={error} /> : null}

      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
            Alert Workspace
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-950 dark:text-slate-50 md:text-lg">
            Transformer alert stream
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isSupplierUser
              ? `Monitoring alerts for ${user?.supplierName || "your organisation"}`
              : "System alerts across monitored transformer assets"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchAlerts()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh Alerts
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Alerts"
          value={stats.total}
          subtitle="All current alert records"
          tone="blue"
          icon={<BellRing className="h-5 w-5" />}
        />
        <StatCard
          title="Active Alerts"
          value={stats.active}
          subtitle="Items flagged for action"
          tone="red"
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <StatCard
          title="Informational"
          value={stats.informational}
          subtitle="Monitoring-only updates"
          tone="amber"
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          title="Controller Triggers"
          value={stats.controllerTriggers}
          subtitle="Door, motion, and vibration"
          tone="violet"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </section>

      <section className="flex flex-col gap-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Alert Summary */}
          <div className="enterprise-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Alert Summary
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Current filter snapshot
                </h3>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <BellRing className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Visible alerts</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{filtered.length}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Active matches</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{filteredStats.active}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Informational</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{filteredStats.informational}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Controller triggers</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{filteredStats.controllerTriggers}</p>
              </div>
            </div>
          </div>

          {/* Filter Context */}
          <div className="enterprise-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Filter Context
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Operational scope
                </h3>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Status mode</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {filterMode === "all" ? "All alerts" : filterMode === "active" ? "Active only" : "Info only"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Search query</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {search ? `"${search}"` : "No active query"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Unique transformers</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{filteredStats.uniqueTransformers}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Date range</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">All time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="enterprise-card flex min-h-[600px] flex-col overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Alerts Table
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                  Prioritized monitoring events
                </h3>
              </div>

              <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {filtered.length.toLocaleString()}
                </span>
                visible matches
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <FilterButton
                  active={filterMode === "all"}
                  label="All"
                  count={stats.total}
                  onClick={() => setFilterMode("all")}
                />
                <FilterButton
                  active={filterMode === "active"}
                  label="Active Alerts"
                  count={stats.active}
                  onClick={() => setFilterMode("active")}
                />
                <FilterButton
                  active={filterMode === "info"}
                  label="Informational"
                  count={stats.informational}
                  onClick={() => setFilterMode("info")}
                />
              </div>

              <div className="enterprise-chip inline-flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Show</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transformer, device, message..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-14 text-slate-500 dark:text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Refreshing alerts...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto p-4 pt-0">
                <table className="min-w-full border-separate border-spacing-y-2.5">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Message</th>
                      <th className="px-3 py-2.5">Transformer</th>
                      <th className="px-3 py-2.5">Device</th>
                      <th className="px-3 py-2.5">Sensor Type</th>
                      <th className="px-3 py-2.5">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12">
                          <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            No alerts found for the current filters.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginated.map((item) => {
                        const controllerSignals = getControllerTriggerSignals(item);
                        const transformerType = getTransformerTypeLabel(item);
                        const status = getStatusMeta(item.isAlert);

                        return (
                          <tr key={item.id} className="enterprise-subtle-card">
                            <td className="rounded-l-[22px] px-3 py-3">
                              <div className="space-y-1.5">
                                <span
                                  className={`inline-flex items-center gap-2 text-xs font-medium ${status.text}`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                                  {status.label}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {isControllerTrigger(item) ? "Controller trigger" : "General event"}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <div>
                                <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                                  {item.message || "Monitoring event"}
                                </p>

                                {controllerSignals.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {controllerSignals.map((signal) => (
                                      <span
                                        key={`${item.id}-${signal.label}-message`}
                                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${signal.tone}`}
                                      >
                                        {signal.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                {isSupplierUser ? null : item.supplierName ? (
                                  <p className="mt-1.5 text-[12px] text-slate-400 dark:text-slate-500">
                                    {item.supplierName}
                                  </p>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <div className="space-y-1.5">
                                <p
                                  className={`text-sm font-medium ${
                                    item.transformerName
                                      ? "text-slate-900 dark:text-slate-100"
                                      : "text-slate-400 dark:text-slate-500"
                                  }`}
                                >
                                  {item.transformerName || "-"}
                                </p>
                                {transformerType ? (
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${transformerTypeTone(transformerType)}`}
                                  >
                                    {transformerType}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <div className="space-y-1">
                                <p
                                  className={`text-sm ${
                                    item.deviceName
                                      ? "font-medium text-slate-900 dark:text-slate-100"
                                      : "text-slate-400 dark:text-slate-500"
                                  }`}
                                >
                                  {item.deviceName || "-"}
                                </p>
                                <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                  {item.deviceId || "-"}
                                </p>
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  item.sensorType
                                    ? "border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    : "border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {item.sensorType || "Unknown"}
                              </span>
                            </td>

                            <td className="rounded-r-[22px] px-3 py-3">
                              {controllerSignals.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {controllerSignals.map((signal) => (
                                    <span
                                      key={`${item.id}-${signal.label}`}
                                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${signal.tone}`}
                                    >
                                      {signal.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span
                                  className={`text-sm font-medium ${
                                    item.value
                                      ? "text-slate-900 dark:text-slate-100"
                                      : "text-slate-400 dark:text-slate-500"
                                  }`}
                                >
                                  {item.value || "-"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Showing {rangeStart} to {rangeEnd} of {filtered.length} alerts
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                    >
                      Previous
                    </button>
                    <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">
                      {page}
                    </div>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Detail Panel */}
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`enterprise-chip inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          active
            ? "bg-white/80 text-current dark:bg-slate-900/70"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="enterprise-subtle-card flex items-center justify-between px-3 py-2.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  tone: "blue" | "red" | "amber" | "violet";
  icon: React.ReactNode;
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300",
    red: "bg-red-50 text-red-600 dark:bg-red-500/14 dark:text-red-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/14 dark:text-violet-300",
  }[tone];

  return (
    <div className="enterprise-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p
            className={`mt-2 text-3xl font-semibold tracking-tight ${
              value > 0
                ? "text-slate-950 dark:text-slate-50"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {value.toLocaleString()}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${toneClasses}`}>{icon}</div>
      </div>
    </div>
  );
}
