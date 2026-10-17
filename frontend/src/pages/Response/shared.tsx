import type { ReactNode } from "react";
import { Activity, DoorOpen, Radar, ShieldAlert, Thermometer, Waves } from "lucide-react";

export type CaseStatus = "NEW" | "ACKNOWLEDGED" | "DISPATCHED" | "EN_ROUTE" | "ON_SCENE" | "RESOLVED" | "FALSE_ALARM";
export type Outcome = "REAL_THREAT" | "FALSE_ALARM" | "TECHNICAL_FAULT" | "AUTHORISED_ACTIVITY" | "OTHER";
export type DispatchStatus = "DISPATCHED" | "ACCEPTED" | "ON_SCENE" | "COMPLETED" | "CANCELLED";

export type IncidentAlert = {
  id: number;
  message?: string | null;
  value?: string | null;
  isAlert?: boolean;
  transformerId?: number | null;
  transformerName?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  deviceName?: string | null;
  deviceId?: string | null;
  sensorType?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string | null;
  caseId?: number | null;
  caseStatus?: CaseStatus | null;
  assignedToEmail?: string | null;
  assignedToName?: string | null;
  acknowledgedAt?: string | null;
  dispatchedAt?: string | null;
  enRouteAt?: string | null;
  onSceneAt?: string | null;
  closedAt?: string | null;
  resolvedAt?: string | null;
  falseAlarmAt?: string | null;
  lastActionAt?: string | null;
  lastActionNote?: string | null;
  occurrenceCount?: number | null;
  lastSeenAt?: string | null;
  outcome?: Outcome | null;
  outcomeNote?: string | null;
  closedByName?: string | null;
};

export type Dispatch = {
  id: number;
  alertId: number;
  alertCaseId: number;
  vehicleId?: number | null;
  vehicleRegistration?: string | null;
  vehicleCallSign?: string | null;
  crewLeadName?: string | null;
  crewLeadPhone?: string | null;
  crewLeadWhatsapp?: string | null;
  crewLeadEmail?: string | null;
  status: DispatchStatus;
  dispatchedByEmail?: string | null;
  dispatchNote?: string | null;
  lastCrewNote?: string | null;
  dispatchedAt?: string | null;
  acceptedAt?: string | null;
  onSceneAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  crewLink?: string | null;
  crewNotified?: boolean;
};

export type BoardCase = { alert: IncidentAlert; dispatches: Dispatch[] };

export type Board = {
  open: BoardCase[];
  recentlyClosed: BoardCase[];
  vehiclesAvailable: number;
  vehiclesDispatched: number;
  vehiclesOutOfService: number;
  generatedAt?: string;
};

export type Vehicle = {
  id: number;
  registration: string;
  callSign?: string | null;
  vehicleType?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  status: "AVAILABLE" | "DISPATCHED" | "OUT_OF_SERVICE";
  crewLeadName?: string | null;
  crewLeadPhone?: string | null;
  crewLeadWhatsapp?: string | null;
  crewLeadEmail?: string | null;
  crewSize?: number | null;
  notes?: string | null;
  currentAlertId?: number | null;
  currentTransformerName?: string | null;
  currentDispatchStatus?: string | null;
  currentDispatchedAt?: string | null;
};

export type Depot = { id: number; name: string; districtId?: number | null };

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const statusOf = (a: IncidentAlert): CaseStatus => a.caseStatus || (a.isAlert ? "NEW" : "RESOLVED");

export const STAGES: Array<{ key: CaseStatus; label: string; hint: string }> = [
  { key: "NEW", label: "New", hint: "Waiting for the contact centre" },
  { key: "ACKNOWLEDGED", label: "Acknowledged", hint: "Seen; needs a vehicle" },
  { key: "DISPATCHED", label: "Dispatched", hint: "Crew notified, not yet accepted" },
  { key: "EN_ROUTE", label: "En route", hint: "Crew on the way" },
  { key: "ON_SCENE", label: "On scene", hint: "Crew at the transformer" },
];

export const STATUS_META: Record<CaseStatus, { label: string; dot: string; chip: string; lane: string }> = {
  NEW: {
    label: "New",
    dot: "bg-red-500",
    chip: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
    lane: "from-red-500/12",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    lane: "from-amber-500/12",
  },
  DISPATCHED: {
    label: "Dispatched",
    dot: "bg-blue-500",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
    lane: "from-blue-500/12",
  },
  EN_ROUTE: {
    label: "En route",
    dot: "bg-indigo-500",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
    lane: "from-indigo-500/12",
  },
  ON_SCENE: {
    label: "On scene",
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
    lane: "from-violet-500/12",
  },
  RESOLVED: {
    label: "Resolved",
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    lane: "from-emerald-500/12",
  },
  FALSE_ALARM: {
    label: "False alarm",
    dot: "bg-slate-400",
    chip: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    lane: "from-slate-500/12",
  },
};

