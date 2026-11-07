import axios from "axios";
import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { invalidateCache } from "../../lib/cache";

export const API = (import.meta.env.VITE_API_BASE_URL || "") + "/api/v1/lifecycle";

export type InstallStatus = "INSTALLED" | "READY" | "SCHEDULED" | "COMMISSIONED" | "FAILED" | "CANCELLED";
export type RequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
export type AttemptStatus = "DRAFT" | "PASSED" | "FAILED";
export type CheckResult = "YES" | "NO" | "NA" | null;

export type Installation = {
  id: number;
  transformerId: number;
  transformerName: string;
  transformerNumber?: string | null;
  requestId?: number | null;
  requestReference?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  depotId?: number | null;
  status: InstallStatus;
  installedOn?: string | null;
  installedBy?: string | null;
  deviceEui?: string | null;
  installNote?: string | null;
  readyAt?: string | null;
  readyBy?: string | null;
  readyNote?: string | null;
  tentativeDate?: string | null;
  scheduledBy?: string | null;
  scheduleNote?: string | null;
  commissionedAt?: string | null;
  failedAt?: string | null;
  attempts: number;
  lastAttemptStatus?: AttemptStatus | null;
  openDraftId?: number | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LifecycleEvent = {
  id: number;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorEmail?: string | null;
  actorOrg?: "ZESA" | "PARTNER" | null;
  note?: string | null;
  createdAt: string;
  attemptId?: number | null;
};

export type AttemptSummary = {
  id: number;
  attemptNo: number;
  status: AttemptStatus;
  testDate?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
};

export type InstallationDetail = Installation & { attemptHistory: AttemptSummary[]; events: LifecycleEvent[] };

export type InstallRequest = {
  id: number;
  reference: string;
  supplierCode?: string | null;
  supplierName?: string | null;
  regionId?: number | null;
  regionName?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  plannedDate?: string | null;
  plannedEndDate?: string | null;
  accessNote?: string | null;
  status: RequestStatus;
  requestedBy?: string | null;
  requestedAt?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  itemCount?: number;
  installedCount?: number;
  items?: Array<{ id: number; transformerId?: number | null; siteLabel?: string | null; transformerName?: string | null; transformerNumber?: string | null; installationId?: number | null; installationStatus?: InstallStatus | null; installedOn?: string | null }>;
  events?: LifecycleEvent[];
};

export type PatItem = { key: string; requirement: string; criteria: string; result: CheckResult; remark?: string | null };
export type Signature = { role: string; name?: string | null; image?: string | null; signedAt?: string | null; capturedBy?: string | null };

export type Attempt = {
  id: number;
  installationId: number;
  transformerId: number;
  attemptNo: number;
  status: AttemptStatus;
  testDate?: string | null;
  depotLabel?: string | null;
  locationLabel?: string | null;
  ssNumber?: string | null;
  items: PatItem[];
  comments?: string | null;
  signatures: Signature[];
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  installation: Installation;
};

export type Paged<T> = { content: T[]; totalElements: number; counts: Record<string, number> };

/** Signatories on the PAT form. ZETDC and ZESA Loss Control are ZESA group users; the Contractor is the partner. */
export const SIGNATORIES: Array<{ role: string; label: string; org: string }> = [
  { role: "ZETDC", label: "ZETDC", org: "ZESA group" },
  { role: "ZESA_LOSS_CONTROL", label: "ZESA Loss Control", org: "ZESA group" },
  { role: "POWERTEL", label: "Powertel", org: "ZESA group" },
  { role: "CONTRACTOR", label: "Contractor", org: "Partner" },
];

export const STATUS_META: Record<InstallStatus, { label: string; short: string; pill: string; dot: string; hex: string; step: number }> = {
  INSTALLED: { label: "Installed", short: "Installed", pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300", dot: "bg-sky-500", hex: "#0284c7", step: 1 },
  READY: { label: "Ready for commissioning", short: "Ready", pill: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300", dot: "bg-violet-500", hex: "#7c3aed", step: 2 },
  SCHEDULED: { label: "Commissioning scheduled", short: "Scheduled", pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500", hex: "#d97706", step: 3 },
  COMMISSIONED: { label: "Commissioned", short: "Commissioned", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-500", hex: "#059669", step: 4 },
  FAILED: { label: "Commissioning failed", short: "Failed", pill: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300", dot: "bg-red-500", hex: "#dc2626", step: 3 },
  CANCELLED: { label: "Cancelled", short: "Cancelled", pill: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400", hex: "#64748b", step: 0 },
};

export const REQUEST_META: Record<RequestStatus, { label: string; pill: string; dot: string }> = {
  PENDING: { label: "Awaiting green light", pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500" },
  APPROVED: { label: "Green light given", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-500" },
  DECLINED: { label: "Declined", pill: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300", dot: "bg-red-500" },
  CANCELLED: { label: "Cancelled", pill: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
};

export const EVENT_LABEL: Record<string, string> = {
  REQUEST_CREATED: "Green light requested",
  REQUEST_APPROVED: "Green light given",
  REQUEST_DECLINED: "Green light declined",
  REQUEST_CANCELLED: "Request cancelled",
  INSTALLED: "Installed",
  READY_FOR_COMMISSIONING: "Marked ready for commissioning",
  SCHEDULED: "Commissioning date set",
  RESCHEDULED: "Commissioning date changed",
  COMMISSIONING_STARTED: "Commissioning form opened",
  COMMISSIONING_SAVED: "Commissioning form saved",
  COMMISSIONING_DISCARDED: "Draft discarded",
  COMMISSIONED: "Commissioned",
  COMMISSIONING_FAILED: "Commissioning failed",
  CANCELLED: "Installation cancelled",
};

/** What the signed-in user may do in this process (backend enforces the same rules). */
export function useLifecycleRights() {
  const { hasPermission, token } = useAuth();
  const { isPartner, isDepot, depotId, supplierCode, supplierName } = useScope();
  return useMemo(
    () => ({
      token,
      isPartner,
      isDepot,
      depotId,
      supplierCode,
      supplierName,
      canRequest: hasPermission("installations.request"),
      canApprove: hasPermission("installations.approve") && !isPartner,
      canRecord: hasPermission("installations.record") && !isPartner,
      canReady: hasPermission("installations.ready") && (isPartner || hasPermission("installations.record")),
      canSchedule: hasPermission("commissioning.schedule") && !isPartner,
      canPerform: hasPermission("commissioning.perform") && !isPartner,
      canDecide: hasPermission("commissioning.decide") && !isPartner,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, isPartner, isDepot, depotId, supplierCode, supplierName, hasPermission]
  );
}

export const authHeaders = (token?: string | null) => (token ? { Authorization: `Bearer ${token}` } : {});

export async function lifecyclePost<T = unknown>(token: string | null | undefined, path: string, body?: unknown): Promise<T> {
  const r = await axios.post(`${API}${path}`, body ?? {}, { headers: authHeaders(token) });
  invalidateCache("/api/v1/lifecycle");
  return r.data as T;
}

export async function lifecyclePut<T = unknown>(token: string | null | undefined, path: string, body?: unknown): Promise<T> {
  const r = await axios.put(`${API}${path}`, body ?? {}, { headers: authHeaders(token) });
  invalidateCache("/api/v1/lifecycle");
  return r.data as T;
}

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Days between two ISO dates (or from a date to today). */
export const daysBetween = (from?: string | null, to?: string | null) => {
  if (!from) return null;
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
};

export const who = (email?: string | null) => (email ? email.split("@")[0].replace(/[._]/g, " ") : "—");
