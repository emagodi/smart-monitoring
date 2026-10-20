import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, KeyRound, Link2, Loader2, Lock, MapPin, NotebookPen, Router, Search, Signal, X } from "lucide-react";
import { PinPukFields, pinPukError, type PinPuk } from "./PinPukFields";

/**
 * "Put this SIM in a gateway": a bottom sheet on phones and a centred window on larger screens.
 * 1) pick the gateway (search + online/offline filter), 2) slot, reason and the PIN/PUK from the SIM plastic.
 */

export type AssignGateway = { id: number; name: string; regionName?: string | null; depotName?: string | null; effectiveStatus?: string | null };
export type AssignSim = { id: number; iccid: string; operator?: string | null; hasPin?: boolean | null; hasPuk?: boolean | null; slotNumber?: number | null };
export type AssignPayload = { gatewayId: number; slot: number; reason: string; codes: PinPuk };

const tail = (v?: string | null) => (v ? v.replace(/\*/g, "").slice(-4) : "");
const statusOf = (s?: string | null) => {
  const v = (s || "").toUpperCase();
  if (v.includes("ONLINE")) return { key: "online", label: "Online", dot: "bg-emerald-500", tile: "from-emerald-500 to-teal-600", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" };
  if (v.includes("DEGRADED")) return { key: "degraded", label: "Degraded", dot: "bg-amber-500", tile: "from-amber-500 to-orange-600", pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30" };
  if (v.includes("OFFLINE")) return { key: "offline", label: "Offline", dot: "bg-red-500", tile: "from-red-500 to-rose-600", pill: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30" };
  return { key: "other", label: v ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "Unknown", dot: "bg-slate-400", tile: "from-slate-400 to-slate-500", pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" };
};
const place = (g: AssignGateway) => [g.depotName, g.regionName].filter((x) => x && x.trim()).join(" · ");

type Filter = "all" | "online" | "offline";

export function AssignSimSheet({
  open,
  sim,
  gateways,
  loading,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  sim: AssignSim | null;
  gateways: AssignGateway[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (p: AssignPayload) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [gatewayId, setGatewayId] = useState<number | null>(null);
  const [slot, setSlot] = useState(1);
  const [reason, setReason] = useState("");
  const [codes, setCodes] = useState<PinPuk>({ pin: "", puk: "" });

  useEffect(() => {
    if (!open) return;
    setQ("");
    setFilter("all");
    setGatewayId(null);
    setSlot(sim?.slotNumber || 1);
    setReason("");
    setCodes({ pin: "", puk: "" });
  }, [open, sim]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const counts = useMemo(() => {
    let online = 0;
    let offline = 0;
    for (const g of gateways) {
      const k = statusOf(g.effectiveStatus).key;
      if (k === "online") online++;
      else if (k === "offline") offline++;
    }
    return { all: gateways.length, online, offline };
  }, [gateways]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return gateways
      .filter((g) => filter === "all" || statusOf(g.effectiveStatus).key === filter)
      .filter((g) => !term || [g.name, g.regionName, g.depotName].join(" ").toLowerCase().includes(term))
      .slice(0, 80);
  }, [gateways, q, filter]);

  if (!open || !sim) return null;
  const selected = gateways.find((g) => g.id === gatewayId) || null;
  const codeErr = pinPukError(codes);
  const canSubmit = Boolean(selected) && !codeErr && !busy;

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[26px] dark:bg-slate-950">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-red-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Link2 className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/80">Assign SIM</p>
              <h3 className="text-lg font-semibold">Put this SIM in a gateway</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip>
                  <span className="font-mono tracking-wide">•••• {tail(sim.iccid)}</span>
                </Chip>
                {sim.operator ? (
                  <Chip>
                    <Signal className="h-3 w-3" /> {sim.operator}
                  </Chip>
                ) : null}
                <Chip tone={sim.hasPin ? "good" : "warn"}>
                  <KeyRound className="h-3 w-3" /> PIN {sim.hasPin ? "on file" : "not set"}
                </Chip>
                <Chip tone={sim.hasPuk ? "good" : "warn"}>
                  <Lock className="h-3 w-3" /> PUK {sim.hasPuk ? "on file" : "not set"}
                </Chip>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full bg-white/10 p-2 text-blue-100 ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-5 dark:bg-slate-900/40">
          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          {/* Step 1: gateway */}
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <StepTitle n={1} title="Choose the gateway" hint={selected ? `Selected: ${selected.name}` : `${counts.all.toLocaleString()} gateways`} done={Boolean(selected)} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex flex-1 items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search gateway, depot or region…"
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {q ? (
                  <button type="button" onClick={() => setQ("")} className="absolute right-3 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <div className="inline-flex shrink-0 rounded-full bg-slate-100 p-0.5 dark:bg-slate-900">
                {(
                  [
                    ["all", "All", counts.all, ""],
                    ["online", "Online", counts.online, "bg-emerald-500"],
                    ["offline", "Offline", counts.offline, "bg-red-500"],
                  ] as Array<[Filter, string, number, string]>
                ).map(([k, l, n, dot]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      filter === k ? "bg-gradient-to-r from-blue-600 to-[#0b4fc4] text-white shadow-sm shadow-blue-600/25" : "text-slate-600 hover:text-blue-700 dark:text-slate-300"
                    }`}
                  >
                    {dot ? <span className={`h-1.5 w-1.5 rounded-full ${filter === k ? "bg-white" : dot}`} /> : null}
                    {l}
                    <span className={`text-[10px] ${filter === k ? "text-blue-100" : "text-slate-400"}`}>{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 max-h-[300px] space-y-1.5 overflow-y-auto pr-0.5">
              {loading ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Loading gateways…
                </p>
              ) : !shown.length ? (
                <div className="py-10 text-center">
                  <Router className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-1 text-sm text-slate-500">{gateways.length ? "No gateway matches." : "No gateways yet."}</p>
                </div>
              ) : (
                shown.map((g) => {
                  const st = statusOf(g.effectiveStatus);
                  const on = g.id === gatewayId;
                  const where = place(g);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGatewayId(on ? null : g.id)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition ${
                        on
                          ? "bg-gradient-to-r from-blue-50 via-white to-red-50 ring-2 ring-blue-500 shadow-md shadow-blue-600/10 dark:from-blue-500/15 dark:via-slate-950 dark:to-red-500/10"
                          : "bg-white ring-slate-200 hover:ring-blue-300 hover:shadow-sm dark:bg-slate-900 dark:ring-slate-800"
                      }`}
                    >
                      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${st.tile}`}>
                        <Router className="h-5 w-5" />
                        {st.key === "online" ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 ring-2 ring-white dark:ring-slate-900" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{g.name}</span>
                        <span className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {where || "No depot set"}
                        </span>
                      </span>
                      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 sm:inline-flex ${st.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${on ? "bg-gradient-to-br from-blue-600 to-red-500 text-white" : "ring-1 ring-slate-300 dark:ring-slate-700"}`}>
                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Step 2: slot, reason, codes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <StepTitle n={2} title="Slot, reason and codes" hint="PIN and PUK are optional and stored encrypted" />
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
              <PinPukFields value={codes} onChange={setCodes} hasPin={sim.hasPin} hasPuk={sim.hasPuk} />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30">•••• {tail(sim.iccid)}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-red-500" />
              {selected ? (
                <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                  {selected.name} <span className="font-normal text-slate-500">· slot {slot}</span>
                </span>
              ) : (
                <span className="italic">pick a gateway</span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => selected && onSubmit({ gatewayId: selected.id, slot, reason, codes })}
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

function Chip({ children, tone }: { children: ReactNode; tone?: "good" | "warn" }) {
  const t = tone === "good" ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/30" : tone === "warn" ? "bg-amber-400/15 text-amber-100 ring-amber-300/30" : "bg-white/10 text-blue-50 ring-white/15";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${t}`}>{children}</span>;
}

function StepTitle({ n, title, hint, done }: { n: number; title: string; hint?: string; done?: boolean }) {
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
