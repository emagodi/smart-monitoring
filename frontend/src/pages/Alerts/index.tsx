import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  FileWarning,
  History,
  Loader2,
  MapPinned,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  Siren,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";

type AlertCaseStatus = "NEW" | "ACKNOWLEDGED" | "DISPATCHED" | "RESOLVED" | "FALSE_ALARM";

type AlertItem = {
  id: number;
  message?: string;
  value?: string;
  isAlert?: boolean;
  transformerId?: number;
  transformerName?: string;
  depotId?: number | null;
  depotName?: string | null;
  supplierName?: string | null;
  supplierCode?: string | null;
  deviceName?: string | null;
  deviceId?: string | null;
  sensorType?: string | null;
  createdAt?: string | null;
  caseId?: number | null;
  caseStatus?: AlertCaseStatus | null;
  assignedToEmail?: string | null;
  assignedToName?: string | null;
  acknowledgedAt?: string | null;
  dispatchedAt?: string | null;
  resolvedAt?: string | null;
  falseAlarmAt?: string | null;
  lastActionAt?: string | null;
  lastActionNote?: string | null;
};

type TimelineItem = {
  id: number;
  activityType: "CASE_CREATED" | "STATUS_CHANGED" | "ASSIGNMENT_CHANGED" | "NOTE_ADDED";
  statusBefore?: AlertCaseStatus | null;
  statusAfter?: AlertCaseStatus | null;
  actorEmail?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt?: string | null;
};

type NotificationItem = {
  id: string;
  channel?: "EMAIL" | "SMS" | "WHATSAPP";
  deliveryStatus?: string | null;
  providerStatus?: string | null;
  recipientName?: string | null;
  recipientAddress?: string | null;
  creationTimestamp?: string | null;
  acceptedTimestamp?: string | null;
  deliveredTimestamp?: string | null;
  readTimestamp?: string | null;
  failedTimestamp?: string | null;
};

type FilterMode =
  | "all"
  | "new"
  | "acknowledged"
  | "dispatched"
  | "resolved"
  | "falseAlarm"
  | "unassigned";

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
  return {
    items: normalizeList<T>(payload),
    totalElements: typeof obj?.totalElements === "number" ? obj.totalElements : normalizeList<T>(payload).length,
    totalPages: typeof obj?.totalPages === "number" ? obj.totalPages : 1,
    page: typeof obj?.number === "number" ? obj.number : 0,
    size: typeof obj?.size === "number" ? obj.size : normalizeList<T>(payload).length || 50,
  };
};

const CASE_ACTIONS: Array<{ label: string; value: AlertCaseStatus; icon: ReactNode }> = [
  { label: "Acknowledge", value: "ACKNOWLEDGED", icon: <UserCheck className="h-4 w-4" /> },
  { label: "Dispatch", value: "DISPATCHED", icon: <Truck className="h-4 w-4" /> },
  { label: "Resolve", value: "RESOLVED", icon: <CheckCircle2 className="h-4 w-4" /> },
  { label: "False Alarm", value: "FALSE_ALARM", icon: <XCircle className="h-4 w-4" /> },
];

const getCaseStatus = (item: AlertItem): AlertCaseStatus => item.caseStatus || (item.isAlert ? "NEW" : "RESOLVED");

const statusTone = (status: AlertCaseStatus) => {
  switch (status) {
    case "ACKNOWLEDGED":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300";
    case "DISPATCHED":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300";
    case "RESOLVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "FALSE_ALARM":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
  }
};

