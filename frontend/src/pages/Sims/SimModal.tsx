import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import axios from "axios";
import { AlertCircle, CalendarDays, CardSim, ChevronDown, Eye, EyeOff, Fingerprint, Hash, KeyRound, Loader2, Lock, Network, NotebookPen, Phone, Plus, Radio, Save, ShieldCheck, Signal, X } from "lucide-react";
import { CONDITION, CONDITIONS, NETWORK, NETWORK_STATES, conditionMeta, networkMeta, placementMeta } from "./simMeta";

/**
 * Create / edit a SIM card. Opens as a bottom sheet on phones. PIN and PUK are encrypted on the server; when editing,
 * people allowed to see them get the current values filled in, everyone else sees whether one is on file and can type
 * a new one (blank = keep).
 */

interface SimCardItem {
  id: number;
  iccid: string;
  imsi?: string | null;
  msisdn?: string | null;
  pin?: string | null;
  puk?: string | null;
  hasPin?: boolean | null;
  hasPuk?: boolean | null;
  operator?: string | null;
  networkName?: string | null;
  status?: string | null;
  networkState?: string | null;
  condition?: string | null;
  assignedGatewayName?: string | null;
  cardSerialNumber?: string | null;
  apn?: string | null;
  activationDate?: string | null;
  expiryDate?: string | null;
  dataPlanGb?: number | null;
  allowanceGb?: number | null;
  notes?: string | null;
}

type Form = {
  iccid: string;
  imsi: string;
  msisdn: string;
  operator: string;
  networkName: string;
  apn: string;
  cardSerialNumber: string;
  pin: string;
  puk: string;
  pin2: string;
  puk2: string;
  status: string;
  networkState: string;
  condition: string;
  activationDate: string;
  expiryDate: string;
  dataPlanGb: string;
  allowanceGb: string;
  notes: string;
};

const EMPTY: Form = {
  iccid: "",
  imsi: "",
  msisdn: "",
  operator: "",
  networkName: "",
  apn: "",
  cardSerialNumber: "",
  pin: "",
  puk: "",
  pin2: "",
  puk2: "",
  status: "AVAILABLE",
  networkState: "ACTIVE",
  condition: "OK",
  activationDate: "",
  expiryDate: "",
  dataPlanGb: "",
  allowanceGb: "",
  notes: "",
};

const OPERATORS = ["Econet Zimbabwe", "NetOne", "Telecel Zimbabwe", "Powertel", "Liquid"];

const isMask = (s?: string | null) => !s || /^\*+$/.test(s.trim()) || s.includes("****");
const clean = (s: string) => {
  const t = s.trim();
  return t ? t : null;
};
const tail4 = (s?: string | null) => (s ? s.replace(/\*/g, "").slice(-4) : "");

function validate(f: Form, isEdit: boolean) {
  const e: Partial<Record<keyof Form, string>> = {};
  const iccid = f.iccid.replace(/\s/g, "");
  if (!isEdit && !iccid) e.iccid = "ICCID is required — it is printed on the SIM card.";
  else if (iccid && !isMask(iccid) && !/^[0-9A-Fa-f]{10,22}$/.test(iccid)) e.iccid = "ICCID should be 10–22 digits.";
  if (f.imsi && !isMask(f.imsi) && !/^\d{6,16}$/.test(f.imsi.trim())) e.imsi = "IMSI should be up to 15 digits.";
  if (f.msisdn && !isMask(f.msisdn) && !/^\+?\d{7,15}$/.test(f.msisdn.replace(/\s/g, ""))) e.msisdn = "Use digits only, e.g. 263771234567.";
  if (f.pin && !/^\d{4,8}$/.test(f.pin)) e.pin = "PIN is 4 to 8 digits.";
  if (f.puk && !/^\d{8}$/.test(f.puk)) e.puk = "PUK is 8 digits.";
  if (f.pin2 && !/^\d{4,8}$/.test(f.pin2)) e.pin2 = "PIN2 is 4 to 8 digits.";
  if (f.puk2 && !/^\d{8}$/.test(f.puk2)) e.puk2 = "PUK2 is 8 digits.";
  if (f.activationDate && f.expiryDate && f.expiryDate < f.activationDate) e.expiryDate = "Expiry is before activation.";
  return e;
}

