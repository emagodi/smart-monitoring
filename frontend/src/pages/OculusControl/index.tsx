import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Loader2,
  Lock,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/button/Button";
import Alert from "../../components/ui/alert/Alert";

type ArmStateFilter = "all" | "ARMED" | "DISARMED" | "UNKNOWN";

type OculusTransformerControl = {
  transformerId: number;
  transformerName: string;
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

const getCommandTargetState = (row: OculusTransformerControl): "ARMED" | "DISARMED" | null => {
  if (row.lastCommandAction === "ARM") return "ARMED";
  if (row.lastCommandAction === "DISARM") return "DISARMED";
  return null;
};

const isAwaitingTelemetryConfirmation = (row: OculusTransformerControl) => {
  if (row.lastCommandStatus !== "SENT") return false;

  const targetState = getCommandTargetState(row);
  if (!targetState || row.armState === targetState) {
    return false;
  }

  const commandAt = parseDateValue(row.lastCommandAt);
  const telemetryAt = parseDateValue(row.lastTelemetryAt);

  if (!commandAt) return false;
  if (!telemetryAt) return true;

  return commandAt.getTime() > telemetryAt.getTime();
};

const getConfirmationStatusLabel = (row: OculusTransformerControl) => {
  if (row.lastCommandStatus === "FAILED") return "Command Failed";
  if (row.lastCommandStatus === "PENDING") return "Sending Command";
  if (isAwaitingTelemetryConfirmation(row)) return "Pending Telemetry";
  if (row.lastCommandStatus === "SENT" && getCommandTargetState(row) && row.armState === getCommandTargetState(row)) {
    return "Confirmed";
  }
  return "No Pending Command";
};

const confirmationTone = (row: OculusTransformerControl) => {
  const label = getConfirmationStatusLabel(row);
  if (label === "Confirmed") return "bg-emerald-100 text-emerald-700";
  if (label === "Pending Telemetry" || label === "Sending Command") return "bg-blue-100 text-blue-700";
  if (label === "Command Failed") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
};

export default function OculusControlIndex() {
  const { token, user } = useAuth();
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
    if (token && canAccess) {
      fetchControlRows();
    }
  }, [token, canAccess, fetchControlRows]);

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
      const matchesArmState = armStateFilter === "all" ? true : (row.armState || "UNKNOWN") === armStateFilter;
      const matchesQuery =
        !query ||
        `${row.transformerName || ""} ${row.regionName} ${row.districtName} ${row.depotName} ${row.controllerName || ""} ${row.controllerDevEui || ""}`
          .toLowerCase()
          .includes(query);
      return matchesArmState && matchesQuery;
    });
  }, [armStateFilter, enrichedRows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const armed = rows.filter((row) => row.armState === "ARMED").length;
    const disarmed = rows.filter((row) => row.armState === "DISARMED").length;
    const unknown = Math.max(total - armed - disarmed, 0);
    return { total, armed, disarmed, unknown };
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
        const data = response.data as { message?: string; transformerName?: string };
        setSuccess(
          data?.message ||
            `${action === "arm" ? "Arm" : "Disarm"} command queued successfully. Confirmed state updates after the next RO1 telemetry.`
        );
        await fetchControlRows(false);
      } catch (commandError: any) {
        console.error(commandError);
        setError(commandError?.response?.data?.message || `Failed to ${action} transformer.`);
      } finally {
        setActiveCommand(null);
      }
    },
    [API_BASE_URL, fetchControlRows, headers]
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oculus Arming Control</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review Oculus-monitored transformers, see live arm state from controller `RO1`, and send Loriot arm or disarm commands.
          </p>
        </div>
        <Button onClick={fetchControlRows} icon={<RefreshCw className="h-4 w-4" />}>
          Refresh Control List
        </Button>
      </div>

      {error ? <Alert variant="error" title="Oculus Control" message={error} /> : null}
      {success ? <Alert variant="success" title="Oculus Control" message={success} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Monitored" value={stats.total} tone="slate" icon={<Shield className="h-5 w-5" />} />
        <StatCard title="Armed" value={stats.armed} tone="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard title="Disarmed" value={stats.disarmed} tone="amber" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard title="Unknown" value={stats.unknown} tone="blue" icon={<Radio className="h-5 w-5" />} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton active={armStateFilter === "all"} onClick={() => setArmStateFilter("all")} label="All" />
            <FilterButton active={armStateFilter === "ARMED"} onClick={() => setArmStateFilter("ARMED")} label="Armed" />
            <FilterButton active={armStateFilter === "DISARMED"} onClick={() => setArmStateFilter("DISARMED")} label="Disarmed" />
            <FilterButton active={armStateFilter === "UNKNOWN"} onClick={() => setArmStateFilter("UNKNOWN")} label="Unknown" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transformer, location, controller..."
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
            <span>Loading Oculus control transformers...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Transformer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Controller</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Command Target State</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Confirmed Telemetry State</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Pending / Confirmed Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                        No Oculus-monitored transformers found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const awaitingConfirmation = isAwaitingTelemetryConfirmation(row);
                      const targetState = getCommandTargetState(row);
                      const confirmationStatusLabel = getConfirmationStatusLabel(row);
                      const disableArm =
                        !row.controlAvailable ||
                        activeCommand === `${row.transformerId}:disarm` ||
                        (row.armState === "ARMED" && !awaitingConfirmation);
                      const disableDisarm =
                        !row.controlAvailable ||
                        activeCommand === `${row.transformerId}:arm` ||
                        (row.armState === "DISARMED" && !awaitingConfirmation);
                      return (
                        <tr key={row.transformerId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-800">
                            <div className="font-semibold">{row.transformerName}</div>
                            <div className="mt-1 text-xs text-gray-500">{row.controllerCount || 0} Oculus controller(s)</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div>{row.regionName}</div>
                            <div className="mt-1">{row.districtName}</div>
                            <div className="mt-1 text-xs text-gray-500">{row.depotName}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="font-medium text-gray-800">{row.controllerName || "No linked controller"}</div>
                            <div className="mt-1 font-mono text-xs text-gray-500">{row.controllerDevEui || "-"}</div>
                            <div className="mt-1 text-xs text-gray-500">{row.controllerType || "-"}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(targetState)}`}>
                                {targetState === "ARMED" ? "Arm Requested" : targetState === "DISARMED" ? "Disarm Requested" : "No Command Target"}
                              </span>
                              <div className="text-xs text-gray-500">
                                {row.lastCommandAction ? `${row.lastCommandAction} at ${formatDateTime(row.lastCommandAt)}` : "No Loriot command sent yet"}
                              </div>
                              {row.lastCommandRequestedBy ? (
                                <div className="text-xs text-gray-500">{row.lastCommandRequestedBy}</div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.armState)}`}>
                                {row.armState === "ARMED" ? "Armed" : row.armState === "DISARMED" ? "Disarmed" : "Unknown"}
                              </span>
                              <div className="font-medium text-gray-800">{formatDateTime(row.lastTelemetryAt)}</div>
                              <div className="text-xs text-gray-500">Latest `RO1` decides confirmed state</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${confirmationTone(row)}`}>
                                {confirmationStatusLabel}
                              </span>
                              <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${commandTone(row.lastCommandStatus)}`}>
                                {row.lastCommandStatus || "No command"}
                              </span>
                              <div className="text-xs text-gray-500">
                                {row.controlAvailable ? "Control ready" : row.availabilityReason || "Unavailable"}
                              </div>
                              {awaitingConfirmation ? (
                                <div className="text-xs text-blue-600">
                                  Loriot accepted {row.lastCommandAction?.toLowerCase()} and the page is waiting for a new `RO1` update.
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                startIcon={<Lock className="h-4 w-4" />}
                                disabled={disableArm}
                                isLoading={activeCommand === `${row.transformerId}:arm`}
                                onClick={() => sendCommand(row.transformerId, "arm")}
                              >
                                Arm
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                startIcon={<Unlock className="h-4 w-4" />}
                                disabled={disableDisarm}
                                isLoading={activeCommand === `${row.transformerId}:disarm`}
                                onClick={() => sendCommand(row.transformerId, "disarm")}
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

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-800">{filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium text-gray-800">{Math.min(page * pageSize, filteredRows.length)}</span> of{" "}
                <span className="font-medium text-gray-800">{filteredRows.length}</span> Oculus transformers
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
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
          </>
        )}
      </div>
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
        active ? "bg-brand-500 text-white shadow-theme-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
  tone: "slate" | "emerald" | "amber" | "blue";
  icon: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneMap[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}
