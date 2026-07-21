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

type ArmStateFilter = "all" | "ARMED" | "DISARMED" | "UNKNOWN";

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
  if (armState === "ARMED") return "bg-emerald-100 text-emerald-700";
  if (armState === "DISARMED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

const commandTone = (status?: string | null) => {
  if (status === "SENT") return "bg-emerald-100 text-emerald-700";
  if (status === "FAILED") return "bg-red-100 text-red-700";
  if (status === "PENDING") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
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
      return "bg-emerald-100 text-emerald-700";
    case "PENDING_KEEPALIVE":
    case "SENDING_COMMAND":
      return "bg-blue-100 text-blue-700";
    case "KEEPALIVE_OVERDUE":
      return "bg-amber-100 text-amber-700";
    case "COMMAND_FAILED":
    case "TELEMETRY_MISMATCH":
      return "bg-red-100 text-red-700";
  }
  return "bg-slate-100 text-slate-700";
};

const controllerStatusTone = (status?: string | null) => {
  if (status === "ONLINE") return "bg-emerald-100 text-emerald-700";
  if (status === "DELAYED") return "bg-amber-100 text-amber-700";
  if (status === "OFFLINE") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
};

const controllerStatusLabel = (status?: string | null) => {
  if (status === "ONLINE") return "Online";
  if (status === "DELAYED") return "Delayed";
  if (status === "OFFLINE") return "Offline";
  return "No Keepalive";
};

const transformerTypeTone = (transformerType?: string | null) => {
  if (transformerType === "GMT") return "bg-indigo-100 text-indigo-700";
  if (transformerType === "PMT") return "bg-cyan-100 text-cyan-700";
  return "bg-slate-100 text-slate-700";
};

const signalTone = (active?: boolean | null) => {
  if (active == null) return "bg-slate-100 text-slate-700";
  if (active) return "bg-red-100 text-red-700";
  return "bg-emerald-100 text-emerald-700";
};