export function SimModal({
  isOpen,
  onClose,
  isEdit,
  existing,
  onSaved,
  headers,
  apiBaseUrl,
  canViewSensitive = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  isEdit: boolean;
  existing?: SimCardItem | null;
  onSaved: () => void;
  headers: Record<string, string>;
  apiBaseUrl: string;
  canViewSensitive?: boolean;
}) {
  const [f, setF] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingReveal, setLoadingReveal] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState(false);
  const [moreCodes, setMoreCodes] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTouched(false);
    setSubmitting(false);
    setRevealedCodes(false);
    setMoreCodes(false);
    if (!isEdit || !existing) {
      setF(EMPTY);
      return;
    }
    setF({
      ...EMPTY,
      iccid: existing.iccid ?? "",
      imsi: existing.imsi ?? "",
      msisdn: existing.msisdn ?? "",
      operator: existing.operator ?? "",
      networkName: existing.networkName ?? "",
      apn: existing.apn ?? "",
      cardSerialNumber: existing.cardSerialNumber ?? "",
      status: existing.status ?? "AVAILABLE",
      networkState: existing.networkState ?? "ACTIVE",
      condition: existing.condition ?? "OK",
      activationDate: existing.activationDate ? String(existing.activationDate).slice(0, 10) : "",
      expiryDate: existing.expiryDate ? String(existing.expiryDate).slice(0, 10) : "",
      dataPlanGb: existing.dataPlanGb != null ? String(existing.dataPlanGb) : "",
      allowanceGb: existing.allowanceGb != null ? String(existing.allowanceGb) : "",
      notes: existing.notes ?? "",
    });
    if (!canViewSensitive) return;
    // Fill in the real identifiers and codes (the list only has masked ones). The server logs this reveal.
    setLoadingReveal(true);
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.post(`${apiBaseUrl}/api/v1/sim-cards/${existing.id}/reveal-sensitive`, { reason: "Edit SIM card" }, { headers });
        if (cancelled) return;
        const d = (r.data || {}) as Record<string, string | undefined>;
        setF((p) => ({
          ...p,
          iccid: d.iccid || p.iccid,
          imsi: d.imsi || p.imsi,
          msisdn: d.msisdn || p.msisdn,
          pin: d.pin && !isMask(d.pin) ? d.pin : "",
          puk: d.puk && !isMask(d.puk) ? d.puk : "",
          pin2: d.pin2 && !isMask(d.pin2) ? d.pin2 : "",
          puk2: d.puk2 && !isMask(d.puk2) ? d.puk2 : "",
        }));
        setRevealedCodes(true);
      } catch {
        /* keep masked values; blank code fields mean "keep" */
      } finally {
        if (!cancelled) setLoadingReveal(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, existing, isEdit, apiBaseUrl, headers, canViewSensitive]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const errors = touched ? validate(f, isEdit) : {};
  const errorList = Object.values(errors).filter(Boolean) as string[];

  const submit = async () => {
    setTouched(true);
    const v = validate(f, isEdit);
    if (Object.keys(v).length) {
      setTimeout(() => document.querySelector("[data-sim-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = {
      iccid: isMask(f.iccid) ? null : clean(f.iccid.replace(/\s/g, "")),
      imsi: isMask(f.imsi) ? null : clean(f.imsi),
      msisdn: isMask(f.msisdn) ? null : clean(f.msisdn.replace(/\s/g, "")),
      cardSerialNumber: isMask(f.cardSerialNumber) ? null : clean(f.cardSerialNumber),
      operator: clean(f.operator),
      networkName: clean(f.networkName),
      apn: clean(f.apn),
      status: f.status === "RETIRED" ? "RETIRED" : "AVAILABLE",
      networkState: f.networkState,
      condition: f.condition,
      activationDate: clean(f.activationDate),
      expiryDate: clean(f.expiryDate),
      dataPlanGb: f.dataPlanGb ? Number(f.dataPlanGb) : null,
      allowanceGb: f.allowanceGb ? Number(f.allowanceGb) : null,
      notes: clean(f.notes),
    };
    for (const k of ["pin", "puk", "pin2", "puk2"] as const) if (f[k]) body[k] = f[k];
    try {
      if (isEdit && existing) await axios.put(`${apiBaseUrl}/api/v1/sim-cards/${existing.id}`, body, { headers });
      else await axios.post(`${apiBaseUrl}/api/v1/sim-cards`, body, { headers });
      onSaved();
      onClose();
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } | string; status?: number } };
      const d = ax.response?.data;
      const msg = (typeof d === "string" && d) || (typeof d === "object" && d?.message) || (ax.response?.status === 409 ? "A SIM with this ICCID already exists." : null);
      setError(`${isEdit ? "Could not save the changes." : "Could not add the SIM."}${msg ? ` ${msg}` : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pl = placementMeta(f.status);
  const net = networkMeta(f.networkState);
  const cond = conditionMeta(f.condition);
  const inGateway = f.status === "ASSIGNED" || Boolean(existing?.assignedGatewayName);
  const pinOnFile = Boolean(existing?.hasPin);
  const pukOnFile = Boolean(existing?.hasPuk);
  const codePlaceholder = (onFile: boolean, hint: string) => (onFile && !revealedCodes ? "On file — type to replace" : hint);

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[26px] dark:bg-slate-950">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-5 pb-4 pt-4 text-white">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-red-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <CardSim className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/80">{isEdit ? "Edit SIM card" : "New SIM card"}</p>
              <h3 className="truncate font-mono text-lg font-semibold tracking-wide">
                {isEdit ? (revealedCodes && f.iccid ? f.iccid.replace(/(.{4})/g, "$1 ").trim() : `•••• •••• ${tail4(existing?.iccid)}`) : "Register a SIM"}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <HeaderChip>
                  <span className={`h-1.5 w-1.5 rounded-full ${pl.dot}`} /> {pl.label}
                </HeaderChip>
                <HeaderChip>
                  <span className={`h-1.5 w-1.5 rounded-full ${net.dot}`} /> {net.label}
                </HeaderChip>
                {f.condition !== "OK" ? (
                  <HeaderChip tone="warn">
                    <span className={`h-1.5 w-1.5 rounded-full ${cond.dot}`} /> {cond.label}
                  </HeaderChip>
                ) : null}
                {f.operator ? (
                  <HeaderChip>
                    <Signal className="h-3 w-3" /> {f.operator}
                  </HeaderChip>
                ) : null}
                {isEdit ? (
                  <>
                    <HeaderChip tone={pinOnFile ? "good" : "warn"}>
                      <KeyRound className="h-3 w-3" /> PIN {pinOnFile ? "on file" : "not set"}
                    </HeaderChip>
                    <HeaderChip tone={pukOnFile ? "good" : "warn"}>
                      <Lock className="h-3 w-3" /> PUK {pukOnFile ? "on file" : "not set"}
                    </HeaderChip>
                  </>
                ) : null}
                {existing?.assignedGatewayName ? (
                  <HeaderChip>
                    <Radio className="h-3 w-3" /> {existing.assignedGatewayName}
                  </HeaderChip>
                ) : null}
                {loadingReveal ? (
                  <HeaderChip>
                    <Loader2 className="h-3 w-3 animate-spin" /> loading saved values
                  </HeaderChip>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-full bg-white/10 p-2 text-blue-100 ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Close">
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
          {errorList.length ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4" /> Please fix {errorList.length === 1 ? "this" : `these ${errorList.length}`} before saving
              </p>
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                {errorList.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card icon={<Fingerprint className="h-4 w-4" />} title="Identity" hint="As printed on the SIM card and in the operator's records">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ICCID" required={!isEdit} icon={<Hash className="h-4 w-4" />} error={errors.iccid}>
                <input value={f.iccid} onChange={(e) => set("iccid", e.target.value)} inputMode="numeric" placeholder="8926 3041 9576 2012 077" className={inp(errors.iccid, true)} />
              </Field>
              <Field label="IMSI" icon={<Fingerprint className="h-4 w-4" />} error={errors.imsi}>
                <input value={f.imsi} onChange={(e) => set("imsi", e.target.value)} inputMode="numeric" placeholder="648041576201207" className={inp(errors.imsi, true)} />
              </Field>
              <Field label="Phone number (MSISDN)" icon={<Phone className="h-4 w-4" />} error={errors.msisdn} hint="International form, e.g. 263782271685">
                <input value={f.msisdn} onChange={(e) => set("msisdn", e.target.value)} inputMode="tel" placeholder="263771234567" className={inp(errors.msisdn, true)} />
              </Field>
              <Field label="Operator" icon={<Signal className="h-4 w-4" />}>
                <input value={f.operator} onChange={(e) => set("operator", e.target.value)} list="sim-operators" placeholder="Econet Zimbabwe" className={inp()} />
                <datalist id="sim-operators">
                  {OPERATORS.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </Field>
              <Field label="Network / HLR" icon={<Network className="h-4 w-4" />}>
                <input value={f.networkName} onChange={(e) => set("networkName", e.target.value)} placeholder="Zim HLR" className={inp()} />
              </Field>
              <Field label="APN" icon={<Radio className="h-4 w-4" />}>
                <input value={f.apn} onChange={(e) => set("apn", e.target.value)} placeholder="internet.econet.co.zw" className={inp()} />
              </Field>
            </div>
          </Card>

          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="PIN & PUK"
            hint="Encrypted on the server. Leave a box blank to keep what is on file."
            tone="secure"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <CodeField label="PIN" value={f.pin} onChange={(v) => set("pin", v)} onFile={isEdit ? pinOnFile : undefined} placeholder={codePlaceholder(pinOnFile, "4–8 digits")} error={errors.pin} />
              <CodeField label="PUK" value={f.puk} onChange={(v) => set("puk", v)} onFile={isEdit ? pukOnFile : undefined} placeholder={codePlaceholder(pukOnFile, "8 digits")} error={errors.puk} />
            </div>
            <button type="button" onClick={() => setMoreCodes(!moreCodes)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
              <ChevronDown className={`h-3.5 w-3.5 transition ${moreCodes ? "rotate-180" : ""}`} /> PIN2 / PUK2 (rarely needed)
            </button>
            {moreCodes ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <CodeField label="PIN2" value={f.pin2} onChange={(v) => set("pin2", v)} placeholder="4–8 digits" error={errors.pin2} />
                <CodeField label="PUK2" value={f.puk2} onChange={(v) => set("puk2", v)} placeholder="8 digits" error={errors.puk2} />
              </div>
            ) : null}
          </Card>

          <Card icon={<CalendarDays className="h-4 w-4" />} title="Lifecycle & plan">
            <p className="mb-2 text-[11px] text-slate-500">Three separate things: where the SIM is, its line with the operator, and the card itself. Combine them freely — e.g. in a gateway, active, good.</p>
            <ChoiceGroup
              label="Network state"
              value={f.networkState}
              onChange={(v) => set("networkState", v)}
              options={(NETWORK_STATES as readonly string[]).map((k) => ({ k, ...NETWORK[k as keyof typeof NETWORK] }))}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ChoiceGroup
                label="Condition"
                value={f.condition}
                onChange={(v) => set("condition", v)}
                cols="grid-cols-3"
                options={(CONDITIONS as readonly string[]).map((k) => ({ k, ...CONDITION[k as keyof typeof CONDITION] }))}
              />
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">Placement</p>
                {inGateway ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30">
                    <Radio className="h-4 w-4 shrink-0" />
                    <span>
                      In a gateway{existing?.assignedGatewayName ? `: ${existing.assignedGatewayName}` : ""}. Remove it from the gateway to put it back in stock or retire it.
                    </span>
                  </div>
                ) : (
                  <ChoiceGroup
                    value={f.status === "RETIRED" ? "RETIRED" : "AVAILABLE"}
                    onChange={(v) => set("status", v)}
                    cols="grid-cols-2"
                    options={[
                      { k: "AVAILABLE", label: "In stock", hint: "Spare, can be assigned", dot: "bg-blue-500" },
                      { k: "RETIRED", label: "Retired", hint: "Out of the inventory", dot: "bg-slate-400" },
                    ]}
                  />
                )}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Activation date" icon={<CalendarDays className="h-4 w-4" />}>
                <input type="date" value={f.activationDate} onChange={(e) => set("activationDate", e.target.value)} className={inp()} />
              </Field>
              <Field label="Expiry date" icon={<CalendarDays className="h-4 w-4" />} error={errors.expiryDate}>
                <input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={inp(errors.expiryDate)} />
              </Field>
              <Field label="Data plan (GB)" icon={<Signal className="h-4 w-4" />}>
                <input type="number" step="0.01" min="0" value={f.dataPlanGb} onChange={(e) => set("dataPlanGb", e.target.value)} placeholder="e.g. 5" className={inp()} />
              </Field>
              <Field label="Card serial no." icon={<Hash className="h-4 w-4" />}>
                <input value={f.cardSerialNumber} onChange={(e) => set("cardSerialNumber", e.target.value)} placeholder="optional" className={inp()} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Notes" icon={<NotebookPen className="h-4 w-4" />}>
                <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Plan details, replacement history…" className={`${inp()} h-auto py-2`} />
              </Field>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-slate-800 dark:bg-slate-950">
          <p className="hidden text-[11px] text-slate-500 sm:block">{isEdit ? "Changes are logged with your name." : <><span className="text-red-500">*</span> required</>}</p>
          <div className="flex flex-1 justify-end gap-2">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || loadingReveal}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-[#0b4fc4] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add SIM"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- pieces

const inp = (err?: string, mono?: boolean) =>
  `h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${mono ? "font-mono tracking-wide" : ""} ${
    err ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-blue-400 focus:ring-blue-100 dark:border-slate-700 dark:focus:ring-blue-500/20"
  }`;

function HeaderChip({ children, tone }: { children: ReactNode; tone?: "good" | "warn" }) {
  const t = tone === "good" ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/30" : tone === "warn" ? "bg-amber-400/15 text-amber-100 ring-amber-300/30" : "bg-white/10 text-blue-50 ring-white/15";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${t}`}>{children}</span>;
}

function Card({ icon, title, hint, tone, children }: { icon: ReactNode; title: string; hint?: string; tone?: "secure"; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border bg-white p-3.5 shadow-sm dark:bg-slate-950 ${tone === "secure" ? "border-blue-200 dark:border-blue-500/30" : "border-slate-200 dark:border-slate-800"}`}>
      <div className="mb-3 flex items-start gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone === "secure" ? "bg-gradient-to-br from-blue-600 to-red-500 text-white" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"}`}>{icon}</span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h4>
          {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
  options,
  cols = "grid-cols-2 sm:grid-cols-5",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ k: string; label: string; hint: string; dot: string }>;
  cols?: string;
}) {
  return (
    <div>
      {label ? <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</p> : null}
      <div className={`grid gap-1.5 ${cols}`}>
        {options.map((o) => {
          const on = value === o.k;
          return (
            <button
              key={o.k}
              type="button"
              onClick={() => onChange(o.k)}
              title={o.hint}
              aria-pressed={on}
              className={`flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs ring-1 transition ${
                on ? "bg-gradient-to-br from-blue-600 to-[#0b4fc4] font-semibold text-white ring-blue-600 shadow-sm shadow-blue-600/25" : "bg-white text-slate-700 ring-slate-200 hover:ring-blue-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-white" : o.dot}`} />
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                <span className={`block truncate text-[10px] font-normal ${on ? "text-blue-100" : "text-slate-400"}`}>{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, icon, required, error, hint, children }: { label: string; icon?: ReactNode; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block" data-sim-error={error ? "" : undefined}>
      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <span className="relative block">
        {icon ? <span className={`pointer-events-none absolute left-3 top-3 ${error ? "text-red-400" : "text-slate-400"}`}>{icon}</span> : null}
        {children}
      </span>
      {error ? <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

function CodeField({ label, value, onChange, onFile, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; onFile?: boolean; placeholder: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block" data-sim-error={error ? "" : undefined}>
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {onFile === true ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
            <ShieldCheck className="h-2.5 w-2.5" /> on file
          </span>
        ) : onFile === false ? (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <KeyRound className="h-2.5 w-2.5" /> not set yet
          </span>
        ) : null}
      </span>
      <span className={`flex h-10 items-center rounded-xl border bg-white pr-1 transition focus-within:ring-2 dark:bg-slate-900 ${error ? "border-red-300 focus-within:ring-red-100" : "border-slate-200 focus-within:border-blue-400 focus-within:ring-blue-100 dark:border-slate-700"}`}>
        <KeyRound className={`ml-3 h-4 w-4 shrink-0 ${error ? "text-red-400" : "text-slate-400"}`} />
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-sm tracking-[0.3em] text-slate-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 dark:text-slate-100"
        />
        <button type="button" onClick={() => setShow(!show)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label={show ? `Hide ${label}` : `Show ${label}`}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {error ? <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span> : null}
    </label>
  );
}
