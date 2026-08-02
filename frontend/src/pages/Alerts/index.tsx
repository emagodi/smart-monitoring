import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Eye,
  FileWarning,
  History,
  Loader2,
  Mail,
  MapPinned,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";
import { Modal } from "../../components/ui/modal";

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
    if (Array.isArray(value)) return value as T[];
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
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const getCaseStatus = (item: AlertItem): AlertCaseStatus => item.caseStatus || (item.isAlert ? "NEW" : "RESOLVED");

const summarizeScope = (supplierName?: string | null, depotId?: number | null) => {
  if (supplierName && depotId) return `${supplierName} · Depot ${depotId}`;
  if (supplierName) return supplierName;
  if (depotId) return `Depot ${depotId}`;
  return "National operations";
};

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
  if (normalized.includes("READ") || normalized.includes("DELIVERED")) return "text-emerald-600 dark:text-emerald-300";
  if (normalized.includes("FAILED")) return "text-red-600 dark:text-red-300";
  if (normalized.includes("SENT") || normalized.includes("ACCEPTED")) return "text-blue-600 dark:text-blue-300";
  return "text-slate-500 dark:text-slate-400";
};

const CASE_ACTIONS: Array<{ label: string; value: AlertCaseStatus; icon: ReactNode }> = [
  { label: "Acknowledge", value: "ACKNOWLEDGED", icon: <UserCheck className="h-3.5 w-3.5" /> },
  { label: "Dispatch", value: "DISPATCHED", icon: <Truck className="h-3.5 w-3.5" /> },
  { label: "Resolve", value: "RESOLVED", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { label: "False Alarm", value: "FALSE_ALARM", icon: <XCircle className="h-3.5 w-3.5" /> },
];

export default function AlertsIndex() {
  const { token, user } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  const [items, setItems] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [assignedToEmail, setAssignedToEmail] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AlertCaseStatus>("NEW");

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
        (item.assignedToEmail || "").toLowerCase().includes(query) ||
        (item.depotName || "").toLowerCase().includes(query) ||
        (item.supplierName || "").toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });
  }, [filterMode, items, search]);

  const stats = useMemo(() => {
    const statusCounts = {
      total: totalElements,
      openCases: 0,
      acknowledged: 0,
      dispatched: 0,
      resolved: 0,
      falseAlarm: 0,
      unassigned: 0,
    };

    items.forEach((item) => {
      const status = getCaseStatus(item);
      if (status === "NEW") statusCounts.openCases += 1;
      if (status === "ACKNOWLEDGED") statusCounts.acknowledged += 1;
      if (status === "DISPATCHED") statusCounts.dispatched += 1;
      if (status === "RESOLVED") statusCounts.resolved += 1;
      if (status === "FALSE_ALARM") statusCounts.falseAlarm += 1;
      if (!item.assignedToEmail && !item.assignedToName && status !== "RESOLVED" && status !== "FALSE_ALARM") {
        statusCounts.unassigned += 1;
      }
    });

    return statusCounts;
  }, [items, totalElements]);

  const deliverySummary = useMemo(() => {
    const delivered = notifications.filter((item) =>
      ["DELIVERED", "READ"].includes((item.deliveryStatus || "").toUpperCase())
    ).length;
    const failed = notifications.filter((item) =>
      (item.deliveryStatus || "").toUpperCase().includes("FAILED")
    ).length;
    return { total: notifications.length, delivered, failed };
  }, [notifications]);

  const openAlertModal = async (alert: AlertItem) => {
    setSelectedAlert(alert);
    setSelectedStatus(getCaseStatus(alert));
    setAssignedToEmail(alert.assignedToEmail || "");
    setAssignedToName(alert.assignedToName || "");
    setNote(alert.lastActionNote || "");
    setModalOpen(true);
    await fetchDetails(alert.id);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedAlert(null);
    setTimeline([]);
    setNotifications([]);
    setNote("");
    setAssignedToEmail("");
    setAssignedToName("");
    setSelectedStatus("NEW");
  };

  const saveCaseUpdate = async (statusOverride?: AlertCaseStatus) => {
    if (!selectedAlert) return;
    try {
      setSaving(true);
      const response = await axios.patch(
        `${API_BASE_URL}/api/v1/alerts/${selectedAlert.id}/case`,
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
      setSelectedAlert(updated);
      setSelectedStatus(getCaseStatus(updated));
      await fetchDetails(updated.id);
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to update the alert workflow.");
    } finally {
      setSaving(false);
    }
  };

  const pageStart = items.length === 0 ? 0 : page * pageSize + 1;
  const pageEnd = items.length === 0 ? 0 : page * pageSize + items.length;

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error" title="Alerts" message={error} /> : null}

      <section className="enterprise-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
              Alert Operations Desk
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              Compact response queue
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Scope: {summarizeScope(user?.supplierName, user?.depotId)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <InfoPill label="National total" value={stats.total.toLocaleString()} icon={<BellRing className="h-3.5 w-3.5" />} />
            <InfoPill label="On page" value={filtered.length.toLocaleString()} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
            <InfoPill label="Unassigned" value={stats.unassigned.toLocaleString()} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricTile label="Open" value={stats.openCases} tone="red" />
        <MetricTile label="Acknowledged" value={stats.acknowledged} tone="amber" />
        <MetricTile label="Dispatched" value={stats.dispatched} tone="blue" />
        <MetricTile label="Resolved" value={stats.resolved} tone="emerald" />
        <MetricTile label="False Alarm" value={stats.falseAlarm} tone="slate" />
        <MetricTile label="Visible Range" value={pageEnd === 0 ? "0" : `${pageStart}-${pageEnd}`} tone="blue" />
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Active Queue
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Click any alert row to open actions and detail in a modal
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterButton active={filterMode === "all"} label="All" onClick={() => setFilterMode("all")} />
                <FilterButton active={filterMode === "new"} label="New" onClick={() => setFilterMode("new")} />
                <FilterButton active={filterMode === "acknowledged"} label="Acknowledged" onClick={() => setFilterMode("acknowledged")} />
                <FilterButton active={filterMode === "dispatched"} label="Dispatched" onClick={() => setFilterMode("dispatched")} />
                <FilterButton active={filterMode === "resolved"} label="Resolved" onClick={() => setFilterMode("resolved")} />
                <FilterButton active={filterMode === "falseAlarm"} label="False Alarm" onClick={() => setFilterMode("falseAlarm")} />
                <FilterButton active={filterMode === "unassigned"} label="Unassigned" onClick={() => setFilterMode("unassigned")} />
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 xl:max-w-[540px]">
              <div className="enterprise-chip flex items-center gap-3 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transformer, device, assignee, depot..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Rows are paged from the backend. Detail, timeline, and recipient audit load only when opened.</span>
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-4 py-20 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span>Loading alert operations desk...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            No alerts found for the current workflow filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full">
              <thead className="bg-slate-50/80 dark:bg-slate-900/70">
                <tr className="text-left">
                  <Th>Status</Th>
                  <Th>Type</Th>
                  <Th>Transformer</Th>
                  <Th>Scope</Th>
                  <Th>Supplier</Th>
                  <Th>Device</Th>
                  <Th>Detected</Th>
                  <Th>Assigned</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const status = getCaseStatus(item);
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-t border-slate-200/80 text-xs transition hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-blue-500/5"
                      onClick={() => void openAlertModal(item)}
                    >
                      <Td>
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(status)}`}>
                          {status.replace("_", " ")}
                        </span>
                      </Td>
                      <Td>
                        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          <ShieldAlert className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-medium uppercase tracking-[0.14em]">{item.sensorType || "Alert"}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="max-w-[260px]">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.transformerName || "Unassigned transformer"}</p>
                          <p className="mt-1 line-clamp-2 text-slate-500 dark:text-slate-400">{item.message || item.value || "Operational event"}</p>
                        </div>
                      </Td>
                      <Td>
                        <div className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <MapPinned className="h-3.5 w-3.5 text-blue-500" />
                          <span>{item.depotName || (item.depotId ? `Depot ${item.depotId}` : "General")}</span>
                        </div>
                      </Td>
                      <Td>{item.supplierName || item.supplierCode || "ZESA"}</Td>
                      <Td>{item.deviceName || item.deviceId || "Unknown"}</Td>
                      <Td>{formatDateTime(item.createdAt)}</Td>
                      <Td>{item.assignedToName || item.assignedToEmail || "Unassigned"}</Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void openAlertModal(item);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Open
                        </button>
                      </Td>
                    </tr>
                  );
                })}
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
        isOpen={modalOpen}
        onClose={closeModal}
        className="max-w-6xl overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
        backdropBlur
      >
        {!selectedAlert ? null : (
          <div className="flex flex-col">
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Alert Case
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {selectedAlert.transformerName || "Transformer alert"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedAlert.message || selectedAlert.value || "Operational event"}
                  </p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(getCaseStatus(selectedAlert))}`}>
                  {getCaseStatus(selectedAlert).replace("_", " ")}
                </span>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryTile label="Detected" value={formatDateTime(selectedAlert.createdAt)} />
                <SummaryTile label="Last Action" value={formatDateTime(selectedAlert.lastActionAt)} />
                <SummaryTile label="Depot" value={selectedAlert.depotName || (selectedAlert.depotId ? `Depot ${selectedAlert.depotId}` : "Unscoped")} />
                <SummaryTile label="Supplier" value={selectedAlert.supplierName || selectedAlert.supplierCode || "ZESA"} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="rounded-[24px] border border-slate-200 p-4 dark:border-slate-800">
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
                        className="enterprise-chip inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium text-slate-700 transition hover:text-slate-950 disabled:opacity-60 dark:text-slate-200"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      value={assignedToName}
                      onChange={(event) => setAssignedToName(event.target.value)}
                      placeholder="Assignee name"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <input
                      value={assignedToEmail}
                      onChange={(event) => setAssignedToEmail(event.target.value)}
                      placeholder="Assignee email"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Operational note, call outcome, dispatch detail, or false alarm reason"
                    rows={4}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveCaseUpdate()}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Save update
                    </button>
                    {detailLoading ? (
                      <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading detail...
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <History className="h-4 w-4 text-blue-500" />
                      Case timeline
                    </div>
                    <div className="mt-3 space-y-3">
                      {timeline.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No timeline activity recorded yet.</p>
                      ) : (
                        timeline.map((entry) => (
                          <div key={entry.id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
                                {entry.activityType.replaceAll("_", " ")}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(entry.createdAt)}</p>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {entry.actorName || entry.actorEmail || "System"}
                            </p>
                            {entry.note ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{entry.note}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <BellRing className="h-4 w-4 text-blue-500" />
                        Recipient audit
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {deliverySummary.delivered}/{deliverySummary.total} delivered
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No notification delivery records linked to this alert yet.</p>
                      ) : (
                        notifications.map((notification) => (
                          <div key={notification.id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${channelTone(notification.channel)}`}>
                                {notification.channel || "CHANNEL"}
                              </span>
                              <span className={`text-[11px] font-semibold ${deliveryTone(notification.deliveryStatus || notification.providerStatus)}`}>
                                {notification.deliveryStatus || notification.providerStatus || "PENDING"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {notification.recipientName || "Recipient"}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                              {notification.recipientAddress || "No address"}
                            </p>
                            <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              {notification.channel === "EMAIL" ? <Mail className="h-3.5 w-3.5" /> : null}
                              {notification.channel === "SMS" ? <Smartphone className="h-3.5 w-3.5" /> : null}
                              {notification.channel === "WHATSAPP" ? <MessageSquareText className="h-3.5 w-3.5" /> : null}
                              Created {formatDateTime(notification.creationTimestamp)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

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

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
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
    <div className="enterprise-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        <span className={`inline-flex rounded-xl px-2.5 py-1 ${toneClasses}`}>{value}</span>
      </div>
    </div>
  );
}

function InfoPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
      {icon}
      <span className="font-medium">{label}:</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
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
