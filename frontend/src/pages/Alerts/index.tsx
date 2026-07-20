import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, BellRing, Loader2, Search, ShieldAlert, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/button/Button";
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

const isControllerTrigger = (item: AlertItem) => (item.sensorType || "").toUpperCase() === "CONTROLLER_TRIGGER";

const getControllerTriggerSignals = (item: AlertItem) => {
  const signalText = `${item.value || ""} ${item.message || ""}`.toLowerCase();
  const signals: Array<{ label: string; tone: string }> = [];

  if (signalText.includes("motion detected")) {
    signals.push({ label: "Motion", tone: "bg-red-100 text-red-700" });
  }
  if (signalText.includes("door open")) {
    signals.push({ label: "Door Open", tone: "bg-orange-100 text-orange-700" });
  }
  if (signalText.includes("vibration detected")) {
    signals.push({ label: "Vibration", tone: "bg-amber-100 text-amber-700" });
  }
  if (signals.length === 0 && signalText.includes("trigger cleared")) {
    signals.push({ label: "Cleared", tone: "bg-emerald-100 text-emerald-700" });
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
  if (type === "GMT") return "bg-indigo-100 text-indigo-700";
  if (type === "PMT") return "bg-cyan-100 text-cyan-700";
  return "bg-slate-100 text-slate-700";
};

export default function AlertsIndex() {
  const { token, user } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";

  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

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
      fetchAlerts();
    }
  }, [fetchAlerts, token]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        filterMode === "all" ? true : filterMode === "active" ? item.isAlert === true : item.isAlert !== true;
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
    return { total, active, informational };
  }, [items]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterMode, search, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isSupplierUser
              ? `Monitoring alerts for ${user?.supplierName || "your organisation"}`
              : "System alerts across monitored transformer assets"}
          </p>
        </div>
        <Button onClick={fetchAlerts} icon={<BellRing className="h-4 w-4" />}>
          Refresh Alerts
        </Button>
      </div>

      {error ? <Alert variant="error" title="Alerts" message={error} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Total Alerts" value={stats.total} tone="slate" icon={<BellRing className="h-5 w-5" />} />
        <StatCard title="Active Alerts" value={stats.active} tone="red" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard title="Informational" value={stats.informational} tone="amber" icon={<Zap className="h-5 w-5" />} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton active={filterMode === "all"} onClick={() => setFilterMode("all")} label="All" />
            <FilterButton active={filterMode === "active"} onClick={() => setFilterMode("active")} label="Active Alerts" />
            <FilterButton active={filterMode === "info"} onClick={() => setFilterMode("info")} label="Informational" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transformer, device, message..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white"
              />
            </div>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-14 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading alerts...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Transformer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Device</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Sensor Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                        No alerts found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.isAlert ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {item.isAlert ? "Alert" : "Info"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800">
                          <div className="font-medium">{item.message || "Monitoring event"}</div>
                          {isControllerTrigger(item) && getControllerTriggerSignals(item).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {getControllerTriggerSignals(item).map((signal) => (
                                <span key={signal.label} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${signal.tone}`}>
                                  {signal.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {isSupplierUser ? null : item.supplierName ? (
                            <div className="mt-1 text-xs text-gray-500">{item.supplierName}</div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div>{item.transformerName || "-"}</div>
                          {getTransformerTypeLabel(item) ? (
                            <div className="mt-2">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${transformerTypeTone(getTransformerTypeLabel(item))}`}>
                                {getTransformerTypeLabel(item)}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div>{item.deviceName || "-"}</div>
                          <div className="mt-1 font-mono text-xs text-gray-400">{item.deviceId || "-"}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.sensorType || "-"}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-800">
                          {isControllerTrigger(item) && getControllerTriggerSignals(item).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {getControllerTriggerSignals(item).map((signal) => (
                                <span key={`${item.id}-${signal.label}`} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${signal.tone}`}>
                                  {signal.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            item.value || "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-800">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium text-gray-800">{Math.min(page * pageSize, filtered.length)}</span> of{" "}
                <span className="font-medium text-gray-800">{filtered.length}</span> alerts
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  title,
  value,
  tone,
  icon,
}: {
  title: string;
  value: number;
  tone: "slate" | "red" | "amber";
  icon: React.ReactNode;
}) {
  const toneClasses = {
    slate: "bg-slate-50 text-slate-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${toneClasses}`}>{icon}</div>
      </div>
    </div>
  );
}
