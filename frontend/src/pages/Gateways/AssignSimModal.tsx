import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertCircle, ArrowRight, CardSim, Check, KeyRound, Link2, Loader2, Lock, NotebookPen, Router, Search, Signal, X } from "lucide-react";
import { PinPukFields, pinPukError, type PinPuk } from "../Sims/PinPukFields";

/**
 * Put a SIM into a gateway, starting from the gateway. Same look as the SIM page's assign window:
 * 1) pick a spare SIM (search by the last digits printed on it), 2) slot, reason, PIN/PUK.
 */

interface AvailableSim {
  id: number;
  iccid: string;
  msisdn?: string | null;
  operator?: string | null;
  status?: string | null;
  hasPin?: boolean | null;
  hasPuk?: boolean | null;
}

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  for (const key of ["content", "data", "items", "records"]) {
    const v = obj?.[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
};
const tail = (v?: string | null) => (v ? v.replace(/\*/g, "").slice(-4) : "");

export function AssignSimModal({
  isOpen,
  onClose,
  gatewayId,
  gatewayName,
  onSaved,
  headers,
  apiBaseUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  gatewayId: number;
  gatewayName?: string | null;
  onSaved: () => void;
  headers: Record<string, string>;
  apiBaseUrl: string;
}) {
  const [sims, setSims] = useState<AvailableSim[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simId, setSimId] = useState<number | null>(null);
  const [slot, setSlot] = useState(1);
  const [reason, setReason] = useState("");
  const [codes, setCodes] = useState<PinPuk>({ pin: "", puk: "" });
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await axios.get(`${apiBaseUrl}/api/v1/sim-cards/available?size=2000`, { headers });
      setSims(normalizeList<AvailableSim>(r.data));
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(`Could not load spare SIMs: ${ax.response?.data?.message || ax.message || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, headers]);

  useEffect(() => {
    if (!isOpen || !gatewayId) return;
    setSimId(null);
    setSlot(1);
    setReason("");
    setCodes({ pin: "", puk: "" });
    setQ("");
    setError(null);
    void load();
  }, [isOpen, gatewayId, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, busy, onClose]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s/g, "");
    const list = term ? sims.filter((s) => [s.iccid, s.msisdn, s.operator].some((v) => (v || "").toLowerCase().replace(/\s/g, "").includes(term))) : sims;
    return list.slice(0, 200);
  }, [sims, q]);

  if (!isOpen) return null;
  const selected = sims.find((s) => s.id === simId) || null;
  const codeErr = pinPukError(codes);

  const submit = async () => {
    if (!selected) return;
    if (codeErr) return setError(codeErr);
    setBusy(true);
    setError(null);
    try {
      await axios.post(
        `${apiBaseUrl}/api/v1/gateways/${gatewayId}/sims/assign`,
        { simId: selected.id, slotNumber: slot, reason: reason || "Assigned from gateway details", pin: codes.pin || undefined, puk: codes.puk || undefined },
        { headers }
      );
      onSaved();
      onClose();
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(`Could not assign the SIM: ${ax.response?.data?.message || ax.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100001] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[26px] dark:bg-slate-950">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-red-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <CardSim className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/80">Assign SIM</p>
              <h3 className="text-lg font-semibold">Put a SIM in this gateway</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip>
                  <Router className="h-3 w-3" /> {gatewayName || `Gateway #${gatewayId}`}
                </Chip>
                <Chip>
                  <CardSim className="h-3 w-3" /> {loading ? "loading stock…" : `${sims.length.toLocaleString()} spare SIMs`}
                </Chip>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full bg-white/10 p-2 text-blue-100 ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-5 dark:bg-slate-900/40">
          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <Step n={1} title="Choose the SIM" hint={selected ? `Selected: •••• ${tail(selected.iccid)}` : "Type the last digits printed on the SIM card"} done={Boolean(selected)} />
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                inputMode="numeric"
                placeholder="Last digits of the ICCID or phone number…"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {q ? (
                <button type="button" onClick={() => setQ("")} className="absolute right-3 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
            <div className="mt-2.5 grid max-h-[300px] gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
              {loading ? (
                <p className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Loading spare SIMs…
                </p>
              ) : !shown.length ? (
                <div className="col-span-full py-10 text-center">
                  <CardSim className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-1 text-sm text-slate-500">{sims.length ? `No spare SIM matches “${q}”.` : "No spare SIMs. Add or upload SIMs on the SIM cards page."}</p>
                </div>
              ) : (
                shown.map((s) => {
                  const on = s.id === simId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSimId(on ? null : s.id)}
                      aria-pressed={on}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition ${
                        on ? "bg-gradient-to-r from-blue-50 via-white to-red-50 ring-2 ring-blue-500 shadow-md shadow-blue-600/10 dark:from-blue-500/15 dark:via-slate-950 dark:to-red-500/10" : "bg-white ring-slate-200 hover:ring-blue-300 dark:bg-slate-900 dark:ring-slate-800"
                      }`}
                    >
                      <span className="relative flex h-10 w-8 shrink-0 items-center justify-center rounded-md rounded-tr-xl bg-gradient-to-br from-blue-600 via-[#0b4fc4] to-red-500 shadow-sm">
                        <span className="h-3 w-4 rounded-sm bg-gradient-to-br from-amber-200 to-amber-400" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-50">•••• {tail(s.iccid)}</span>
                        <span className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                          <Signal className="h-3 w-3 shrink-0" />
                          {s.operator || "No operator"}
                          {s.msisdn ? ` · ••• ${tail(s.msisdn)}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <Mini ok={s.hasPin} icon={<KeyRound className="h-2.5 w-2.5" />} label="PIN" />
                        <Mini ok={s.hasPuk} icon={<Lock className="h-2.5 w-2.5" />} label="PUK" />
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-gradient-to-br from-blue-600 to-red-500 text-white" : "ring-1 ring-slate-300 dark:ring-slate-700"}`}>
                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {shown.length === 200 ? <p className="mt-1.5 text-[11px] text-slate-400">Showing the first 200 — type more digits to narrow it down.</p> : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <Step n={2} title="Slot, reason and codes" hint="PIN and PUK are optional and stored encrypted" />
            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Slot</p>
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-900">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSlot(n)}
                      className={`h-9 w-11 rounded-lg text-sm font-semibold transition ${slot === n ? "bg-gradient-to-br from-blue-600 to-[#0b4fc4] text-white shadow-sm shadow-blue-600/25" : "text-slate-600 hover:text-blue-700 dark:text-slate-300"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Reason (optional)</span>
                <span className="relative block">
                  <NotebookPen className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. New install, replacement SIM"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </span>
              </label>
            </div>
            <div className="mt-3">
              <PinPukFields value={codes} onChange={setCodes} hasPin={selected?.hasPin} hasPuk={selected?.hasPuk} />
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
              {selected ? (
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30">•••• {tail(selected.iccid)}</span>
              ) : (
                <span className="italic">pick a SIM</span>
              )}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                {gatewayName || `Gateway #${gatewayId}`} <span className="font-normal text-slate-500">· slot {slot}</span>
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Cancel
              </button>
              <button
                type="button"
                disabled={!selected || busy || Boolean(codeErr)}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-[#0b4fc4] to-red-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {busy ? "Assigning…" : "Assign SIM"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-blue-50 ring-1 ring-white/15">{children}</span>;
}

function Mini({ ok, icon, label }: { ok?: boolean | null; icon: ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 text-[9px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
      {icon}
      {label} {ok ? "✓" : "—"}
    </span>
  );
}

function Step({ n, title, hint, done }: { n: number; title: string; hint?: string; done?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${done ? "bg-emerald-500" : "bg-gradient-to-br from-blue-600 to-red-500"}`}>
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h4>
        {hint ? <p className="truncate text-[11px] text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}
