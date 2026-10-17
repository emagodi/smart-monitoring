import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  ShieldOff,
  SignalHigh,
  Siren,
  Truck,
  Undo2,
  UserCheck,
} from "lucide-react";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import {
  API_BASE_URL,
  BoardCase,
  Dispatch,
  EVENT_META,
  OUTCOMES,
  Outcome,
  STATUS_META,
  Vehicle,
  activeDispatch,
  apiError,
  eventKind,
  eventText,
  formatElapsed,
  formatTime,
  minutesSince,
  normalizeList,
  outcomeChip,
  outcomeLabel,
  statusOf,
  vehicleLabel,
} from "./shared";

type TimelineItem = {
  id: number;
  activityType: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  note?: string | null;
  createdAt?: string | null;
};

type DeviceState = {
  status: string;
  controllerCount: number;
  lastCommandAction?: string | null;
  lastCommandStatus?: string | null;
  lastCommandAt?: string | null;
};

type Props = {
  item: BoardCase | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onChanged: () => void;
};

const STEPS: Array<{ key: string; label: string; at: (c: BoardCase) => string | null | undefined }> = [
  { key: "detected", label: "Detected", at: (c) => c.alert.createdAt },
  { key: "ack", label: "Acknowledged", at: (c) => c.alert.acknowledgedAt },
  { key: "dispatch", label: "Dispatched", at: (c) => c.alert.dispatchedAt },
  { key: "enroute", label: "En route", at: (c) => c.alert.enRouteAt },
  { key: "scene", label: "On scene", at: (c) => c.alert.onSceneAt },
  { key: "closed", label: "Closed", at: (c) => c.alert.closedAt || c.alert.resolvedAt || c.alert.falseAlarmAt },
];