const activeAlertSummaryTone = (summary?: string | null) => {
  if (!summary || summary === "No active intrusion alerts") return "bg-emerald-100 text-emerald-700";
  return "bg-red-100 text-red-700";
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
  const [armStateFilter, setArmStateFilter] = useState<ArmStateFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<EnrichedControlRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdvancedAudit, setShowAdvancedAudit] = useState(false);

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
      setError(fetchError?.response?.data?.message || "Failed to load Oculus control transformers.");
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
      const matchesArmState = armStateFilter === "all" ? true : getEffectiveArmState(row) === armStateFilter;
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
    const unavailable = rows.filter((row) => !row.controlAvailable).length;
    const overdue = rows.filter((row) => row.confirmationStatus === "KEEPALIVE_OVERDUE").length;
    return { total, armed, disarmed, unknown, pending, online, unavailable, overdue };
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

  useEffect(() => {
    setShowAdvancedAudit(false);
  }, [showDetails, selectedRow?.transformerId]);

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
        title="Oculus Control"
        message="This control page is only available for the Oculus supplier workspace."
      />
    );
  }

  const selectedEffectiveState = getEffectiveArmState(selectedRow || undefined);
  const selectedCommandTarget = selectedRow ? getCommandTargetState(selectedRow) : null;
  const selectedAwaitingConfirmation = selectedRow ? isAwaitingTelemetryConfirmation(selectedRow) : false;
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Oculus Control</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950 md:text-2xl">Enterprise arming control workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review Oculus-monitored transformers, compare operator state with confirmed telemetry, and send Loriot arm or disarm commands without losing command context.
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

      {error ? <Alert variant="error" title="Oculus Control" message={error} /> : null}
      {success ? <Alert variant="success" title="Oculus Control" message={success} /> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Monitored" value={stats.total} helper="Oculus transformers in scope" tone="slate" icon={<Shield className="h-5 w-5" />} />
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
                    <p className="text-xs text-slate-500 dark:text-slate-400">Location</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedRow.districtName}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Controller</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedRow.controllerName || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Telemetry</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedRow.minutesSinceLastTelemetry != null ? `${selectedRow.minutesSinceLastTelemetry}m ago` : "None"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Target</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedCommandTarget || "None"}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="outline"
                    startIcon={<Lock className="h-4 w-4" />}
                    disabled={disableSelectedArm}
                    isLoading={activeCommand === `${selectedRow.transformerId}:arm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "arm")}
                  >
                    Arm
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    variant="secondary"
                    startIcon={<Unlock className="h-4 w-4" />}
                    disabled={disableSelectedDisarm}
                    isLoading={activeCommand === `${selectedRow.transformerId}:disarm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "disarm")}
                  >
                    Disarm
                  </Button>
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
        <div className="enterprise-card flex min-h-[600px] flex-col overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Control Directory</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 md:text-base">Premium table shell for command-ready assets</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Row selection drives the summary rail and the centered detail modal while preserving the existing command and telemetry workflow.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search transformer, location, controller..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value={10}>10 rows</option>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterButton active={armStateFilter === "all"} onClick={() => setArmStateFilter("all")} label="All" />
              <FilterButton active={armStateFilter === "ARMED"} onClick={() => setArmStateFilter("ARMED")} label="Armed" />
              <FilterButton active={armStateFilter === "DISARMED"} onClick={() => setArmStateFilter("DISARMED")} label="Disarmed" />
              <FilterButton active={armStateFilter === "UNKNOWN"} onClick={() => setArmStateFilter("UNKNOWN")} label="Unknown" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading Oculus control transformers...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Transformer</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Location</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Controller health</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Intrusion signals</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Control posture</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 bg-white">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                          No Oculus-monitored transformers found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => {
                        const awaitingConfirmation = isAwaitingTelemetryConfirmation(row);
                        const targetState = getCommandTargetState(row);
                        const confirmationStatusLabel = getConfirmationStatusLabel(row);
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
                            className={`cursor-pointer transition hover:bg-slate-50 ${
                              selectedRow?.transformerId === row.transformerId ? "bg-blue-50/60" : "bg-white"
                            }`}
                          >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900">{row.transformerName}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${transformerTypeTone(row.transformerType)}`}>
                                  {row.transformerType || "Unspecified"}
                                </span>
                                <span className="text-xs text-slate-500">{row.controllerCount || 0} Oculus controller(s)</span>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">{row.activeAlertSummary || "No active intrusion alerts"}</div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <div>{row.regionName}</div>
                              <div className="mt-1">{row.districtName}</div>
                              <div className="mt-1 text-xs text-slate-500">{row.depotName}</div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <div className="font-medium text-slate-900">{row.controllerName || "No linked controller"}</div>
                              <div className="mt-1 font-mono text-xs text-slate-500">{row.controllerDevEui || "-"}</div>
                              <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
                                <span className={`h-2 w-2 rounded-full ${controllerStatusDot(row.controllerStatus)}`} />
                                {controllerStatusLabel(row.controllerStatus)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {row.minutesSinceLastTelemetry != null
                                  ? `Last keepalive ${row.minutesSinceLastTelemetry} min ago`
                                  : "No keepalive received yet"}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                                  <span className={`h-2 w-2 rounded-full ${signalDot(row.motionDetected)}`} />
                                  {row.motionStatusLabel || "No motion telemetry"}
                                </div>
                                <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                                  <span className={`h-2 w-2 rounded-full ${signalDot(row.secondaryAlertDetected)}`} />
                                  {row.secondaryAlertStatusLabel || "No secondary telemetry"}
                                </div>
                                {row.secondaryAlertLabel ? <div className="text-xs text-slate-400">{row.secondaryAlertLabel}</div> : null}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 text-xs text-slate-700">
                                  <span className={`h-2 w-2 rounded-full ${armStateDot(effectiveArmState)}`} />
                                  {effectiveArmState === "ARMED" ? "Armed now" : effectiveArmState === "DISARMED" ? "Disarmed now" : "Unknown"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {targetState === "ARMED"
                                    ? "Target: Arm requested"
                                    : targetState === "DISARMED"
                                      ? "Target: Disarm requested"
                                      : "Target: No command target"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Telemetry: {row.armState === "ARMED" ? "Armed" : row.armState === "DISARMED" ? "Disarmed" : "Unknown"}
                                </div>
                                <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                                  <span className={`h-2 w-2 rounded-full ${confirmationDot(row)}`} />
                                  {confirmationStatusLabel}
                                </div>
                                {awaitingConfirmation ? (
                                  <div className="text-xs text-blue-600">
                                    Waiting for the next keepalive or `RO1` update.
                                  </div>
                                ) : null}
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
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Details
                                </button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  startIcon={<Lock className="h-4 w-4" />}
                                  disabled={disableArm}
                                  isLoading={activeCommand === `${row.transformerId}:arm`}
                                  onClick={() => {
                                    setSelectedRow(row);
                                    void sendCommand(row.transformerId, "arm");
                                  }}
                                >
                                  Arm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  startIcon={<Unlock className="h-4 w-4" />}
                                  disabled={disableDisarm}
                                  isLoading={activeCommand === `${row.transformerId}:disarm`}
                                  onClick={() => {
                                    setSelectedRow(row);
                                    void sendCommand(row.transformerId, "disarm");
                                  }}
                                >
                                  Disarm
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200/80 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Showing <span className="font-medium text-slate-900">{filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-medium text-slate-900">{Math.min(page * pageSize, filteredRows.length)}</span> of{" "}
                    <span className="font-medium text-slate-900">{filteredRows.length}</span> Oculus transformers
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
                  <h3 className="mt-1 text-base font-semibold text-slate-950 md:text-lg">{selectedRow?.transformerName || "Oculus transformer"}</h3>
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
                      <DetailField label="Transformer type" value={selectedRow.transformerType || "Unspecified"} />
                      <DetailField label="Supplier" value={selectedRow.supplierName || selectedRow.supplierCode || "Oculus"} />
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
                      <button
                        type="button"
                        onClick={() => setShowAdvancedAudit((current) => !current)}
                        className="w-full rounded-[18px] border border-dashed border-slate-300 px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-700"
                      >
                        {showAdvancedAudit ? "Hide advanced audit" : "Show advanced audit"}
                      </button>
                      {showAdvancedAudit ? (
                        <div className="space-y-2">
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
                      ) : null}
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
                  <Button
                    size="xs"
                    variant="outline"
                    startIcon={<Lock className="h-4 w-4" />}
                    disabled={disableSelectedArm}
                    isLoading={activeCommand === `${selectedRow.transformerId}:arm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "arm")}
                  >
                    Arm Transformer
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    startIcon={<Unlock className="h-4 w-4" />}
                    disabled={disableSelectedDisarm}
                    isLoading={activeCommand === `${selectedRow.transformerId}:disarm`}
                    onClick={() => void sendCommand(selectedRow.transformerId, "disarm")}
                  >
                    Disarm Transformer
                  </Button>
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
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
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