const channelTone = (channel?: string | null) => {
  switch (channel) {
    case "WHATSAPP":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "SMS":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300";
    case "EMAIL":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
};

const deliveryTone = (status?: string | null) => {
  const normalized = (status || "").toUpperCase();
  if (normalized.includes("READ") || normalized.includes("DELIVERED")) {
    return "text-emerald-600 dark:text-emerald-300";
  }
  if (normalized.includes("FAILED")) {
    return "text-red-600 dark:text-red-300";
  }
  if (normalized.includes("SENT") || normalized.includes("ACCEPTED")) {
    return "text-blue-600 dark:text-blue-300";
  }
  return "text-slate-500 dark:text-slate-400";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const summarizeScope = (supplierName?: string | null, depotId?: number | null) => {
  if (supplierName && depotId) return `${supplierName} · Depot ${depotId}`;
  if (supplierName) return supplierName;
  if (depotId) return `Depot ${depotId}`;
  return "National operations";
};

export default function AlertsIndex() {
  const { token, user } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  const [items, setItems] = useState<AlertItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [note, setNote] = useState("");
  const [assignedToEmail, setAssignedToEmail] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AlertCaseStatus>("NEW");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/v1/alerts`, {
        headers,
        params: { page, size: pageSize },
      });
      const normalized = normalizePage<AlertItem>(response.data);
      setItems(normalized.items);
      setTotalElements(normalized.totalElements);
      setTotalPages(Math.max(normalized.totalPages, 1));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load alert workflow desk.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, page, pageSize]);

  const fetchDetails = useCallback(
    async (alertId: number) => {
      try {
        setDetailLoading(true);
        const [timelineResponse, notificationsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/alerts/${alertId}/timeline`, { headers }),
          axios.get(`${API_BASE_URL}/v1/notification/reference/${alertId}`, {
            headers,
            params: { sourceSystem: "transformer-service" },
          }),
        ]);
        setTimeline(normalizeList<TimelineItem>(timelineResponse.data));
        setNotifications(normalizeList<NotificationItem>(notificationsResponse.data));
      } catch (detailError) {
        console.error(detailError);
        setTimeline([]);
        setNotifications([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [API_BASE_URL, headers]
  );

  useEffect(() => {
    if (token) {
      void fetchAlerts();
    }
  }, [fetchAlerts, token]);

  useEffect(() => {
    setPage(0);
  }, [filterMode, search]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const status = getCaseStatus(item);
      const matchesFilter =
        filterMode === "all"
          ? true
          : filterMode === "new"
            ? status === "NEW"
            : filterMode === "acknowledged"
              ? status === "ACKNOWLEDGED"
              : filterMode === "dispatched"
                ? status === "DISPATCHED"
                : filterMode === "resolved"
                  ? status === "RESOLVED"
                  : filterMode === "falseAlarm"
                    ? status === "FALSE_ALARM"
                    : !item.assignedToEmail && !item.assignedToName;

      const matchesQuery =
        !query ||
        (item.message || "").toLowerCase().includes(query) ||
        (item.transformerName || "").toLowerCase().includes(query) ||
        (item.deviceName || "").toLowerCase().includes(query) ||
        (item.deviceId || "").toLowerCase().includes(query) ||
        (item.assignedToName || "").toLowerCase().includes(query) ||
        (item.assignedToEmail || "").toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });
  }, [filterMode, items, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      setTimeline([]);
      setNotifications([]);
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((item) => item.id === selectedId) || items.find((item) => item.id === selectedId) || null,
    [filtered, items, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      return;
    }
    setSelectedStatus(getCaseStatus(selected));
    setAssignedToEmail(selected.assignedToEmail || "");
    setAssignedToName(selected.assignedToName || "");
    setNote(selected.lastActionNote || "");
    void fetchDetails(selected.id);
  }, [fetchDetails, selected]);

  const stats = useMemo(() => {
    const statusCounts = {
      total: items.length,
      newCases: 0,
      acknowledged: 0,
      dispatched: 0,
      resolved: 0,
      falseAlarm: 0,
      unassigned: 0,
    };

    items.forEach((item) => {
      const status = getCaseStatus(item);
      if (status === "NEW") statusCounts.newCases += 1;
      if (status === "ACKNOWLEDGED") statusCounts.acknowledged += 1;
      if (status === "DISPATCHED") statusCounts.dispatched += 1;
      if (status === "RESOLVED") statusCounts.resolved += 1;
      if (status === "FALSE_ALARM") statusCounts.falseAlarm += 1;
      if (!item.assignedToEmail && !item.assignedToName && status !== "RESOLVED" && status !== "FALSE_ALARM") {
        statusCounts.unassigned += 1;
      }
    });

    return statusCounts;
  }, [items]);

  const pageStart = items.length === 0 ? 0 : page * pageSize + 1;
  const pageEnd = items.length === 0 ? 0 : page * pageSize + items.length;

  const deliverySummary = useMemo(() => {
    const delivered = notifications.filter((item) =>
      ["DELIVERED", "READ"].includes((item.deliveryStatus || "").toUpperCase())
    ).length;
    const failed = notifications.filter((item) =>
      (item.deliveryStatus || "").toUpperCase().includes("FAILED")
    ).length;
    return { total: notifications.length, delivered, failed };
  }, [notifications]);

  const saveCaseUpdate = async (statusOverride?: AlertCaseStatus) => {
    if (!selected) return;
    try {
      setSaving(true);
      const response = await axios.patch(
        `${API_BASE_URL}/api/v1/alerts/${selected.id}/case`,
        {
          status: statusOverride || selectedStatus,
          assignedToEmail,
          assignedToName,
          note,
        },
        { headers }
      );
      const updated = response.data as AlertItem;
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
      setSelectedStatus(getCaseStatus(updated));
      await fetchDetails(updated.id);
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to update the alert workflow.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading alert operations desk...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error" title="Alerts" message={error} /> : null}

      <section className="enterprise-card overflow-hidden p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
              Alert Operations Desk
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
              Depot-aware transformer response workflow
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Scope: {summarizeScope(user?.supplierName, user?.depotId)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <div className="font-semibold">Unassigned</div>
              <div className="mt-1 text-2xl font-semibold">{stats.unassigned}</div>
              <div className="mt-1 text-xs text-blue-600/80 dark:text-blue-200/80">Current page</div>
            </div>
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Desk
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Open Cases" value={stats.newCases} subtitle="Awaiting first action" icon={<Siren className="h-5 w-5" />} tone="red" />
        <StatCard title="Acknowledged" value={stats.acknowledged} subtitle="Seen by operations" icon={<UserCheck className="h-5 w-5" />} tone="amber" />
        <StatCard title="Dispatched" value={stats.dispatched} subtitle="Field response underway" icon={<Truck className="h-5 w-5" />} tone="blue" />
        <StatCard title="Resolved" value={stats.resolved} subtitle="Closed operationally" icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="False Alarms" value={stats.falseAlarm} subtitle="Closed as non-events" icon={<FileWarning className="h-5 w-5" />} tone="slate" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr,0.95fr]">
        <div className="enterprise-card overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Active Queue
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Prioritized alerts with action status
                </h3>
              </div>
              <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                <BellRing className="h-4 w-4" />
                {pageStart}-{pageEnd} of {totalElements.toLocaleString()}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <FilterButton active={filterMode === "all"} label="All" onClick={() => setFilterMode("all")} />
                <FilterButton active={filterMode === "new"} label="New" onClick={() => setFilterMode("new")} />
                <FilterButton active={filterMode === "acknowledged"} label="Acknowledged" onClick={() => setFilterMode("acknowledged")} />
                <FilterButton active={filterMode === "dispatched"} label="Dispatched" onClick={() => setFilterMode("dispatched")} />
                <FilterButton active={filterMode === "resolved"} label="Resolved" onClick={() => setFilterMode("resolved")} />
                <FilterButton active={filterMode === "falseAlarm"} label="False Alarm" onClick={() => setFilterMode("falseAlarm")} />
                <FilterButton active={filterMode === "unassigned"} label="Unassigned" onClick={() => setFilterMode("unassigned")} />
              </div>

              <div className="enterprise-chip flex items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transformer, device, assignee..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Filters and search apply to the current loaded page. Select an alert to load timeline and recipient audit on demand.</span>
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
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="max-h-[900px] overflow-y-auto p-4">
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-14 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No alerts found for the current workflow filters.
                </div>
              ) : (
                filtered.map((item) => {
                  const status = getCaseStatus(item);
                  const selectedRow = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selectedRow
                          ? "border-blue-300 bg-blue-50/70 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900/90"
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(status)}`}>
                              {status.replace("_", " ")}
                            </span>
                            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                              {item.sensorType || "Alert"}
                            </span>
                          </div>
                          <div>
                            <p className="text-base font-semibold text-slate-950 dark:text-slate-50">
                              {item.transformerName || "Unassigned transformer"}
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {item.message || item.value || "Operational alert"}
                            </p>
                          </div>
                        </div>

                        <div className="grid min-w-[260px] grid-cols-2 gap-3 text-sm text-slate-500 dark:text-slate-400">
                          <MetaBlock
                            icon={<MapPinned className="h-4 w-4" />}
                            label="Scope"
                            value={item.depotName || (item.depotId ? `Depot ${item.depotId}` : item.supplierName || "General")}
                          />
                          <MetaBlock
                            icon={<Clock3 className="h-4 w-4" />}
                            label="Detected"
                            value={formatDateTime(item.createdAt)}
                          />
                          <MetaBlock
                            icon={<UserCheck className="h-4 w-4" />}
                            label="Assigned"
                            value={item.assignedToName || item.assignedToEmail || "Unassigned"}
                          />
                          <MetaBlock
                            icon={<AlertTriangle className="h-4 w-4" />}
                            label="Device"
                            value={item.deviceName || item.deviceId || "Unknown"}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Page {totalElements === 0 ? 0 : page + 1} of {Math.max(totalPages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  className="enterprise-chip rounded-full px-3 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={loading || page + 1 >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="enterprise-card overflow-hidden">
          {!selected ? (
            <div className="flex h-full min-h-[520px] items-center justify-center px-6 py-14 text-center text-sm text-slate-500 dark:text-slate-400">
              Select an alert to review case history, recipients, and response actions.
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                      Case Detail
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                      {selected.transformerName || "Transformer alert"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {selected.message || selected.value || "Operational event"}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(getCaseStatus(selected))}`}>
                    {getCaseStatus(selected).replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SummaryTile label="Detected" value={formatDateTime(selected.createdAt)} />
                  <SummaryTile label="Last Action" value={formatDateTime(selected.lastActionAt)} />
                  <SummaryTile label="Depot" value={selected.depotName || (selected.depotId ? `Depot ${selected.depotId}` : "Unscoped")} />
                  <SummaryTile label="Supplier" value={selected.supplierName || selected.supplierCode || "ZESA"} />
                </div>

                <div className="rounded-[22px] border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <ShieldAlert className="h-4 w-4 text-blue-500" />
                    Response controls
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {CASE_ACTIONS.map((action) => (
                      <button
                        key={action.value}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setSelectedStatus(action.value);
                          void saveCaseUpdate(action.value);
                        }}
                        className="enterprise-chip inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:text-slate-950 disabled:opacity-60 dark:text-slate-200"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      value={assignedToName}
                      onChange={(event) => setAssignedToName(event.target.value)}
                      placeholder="Assignee name"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <input
                      value={assignedToEmail}
                      onChange={(event) => setAssignedToEmail(event.target.value)}
                      placeholder="Assignee email"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Operational note, call outcome, dispatch detail, or false alarm reason"
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveCaseUpdate()}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Save workflow update
                    </button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <History className="h-4 w-4 text-blue-500" />
                      Case timeline
                    </div>
                    {detailLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {timeline.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No timeline activity recorded yet.</p>
                    ) : (
                      timeline.map((entry) => (
                        <div key={entry.id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {entry.activityType.replaceAll("_", " ")}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(entry.createdAt)}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {entry.actorName || entry.actorEmail || "System"}
                          </p>
                          {entry.note ? (
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{entry.note}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <BellRing className="h-4 w-4 text-blue-500" />
                      Recipient audit
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {deliverySummary.delivered}/{deliverySummary.total} delivered
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No notification delivery records linked to this alert yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${channelTone(notification.channel)}`}>
                              {notification.channel || "CHANNEL"}
                            </span>
                            <span className={`text-xs font-semibold ${deliveryTone(notification.deliveryStatus || notification.providerStatus)}`}>
                              {notification.deliveryStatus || notification.providerStatus || "PENDING"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                            {notification.recipientName || "Recipient"}
                          </p>
                          <p className="mt-1 break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {notification.recipientAddress || "No address"}
                          </p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Created {formatDateTime(notification.creationTimestamp)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
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
      className={`enterprise-chip rounded-full px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
          : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
  tone: "red" | "amber" | "blue" | "emerald" | "slate";
}) {
  const toneClasses = {
    red: "bg-red-50 text-red-600 dark:bg-red-500/14 dark:text-red-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  }[tone];

  return (
    <div className="enterprise-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {value.toLocaleString()}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${toneClasses}`}>{icon}</div>
      </div>
    </div>
  );
}

function MetaBlock({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