export default function IncidentDrawer({ item, vehicles, onClose, onChanged }: Props) {
  const { token, hasPermission } = useAuth();
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [notifyCrew, setNotifyCrew] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [confirmControl, setConfirmControl] = useState<"arm" | "disarm" | null>(null);

  const alert = item?.alert;
  const status = alert ? statusOf(alert) : "NEW";
  const isOpen = status !== "RESOLVED" && status !== "FALSE_ALARM";
  const current = item ? activeDispatch(item.dispatches) : null;
  const canAck = hasPermission("response.acknowledge");
  const canDispatch = hasPermission("response.dispatch");
  const canClose = hasPermission("response.close");
  const canArm = hasPermission("control.arm");
  const canDisarm = hasPermission("control.disarm");

  const loadDevice = useCallback(async () => {
    if (!alert?.transformerId) {
      setDevice(null);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/registry/${alert.transformerId}`, { headers });
      setDevice(res.data as DeviceState);
    } catch {
      setDevice(null);
    }
  }, [alert?.transformerId, headers]);

  const loadTimeline = useCallback(async () => {
    if (!alert) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/alerts/${alert.id}/timeline`, { headers });
      setTimeline(normalizeList<TimelineItem>(res.data).slice().reverse());
    } catch {
      setTimeline([]);
    }
  }, [alert, headers]);

  useEffect(() => {
    setError(null);
    setNotice(null);
    setNote("");
    setCloseNote("");
    setOutcome(null);
    setVehicleId("");
    setConfirmControl(null);
    void loadTimeline();
    void loadDevice();
  }, [alert?.id, loadTimeline, loadDevice]);

  // Same-depot available vehicles first, then other available, then busy ones.
  const vehicleOptions = useMemo(() => {
    const rank = (v: Vehicle) =>
      (v.status === "AVAILABLE" ? 0 : v.status === "DISPATCHED" ? 2 : 4) + (alert?.depotId && v.depotId === alert.depotId ? 0 : 1);
    return vehicles.filter((v) => v.status !== "OUT_OF_SERVICE").slice().sort((a, b) => rank(a) - rank(b));
  }, [alert?.depotId, vehicles]);

  if (!item || !alert) return null;

  const kind = eventKind(alert);
  const ev = EVENT_META[kind];

  const run = async (key: string, fn: () => unknown, success?: string) => {
    try {
      setBusy(key);
      setError(null);
      await fn();
      if (success) setNotice(success);
      onChanged();
      void loadTimeline();
    } catch (e) {
      setError(apiError(e, "Action failed. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const acknowledge = () =>
    run("ack", () => axios.post(`${API_BASE_URL}/api/v1/response/cases/${alert.id}/acknowledge`, { note: note || undefined }, { headers }), "Acknowledged");

  const dispatch = (force = false) =>
    run(
      "dispatch",
      async () => {
        const res = await axios.post(
          `${API_BASE_URL}/api/v1/response/cases/${alert.id}/dispatch`,
          { vehicleId, note: note || undefined, notifyCrew, force },
          { headers }
        );
        const d = res.data as Dispatch;
        setNotice(
          d.crewNotified
            ? `${vehicleLabel(d)} dispatched. Crew lead notified with their response link.`
            : `${vehicleLabel(d)} dispatched. Crew was not messaged; copy the link below and send it.`
        );
        setVehicleId("");
        setNote("");
      }
    );

  const crewStatus = (d: Dispatch, next: "ACCEPTED" | "ON_SCENE" | "CANCELLED") =>
    run(
      `crew-${next}`,
      () => axios.post(`${API_BASE_URL}/api/v1/response/dispatches/${d.id}/status`, { status: next, note: note || undefined }, { headers }),
      next === "CANCELLED" ? "Vehicle recalled" : next === "ACCEPTED" ? "Marked en route" : "Marked on scene"
    );

  const closeIncident = () =>
    run(
      "close",
      () => axios.post(`${API_BASE_URL}/api/v1/response/cases/${alert.id}/close`, { outcome, note: closeNote || undefined }, { headers }),
      `Closed as ${outcomeLabel(outcome)}`
    );

  // Same endpoint and permission rule as the control console and WhatsApp commands;
  // alertId makes the command show up on this incident's timeline.
  const sendControl = (action: "arm" | "disarm") =>
    run(
      `control-${action}`,
      async () => {
        await axios.post(`${API_BASE_URL}/api/v1/oculus-control/transformers/${alert.transformerId}/${action}`, null, {
          headers,
          params: { alertId: alert.id },
        });
        setConfirmControl(null);
        void loadDevice();
      },
      action === "arm" ? "Arm command sent to the site controller" : "Disarm command sent. The site siren will stay silent until re-armed"
    );

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Crew link copied");
    } catch {
      setNotice(text);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const mapUrl = alert.lat != null && alert.lng != null ? `https://maps.google.com/?q=${alert.lat},${alert.lng}` : null;

  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} variant="drawer" className="max-w-2xl">
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 px-6 pb-5 pt-6 text-white dark:border-slate-800">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-500/20 blur-3xl" />
          <div className="relative flex items-start gap-4 pr-12">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${ev.tone}`}>{ev.icon}</div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/80">Incident #{alert.id}</p>
              <h3 className="mt-1 truncate text-xl font-semibold">{alert.transformerName || "Unknown transformer"}</h3>
              <p className="mt-1 text-sm text-blue-100/90">{eventText(alert)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${STATUS_META[status].chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`} />
                  {STATUS_META[status].label}
                </span>
                {alert.outcome ? (
                  <span className={`rounded-full border px-2.5 py-1 font-semibold ${outcomeChip(alert.outcome)}`}>{outcomeLabel(alert.outcome)}</span>
                ) : null}
                <span className="rounded-full bg-white/10 px-2.5 py-1">{alert.depotName || "No depot"}</span>
                {alert.supplierName || alert.supplierCode ? (
                  <span className="rounded-full bg-white/10 px-2.5 py-1">Partner: {alert.supplierName || alert.supplierCode}</span>
                ) : null}
                {(alert.occurrenceCount ?? 1) > 1 ? (
                  <span className="rounded-full bg-red-500/80 px-2.5 py-1 font-semibold">×{alert.occurrenceCount} triggers</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Lifecycle stepper */}
          <ol className="relative mt-5 grid grid-cols-6 gap-1">
            {STEPS.map((step, i) => {
              const at = step.at(item);
              const done = Boolean(at);
              return (
                <li key={step.key} className="min-w-0">
                  <div className="flex items-center">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done ? "bg-emerald-400 text-emerald-950" : "bg-white/15 text-white/60"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {i < STEPS.length - 1 ? <span className={`ml-1 h-0.5 flex-1 rounded ${done ? "bg-emerald-400/70" : "bg-white/15"}`} /> : null}
                  </div>
                  <p className="mt-1.5 truncate text-[10px] font-semibold text-white/90">{step.label}</p>
                  <p className="truncate text-[10px] text-blue-100/70">{done ? formatTime(at) : "—"}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</div>
          ) : null}

          {/* Facts */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Fact label="Detected" value={formatTime(alert.createdAt)} sub={`${formatElapsed(minutesSince(alert.createdAt))} ago`} />
            <Fact label="Last trigger" value={formatTime(alert.lastSeenAt || alert.createdAt)} />
            <Fact label="Device" value={alert.deviceName || alert.deviceId || "—"} />
            <Fact label="Handled by" value={alert.assignedToName || alert.assignedToEmail || "Unassigned"} />
          </div>
          <div className="flex flex-wrap gap-2">
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">
                <MapPin className="h-3.5 w-3.5" /> Open location
              </a>
            ) : null}
            {alert.transformerId ? (
              <Link to={`/transformer/${alert.transformerId}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">
                <ExternalLink className="h-3.5 w-3.5" /> Transformer & controls
              </Link>
            ) : null}
          </div>

          {/* Site controls: arm / disarm */}
          {alert.transformerId && (canArm || canDisarm) ? (
            <section className="rounded-[22px] border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Site controller</h4>
                {device ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ${
                        device.status === "ONLINE"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : device.status === "DELAYED"
                            ? "bg-amber-50 text-amber-700 ring-amber-200"
                            : "bg-red-50 text-red-700 ring-red-200"
                      }`}
                    >
                      <SignalHigh className="h-3 w-3" /> {device.status.replace("_", " ").toLowerCase()}
                    </span>
                    {device.lastCommandAction ? (
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        {device.lastCommandAction === "ARM" ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldOff className="h-3.5 w-3.5 text-amber-600" />}
                        Last: {device.lastCommandAction === "ARM" ? "armed" : "disarmed"} ({(device.lastCommandStatus || "").toLowerCase()}) {formatTime(device.lastCommandAt)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {device && device.controllerCount === 0 ? (
                <p className="mt-2 text-xs text-amber-700">No controller is linked to this transformer, so it cannot be armed or disarmed remotely.</p>
              ) : confirmControl ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  <span className="flex-1">
                    {confirmControl === "disarm"
                      ? "Disarming silences the site siren and stops new alerts until it is armed again. Continue?"
                      : "Arm the site? The siren will sound on the next intrusion."}
                  </span>
                  <SmallBtn onClick={() => setConfirmControl(null)}>Cancel</SmallBtn>
                  <SmallBtn
                    onClick={() => sendControl(confirmControl)}
                    busy={busy === `control-${confirmControl}`}
                    icon={confirmControl === "arm" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                    tone={confirmControl === "disarm" ? "danger" : undefined}
                  >
                    Yes, {confirmControl}
                  </SmallBtn>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canArm}
                    onClick={() => setConfirmControl("arm")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    <ShieldCheck className="h-4 w-4" /> Arm site
                  </button>
                  <button
                    type="button"
                    disabled={!canDisarm}
                    onClick={() => setConfirmControl("disarm")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-40 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    <ShieldOff className="h-4 w-4" /> Disarm site
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {/* Current dispatch */}
          {item.dispatches.length > 0 ? (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vehicles</h4>
              {item.dispatches.map((d) => {
                const active = d === current || d.status === "DISPATCHED" || d.status === "ACCEPTED" || d.status === "ON_SCENE";
                return (
                  <div
                    key={d.id}
                    className={`rounded-2xl border p-3 ${active ? "border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10" : "border-slate-200 opacity-75 dark:border-slate-800"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{vehicleLabel(d)}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                          {d.status.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">sent {formatTime(d.dispatchedAt)} by {d.dispatchedByEmail || "—"}</span>
                    </div>
                    {d.crewLeadName || d.crewLeadPhone ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Phone className="h-3.5 w-3.5" /> {d.crewLeadName || "Crew lead"} {d.crewLeadPhone ? `· ${d.crewLeadPhone}` : ""}
                      </p>
                    ) : null}
                    {d.lastCrewNote ? <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-300">“{d.lastCrewNote}”</p> : null}
                    {active && isOpen && canDispatch ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {d.status === "DISPATCHED" ? (
                          <SmallBtn onClick={() => crewStatus(d, "ACCEPTED")} busy={busy === "crew-ACCEPTED"} icon={<Navigation className="h-3.5 w-3.5" />}>
                            Crew en route
                          </SmallBtn>
                        ) : null}
                        {d.status !== "ON_SCENE" ? (
                          <SmallBtn onClick={() => crewStatus(d, "ON_SCENE")} busy={busy === "crew-ON_SCENE"} icon={<MapPin className="h-3.5 w-3.5" />}>
                            Crew on scene
                          </SmallBtn>
                        ) : null}
                        {d.crewLink ? (
                          <SmallBtn onClick={() => copy(d.crewLink!)} icon={<ClipboardCopy className="h-3.5 w-3.5" />}>
                            Copy crew link
                          </SmallBtn>
                        ) : null}
                        <SmallBtn onClick={() => crewStatus(d, "CANCELLED")} busy={busy === "crew-CANCELLED"} icon={<Undo2 className="h-3.5 w-3.5" />} tone="danger">
                          Recall
                        </SmallBtn>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null}

          {/* Actions */}
          {isOpen ? (
            <section className="space-y-3 rounded-[22px] border border-slate-200 p-4 dark:border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Next step</h4>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Note (optional): call outcome, directions for the crew…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />

              {status === "NEW" && canAck ? (
                <PrimaryBtn onClick={acknowledge} busy={busy === "ack"} icon={<UserCheck className="h-4 w-4" />}>
                  Acknowledge alert
                </PrimaryBtn>
              ) : null}

              {canDispatch ? (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {current ? "Send another vehicle" : "Dispatch a response vehicle"}
                  </label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">{vehicleOptions.length ? "Choose a vehicle…" : "No vehicles registered. Add some under Fleet."}</option>
                    {vehicleOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.status === "AVAILABLE" ? "🟢" : "🔵"} {vehicleLabel(v)} · {v.depotName || "No depot"}
                        {alert.depotId && v.depotId === alert.depotId ? " (same depot)" : ""}
                        {v.status === "DISPATCHED" ? ` · busy${v.currentTransformerName ? ` at ${v.currentTransformerName}` : ""}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedVehicle ? (
                    <p className="text-[11px] text-slate-500">
                      Crew lead: {selectedVehicle.crewLeadName || "not set"}
                      {selectedVehicle.crewLeadPhone ? ` · ${selectedVehicle.crewLeadPhone}` : ""}
                      {selectedVehicle.crewLeadWhatsapp ? ` · WhatsApp ${selectedVehicle.crewLeadWhatsapp}` : ""}
                    </p>
                  ) : null}
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={notifyCrew} onChange={(e) => setNotifyCrew(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                    Message the crew lead (SMS / WhatsApp / email) with their response link
                  </label>
                  <PrimaryBtn
                    onClick={() => dispatch(selectedVehicle?.status === "DISPATCHED")}
                    busy={busy === "dispatch"}
                    disabled={!vehicleId}
                    icon={<Siren className="h-4 w-4" />}
                    tone="blue"
                  >
                    {selectedVehicle?.status === "DISPATCHED" ? "Reassign busy vehicle" : "Dispatch vehicle"}
                  </PrimaryBtn>
                </div>
              ) : null}

              {canClose ? (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Close the incident: what was found?</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {OUTCOMES.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        data-on={outcome === o.key}
                        title={o.hint}
                        onClick={() => setOutcome(o.key)}
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${o.tone}`}
                      >
                        {o.label}
                        <span className="mt-0.5 block text-[10px] font-normal opacity-80">{o.hint}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    rows={2}
                    placeholder="What the crew found, damage, police case number…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <PrimaryBtn onClick={closeIncident} busy={busy === "close"} disabled={!outcome} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald">
                    Close incident
                  </PrimaryBtn>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="rounded-[22px] border border-emerald-200 bg-emerald-50/60 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Closed as {outcomeLabel(alert.outcome || (status === "FALSE_ALARM" ? "FALSE_ALARM" : null))}
              </p>
              <p className="mt-1 text-emerald-900/80 dark:text-emerald-200/80">
                {alert.outcomeNote || alert.lastActionNote || "No closing note."} {alert.closedByName ? `By ${alert.closedByName}.` : ""}
              </p>
            </section>
          )}

          {/* Timeline */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Activity</h4>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-slate-800">
              {timeline.length === 0 ? <li className="text-xs text-slate-500">No activity recorded yet.</li> : null}
              {timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 dark:border-slate-900" />
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{t.note || t.activityType.replace(/_/g, " ").toLowerCase()}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock3 className="h-3 w-3" /> {formatTime(t.createdAt)} · {t.actorName || t.actorEmail || "system"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Modal>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  busy,
  disabled,
  icon,
  tone = "dark",
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  tone?: "dark" | "blue" | "emerald";
}) {
  const tones = {
    dark: "bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950",
    blue: "bg-blue-600 hover:bg-blue-700",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon ?? <Send className="h-4 w-4" />}
      {children}
    </button>
  );
}

function SmallBtn({
  children,
  onClick,
  busy,
  icon,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  icon?: ReactNode;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
        tone === "danger"
          ? "border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
