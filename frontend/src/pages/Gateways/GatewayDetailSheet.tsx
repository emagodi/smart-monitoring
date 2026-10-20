import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CardSim,
  Check,
  ClipboardList,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  Fingerprint,
  History,
  Link2,
  Link2Off,
  Loader2,
  MapPin,
  MapPinned,
  Network,
  Pencil,
  Phone,
  RefreshCw,
  Router,
  Server,
  Signal,
  X,
} from "lucide-react";

/**
 * Gateway detail (view mode). A bottom sheet on phones and a wide window on desktops, in the app's blue/red style:
 * a gradient header with live health, then Overview · Status history · SIM card · Sync log · Audit.
 */

export type GwStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "NEVER_SEEN" | "UNKNOWN" | string;

export type DetailGateway = {
  id: number;
  name: string;
  loriotGatewayId?: string | null;
  gatewayEui?: string | null;
  mac?: string | null;
  model?: string | null;
  fwVersion?: string | null;
  regionName?: string | null;
  depotName?: string | null;
  networkName?: string | null;
  operator?: string | null;
  effectiveStatus: GwStatus;
  lastTrafficSeenAt?: string | null;
  lastLoriotSeenAt?: string | null;
  lat?: number;
  lng?: number;
  address?: string | null;
  locationSource?: string | null;
  createdAt?: string | null;
};

export type DetailHistory = { id: number; previousStatus?: GwStatus | null; newStatus: GwStatus; reason?: string | null; source?: string | null; observedAt?: string | null };

export type DetailSim = {
  id: number;
  simId: number;
  simIccid?: string | null;
  iccid?: string | null;
  simMsisdn?: string | null;
  slotNumber: number;
  active: boolean;
  assignedAt?: string | null;
  unassignedAt?: string | null;
  assignedBy?: string | null;
  unassignedBy?: string | null;
  reason?: string | null;
};

type Tab = "overview" | "status" | "sim" | "sync" | "audit";

// ------------------------------------------------------------------ helpers

const ST: Record<string, { label: string; dot: string; pill: string; tile: string; glow: string }> = {
  ONLINE: { label: "Online", dot: "bg-emerald-400", pill: "bg-emerald-400/15 text-emerald-100 ring-emerald-300/40", tile: "from-emerald-500 to-teal-600", glow: "bg-emerald-400/30" },
  OFFLINE: { label: "Offline", dot: "bg-red-400", pill: "bg-red-400/15 text-red-100 ring-red-300/40", tile: "from-red-500 to-rose-600", glow: "bg-red-500/35" },
  DEGRADED: { label: "Degraded", dot: "bg-amber-400", pill: "bg-amber-400/15 text-amber-100 ring-amber-300/40", tile: "from-amber-500 to-orange-600", glow: "bg-amber-400/30" },
  NEVER_SEEN: { label: "Never seen", dot: "bg-slate-300", pill: "bg-white/10 text-slate-100 ring-white/20", tile: "from-slate-400 to-slate-600", glow: "bg-slate-300/20" },
  UNKNOWN: { label: "Unknown", dot: "bg-slate-300", pill: "bg-white/10 text-slate-100 ring-white/20", tile: "from-slate-400 to-slate-600", glow: "bg-slate-300/20" },
};
const st = (s?: string | null) => ST[(s || "UNKNOWN").toUpperCase()] ?? ST.UNKNOWN;

const LIGHT: Record<string, string> = {
  ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  OFFLINE: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
  DEGRADED: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
};
const lightPill = (s?: string | null) => LIGHT[(s || "").toUpperCase()] ?? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
const DOT: Record<string, string> = { ONLINE: "bg-emerald-500", OFFLINE: "bg-red-500", DEGRADED: "bg-amber-500" };

const ago = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString();
};
const when = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const tail4 = (v?: string | null) => (v ? v.replace(/\*/g, "").slice(-4) : "");
const who = (email?: string | null) => (email ? email.split("@")[0].replace(/[._]/g, " ") : null);
const sourceLabel = (s?: string | null) => (s === "LORIOT_API" ? "Automatic · LORIOT" : s === "MANUAL" ? "Set by hand" : s || null);

// ------------------------------------------------------------------ component