export const OUTCOMES: Array<{ key: Outcome; label: string; hint: string; tone: string }> = [
  {
    key: "REAL_THREAT",
    label: "Real threat",
    hint: "Intrusion, theft or vandalism attempt",
    tone: "border-red-300 bg-red-50 text-red-700 data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600 dark:bg-red-500/10 dark:text-red-300",
  },
  {
    key: "FALSE_ALARM",
    label: "False alarm",
    hint: "Nothing found on site",
    tone: "border-slate-300 bg-slate-50 text-slate-700 data-[on=true]:bg-slate-700 data-[on=true]:text-white data-[on=true]:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    key: "TECHNICAL_FAULT",
    label: "Technical fault",
    hint: "Faulty sensor, controller or door switch",
    tone: "border-amber-300 bg-amber-50 text-amber-800 data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500 dark:bg-amber-500/10 dark:text-amber-300",
  },
  {
    key: "AUTHORISED_ACTIVITY",
    label: "Authorised work",
    hint: "ZESA / Powertel crew on site, not disarmed",
    tone: "border-blue-300 bg-blue-50 text-blue-700 data-[on=true]:bg-blue-600 data-[on=true]:text-white data-[on=true]:border-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  },
  {
    key: "OTHER",
    label: "Other",
    hint: "Explain in the note",
    tone: "border-slate-300 bg-white text-slate-600 data-[on=true]:bg-slate-900 data-[on=true]:text-white data-[on=true]:border-slate-900 dark:bg-slate-900 dark:text-slate-300",
  },
];

export const outcomeLabel = (o?: Outcome | null) => OUTCOMES.find((x) => x.key === o)?.label || (o ? o : "Closed");

export const outcomeChip = (o?: Outcome | null) => {
  switch (o) {
    case "REAL_THREAT":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
    case "TECHNICAL_FAULT":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
    case "AUTHORISED_ACTIVITY":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
};

/** What physically happened, derived from the decoded trigger text. */
export type EventKind = "door" | "motion" | "vibration" | "temperature" | "tilt" | "other";

export const eventKind = (a: Pick<IncidentAlert, "value" | "message" | "sensorType">): EventKind => {
  const text = `${a.value || ""} ${a.message || ""} ${a.sensorType || ""}`.toLowerCase();
  if (text.includes("door") || text.includes("contact")) return "door";
  if (text.includes("vibration")) return "vibration";
  if (text.includes("motion")) return "motion";
  if (text.includes("temp")) return "temperature";
  if (text.includes("tilt")) return "tilt";
  return "other";
};

export const EVENT_META: Record<EventKind, { label: string; icon: ReactNode; tone: string }> = {
  door: { label: "Door opened", icon: <DoorOpen className="h-4 w-4" />, tone: "bg-red-600 text-white" },
  motion: { label: "Motion detected", icon: <Radar className="h-4 w-4" />, tone: "bg-orange-500 text-white" },
  vibration: { label: "Vibration", icon: <Waves className="h-4 w-4" />, tone: "bg-fuchsia-600 text-white" },
  temperature: { label: "High temperature", icon: <Thermometer className="h-4 w-4" />, tone: "bg-amber-500 text-white" },
  tilt: { label: "Tilt / tamper", icon: <Activity className="h-4 w-4" />, tone: "bg-rose-600 text-white" },
  other: { label: "Security alert", icon: <ShieldAlert className="h-4 w-4" />, tone: "bg-slate-700 text-white" },
};

/** Human event text: prefer the decoded value ("Motion Detected, Door Open"). */
export const eventText = (a: IncidentAlert) => a.value || EVENT_META[eventKind(a)].label;

export const minutesSince = (iso?: string | null, now: number = Date.now()) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / 60000);
};

export const formatElapsed = (minutes: number | null) => {
  if (minutes == null) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h < 24) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

export const formatTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/**
 * Response-time targets per stage, in minutes. Amber at the target, red at twice the target.
 * Contact centre should acknowledge fast; arrival depends on distance.
 */
export const SLA_MINUTES: Partial<Record<CaseStatus, number>> = {
  NEW: 2,
  ACKNOWLEDGED: 5,
  DISPATCHED: 5,
  EN_ROUTE: 30,
  ON_SCENE: 60,
};

/** Timestamp the current stage started at. */
export const stageStartedAt = (a: IncidentAlert) => {
  switch (statusOf(a)) {
    case "ACKNOWLEDGED":
      return a.acknowledgedAt || a.createdAt;
    case "DISPATCHED":
      return a.dispatchedAt || a.acknowledgedAt || a.createdAt;
    case "EN_ROUTE":
      return a.enRouteAt || a.dispatchedAt || a.createdAt;
    case "ON_SCENE":
      return a.onSceneAt || a.enRouteAt || a.createdAt;
    default:
      return a.createdAt;
  }
};

export const slaTone = (a: IncidentAlert, now: number) => {
  const target = SLA_MINUTES[statusOf(a)];
  const m = minutesSince(stageStartedAt(a), now);
  if (!target || m == null) return "text-slate-500 dark:text-slate-400";
  if (m >= target * 2) return "text-red-600 dark:text-red-400 font-semibold";
  if (m >= target) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-emerald-600 dark:text-emerald-400";
};

export const activeDispatch = (dispatches: Dispatch[]) =>
  dispatches.find((d) => d.status === "DISPATCHED" || d.status === "ACCEPTED" || d.status === "ON_SCENE") || null;

export const vehicleLabel = (d: { vehicleCallSign?: string | null; vehicleRegistration?: string | null; callSign?: string | null; registration?: string | null }) => {
  const sign = d.vehicleCallSign || d.callSign;
  const reg = d.vehicleRegistration || d.registration;
  return sign ? `${sign} · ${reg ?? ""}` : reg || "Vehicle";
};

export const apiError = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string; error?: string } | string } };
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") return data.message || data.error || fallback;
  return fallback;
};

export const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
};
