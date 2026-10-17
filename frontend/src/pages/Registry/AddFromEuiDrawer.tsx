import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Check, CheckCircle2, Cpu, Hash, Link2, Loader2, MapPin, Radio, Search, Sparkles, TriangleAlert, X, Zap } from "lucide-react";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { inputCls } from "../../components/ui/page";
import { API_BASE_URL, depotDistrictId, districtRegionId, suggestDepot, useGeography } from "./geo";

type Preview = {
  eui: string;
  controllerKnown: boolean;
  controllerOnline: boolean;
  controllerLastReadingAt?: string | null;
  linkedTransformerId?: number | null;
  linkedTransformerName?: string | null;
  remoteFound: boolean;
  remoteMessage?: string | null;
  name?: string | null;
  transformerNumber?: string | null;
  type?: string | null;
  rawType?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  open: boolean;
  initialEui?: string;
  geo: ReturnType<typeof useGeography>;
  onClose: () => void;
  onCreated: () => void;
};

const err = (e: unknown, fallback: string) => {
  const d = (e as { response?: { data?: { message?: string } | string } })?.response?.data;
  return typeof d === "string" ? d : d?.message || fallback;
};

/** "Warren Park 1 55 crescent - 2476" -> "2476": partner names end with the transformer number. */
const numberFromName = (name?: string | null) => {
  const m = (name || "").trim().match(/[-–]\s*([A-Za-z]{0,3}\d[\w/]*)\s*$/);
  return m ? m[1] : "";
};