export function GatewayDetailSheet({
  open,
  gateway,
  history,
  sims,
  loading,
  initialTab = "overview",
  canEdit,
  canSync,
  syncing,
  onClose,
  onEdit,
  onSync,
  onAssignSim,
  onUnassign,
}: {
  open: boolean;
  gateway: DetailGateway | null;
  history: DetailHistory[];
  sims: DetailSim[];
  loading: boolean;
  initialTab?: Tab;
  canEdit: boolean;
  canSync: boolean;
  syncing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSync: () => void;
  onAssignSim: () => void;
  onUnassign: (a: DetailSim) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setConfirmId(null);
    }
  }, [open, gateway?.id, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !gateway) return null;
  const g = gateway;
  const s = st(g.effectiveStatus);
  const current = sims.find((a) => a.active) || null;
  const past = sims.filter((a) => !a.active);
  const lastChange = history[0];
  const hasPlace = Boolean(g.depotName || g.regionName);
  const hasCoords = typeof g.lat === "number" && typeof g.lng === "number";
  const ids = g.gatewayEui || g.mac || g.loriotGatewayId;

  const copy = (key: string, v?: string | null) => {
    if (!v) return;
    void navigator.clipboard?.writeText(v).catch(() => undefined);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  };

  const remove = async (a: DetailSim) => {
    setRemoving(true);
    try {
      await onUnassign(a);
      setConfirmId(null);
    } finally {
      setRemoving(false);
    }
  };

  const TABS: Array<{ k: Tab; label: string; icon: ReactNode; count?: number }> = [
    { k: "overview", label: "Overview", icon: <Router className="h-3.5 w-3.5" /> },
    { k: "status", label: "Status history", icon: <Activity className="h-3.5 w-3.5" />, count: history.length },
    { k: "sim", label: "SIM card", icon: <CardSim className="h-3.5 w-3.5" />, count: sims.length },
    { k: "sync", label: "Sync log", icon: <Server className="h-3.5 w-3.5" /> },
    { k: "audit", label: "Audit", icon: <ClipboardList className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[28px] dark:bg-slate-950">
        {/* ------------------------------------------------ header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-4 pb-4 pt-4 text-white sm:px-6 sm:pt-5">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-red-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex items-start gap-3 sm:gap-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14">
              <span className={`absolute inset-0 rounded-2xl blur-md ${s.glow}`} />
              <span className={`relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20 ${s.tile}`}>
                <Router className="h-6 w-6 sm:h-7 sm:w-7" />
              </span>
              {g.effectiveStatus === "ONLINE" ? <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-emerald-300 ring-2 ring-[#0a2a6b]" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/80">LoRaWAN gateway</p>
              <h3 className="truncate text-lg font-semibold sm:text-xl">{g.name || "Unnamed gateway"}</h3>
              {ids ? (
                <button type="button" onClick={() => copy("hdr", ids)} className="group mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs tracking-wide text-blue-100/90 hover:text-white">
                  {ids}
                  {copied === "hdr" ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />}
                </button>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <HChip className={s.pill}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${g.effectiveStatus === "ONLINE" ? "animate-pulse" : ""}`} />
                  {s.label}
                </HChip>
                <HChip className={hasPlace ? "" : "bg-amber-400/15 text-amber-100 ring-amber-300/40"}>
                  <MapPin className="h-3 w-3" />
                  {hasPlace ? [g.depotName, g.regionName].filter(Boolean).join(" · ") : "No depot set"}
                </HChip>
                <HChip className={current ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/40" : "bg-amber-400/15 text-amber-100 ring-amber-300/40"}>
                  <CardSim className="h-3 w-3" />
                  {current ? `SIM •••• ${tail4(current.simIccid || current.iccid)}` : "No SIM"}
                </HChip>
                {g.model ? (
                  <HChip>
                    <Cpu className="h-3 w-3" /> {g.model}
                  </HChip>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canEdit ? (
                <button type="button" onClick={onEdit} className="hidden items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50 sm:inline-flex">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              ) : null}
              {canSync ? (
                <button type="button" onClick={onSync} disabled={syncing} className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 sm:inline-flex">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-blue-100 ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* live health strip */}
          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi icon={<Signal className="h-3.5 w-3.5" />} label="Last traffic" value={ago(g.lastTrafficSeenAt) ?? "Never"} sub={when(g.lastTrafficSeenAt) ?? "no packets yet"} warn={!g.lastTrafficSeenAt} />
            <Kpi icon={<Server className="h-3.5 w-3.5" />} label="Last LORIOT check" value={ago(g.lastLoriotSeenAt) ?? "Never"} sub={when(g.lastLoriotSeenAt) ?? "—"} />
            <Kpi icon={<History className="h-3.5 w-3.5" />} label={`${s.label} since`} value={ago(lastChange?.observedAt) ?? "—"} sub={lastChange ? `${history.length} change${history.length === 1 ? "" : "s"} recorded` : "no changes recorded"} />
            <Kpi icon={<CardSim className="h-3.5 w-3.5" />} label="SIM card" value={current ? `Slot ${current.slotNumber}` : "None"} sub={current ? `in since ${ago(current.assignedAt) ?? "—"}` : "assign one"} warn={!current} />
          </div>

          {/* mobile actions */}
          {canEdit || canSync ? (
            <div className="relative mt-3 flex gap-2 sm:hidden">
              {canEdit ? (
                <button type="button" onClick={onEdit} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              ) : null}
              {canSync ? (
                <button type="button" onClick={onSync} disabled={syncing} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------ tabs */}
        <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 sm:px-5 dark:border-slate-800 dark:bg-slate-950">
          {TABS.map((t) => {
            const on = tab === t.k;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  on ? "bg-gradient-to-r from-blue-600 to-[#0b4fc4] text-white shadow-md shadow-blue-600/25" : "text-slate-600 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-900"
                }`}
              >
                {t.icon}
                {t.label}
                {t.count ? <span className={`rounded-full px-1.5 text-[10px] ${on ? "bg-white/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{t.count}</span> : null}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------ body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-3 py-4 sm:px-5 dark:bg-slate-900/40">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Loading gateway…
            </div>
          ) : tab === "overview" ? (
            <div className="space-y-3">
              {!hasPlace || !current ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-3 sm:flex-row sm:items-center dark:border-amber-500/30 dark:from-amber-500/10 dark:to-slate-950">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                  <p className="flex-1 text-xs text-amber-900 dark:text-amber-100">
                    <b>Finish setting up this gateway:</b> {[!hasPlace ? "give it a region and depot so the right team sees it" : null, !current ? "record the SIM card that is inside it" : null].filter(Boolean).join(", and ")}.
                  </p>
                  <div className="flex gap-1.5">
                    {!hasPlace && canEdit ? <SmallBtn onClick={onEdit} icon={<MapPinned className="h-3.5 w-3.5" />}>Set depot</SmallBtn> : null}
                    {!current && canEdit ? <SmallBtn onClick={() => setTab("sim")} icon={<CardSim className="h-3.5 w-3.5" />}>Add SIM</SmallBtn> : null}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                <Card icon={<Fingerprint className="h-4 w-4" />} title="Identity">
                  <Row label="Gateway EUI" value={g.gatewayEui} mono onCopy={() => copy("eui", g.gatewayEui)} copied={copied === "eui"} />
                  <Row label="LORIOT ID" value={g.loriotGatewayId} mono onCopy={() => copy("lid", g.loriotGatewayId)} copied={copied === "lid"} />
                  <Row label="MAC address" value={g.mac} mono onCopy={() => copy("mac", g.mac)} copied={copied === "mac"} />
                  <Row label="Model" value={g.model} />
                  <Row label="Firmware" value={g.fwVersion} />
                </Card>

                <Card icon={<MapPinned className="h-4 w-4" />} title="Location" tone="red">
                  <Row label="Depot" value={g.depotName} />
                  <Row label="Region" value={g.regionName} />
                  <Row label="Coordinates" value={hasCoords ? `${g.lat!.toFixed(5)}, ${g.lng!.toFixed(5)}` : null} mono />
                  <Row label="Address" value={g.address} />
                  <Row label="Location from" value={sourceLabel(g.locationSource)} />
                  {hasCoords ? (
                    <a
                      href={`https://www.google.com/maps?q=${g.lat},${g.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
                    </a>
                  ) : null}
                </Card>

                <Card icon={<Network className="h-4 w-4" />} title="Network & SIM">
                  <Row label="Network" value={g.networkName} />
                  <Row label="Operator" value={g.operator} />
                  <Row
                    label="SIM card"
                    value={current ? `•••• ${tail4(current.simIccid || current.iccid)} · slot ${current.slotNumber}` : null}
                    empty="No SIM recorded"
                    action={canEdit ? <LinkBtn onClick={() => setTab("sim")}>{current ? "Manage" : "Assign"}</LinkBtn> : null}
                  />
                  <Row label="SIM number" value={current?.simMsisdn ? `••• ${tail4(current.simMsisdn)}` : null} mono />
                </Card>

                <Card icon={<CalendarClock className="h-4 w-4" />} title="Activity" tone="red">
                  <Timeline
                    items={[
                      { label: "Last traffic", at: g.lastTrafficSeenAt, tone: g.lastTrafficSeenAt ? "good" : "muted", empty: "No traffic seen yet" },
                      { label: "Last LORIOT check", at: g.lastLoriotSeenAt, tone: "blue" },
                      { label: "Added to the system", at: g.createdAt, tone: "muted" },
                    ]}
                  />
                </Card>
              </div>
            </div>
          ) : tab === "status" ? (
            <Card icon={<Activity className="h-4 w-4" />} title="Status changes" hint="Newest first">
              {!history.length ? (
                <Empty icon={<Activity className="h-7 w-7" />} title="No changes yet" text="Each time this gateway goes online, offline or degraded it will be listed here." />
              ) : (
                <ol className="relative ml-2 space-y-3 border-l-2 border-dashed border-slate-200 pl-5 dark:border-slate-800">
                  {history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-950 ${DOT[(h.newStatus || "").toUpperCase()] ?? "bg-slate-400"}`} />
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Pill cls={lightPill(h.previousStatus)}>{h.previousStatus ? st(h.previousStatus).label : "New"}</Pill>
                            <ArrowRight className="h-3.5 w-3.5 text-red-400" />
                            <Pill cls={lightPill(h.newStatus)}>{st(h.newStatus).label}</Pill>
                          </div>
                          <span className="text-[11px] text-slate-500" title={when(h.observedAt) ?? undefined}>
                            {ago(h.observedAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {when(h.observedAt)} · {h.source || "System"}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ) : tab === "sim" ? (
            <div className="space-y-3">
              {current ? (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_1fr]">
                  <SimCardVisual a={current} />
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">SIM in this gateway</h4>
                      <Row label="ICCID" value={`•••• •••• ${tail4(current.simIccid || current.iccid)}`} mono />
                      <Row label="Number" value={current.simMsisdn ? `••• ${tail4(current.simMsisdn)}` : null} mono />
                      <Row label="Slot" value={`Slot ${current.slotNumber}`} />
                      <Row label="Put in" value={when(current.assignedAt)} />
                      <Row label="By" value={who(current.assignedBy)} />
                      {current.reason ? <Row label="Reason" value={current.reason} /> : null}
                    </div>
                    {canEdit ? (
                      confirmId === current.id ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                          <p className="text-xs text-red-800 dark:text-red-200">Remove this SIM from the gateway? It goes back to spare stock with its PIN and PUK kept.</p>
                          <div className="mt-2 flex justify-end gap-2">
                            <SmallBtn onClick={() => setConfirmId(null)}>Keep it</SmallBtn>
                            <button
                              type="button"
                              disabled={removing}
                              onClick={() => void remove(current)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                            >
                              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />} Remove SIM
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <GradientBtn onClick={onAssignSim} icon={<RefreshCw className="h-4 w-4" />}>
                            Swap SIM
                          </GradientBtn>
                          <button
                            type="button"
                            onClick={() => setConfirmId(current.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900"
                          >
                            <Link2Off className="h-4 w-4" /> Remove
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-red-50 p-6 text-center dark:border-blue-500/20 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
                  <div className="mx-auto mb-3 flex h-20 w-16 items-center justify-center rounded-xl rounded-tr-[22px] bg-gradient-to-br from-blue-600 via-[#0b4fc4] to-red-500 shadow-xl shadow-blue-600/25">
                    <span className="h-6 w-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 ring-1 ring-amber-500/40" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-50">No SIM card in this gateway</h4>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    {g.effectiveStatus === "ONLINE" ? "It is online, so it has a SIM — record which one so it can be tracked, topped up and replaced." : "Record the SIM that goes into this gateway so it can be tracked, topped up and replaced."}
                  </p>
                  {canEdit ? (
                    <div className="mt-4 flex justify-center">
                      <GradientBtn onClick={onAssignSim} icon={<Link2 className="h-4 w-4" />}>
                        Assign a SIM
                      </GradientBtn>
                    </div>
                  ) : null}
                </div>
              )}

              <Card icon={<History className="h-4 w-4" />} title="Earlier SIMs" hint={past.length ? `${past.length} previous` : undefined}>
                {!past.length ? (
                  <p className="py-2 text-xs text-slate-500">No earlier SIMs recorded for this gateway.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {past.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                          <CardSim className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                            •••• {tail4(a.simIccid || a.iccid)} <span className="font-sans font-normal text-slate-400">· slot {a.slotNumber}</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {when(a.assignedAt) ?? "—"} → {when(a.unassignedAt) ?? "—"}
                            {a.reason ? ` · ${a.reason}` : ""}
                          </p>
                        </div>
                        {a.unassignedBy ? <span className="text-[11px] capitalize text-slate-400">removed by {who(a.unassignedBy)}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : tab === "sync" ? (
            <Card icon={<Server className="h-4 w-4" />} title="LORIOT sync">
              <div className="grid gap-2 sm:grid-cols-2">
                <MiniStat label="Last LORIOT check" value={ago(g.lastLoriotSeenAt) ?? "Never"} sub={when(g.lastLoriotSeenAt) ?? "—"} />
                <MiniStat label="Location from" value={sourceLabel(g.locationSource) ?? "Not set"} sub={hasCoords ? "coordinates on file" : "no coordinates yet"} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="h-3.5 w-3.5" /> A run-by-run sync history for each gateway is not recorded yet.
              </p>
            </Card>
          ) : (
            <Card icon={<ClipboardList className="h-4 w-4" />} title="Audit trail">
              <Empty icon={<ClipboardList className="h-7 w-7" />} title="Not recorded yet" text="Edits, syncs and SIM changes will be listed here once the audit log is switched on for gateways. SIM changes already show who did them on the SIM card tab." />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function HChip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${className || "bg-white/10 text-blue-50 ring-white/15"}`}>{children}</span>;
}

function Kpi({ icon, label, value, sub, warn }: { icon: ReactNode; label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.08] px-3 py-2 ring-1 ring-white/10 backdrop-blur">
      <p className="flex items-center gap-1.5 truncate text-[11px] text-blue-100/75">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 truncate text-base font-semibold ${warn ? "text-amber-300" : "text-white"}`}>{value}</p>
      <p className="truncate text-[10px] text-blue-100/55">{sub}</p>
    </div>
  );
}

function Card({ icon, title, hint, tone, children }: { icon: ReactNode; title: string; hint?: string; tone?: "red"; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone === "red" ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"}`}>{icon}</span>
        <h4 className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h4>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, mono, empty = "Not set", onCopy, copied, action }: { label: string; value?: string | null; mono?: boolean; empty?: string; onCopy?: () => void; copied?: boolean; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {value ? (
          <span className={`truncate text-right text-[13px] font-medium text-slate-900 dark:text-slate-100 ${mono ? "font-mono tracking-wide" : ""}`}>{value}</span>
        ) : (
          <span className="text-xs italic text-slate-400">{empty}</span>
        )}
        {value && onCopy ? (
          <button type="button" onClick={onCopy} className="rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label={`Copy ${label}`}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        {action}
      </span>
    </div>
  );
}

function Timeline({ items }: { items: Array<{ label: string; at?: string | null; tone: "good" | "blue" | "muted"; empty?: string }> }) {
  const dot = { good: "bg-emerald-500", blue: "bg-blue-500", muted: "bg-slate-300" };
  return (
    <ol className="relative ml-1.5 space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
      {items.map((it) => (
        <li key={it.label} className="relative">
          <span className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-slate-950 ${dot[it.tone]}`} />
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{it.label}</p>
          <p className="text-[11px] text-slate-500">{it.at ? `${when(it.at)} · ${ago(it.at)}` : it.empty ?? "Never"}</p>
        </li>
      ))}
    </ol>
  );
}

function SimCardVisual({ a }: { a: DetailSim }) {
  return (
    <div className="relative aspect-[1.6] w-full overflow-hidden rounded-[22px] rounded-tr-[46px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] p-5 text-white shadow-xl shadow-blue-900/30">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-500/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-sky-400/25 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="grid h-10 w-12 grid-cols-3 gap-px overflow-hidden rounded-lg bg-gradient-to-br from-amber-200 to-amber-400 p-1 ring-1 ring-amber-500/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="rounded-[2px] bg-amber-300/70" />
            ))}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-300/40">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> In use · slot {a.slotNumber}
          </span>
        </div>
        <div>
          <p className="font-mono text-lg tracking-[0.18em] sm:text-xl">•••• •••• •••• {tail4(a.simIccid || a.iccid)}</p>
          <div className="mt-2 flex items-end justify-between text-[11px] text-blue-100/80">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {a.simMsisdn ? `••• ${tail4(a.simMsisdn)}` : "no number"}
            </span>
            <span>since {ago(a.assignedAt) ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ children, cls }: { children: ReactNode; cls: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>{children}</span>;
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-white p-3 ring-1 ring-blue-100 dark:from-blue-500/10 dark:to-slate-950 dark:ring-blue-500/20">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-red-50 text-blue-500 ring-1 ring-blue-100 dark:from-blue-500/10 dark:to-red-500/10 dark:ring-blue-500/20">{icon}</span>
      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mx-auto mt-0.5 max-w-sm text-xs text-slate-500">{text}</p>
    </div>
  );
}

function SmallBtn({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      {icon}
      {children}
    </button>
  );
}

function LinkBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200">
      {children}
    </button>
  );
}

function GradientBtn({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-[#0b4fc4] to-red-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110"
    >
      {icon}
      {children}
    </button>
  );
}
