import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { CheckCircle2, Loader2, MapPin, Search, Sparkles, TriangleAlert } from "lucide-react";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
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
  const [capacity, setCapacity] = useState("");
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
    setCapacity("");
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
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/import-eui/preview`, { headers, params: { eui: value } });
      const p = res.data as Preview;
      setPreview(p);
      setEui(p.eui);
      setName(p.name || "");
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
          name: name || undefined,
          type: type || undefined,
          capacity: capacity ? Number(capacity) : undefined,
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
  const canCreate = preview && !alreadyLinked && depotId && name.trim();

  return (
    <Modal isOpen={open} onClose={onClose} variant="drawer">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 to-blue-900 px-6 py-5 text-white dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/80">New transformer</p>
          <h3 className="mt-1 text-lg font-semibold">Add from a partner device EUI</h3>
          <p className="mt-1 text-xs text-blue-100/80">We pull the name, type and GPS from the partner. You choose where it sits: region, district and depot.</p>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Step 1 */}
          <Step n={1} title="Device EUI">
            <div className="flex gap-2">
              <input
                value={eui}
                onChange={(e) => setEui(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void lookup()}
                placeholder="e.g. A84041F6115E179E"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button type="button" onClick={() => void lookup()} disabled={looking || !eui.trim()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look up
              </button>
            </div>
            {preview ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Pill ok={preview.remoteFound} okText="Found at partner" badText={preview.remoteMessage || "Not found at partner. Enter details below"} />
                <Pill
                  ok={preview.controllerKnown}
                  okText={preview.controllerOnline ? "Device is reporting to us now" : "Device known, not reporting recently"}
                  badText="Device not heard yet (will be linked when it reports)"
                  neutral={!preview.controllerKnown}
                />
                {alreadyLinked ? (
                  <div className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Already linked to {preview.linkedTransformerName}. Unlink it there first if it moved.
                  </div>
                ) : null}
              </div>
            ) : null}
          </Step>

          {preview && !alreadyLinked ? (
            <>
              <Step n={2} title="Where is it? (not provided by the partner)">
                {suggested ? (
                  <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" /> Suggested from the name: {suggested}. Change it if wrong.
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-3">
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
                  <Sel label="Depot *" value={depotId} onChange={(v) => { pickDepot(v); setSuggested(null); }} options={depots.map((d) => [String(d.id), d.name])} />
                </div>
              </Step>

              <Step n={3} title="Check the details">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Transformer name *">
                    <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label={`Type${preview.rawType ? ` (partner: ${preview.rawType})` : ""}`}>
                    <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                      <option value="">Unknown</option>
                      <option value="GROUND_MOUNTED">Ground mounted (GMT)</option>
                      <option value="POLE_MOUNTED">Pole mounted (PMT)</option>
                    </select>
                  </Field>
                  <Field label="Capacity (kVA)">
                    <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Latitude">
                      <input value={lat} onChange={(e) => setLat(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Longitude">
                      <input value={lng} onChange={(e) => setLng(e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>
                {lat && lng ? (
                  <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                    <MapPin className="h-3.5 w-3.5" /> Check the pin on a map
                  </a>
                ) : null}
              </Step>
            </>
          ) : null}

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <p className="text-[11px] text-slate-500">The device {eui || "EUI"} is linked to the new transformer automatically.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button type="button" onClick={() => void create()} disabled={!canCreate || saving} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Create & link
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">{n}</span>
        {title}
      </p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <Field label={label}>
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

function Pill({ ok, okText, badText, neutral }: { ok: boolean; okText: string; badText: string; neutral?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
        ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : neutral ? "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
      }`}
    >
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      {ok ? okText : badText}
    </div>
  );
}
