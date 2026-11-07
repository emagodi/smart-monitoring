import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Hammer,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Button, Dialog, Field, inputCls, Notice } from "../../components/ui/page";
import { cachedGet } from "../../lib/cache";
import { useGeography, depotDistrictId, districtRegionId } from "../Registry/geo";
import { apiError } from "../Response/shared";
import {
  EVENT_LABEL,
  REQUEST_META,
  STATUS_META,
  fmtDate,
  fmtDateTime,
  lifecyclePost,
  todayIso,
  who,
  type InstallRequest,
  type InstallStatus,
  type Installation,
  type LifecycleEvent,
  type RequestStatus,
} from "./shared";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

// ------------------------------------------------------------------ badges and stepper

export function StatusBadge({ status, attempts }: { status: InstallStatus; attempts?: number }) {
  const m = STATUS_META[status] ?? STATUS_META.INSTALLED;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.short}
      {attempts && attempts > 0 && status !== "INSTALLED" && status !== "READY" ? <span className="font-medium opacity-70">· try {attempts}</span> : null}
    </span>
  );
}

export function RequestBadge({ status }: { status: RequestStatus }) {
  const m = REQUEST_META[status] ?? REQUEST_META.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const STEPS: Array<{ key: string; label: string; icon: ReactNode }> = [
  { key: "INSTALLED", label: "Installed", icon: <Hammer className="h-3.5 w-3.5" /> },
  { key: "READY", label: "Ready", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { key: "SCHEDULED", label: "Scheduled", icon: <CalendarClock className="h-3.5 w-3.5" /> },
  { key: "COMMISSIONED", label: "Commissioned", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

/** Installed → Ready → Scheduled → Commissioned, with the failed state shown on the last step. */
export function Stepper({ status }: { status: InstallStatus }) {
  const step = STATUS_META[status]?.step ?? 0;
  const failed = status === "FAILED";
  return (
    <ol className="flex w-full items-center gap-1.5 sm:gap-2">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = status === "COMMISSIONED" ? true : n < step || (n === step && status !== "FAILED");
        const isFailStep = failed && n === 4;
        const current = n === step + 1 && !failed && status !== "COMMISSIONED" && status !== "CANCELLED";
        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 ${
                isFailStep
                  ? "bg-red-500 text-white ring-red-200 dark:ring-red-500/30"
                  : done
                    ? "bg-emerald-500 text-white ring-emerald-200 dark:ring-emerald-500/30"
                    : current
                      ? "bg-blue-600 text-white ring-blue-200 dark:ring-blue-500/30"
                      : "bg-white text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
              }`}
            >
              {isFailStep ? <X className="h-3.5 w-3.5" /> : done ? <Check className="h-3.5 w-3.5" /> : s.icon}
            </span>
            <span className={`hidden truncate text-[11px] font-semibold sm:block ${isFailStep ? "text-red-600" : done || current ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>
              {isFailStep ? "Failed" : s.label}
            </span>
            {i < STEPS.length - 1 ? <span className={`h-0.5 min-w-3 flex-1 rounded ${n < step || status === "COMMISSIONED" ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ timeline

export function Timeline({ events }: { events: LifecycleEvent[] }) {
  if (!events.length) return <p className="px-1 py-6 text-center text-sm text-slate-500">Nothing recorded yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-5 dark:border-slate-800">
      {events.map((e) => {
        const tone =
          e.eventType === "COMMISSIONED" || e.eventType === "REQUEST_APPROVED"
            ? "bg-emerald-500"
            : e.eventType.includes("FAIL") || e.eventType.includes("DECLINED") || e.eventType.includes("CANCEL")
              ? "bg-red-500"
              : e.eventType.includes("READY")
                ? "bg-violet-500"
                : e.eventType.includes("SCHEDULED")
                  ? "bg-amber-500"
                  : "bg-blue-500";
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-950 ${tone}`} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{EVENT_LABEL[e.eventType] ?? e.eventType.replace(/_/g, " ").toLowerCase()}</p>
              <p className="text-[11px] text-slate-500">{fmtDateTime(e.createdAt)}</p>
            </div>
            <p className="text-xs text-slate-500">
              <span className="font-medium capitalize text-slate-600 dark:text-slate-300">{who(e.actorEmail)}</span>
              {e.actorOrg ? <span className="ml-1 rounded bg-slate-100 px-1 py-px text-[10px] font-semibold text-slate-500 dark:bg-slate-800">{e.actorOrg === "PARTNER" ? "Partner" : "ZESA group"}</span> : null}
              {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus ? (
                <span className="ml-1">
                  · {e.fromStatus.toLowerCase()} → {e.toStatus.toLowerCase()}
                </span>
              ) : null}
            </p>
            {e.note ? <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{e.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ pickers

/** Partner (contractor) code → name, taken from the transformer registry so it matches what the system already knows. */
export function usePartners(token: string | null | undefined) {
  const [partners, setPartners] = useState<Array<[string, string]>>([]);
  useEffect(() => {
    if (!token) return;
    cachedGet<{ partners?: Record<string, string> }>(`${BASE}/api/v1/transformers/registry/page?page=0&size=1`, token, 300_000)
      .then((r) => setPartners(Object.entries(r?.partners ?? {}).sort((a, b) => a[1].localeCompare(b[1]))))
      .catch(() => setPartners([]));
  }, [token]);
  return partners;
}

type TxHit = { id: number; name: string; transformerNumber?: string | null; depotId?: number | null; supplierName?: string | null };

export function TransformerPicker({
  token,
  depotId,
  value,
  onChange,
}: {
  token: string | null | undefined;
  depotId?: number | null;
  value: TxHit[];
  onChange: (v: TxHit[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TxHit[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ page: "0", size: "12", sort: "name", dir: "asc" });
      if (q.trim()) qs.set("q", q.trim());
      if (depotId) qs.set("depotIds", String(depotId));
      setBusy(true);
      cachedGet<{ content: TxHit[] }>(`${BASE}/api/v1/transformers/registry/page?${qs}`, token, 20_000)
        .then((r) => setHits(r?.content ?? []))
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, depotId, token]);
  const picked = new Set(value.map((v) => v.id));
  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-blue-600 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-white">
              <Zap className="h-3 w-3" />
              {t.name}
              {t.transformerNumber ? <span className="opacity-75">· {t.transformerNumber}</span> : null}
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== t.id))} className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${t.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transformer name or number…" className={`${inputCls} pl-9`} />
        {busy ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" /> : null}
      </label>
      <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
        {hits.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">{busy ? "Searching…" : depotId ? "No transformers found in this depot." : "No transformers found."}</p>
        ) : (
          hits.map((t) => {
            const on = picked.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(on ? value.filter((v) => v.id !== t.id) : [...value, t])}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 dark:border-slate-800 ${on ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                  {on ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {t.transformerNumber ? `No. ${t.transformerNumber}` : "No number"}
                    {t.supplierName ? ` · ${t.supplierName}` : ""}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Region → depot selects (depot users are fixed to their depot). */
export function DepotSelect({
  token,
  regionId,
  depotId,
  onChange,
  lockedDepotId,
}: {
  token: string | null | undefined;
  regionId: number | null;
  depotId: number | null;
  onChange: (v: { regionId: number | null; regionName: string; depotId: number | null; depotName: string }) => void;
  lockedDepotId?: number | null;
}) {
  const geo = useGeography(token ?? null);
  const regionOfDepot = (id: number) => {
    const d = geo.depots.find((x) => x.id === id);
    const dist = d ? geo.districts.find((x) => x.id === depotDistrictId(d)) : undefined;
    return dist ? districtRegionId(dist) : null;
  };
  useEffect(() => {
    if (lockedDepotId && geo.loaded && depotId !== lockedDepotId) {
      const p = geo.pathOf(lockedDepotId);
      onChange({ regionId: p.regionId, regionName: p.regionName, depotId: lockedDepotId, depotName: p.depotName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedDepotId, geo.loaded]);
  const depots = useMemo(() => (regionId ? geo.depots.filter((d) => regionOfDepot(d.id) === regionId) : geo.depots), [geo.depots, regionId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Region">
        <select
          className={inputCls}
          value={regionId ?? ""}
          disabled={Boolean(lockedDepotId)}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            onChange({ regionId: id, regionName: geo.regions.find((r) => r.id === id)?.name ?? "", depotId: null, depotName: "" });
          }}
        >
          <option value="">Choose region…</option>
          {geo.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Depot">
        <select
          className={inputCls}
          value={depotId ?? ""}
          disabled={Boolean(lockedDepotId)}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            const p = id ? geo.pathOf(id) : null;
            onChange({ regionId: p?.regionId ?? regionId, regionName: p?.regionName ?? "", depotId: id, depotName: p?.depotName ?? "" });
          }}
        >
          <option value="">Choose depot…</option>
          {depots.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError(apiError(e, "That did not work. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function NewRequestDialog({
  open,
  onClose,
  onDone,
  token,
  isPartner,
  lockedDepotId,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (r: InstallRequest) => void;
  token: string | null | undefined;
  isPartner: boolean;
  lockedDepotId?: number | null;
}) {
  const partners = usePartners(token);
  const [place, setPlace] = useState<{ regionId: number | null; regionName: string; depotId: number | null; depotName: string }>({ regionId: null, regionName: "", depotId: null, depotName: "" });
  const [partner, setPartner] = useState("");
  const [date, setDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [txs, setTxs] = useState<TxHit[]>([]);
  const [extra, setExtra] = useState("");
  const a = useAction();
  const extraSites = extra.split("\n").map((s) => s.trim()).filter(Boolean);
  const submit = () =>
    a.run(
      async () => {
        const r = await lifecyclePost<InstallRequest>(token, "/requests", {
          supplierCode: partner || null,
          supplierName: partners.find((p) => p[0] === partner)?.[1] ?? null,
          ...place,
          plannedDate: date,
          plannedEndDate: endDate || null,
          accessNote: note,
          items: [...txs.map((t) => ({ transformerId: t.id })), ...extraSites.map((s) => ({ siteLabel: s }))],
        });
        onDone(r);
      },
      () => {
        setTxs([]);
        setExtra("");
        setNote("");
        onClose();
      }
    );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      icon={<Building2 className="h-5 w-5" />}
      title="Ask for the green light"
      subtitle="The region and depot approve the installation (switching and limited access) before the team goes to site."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={a.busy} disabled={!place.depotId || !date || txs.length + extraSites.length === 0} onClick={submit} icon={<Check className="h-3.5 w-3.5" />}>
            Send for approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {a.error ? <Notice onClose={() => a.setError(null)}>{a.error}</Notice> : null}
        <DepotSelect token={token} regionId={place.regionId} depotId={place.depotId} lockedDepotId={lockedDepotId} onChange={setPlace} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Planned date">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Until (optional)">
            <input type="date" className={inputCls} value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          {!isPartner ? (
            <Field label="Partner (contractor)">
              <select className={inputCls} value={partner} onChange={(e) => setPartner(e.target.value)}>
                <option value="">Choose partner…</option>
                {partners.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <Field label={`Transformers${txs.length ? ` (${txs.length} selected)` : ""}`} hint={place.depotId ? undefined : "Choose the depot first to list its transformers."}>
          <TransformerPicker token={token} depotId={place.depotId} value={txs} onChange={setTxs} />
        </Field>
        <Field label="Sites not yet in the system (optional)" hint="One per line, e.g. a new transformer name or address.">
          <textarea className={`${inputCls} h-20 py-2`} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={"Mabelreign shops\nWarren Park D, cnr 5th St"} />
        </Field>
        <Field label="Switching / access arrangements" hint="Who to meet, outage window, keys, escorts…">
          <textarea className={`${inputCls} h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

export function DecideRequestDialog({
  request,
  approve,
  onClose,
  onDone,
  token,
}: {
  request: InstallRequest | null;
  approve: boolean;
  onClose: () => void;
  onDone: () => void;
  token: string | null | undefined;
}) {
  const [note, setNote] = useState("");
  const a = useAction();
  if (!request) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      icon={approve ? <ThumbsUp className="h-5 w-5" /> : <ThumbsDown className="h-5 w-5" />}
      title={approve ? `Give the green light for ${request.reference}` : `Decline ${request.reference}`}
      subtitle={`${request.depotName ?? "Depot"} · ${fmtDate(request.plannedDate)} · ${request.itemCount ?? request.items?.length ?? 0} site(s)`}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button
            variant={approve ? "primary" : "danger"}
            busy={a.busy}
            disabled={!approve && !note.trim()}
            onClick={() => a.run(() => lifecyclePost(token, `/requests/${request.id}/${approve ? "approve" : "decline"}`, { note }), () => { setNote(""); onDone(); })}
          >
            {approve ? "Approve" : "Decline"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {a.error ? <Notice onClose={() => a.setError(null)}>{a.error}</Notice> : null}
        {request.accessNote ? (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Access arrangements requested</p>
            {request.accessNote}
          </div>
        ) : null}
        <Field label={approve ? "Conditions / switching details (optional)" : "Why is it declined?"}>
          <textarea className={`${inputCls} h-24 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? "e.g. Switching officer T. Moyo on 0772…, outage 08:00–12:00" : "e.g. No switching staff available that day; propose next week"} />
        </Field>
      </div>
    </Dialog>
  );
}

export function RecordInstallDialog({
  open,
  onClose,
  onDone,
  token,
  request,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  token: string | null | undefined;
  request?: InstallRequest | null;
}) {
  const partners = usePartners(token);
  const pending = useMemo(
    () => (request?.items ?? []).filter((i) => i.transformerId && !i.installationId).map((i) => ({ id: i.transformerId as number, name: i.transformerName ?? `#${i.transformerId}`, transformerNumber: i.transformerNumber })),
    [request]
  );
  const [txs, setTxs] = useState<TxHit[]>([]);
  const [date, setDate] = useState(todayIso());
  const [partner, setPartner] = useState("");
  const [eui, setEui] = useState("");
  const [note, setNote] = useState("");
  const a = useAction();
  useEffect(() => {
    if (open) {
      setTxs(pending);
      setPartner(request?.supplierCode ?? "");
    }
  }, [open, pending, request]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      icon={<Hammer className="h-5 w-5" />}
      title="Record installed transformers"
      subtitle={request ? `Against ${request.reference} (green light given ${fmtDate(request.decidedAt)})` : "Mark the transformers where devices were installed. Their status becomes Installed."}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            busy={a.busy}
            disabled={!txs.length || !partner}
            icon={<Check className="h-3.5 w-3.5" />}
            onClick={() =>
              a.run(
                () =>
                  lifecyclePost(token, "/installations", {
                    transformerIds: txs.map((t) => t.id),
                    requestId: request?.id ?? null,
                    installedOn: date,
                    supplierCode: partner,
                    supplierName: partners.find((p) => p[0] === partner)?.[1] ?? request?.supplierName ?? null,
                    deviceEui: txs.length === 1 ? eui : null,
                    note,
                  }),
                () => {
                  setNote("");
                  setEui("");
                  onDone();
                }
              )
            }
          >
            Save {txs.length ? `${txs.length} installation${txs.length === 1 ? "" : "s"}` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {a.error ? <Notice onClose={() => a.setError(null)}>{a.error}</Notice> : null}
        {!request ? (
          <Notice tone="warn">No green-light request chosen. Prefer recording installations from an approved request (Green light tab) so the approval is on record.</Notice>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Installed on">
            <input type="date" className={inputCls} value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Installed by (partner)">
            <select className={inputCls} value={partner} onChange={(e) => setPartner(e.target.value)}>
              <option value="">Choose partner…</option>
              {partners.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`Transformers${txs.length ? ` (${txs.length})` : ""}`}>
          <TransformerPicker token={token} depotId={request?.depotId ?? null} value={txs} onChange={setTxs} />
        </Field>
        {txs.length === 1 ? (
          <Field label="Device EUI / serial (optional)">
            <input className={inputCls} value={eui} onChange={(e) => setEui(e.target.value)} placeholder="e.g. 70B3D57ED0051A2B" />
          </Field>
        ) : null}
        <Field label="Notes (optional)">
          <textarea className={`${inputCls} h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

export function ReadyDialog({ inst, onClose, onDone, token }: { inst: Installation | null; onClose: () => void; onDone: () => void; token: string | null | undefined }) {
  const [note, setNote] = useState("");
  const a = useAction();
  if (!inst) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      icon={<ClipboardCheck className="h-5 w-5" />}
      title="Ready for commissioning"
      subtitle={`${inst.transformerName}${inst.transformerNumber ? ` · No. ${inst.transformerNumber}` : ""}`}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant="primary" busy={a.busy} onClick={() => a.run(() => lifecyclePost(token, `/installations/${inst.id}/ready`, { note }), () => { setNote(""); onDone(); })} icon={<Check className="h-3.5 w-3.5" />}>
            Confirm ready
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {a.error ? <Notice onClose={() => a.setError(null)}>{a.error}</Notice> : null}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Confirm that you tested the installation yourselves (detection, siren and lights, SMS / voice alerts, platform alarms, remote and automatic arming) and the site is ready for
          ZESA&apos;s commissioning test. Powertel and Loss Control will then agree a date.
        </p>
        <Field label="What was tested / notes (optional)">
          <textarea className={`${inputCls} h-24 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. All 14 PAT checks tested on site 12/11; buzzer moved outside the kiosk" />
        </Field>
      </div>
    </Dialog>
  );
}

export function ScheduleDialog({ inst, onClose, onDone, token }: { inst: Installation | null; onClose: () => void; onDone: () => void; token: string | null | undefined }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const a = useAction();
  useEffect(() => {
    setDate(inst?.tentativeDate ?? "");
  }, [inst]);
  if (!inst) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      icon={<CalendarClock className="h-5 w-5" />}
      title={inst.tentativeDate ? "Change the commissioning date" : "Set a tentative commissioning date"}
      subtitle={`${inst.transformerName} · ${inst.supplierName ?? "partner"}`}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant="primary" busy={a.busy} disabled={!date} onClick={() => a.run(() => lifecyclePost(token, `/installations/${inst.id}/schedule`, { tentativeDate: date, note }), () => { setNote(""); onDone(); })}>
            Save date
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {a.error ? <Notice onClose={() => a.setError(null)}>{a.error}</Notice> : null}
        <Field label="Tentative date">
          <input type="date" className={inputCls} value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note for the team (optional)">
          <textarea className={`${inputCls} h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Meet at the depot 08:30 with ZETDC and Loss Control" />
        </Field>
      </div>
    </Dialog>
  );
}

export function CancelInstallDialog({ inst, onClose, onDone, token }: { inst: Installation | null; onClose: () => void; onDone: () => void; token: string | null | undefined }) {
  const [note, setNote] = useState("");
  const a = useAction();
  if (!inst) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      icon={<XCircle className="h-5 w-5" />}
      title="Cancel this installation"
      subtitle={`${inst.transformerName}. The record and its history are kept; a new installation can then be recorded.`}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant="danger" busy={a.busy} disabled={!note.trim()} onClick={() => a.run(() => lifecyclePost(token, `/installations/${inst.id}/cancel`, { note }), onDone)}>
            Cancel installation
          </Button>
        </>
      }
    >
      {a.error ? <Notice onClose={() => a.setError(null)}>{a.error}</Notice> : null}
      <Field label="Why?">
        <textarea className={`${inputCls} h-24 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Device removed after vandalism; recorded against the wrong transformer" />
      </Field>
    </Dialog>
  );
}

/** Next step badge shown in lists. */
export function NextStep({ inst, isPartner }: { inst: Installation; isPartner: boolean }) {
  const t = (s: string, icon: ReactNode) => (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      {icon}
      {s}
    </span>
  );
  switch (inst.status) {
    case "INSTALLED":
      return t(isPartner ? "Test, then mark ready" : "Waiting for the partner", <CircleDashed className="h-3 w-3" />);
    case "READY":
      return t("Agree a commissioning date", <CalendarClock className="h-3 w-3" />);
    case "SCHEDULED":
      return t(`Commission on ${fmtDate(inst.tentativeDate)}`, <ClipboardCheck className="h-3 w-3" />);
    case "FAILED":
      return t(isPartner ? "Fix and mark ready again" : "Partner to fix, then retest", <Plus className="h-3 w-3" />);
    case "COMMISSIONED":
      return t(`Since ${fmtDate(inst.commissionedAt)}`, <CheckCircle2 className="h-3 w-3 text-emerald-500" />);
    default:
      return t("—", null);
  }
}
