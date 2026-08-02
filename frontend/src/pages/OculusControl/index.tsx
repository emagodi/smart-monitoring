import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import {
  Activity,
  Eye,
  Globe,
  Loader2,
  Lock,
  MapPinned,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/button/Button";
import Alert from "../../components/ui/alert/Alert";
import { Modal } from "../../components/ui/modal";

type ControlFilter = "all" | "ARMED" | "DISARMED" | "UNKNOWN" | "ONLINE" | "OFFLINE";

type OculusTransformerControl = {
  transformerId: number;
  transformerName: string;
  transformerType?: "GMT" | "PMT" | string | null;
  depotId?: number | null;
  controllerCount?: number | null;
  controllerId?: number | null;
  controllerName?: string | null;
  controllerDevEui?: string | null;
  controllerType?: string | null;
  controlAvailable?: boolean | null;
  availabilityReason?: string | null;
  armState?: "ARMED" | "DISARMED" | "UNKNOWN" | null;
  armed?: boolean | null;
  effectiveArmState?: "ARMED" | "DISARMED" | "UNKNOWN" | null;
  effectiveArmed?: boolean | null;
  effectiveStateSource?: "COMMAND" | "TELEMETRY" | null;
  confirmationStatus?:
    | "NO_COMMAND"
    | "COMMAND_FAILED"
    | "SENDING_COMMAND"
    | "CONFIRMED"
    | "TELEMETRY_MISMATCH"
    | "PENDING_KEEPALIVE"
    | "KEEPALIVE_OVERDUE"
    | null;
  controllerStatus?: "ONLINE" | "DELAYED" | "OFFLINE" | "NO_KEEPALIVE" | null;
  minutesSinceLastTelemetry?: number | null;
  motionDetected?: boolean | null;
  motionStatusLabel?: string | null;
  secondaryAlertDetected?: boolean | null;
  secondaryAlertLabel?: string | null;
  secondaryAlertStatusLabel?: string | null;
  activeAlertSummary?: string | null;
  lastTelemetryAt?: string | null;
  lastCommandAction?: string | null;
  lastCommandStatus?: string | null;
  lastCommandAt?: string | null;
  lastCommandRequestedBy?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
};

type Region = {
  id: number;
  name: string;
  districts?: District[];
};

type District = {
  id: number;
  name: string;
};

type Depot = {
  id: number;
  name: string;
  districtId?: number;
};

type EnrichedControlRow = OculusTransformerControl & {
  regionName: string;
  districtName: string;
  depotName: string;
};

type OculusControlActionResponse = {
  transformerId?: number;
  targetState?: "ARMED" | "DISARMED" | null;
  commandStatus?: "PENDING" | "SENT" | "FAILED" | null;
  requestedAt?: string | null;
  requestedBy?: string | null;
  message?: string | null;
  transformerName?: string | null;
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

const formatDateTime = (value?: string | null) => {
  if (!value) return "No telemetry yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const statusTone = (armState?: string | null) => {
  if (armState === "ARMED") return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  if (armState === "DISARMED") return "border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-100 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
};

const commandTone = (status?: string | null) => {
  if (status === "SENT") return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  if (status === "FAILED") return "border border-red-200 bg-gradient-to-r from-red-50 to-rose-100 text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  if (status === "PENDING") return "border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-100 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
};

const parseDateValue = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getCommandTargetState = (row?: OculusTransformerControl | null): "ARMED" | "DISARMED" | null => {
  if (!row) return null;
  if (row.lastCommandAction === "ARM") return "ARMED";
  if (row.lastCommandAction === "DISARM") return "DISARMED";
  return null;
};

const getEffectiveArmState = (row?: OculusTransformerControl | null) =>
  row?.effectiveArmState || row?.armState || "UNKNOWN";

const isAwaitingTelemetryConfirmation = (row?: OculusTransformerControl | null) => {
  return row?.confirmationStatus === "PENDING_KEEPALIVE" || row?.confirmationStatus === "KEEPALIVE_OVERDUE" || row?.confirmationStatus === "SENDING_COMMAND";
};

const getConfirmationStatusLabel = (row?: OculusTransformerControl | null) => {
  switch (row?.confirmationStatus) {
    case "COMMAND_FAILED":
      return "Command Failed";
    case "SENDING_COMMAND":
      return "Sending Command";
    case "PENDING_KEEPALIVE":
      return "Pending Keepalive";
    case "KEEPALIVE_OVERDUE":
      return "Keepalive Overdue";
    case "TELEMETRY_MISMATCH":
      return "Telemetry Mismatch";
    case "CONFIRMED":
      return "Confirmed";
    default:
      return "No Pending Command";
  }
};

const confirmationTone = (row?: OculusTransformerControl | null) => {
  switch (row?.confirmationStatus) {
    case "CONFIRMED":
      return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
    case "PENDING_KEEPALIVE":
    case "SENDING_COMMAND":
      return "border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-100 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
    case "KEEPALIVE_OVERDUE":
      return "border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-100 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
    case "COMMAND_FAILED":
    case "TELEMETRY_MISMATCH":
      return "border border-red-200 bg-gradient-to-r from-red-50 to-rose-100 text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  }
  return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
};

const controllerStatusTone = (status?: string | null) => {
  if (status === "ONLINE") return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.08)]";
  if (status === "DELAYED") return "border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-100 text-amber-700 shadow-[0_6px_16px_rgba(245,158,11,0.08)]";
  if (status === "OFFLINE") return "border border-red-200 bg-gradient-to-r from-red-50 to-rose-100 text-red-700 shadow-[0_6px_16px_rgba(239,68,68,0.08)]";
  return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[0_6px_16px_rgba(100,116,139,0.08)]";
};

const controllerStatusLabel = (status?: string | null) => {
  if (status === "ONLINE") return "Online";
  if (status === "DELAYED") return "Delayed";
  if (status === "OFFLINE") return "Offline";
  return "No Keepalive";
};

const armStateLabel = (state?: string | null) => {
  if (state === "ARMED") return "Armed";
  if (state === "DISARMED") return "Disarmed";
  return "Unknown";
};

const armStateTone = (state?: string | null) => {
  if (state === "ARMED") return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  if (state === "DISARMED") return "border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-100 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
};

const commandTargetLabel = (state?: "ARMED" | "DISARMED" | null) => {
  if (state === "ARMED") return "Arm Requested";
  if (state === "DISARMED") return "Disarm Requested";
  return "No Command Target";
};

const effectiveStateSourceLabel = (source?: "COMMAND" | "TELEMETRY" | null) => {
  if (source === "COMMAND") return "Source: latest command";
  if (source === "TELEMETRY") return "Source: confirmed telemetry";
  return "Source: no confirmed telemetry";
};

const transformerTypeTone = (transformerType?: string | null) => {
  if (transformerType === "GMT") return "border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-100 text-indigo-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  if (transformerType === "PMT") return "border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-100 text-cyan-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
};

const signalTone = (active?: boolean | null) => {
  if (active == null) return "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  if (active) return "border border-red-200 bg-gradient-to-r from-red-50 to-rose-100 text-red-700 shadow-[0_6px_16px_rgba(239,68,68,0.08)]";
  return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.08)]";
};