export default function AddFromEuiDrawer({ open, initialEui, geo, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const [eui, setEui] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [transformerNumber, setTransformerNumber] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [suggested, setSuggested] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEui(initialEui || "");
    setPreview(null);
    setError(null);
    setName("");
    setType("");
    setTransformerNumber("");
    setLat("");
    setLng("");
    setRegionId("");
    setDistrictId("");
    setDepotId("");
    setSuggested(null);
    if (initialEui) void lookup(initialEui);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEui]);

  const pickDepot = (id: string) => {
    setDepotId(id);
    const depot = geo.depotById.get(Number(id));
    if (depot) {
      const district = geo.districtById.get(depotDistrictId(depot) ?? -1);
      setDistrictId(district ? String(district.id) : "");
      const r = district ? districtRegionId(district) : null;
      setRegionId(r != null ? String(r) : "");
    }
  };

  const lookup = async (value = eui) => {
    try {
      setLooking(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/import-eui/preview`, { headers, params: { eui: value.trim() } });
      const p = res.data as Preview;
      setPreview(p);
      setEui(p.eui);
      setName(p.name || "");
      setTransformerNumber(p.transformerNumber || numberFromName(p.name));
      setType(p.type || "");
      setLat(p.lat != null ? String(p.lat) : "");
      setLng(p.lng != null ? String(p.lng) : "");
      const s = suggestDepot(geo.depots, p.name);
      if (s) {
        pickDepot(String(s.id));
        setSuggested(s.name);
      }
    } catch (e) {
      setPreview(null);
      setError(err(e, "Lookup failed."));
    } finally {
      setLooking(false);
    }
  };

  const districts = geo.districts.filter((d) => !regionId || String(districtRegionId(d)) === regionId);
  const depots = geo.depots.filter((d) => {
    if (districtId) return String(depotDistrictId(d)) === districtId;
    if (regionId) return String(geo.pathOf(d.id).regionId) === regionId;
    return true;
  });

  const create = async () => {
    try {
      setSaving(true);
      setError(null);
      await axios.post(
        `${API_BASE_URL}/api/v1/transformers/import-eui`,
        {
          eui,
          depotId: depotId ? Number(depotId) : null,
          name: name.trim() || undefined,
          type: type || undefined,
          transformerNumber: transformerNumber.trim() || undefined,
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined,
        },
        { headers }
      );
      onCreated();
    } catch (e) {
      setError(err(e, "Could not create the transformer."));
    } finally {
      setSaving(false);
    }
  };

  const alreadyLinked = preview?.linkedTransformerId != null;
  const step1Done = Boolean(preview) && !alreadyLinked;
  const step2Done = step1Done && Boolean(depotId);
  const step3Done = step2Done && Boolean(name.trim());
  const canCreate = step3Done;
  const missing = !preview ? "Look up the device EUI first" : alreadyLinked ? "This device is already linked" : !depotId ? "Choose the depot to continue" : !name.trim() ? "Enter the transformer name" : null;
  const depotName = depotId ? geo.pathOf(Number(depotId)).depotName : null;

  return (
    <Modal isOpen={open} onClose={onClose} variant="drawer" showCloseButton={false}>
      <div className="flex h-full flex-col bg-slate-50/60 dark:bg-slate-950">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-6 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <Link2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">New transformer</p>
                <h3 className="mt-0.5 text-lg font-semibold tracking-tight">Add from a partner device</h3>
                <p className="mt-0.5 max-w-md text-[13px] text-blue-100/80">The partner gives us the name, type and GPS. You confirm where it sits and its transformer number.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Progress */}
          <ol className="relative mt-5 grid grid-cols-3 gap-2">
            <Progress n={1} label="Device" done={step1Done} active={!step1Done} />
            <Progress n={2} label="Location" done={step2Done} active={step1Done && !step2Done} />
            <Progress n={3} label="Details" done={step3Done} active={step2Done && !step3Done} />
          </ol>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Step 1 */}
          <Card n={1} title="Device EUI" subtitle="The 16-character ID printed on the controller." done={step1Done}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Cpu className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={eui}
                  onChange={(e) => setEui(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void lookup()}
                  placeholder="e.g. A84041F6115E179E"
                  className={`${inputCls} pl-9 font-mono uppercase tracking-wide`}
                />
              </div>
              <button
                type="button"
                onClick={() => void lookup()}
                disabled={looking || !eui.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look up
              </button>
            </div>
            {preview ? (
              <div className="mt-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Status ok={preview.remoteFound} okText="Found at the partner" badText={preview.remoteMessage || "Not found at the partner: enter the details below"} />
                  <Status
                    ok={preview.controllerKnown && preview.controllerOnline}
                    warn={preview.controllerKnown && !preview.controllerOnline}
                    okText="Device is reporting now"
                    warnText="Device known, not reporting recently"
                    badText="Not heard yet: it links when it first reports"
                  />
                </div>
                {preview.remoteFound && preview.name ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      <Zap className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 text-[13px]">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{preview.name}</p>
                      <p className="text-xs text-slate-500">
                        {preview.rawType || "Type not given"}
                        {preview.lat != null && preview.lng != null ? ` · ${Number(preview.lat).toFixed(5)}, ${Number(preview.lng).toFixed(5)}` : " · no GPS"}
                      </p>
                    </div>
                  </div>
                ) : null}
                {alreadyLinked ? (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Already linked to {preview.linkedTransformerName}. Unlink it there first if it has moved.
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          {preview && !alreadyLinked ? (
            <>
              <Card n={2} title="Location" subtitle="Partners do not send region, district or depot." done={step2Done}>
                {suggested ? (
                  <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" /> Suggested from the name: {suggested}. Change it if wrong.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Sel
                    label="Region"
                    value={regionId}
                    onChange={(v) => {
                      setRegionId(v);
                      setDistrictId("");
                      setDepotId("");
                      setSuggested(null);
                    }}
                    options={geo.regions.map((r) => [String(r.id), r.name])}
                  />
                  <Sel
                    label="District"
                    value={districtId}
                    onChange={(v) => {
                      setDistrictId(v);
                      setDepotId("");
                      setSuggested(null);
                    }}
                    options={districts.map((d) => [String(d.id), d.name])}
                  />
                  <Sel
                    label="Depot"
                    required
                    value={depotId}
                    onChange={(v) => {
                      pickDepot(v);
                      setSuggested(null);
                    }}
                    options={depots.map((d) => [String(d.id), d.name])}
                  />
                </div>
              </Card>

              <Card n={3} title="Transformer details" subtitle="Filled from the partner. Check and correct anything wrong." done={step3Done}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Transformer name" required>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Transformer number" hint={transformerNumber && transformerNumber === numberFromName(name) ? "Taken from the end of the name" : "The utility number on the transformer plate"}>
                    <div className="relative">
                      <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input value={transformerNumber} onChange={(e) => setTransformerNumber(e.target.value)} placeholder="e.g. 2476" className={`${inputCls} pl-9`} />
                    </div>
                  </Field>
                  <Field label="Type" hint={preview.rawType ? `Partner says: ${preview.rawType}` : undefined}>
                    <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                      <option value="">Unknown</option>
                      <option value="GROUND_MOUNTED">Ground mounted (GMT)</option>
                      <option value="POLE_MOUNTED">Pole mounted (PMT)</option>
                    </select>
                  </Field>
                  <Field
                    label="GPS position"
                    hint={
                      lat && lng ? (
                        <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                          <MapPin className="h-3 w-3" /> Check the pin on a map
                        </a>
                      ) : (
                        "Latitude, longitude"
                      )
                    }
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" className={inputCls} />
                      <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" className={inputCls} />
                    </div>
                  </Field>
                </div>
              </Card>
            </>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
              <Radio className="h-4 w-4 shrink-0 text-blue-600" />
              {canCreate ? (
                <span className="line-clamp-2">
                  Creates <b className="text-slate-800 dark:text-slate-100">{name.trim()}</b>
                  {transformerNumber.trim() ? ` (No. ${transformerNumber.trim()})` : ""} in <b className="text-slate-800 dark:text-slate-100">{depotName}</b> and links device{" "}
                  <span className="font-mono">{eui}</span>.
                </span>
              ) : (
                <span>{missing}</span>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void create()}
                disabled={!canCreate || saving}
                className="group inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-600/35 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 transition group-hover:rotate-12" />}
                {saving ? "Creating…" : "Create transformer & link device"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Progress({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
          done ? "bg-emerald-400 text-slate-950" : active ? "bg-white text-slate-900" : "bg-white/10 text-white/70 ring-1 ring-white/20"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span className={`text-xs font-semibold ${done || active ? "text-white" : "text-white/60"}`}>{label}</span>
      {n < 3 ? <span className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-300/70" : "bg-white/20"}`} /> : null}
    </li>
  );
}

function Card({ n, title, subtitle, done, children }: { n: number; title: string; subtitle?: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-3 flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Sel({ label, value, onChange, options, required }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Select…</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Status({ ok, warn, okText, warnText, badText }: { ok: boolean; warn?: boolean; okText: string; warnText?: string; badText: string }) {
  const tone = ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    : warn
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${tone}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      {ok ? okText : warn ? warnText : badText}
    </div>
  );
}
