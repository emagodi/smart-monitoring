import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock3, Loader2, MapPin, Navigation, ShieldAlert, Truck } from "lucide-react";
import { API_BASE_URL, EVENT_META, OUTCOMES, Outcome, apiError, eventKind, formatTime, outcomeLabel } from "./shared";

type CrewView = {
  transformerName?: string | null;
  transformerType?: string | null;
  event?: string | null;
  depotName?: string | null;
  lat?: number | null;
  lng?: number | null;
  detectedAt?: string | null;
  occurrenceCount?: number | null;
  caseStatus?: string | null;
  outcome?: Outcome | null;
  vehicleRegistration?: string | null;
  vehicleCallSign?: string | null;
  crewLeadName?: string | null;
  dispatchStatus?: string | null;
  dispatchNote?: string | null;
  dispatchedAt?: string | null;
  acceptedAt?: string | null;
  onSceneAt?: string | null;
  completedAt?: string | null;
  canAccept: boolean;
  canArrive: boolean;
  canClose: boolean;
};

/**
 * Public page opened from the SMS / WhatsApp link a crew receives at dispatch.
 * No login: the token in the URL identifies exactly one dispatch.
 */
export default function CrewRespond() {
  const { token } = useParams();
  const [view, setView] = useState<CrewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const base = `${API_BASE_URL}/api/v1/public/response/${token}`;

  const load = useCallback(async () => {
    try {
      const res = await axios.get(base);
      setView(res.data as CrewView);
      setError(null);
    } catch (e) {
      setError(apiError(e, "This link is not valid or has expired."));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: "accept" | "arrive" | "close") => {
    try {
      setBusy(action);
      setError(null);
      const body = action === "close" ? { outcome, note: note || undefined } : { note: note || undefined };
      const res = await axios.post(`${base}/${action}`, body);
      setView(res.data as CrewView);
      setNote("");
    } catch (e) {
      setError(apiError(e, "Could not update. Check your signal and try again."));
    } finally {
      setBusy(null);
    }
  };

  const ev = EVENT_META[eventKind({ value: view?.event, message: view?.event, sensorType: null })];
  const mapUrl = view?.lat != null && view?.lng != null ? `https://maps.google.com/?q=${view.lat},${view.lng}` : null;
  const navUrl = view?.lat != null && view?.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${view.lat},${view.lng}` : null;
  const closed = view && (view.caseStatus === "RESOLVED" || view.caseStatus === "FALSE_ALARM" || view.dispatchStatus === "COMPLETED");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#031c42_0%,#0a4ec6_100%)] px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="rounded-2xl bg-white px-3 py-1.5 shadow-lg ring-1 ring-white/50">
            <img src="/images/powertel.png" alt="Powertel" className="h-7 w-auto" />
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">Rapid response</span>
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-950">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading job…
            </div>
          ) : !view ? (
            <div className="px-6 py-16 text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-800">{error || "Link not found"}</p>
              <p className="mt-1 text-xs text-slate-500">Call the contact centre for instructions.</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-slate-950 to-blue-900 px-5 pb-5 pt-5 text-white">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${ev.tone}`}>{ev.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{view.transformerName || "Transformer"}</p>
                    <p className="text-sm text-blue-100/90">{view.event || ev.label}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Info label="Detected" value={formatTime(view.detectedAt)} />
                  <Info label="Depot" value={view.depotName || "—"} />
                  <Info label="Type" value={view.transformerType || "—"} />
                  <Info label="Vehicle" value={view.vehicleCallSign || view.vehicleRegistration || "—"} />
                </div>
                {view.dispatchNote ? <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs">Dispatcher: {view.dispatchNote}</p> : null}
              </div>

              <div className="space-y-4 px-5 py-5">
                {navUrl ? (
                  <div className="grid grid-cols-2 gap-2">
                    <a href={navUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
                      <Navigation className="h-4 w-4" /> Navigate
                    </a>
                    <a href={mapUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                      <MapPin className="h-4 w-4" /> View map
                    </a>
                  </div>
                ) : null}

                <ol className="space-y-2">
                  <Step done={Boolean(view.dispatchedAt)} label="Dispatched" at={view.dispatchedAt} />
                  <Step done={Boolean(view.acceptedAt)} label="Accepted · on the way" at={view.acceptedAt} />
                  <Step done={Boolean(view.onSceneAt)} label="Arrived on scene" at={view.onSceneAt} />
                  <Step done={Boolean(closed)} label={closed ? `Closed · ${outcomeLabel(view.outcome)}` : "Closed with outcome"} at={view.completedAt} />
                </ol>

                {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

                {closed ? (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-center text-sm text-emerald-800">
                    <CheckCircle2 className="mx-auto mb-1 h-6 w-6" /> Job closed. Thank you.
                  </div>
                ) : (
                  <>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Note for the contact centre (optional)"
                      className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-300"
                    />
                    {view.canAccept ? (
                      <BigBtn onClick={() => act("accept")} busy={busy === "accept"} tone="bg-blue-600" icon={<Truck className="h-5 w-5" />}>
                        Accept · we are on our way
                      </BigBtn>
                    ) : null}
                    {view.canArrive ? (
                      <BigBtn onClick={() => act("arrive")} busy={busy === "arrive"} tone="bg-violet-600" icon={<MapPin className="h-5 w-5" />}>
                        We have arrived
                      </BigBtn>
                    ) : null}
                    {view.canClose ? (
                      <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-600">What did you find?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {OUTCOMES.map((o) => (
                            <button
                              key={o.key}
                              type="button"
                              data-on={outcome === o.key}
                              onClick={() => setOutcome(o.key)}
                              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${o.tone}`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        <BigBtn onClick={() => act("close")} busy={busy === "close"} disabled={!outcome} tone="bg-emerald-600" icon={<CheckCircle2 className="h-5 w-5" />}>
                          Close job
                        </BigBtn>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-[11px] text-blue-100/70">Powertel · ZESA Private Limited · Transformer security</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-blue-200/80">{label}</p>
      <p className="break-words font-semibold leading-snug">{value}</p>
    </div>
  );
}

function Step({ done, label, at }: { done: boolean; label: string; at?: string | null }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
        {done ? "✓" : <Clock3 className="h-3.5 w-3.5" />}
      </span>
      <span className={`flex-1 text-sm ${done ? "font-semibold text-slate-900" : "text-slate-500"}`}>{label}</span>
      <span className="text-xs text-slate-400">{at ? formatTime(at) : ""}</span>
    </li>
  );
}

function BigBtn({
  children,
  onClick,
  busy,
  disabled,
  tone,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-50 ${tone}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