const activeAlertSummaryTone = (summary?: string | null) => {
  if (!summary || summary === "No active intrusion alerts") return "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.08)]";
  return "border border-red-200 bg-gradient-to-r from-red-50 to-rose-100 text-red-700 shadow-[0_6px_16px_rgba(239,68,68,0.08)]";
};

const secondarySignalColumnLabel = (transformerType?: string | null) => {
  if (transformerType === "GMT") return "Door Open";
  if (transformerType === "PMT") return "Vibration";
  return "Door / Vibration";
};

export default function OculusControlIndex() {
  const { token, user } = useAuth();
  const initialLoadTokenRef = useRef<string | null>(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
  const isOculusSupplier = (user?.supplierCode || "").toLowerCase() === "oculus";
  const canAccess = !isSupplierUser || isOculusSupplier;

  const [rows, setRows] = useState<OculusTransformerControl[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [armStateFilter, setArmStateFilter] = useState<ControlFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<EnrichedControlRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const fetchControlRows = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);
      const [controlsRes, regionsRes, depotsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/oculus-control/transformers`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/regions`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }),
      ]);
      setRows(normalizeList<OculusTransformerControl>(controlsRes.data));
      setRegions(normalizeList<Region>(regionsRes.data));
      setDepots(normalizeList<Depot>(depotsRes.data));
    } catch (fetchError: any) {
      console.error(fetchError);
      setError(fetchError?.response?.data?.message || "Failed to load Oqulus control transformers.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (!token || !canAccess) {
      initialLoadTokenRef.current = null;
      return;
    }

    if (initialLoadTokenRef.current === token) return;
    initialLoadTokenRef.current = token;
    void fetchControlRows();
  }, [canAccess, fetchControlRows, token]);

  useEffect(() => {
    if (!rows.some(isAwaitingTelemetryConfirmation)) {
      return;
    }

    const interval = window.setInterval(() => {
      fetchControlRows(false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [fetchControlRows, rows]);

  const enrichedRows = useMemo<EnrichedControlRow[]>(() => {
    const depotById = new Map<number, Depot>();
    depots.forEach((depot) => depotById.set(depot.id, depot));

    const districtById = new Map<number, District>();
    const regionByDistrictId = new Map<number, string>();
    regions.forEach((region) => {
      (region.districts || []).forEach((district) => {
        districtById.set(district.id, district);
        regionByDistrictId.set(district.id, region.name);
      });
    });

    return rows.map((row) => {
      const depot = typeof row.depotId === "number" ? depotById.get(row.depotId) : undefined;
      const district = depot?.districtId ? districtById.get(depot.districtId) : undefined;
      return {
        ...row,
        regionName: district?.id ? regionByDistrictId.get(district.id) || "Unassigned Region" : "Unassigned Region",
        districtName: district?.name || "Unassigned District",
        depotName: depot?.name || "Unassigned Depot",
      };
    });
  }, [depots, regions, rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enrichedRows.filter((row) => {
      const matchesArmState =
        armStateFilter === "all"
          ? true
          : armStateFilter === "ONLINE"
            ? row.controllerStatus === "ONLINE"
            : armStateFilter === "OFFLINE"
              ? row.controllerStatus === "OFFLINE"
            : getEffectiveArmState(row) === armStateFilter;
      const matchesQuery =
        !query ||
        `${row.transformerName || ""} ${row.transformerType || ""} ${row.regionName} ${row.districtName} ${row.depotName} ${row.controllerName || ""} ${row.controllerDevEui || ""}`
          .toLowerCase()
          .includes(query);
      return matchesArmState && matchesQuery;
    });
  }, [armStateFilter, enrichedRows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const armed = rows.filter((row) => getEffectiveArmState(row) === "ARMED").length;
    const disarmed = rows.filter((row) => getEffectiveArmState(row) === "DISARMED").length;
    const unknown = Math.max(total - armed - disarmed, 0);
    const pending = rows.filter(isAwaitingTelemetryConfirmation).length;
    const online = rows.filter((row) => row.controllerStatus === "ONLINE").length;
    const offline = rows.filter((row) => row.controllerStatus === "OFFLINE").length;
    const unavailable = rows.filter((row) => !row.controlAvailable).length;
    const overdue = rows.filter((row) => row.confirmationStatus === "KEEPALIVE_OVERDUE").length;
    return { total, armed, disarmed, unknown, pending, online, offline, unavailable, overdue };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, armStateFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      setSelectedRow(null);
      return;
    }

    if (!selectedRow) {
      setSelectedRow(filteredRows[0]);
      return;
    }

    const refreshedSelection = filteredRows.find((row) => row.transformerId === selectedRow.transformerId);
    if (refreshedSelection) {
      if (refreshedSelection !== selectedRow) {
        setSelectedRow(refreshedSelection);
      }
      return;
    }

    setSelectedRow(filteredRows[0]);
  }, [filteredRows, selectedRow]);

  const applyOptimisticCommandState = useCallback(
    (transformerId: number, action: "arm" | "disarm", data?: OculusControlActionResponse) => {
      const targetState = data?.targetState || (action === "arm" ? "ARMED" : "DISARMED");
      const commandStatus = data?.commandStatus || "SENT";
      const requestedAt = data?.requestedAt || new Date().toISOString();

      setRows((currentRows) =>
        currentRows.map((row) => {
          if (row.transformerId !== transformerId) {
            return row;
          }

          return {
            ...row,
            effectiveArmState: targetState,
            effectiveArmed: targetState === "ARMED",
            effectiveStateSource: "COMMAND",
            confirmationStatus: commandStatus === "FAILED" ? "COMMAND_FAILED" : commandStatus === "PENDING" ? "SENDING_COMMAND" : "PENDING_KEEPALIVE",
            lastCommandAction: action === "arm" ? "ARM" : "DISARM",
            lastCommandStatus: commandStatus,
            lastCommandAt: requestedAt,
            lastCommandRequestedBy: data?.requestedBy || row.lastCommandRequestedBy,
          };
        })
      );
    },
    []
  );

  const sendCommand = useCallback(
    async (transformerId: number, action: "arm" | "disarm") => {
      try {
        setError(null);
        setSuccess(null);
        setActiveCommand(`${transformerId}:${action}`);
        const response = await axios.post(
          `${API_BASE_URL}/api/v1/oculus-control/transformers/${transformerId}/${action}`,
          {},
          { headers }
        );
        const data = response.data as OculusControlActionResponse;
        applyOptimisticCommandState(transformerId, action, data);
        setSuccess(
          data?.message ||
            `${action === "arm" ? "Arm" : "Disarm"} command sent. Operator state updates immediately while telemetry confirmation follows on the next keepalive.`
        );
        await fetchControlRows(false);
      } catch (commandError: any) {
        console.error(commandError);
        setError(commandError?.response?.data?.message || `Failed to ${action} transformer.`);
      } finally {
        setActiveCommand(null);
      }
    },
    [API_BASE_URL, applyOptimisticCommandState, fetchControlRows, headers]
  );

  if (!canAccess) {
    return (
      <Alert
        variant="warning"
        title="Oqulus Control"
        message="This control page is only available for the Oqulus supplier workspace."
      />
    );
  }

  const selectedEffectiveState = getEffectiveArmState(selectedRow || undefined);
  const selectedCommandTarget = selectedRow ? getCommandTargetState(selectedRow) : null;
  const selectedAwaitingConfirmation = selectedRow ? isAwaitingTelemetryConfirmation(selectedRow) : false;
  const filterCounts = {
    all: stats.total,
    ARMED: stats.armed,
    DISARMED: stats.disarmed,
    UNKNOWN: stats.unknown,
    ONLINE: stats.online,
    OFFLINE: stats.offline,
  } as const;
  const disableSelectedArm =
    !selectedRow ||
    !selectedRow.controlAvailable ||
    activeCommand === `${selectedRow.transformerId}:disarm` ||
    selectedEffectiveState === "ARMED";
  const disableSelectedDisarm =
    !selectedRow ||
    !selectedRow.controlAvailable ||
    activeCommand === `${selectedRow.transformerId}:arm` ||
    selectedEffectiveState === "DISARMED";

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Oqulus Control</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950 md:text-2xl">Enterprise arming control workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review Oqulus-monitored transformers, compare operator state with confirmed telemetry, and send Loriot arm or disarm commands without losing command context.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Monitored</span>
              <span className="mt-1 block font-semibold text-slate-900">{filteredRows.length.toLocaleString()}</span>
            </div>
            <Button onClick={() => void fetchControlRows()} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh Control List
            </Button>
          </div>
        </div>
      </section>

      {error ? <Alert variant="error" title="Oqulus Control" message={error} /> : null}
      {success ? <Alert variant="success" title="Oqulus Control" message={success} /> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Monitored" value={stats.total} helper="Oqulus transformers in scope" tone="slate" icon={<Shield className="h-5 w-5" />} />
        <StatCard title="Armed now" value={stats.armed} helper={`${stats.disarmed} disarmed posture`} tone="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard
          title="Pending confirmation"
          value={stats.pending}
          helper={`${stats.overdue} keepalive overdue`}
          tone="blue"
          icon={<Radio className="h-5 w-5" />}
        />
        <StatCard
          title="Controllers online"
          value={stats.online}
          helper={`${stats.unavailable} unavailable for control`}
          tone="amber"
          icon={<Activity className="h-5 w-5" />}
        />
      </section>

      <section className="flex flex-col gap-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Summary Rail */}
          <div className="enterprise-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Summary Rail
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Control posture snapshot
                </h3>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Armed posture</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.armed}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Disarmed posture</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.disarmed}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Unknown posture</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.unknown}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Pending confirmation</p>
                <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">{stats.pending}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Unavailable controls</p>
                <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">{stats.unavailable}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Online controllers</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">{stats.online}</p>
              </div>
            </div>
          </div>

          {/* Selected Asset */}
          <div className="enterprise-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Selected Asset
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Focused control context
                </h3>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <MapPinned className="h-4 w-4" />
              </div>
            </div>

            {selectedRow ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">{selectedRow.transformerName}</p>
                    <div className="mt-1 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className={`h-2 w-2 rounded-full ${armStateDot(selectedEffectiveState)}`} />
                      {selectedEffectiveState === "ARMED"
                        ? "Armed now"
                        : selectedEffectiveState === "DISARMED"
                          ? "Disarmed now"
                          : "Unknown posture"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon={<Eye className="h-4 w-4" />}
                    onClick={() => setShowDetails(true)}
                  >
                    Details
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Transformer Type</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedRow.transformerType || "Unspecified"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Motion</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedRow.motionStatusLabel || "No motion telemetry"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Telemetry</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedRow.minutesSinceLastTelemetry != null ? `${selectedRow.minutesSinceLastTelemetry}m ago` : "None"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pending Status</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{getConfirmationStatusLabel(selectedRow)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <PremiumActionButton
                    className="flex-1"
                    tone="arm"
                    icon={<Lock className="h-4 w-4" />}
                    disabled={disableSelectedArm}
                    loading={activeCommand === `${selectedRow.transformerId}:arm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "arm")}
                  >
                    Arm
                  </PremiumActionButton>
                  <PremiumActionButton
                    className="flex-1"
                    tone="disarm"
                    icon={<Unlock className="h-4 w-4" />}
                    disabled={disableSelectedDisarm}
                    loading={activeCommand === `${selectedRow.transformerId}:disarm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "disarm")}
                  >
                    Disarm
                  </PremiumActionButton>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Select a transformer to inspect command posture.
              </div>
            )}
          </div>
        </div>

        {/* Main Table Card */}
        <div className="enterprise-card flex min-h-[600px] flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.10)] ring-1 ring-blue-100/40">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400" />
          <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_42%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.94))] px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <FilterButton active={armStateFilter === "all"} onClick={() => setArmStateFilter("all")} label="All" count={filterCounts.all} tone="slate" />
                <FilterButton active={armStateFilter === "ARMED"} onClick={() => setArmStateFilter("ARMED")} label="Armed" count={filterCounts.ARMED} tone="emerald" />
                <FilterButton active={armStateFilter === "DISARMED"} onClick={() => setArmStateFilter("DISARMED")} label="Disarmed" count={filterCounts.DISARMED} tone="amber" />
                <FilterButton active={armStateFilter === "UNKNOWN"} onClick={() => setArmStateFilter("UNKNOWN")} label="Unknown" count={filterCounts.UNKNOWN} tone="slate" />
                <FilterButton active={armStateFilter === "ONLINE"} onClick={() => setArmStateFilter("ONLINE")} label="Online" count={filterCounts.ONLINE} tone="emerald" />
                <FilterButton active={armStateFilter === "OFFLINE"} onClick={() => setArmStateFilter("OFFLINE")} label="Offline" count={filterCounts.OFFLINE} tone="amber" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search transformer, location, controller..."
                    className="w-full rounded-2xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading Oqulus control transformers...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1180px]">
                  <thead className="border-b border-slate-200 bg-[linear-gradient(90deg,rgba(15,23,42,0.04),rgba(37,99,235,0.07),rgba(6,182,212,0.05))]">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Transformer</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Controller</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Motion</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Vibration / Door</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.92))]">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                          No Oqulus-monitored transformers found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => {
                        const effectiveArmState = getEffectiveArmState(row);
                        const disableArm =
                          !row.controlAvailable ||
                          activeCommand === `${row.transformerId}:disarm` ||
                          effectiveArmState === "ARMED";
                        const disableDisarm =
                          !row.controlAvailable ||
                          activeCommand === `${row.transformerId}:arm` ||
                          effectiveArmState === "DISARMED";

                        return (
                          <tr
                            key={row.transformerId}
                            onClick={() => setSelectedRow(row)}
                            className={`group cursor-pointer transition-all duration-200 hover:bg-[linear-gradient(90deg,rgba(239,246,255,0.9),rgba(248,250,252,0.96))] hover:shadow-[inset_4px_0_0_rgba(37,99,235,0.55)] ${
                              selectedRow?.transformerId === row.transformerId
                                ? "bg-[linear-gradient(90deg,rgba(219,234,254,0.85),rgba(255,255,255,0.98),rgba(236,254,255,0.9))] shadow-[inset_4px_0_0_rgba(37,99,235,1)]"
                                : "bg-white"
                            }`}
                          >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900">{row.transformerName}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${transformerTypeTone(row.transformerType)}`}>
                                  {row.transformerType || "Unspecified"}
                                </span>
                                <span className="text-xs text-slate-500">{row.controllerCount || 0} Oqulus controller(s)</span>
                              </div>
                              <div className="mt-2">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activeAlertSummaryTone(row.activeAlertSummary)}`}>
                                  {row.activeAlertSummary || "No active intrusion alerts"}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <div className="space-y-2">
                                <div className="font-mono text-xs text-slate-500">{row.controllerDevEui || "-"}</div>
                                <div>
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${controllerStatusTone(row.controllerStatus)}`}>
                                    {controllerStatusLabel(row.controllerStatus)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {row.minutesSinceLastTelemetry != null
                                    ? `Last keepalive ${row.minutesSinceLastTelemetry} min ago`
                                    : "No keepalive received yet"}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${signalTone(row.motionDetected)}`}>
                                {row.motionStatusLabel || "No motion telemetry"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <div>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${signalTone(row.secondaryAlertDetected)}`}>
                                  {row.secondaryAlertStatusLabel || "No secondary telemetry"}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedRow(row);
                                    setShowDetails(true);
                                  }}
                                  className="inline-flex h-10 items-center gap-2 rounded-full border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-100 px-3.5 text-xs font-semibold text-blue-700 shadow-[0_10px_24px_rgba(37,99,235,0.16)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:from-blue-100 hover:to-cyan-100 hover:text-blue-800"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Details
                                </button>
                                <PremiumActionButton
                                  tone="arm"
                                  icon={<Lock className="h-4 w-4" />}
                                  disabled={disableArm}
                                  loading={activeCommand === `${row.transformerId}:arm`}
                                  onClick={() => {
                                    setSelectedRow(row);
                                    void sendCommand(row.transformerId, "arm");
                                  }}
                                >
                                  Arm
                                </PremiumActionButton>
                                <PremiumActionButton
                                  tone="disarm"
                                  icon={<Unlock className="h-4 w-4" />}
                                  disabled={disableDisarm}
                                  loading={activeCommand === `${row.transformerId}:disarm`}
                                  onClick={() => {
                                    setSelectedRow(row);
                                    void sendCommand(row.transformerId, "disarm");
                                  }}
                                >
                                  Disarm
                                </PremiumActionButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,0.95))] px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Showing <span className="font-medium text-slate-900">{filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-medium text-slate-900">{Math.min(page * pageSize, filteredRows.length)}</span> of{" "}
                    <span className="font-medium text-slate-900">{filteredRows.length}</span> Oqulus transformers
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                      Previous
                    </Button>
                    <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">{page}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        variant="center"
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-[860px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl"
        backdropBlur={true}
      >
        <div className="flex max-h-[90vh] min-h-0 flex-col bg-white">
          <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Control Detail</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950 md:text-lg">{selectedRow?.transformerName || "Oqulus transformer"}</h3>
                  <p className="mt-1 text-xs text-slate-500 md:text-sm">
                    {selectedRow
                      ? `${selectedRow.regionName} / ${selectedRow.districtName} / ${selectedRow.depotName}`
                      : "Centered modal for control, telemetry, and alert posture."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5">
            {selectedRow ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Overview</p>
                      <h4 className="mt-1 text-sm font-semibold text-slate-950">Current control posture</h4>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                      {selectedRow.controllerName || "No linked controller"}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <StatCard
                    title="Effective posture"
                    valueLabel={selectedEffectiveState}
                    helper={selectedRow.effectiveStateSource === "COMMAND" ? "Derived from latest command" : "Derived from telemetry"}
                    tone="emerald"
                    icon={<ShieldCheck className="h-5 w-5" />}
                    compact
                  />
                  <StatCard
                    title="Confirmed telemetry"
                    valueLabel={selectedRow.armState || "UNKNOWN"}
                    helper={selectedRow.lastTelemetryAt ? formatDateTime(selectedRow.lastTelemetryAt) : "No telemetry yet"}
                    tone="slate"
                    icon={<Radio className="h-5 w-5" />}
                    compact
                  />
                  <StatCard
                    title="Pending status"
                    valueLabel={getConfirmationStatusLabel(selectedRow)}
                    helper={selectedRow.lastCommandStatus || "No command"}
                    tone="blue"
                    icon={<Activity className="h-5 w-5" />}
                    compact
                  />
                  <StatCard
                    title="Controller health"
                    valueLabel={controllerStatusLabel(selectedRow.controllerStatus)}
                    helper={
                      selectedRow.minutesSinceLastTelemetry != null
                        ? `${selectedRow.minutesSinceLastTelemetry} minutes since keepalive`
                        : "No keepalive received"
                    }
                    tone="amber"
                    icon={<MapPinned className="h-5 w-5" />}
                    compact
                  />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <SectionCard
                      label="Location Mapping"
                      title="Asset context"
                      tone="blue"
                      contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      <DetailField label="Region" value={selectedRow.regionName} />
                      <DetailField label="District" value={selectedRow.districtName} />
                      <DetailField label="Depot" value={selectedRow.depotName} />
                      <DetailField label="Controller" value={selectedRow.controllerName || "No linked controller"} />
                      <DetailField label="Controller DevEUI" value={selectedRow.controllerDevEui || "Unavailable"} />
                      <DetailField label="Transformer type" value={selectedRow.transformerType || "Unspecified"} />
                      <DetailField label="Supplier" value={selectedRow.supplierName || selectedRow.supplierCode || "Oqulus"} />
                      <DetailField label="Controller type" value={selectedRow.controllerType || "Unavailable"} />
                    </SectionCard>

                    <SectionCard
                      label="Intrusion Signals"
                      title="Field telemetry"
                      tone="amber"
                      contentClassName="space-y-3"
                    >
                        <StatusLine label="Motion" value={selectedRow.motionStatusLabel || "No motion telemetry"} dotClass={signalDot(selectedRow.motionDetected)} />
                        <StatusLine
                          label={secondarySignalColumnLabel(selectedRow.transformerType)}
                          value={selectedRow.secondaryAlertStatusLabel || "No secondary telemetry"}
                          dotClass={signalDot(selectedRow.secondaryAlertDetected)}
                        />
                        <DetailRow label="Signal note" value={selectedRow.secondaryAlertLabel || selectedRow.activeAlertSummary || "No active intrusion alerts"} />
                    </SectionCard>
                  </div>

                  <SectionCard
                    label="Command Lifecycle"
                    title="Control and audit trail"
                    tone="violet"
                    contentClassName="space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3">
                      <StatusLine
                        label="Effective control state"
                        value={selectedEffectiveState}
                        dotClass={armStateDot(selectedEffectiveState)}
                      />
                      <StatusLine
                        label="Command target state"
                        value={selectedCommandTarget || "No command target"}
                        dotClass={armStateDot(selectedCommandTarget)}
                      />
                      <StatusLine
                        label="Pending or confirmed status"
                        value={getConfirmationStatusLabel(selectedRow)}
                        dotClass={confirmationDot(selectedRow)}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <DetailRow label="Last command action" value={selectedRow.lastCommandAction || "No command sent"} />
                      <DetailRow label="Last command timestamp" value={formatDateTime(selectedRow.lastCommandAt)} />
                      <DetailRow label="Requested by" value={selectedRow.lastCommandRequestedBy || "Unavailable"} />
                      <DetailRow label="Availability note" value={selectedRow.controlAvailable ? "Control ready" : selectedRow.availabilityReason || "Unavailable"} />
                      <DetailRow
                        label="Workflow note"
                        value={
                          selectedAwaitingConfirmation
                            ? "Operator posture has updated and is waiting for keepalive confirmation."
                            : "Telemetry and operator posture are aligned or no command is pending."
                        }
                      />
                    </div>
                  </SectionCard>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-16 text-center text-sm text-slate-500">
                Select a transformer from the control table to inspect detail.
              </div>
            )}
          </div>
          {selectedRow ? (
            <div className="border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-sm">
              <div className="flex justify-end">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button size="xs" variant="outline" onClick={() => setShowDetails(false)}>
                    Close
                  </Button>
                  <PremiumActionButton
                    tone="arm"
                    icon={<Lock className="h-4 w-4" />}
                    disabled={disableSelectedArm}
                    loading={activeCommand === `${selectedRow.transformerId}:arm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "arm")}
                  >
                    Arm Transformer
                  </PremiumActionButton>
                  <PremiumActionButton
                    tone="disarm"
                    icon={<Unlock className="h-4 w-4" />}
                    disabled={disableSelectedDisarm}
                    loading={activeCommand === `${selectedRow.transformerId}:disarm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "disarm")}
                  >
                    Disarm Transformer
                  </PremiumActionButton>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  tone = "slate",
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  tone?: "slate" | "emerald" | "amber";
  onClick: () => void;
}) {
  const activeToneMap = {
    slate: "border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)]",
    emerald: "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)]",
    amber: "border-amber-400 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-[0_10px_24px_rgba(245,158,11,0.28)]",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? activeToneMap[tone]
          : "border-slate-200 bg-white text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
      {typeof count === "number" ? (
        <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? "bg-white/20 text-inherit" : "bg-slate-100 text-slate-600"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function PremiumActionButton({
  children,
  icon,
  onClick,
  disabled = false,
  loading = false,
  tone,
  className = "",
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone: "arm" | "disarm";
  className?: string;
}) {
  const toneClass =
    tone === "arm"
      ? "border-blue-300 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_12px_26px_rgba(37,99,235,0.30)] hover:from-blue-700 hover:to-cyan-600"
      : "border-red-200 bg-gradient-to-r from-red-50 to-rose-100 text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.14)] hover:border-red-300 hover:from-red-100 hover:to-rose-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
        disabled || loading ? "cursor-not-allowed opacity-50" : `hover:-translate-y-0.5 ${toneClass}`
      } ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="flex items-center">{icon}</span>
      )}
      {children}
    </button>
  );
}

function StatCard({
  title,
  value,
  valueLabel,
  helper,
  tone,
  icon,
  compact = false,
}: {
  title: string;
  value: number;
  valueLabel?: string;
  helper?: string;
  tone: "slate" | "emerald" | "amber" | "blue";
  icon: ReactNode;
  compact?: boolean;
}) {
  const toneMap: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-slate-500`}>{title}</p>
          <p className={`mt-2 font-semibold text-slate-950 ${compact ? "text-[18px] leading-6 md:text-[19px]" : "text-3xl"}`}>
            {valueLabel ?? value.toLocaleString()}
          </p>
          {helper ? <p className={`${compact ? "mt-2 text-[11px] leading-4" : "mt-3 text-xs leading-5"} text-slate-500`}>{helper}</p> : null}
        </div>
        <div className={`rounded-2xl ${compact ? "p-2.5" : "p-3"} ${toneMap[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}

function RailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${tone === "warning" ? "text-amber-600" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="max-w-[62%] text-right text-sm font-semibold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function SectionCard({
  label,
  title,
  children,
  tone = "slate",
  contentClassName = "",
}: {
  label: string;
  title: string;
  children: ReactNode;
  tone?: "slate" | "blue" | "amber" | "violet";
  contentClassName?: string;
}) {
  const toneMap: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <h4 className="mt-1 text-sm font-semibold text-slate-950">{title}</h4>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneMap[tone]}`}>
          {tone}
        </span>
      </div>
      <div className={`mt-3 ${contentClassName}`}>{children}</div>
    </div>
  );
}

function StatusLine({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: string;
  dotClass: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3.5 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1.5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {value}
      </div>
    </div>
  );
}

function armStateDot(state?: string | null) {
  if (state === "ARMED") return "bg-emerald-500";
  if (state === "DISARMED") return "bg-amber-500";
  return "bg-slate-400";
}

function controllerStatusDot(status?: string | null) {
  if (status === "ONLINE") return "bg-emerald-500";
  if (status === "DELAYED") return "bg-amber-500";
  if (status === "OFFLINE") return "bg-red-500";
  return "bg-slate-400";
}

function signalDot(active?: boolean | null) {
  if (active == null) return "bg-slate-400";
  return active ? "bg-red-500" : "bg-emerald-500";
}

function confirmationDot(row: OculusTransformerControl) {
  switch (row.confirmationStatus) {
    case "CONFIRMED":
      return "bg-emerald-500";
    case "PENDING_KEEPALIVE":
    case "SENDING_COMMAND":
      return "bg-blue-500";
    case "KEEPALIVE_OVERDUE":
      return "bg-amber-500";
    case "COMMAND_FAILED":
    case "TELEMETRY_MISMATCH":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}
