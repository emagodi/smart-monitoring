import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRightLeft,
  Activity,
  BellRing,
  Clock,
  ShieldOff,
  Cpu,
  ExternalLink,
  Hash,
  Link2,
  MapPin,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Unlink,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cachedGet, invalidateCache, useCachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { useScope } from "../../lib/scope";
import { depotDistrictId, districtRegionId, useGeography } from "../Registry/geo";
import { Button, Dialog, Field, HeroButton, Notice, PageHero, Panel, inputCls, timeAgo } from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";
const ONLINE_MINUTES = 15;

type ControllerRow = {
  id: number;
  devEui: string;
  deviceId?: string | null;
  name?: string | null;
  type?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lastReadingAt?: string | null;
};

type TransformerData = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  isActive?: boolean | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  type?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  controllers?: ControllerRow[];
};

type RegistryLite = { id: number; name: string; transformerNumber?: string | null; depotId?: number | null; controllerEuis?: string[] };
type Unmatched = { id: number; devEui: string; name?: string | null; supplierCode?: string | null; supplierName?: string | null; lastReadingAt?: string | null; online?: boolean };

const errText = (e: unknown, fallback: string) => {
  const d = (e as { response?: { data?: { message?: string } | string } })?.response?.data;
  return typeof d === "string" ? d : d?.message || fallback;
};
const isOnline = (at?: string | null) => !!at && Date.now() - new Date(at).getTime() <= ONLINE_MINUTES * 60_000;
const ctlLabel = (c: { name?: string | null; devEui: string }) => c.name?.trim() || `Controller ${c.devEui.slice(-8)}`;

/**
 * Edit a transformer: its details (name, number, type, location, depot) and the controllers on it.
 * A controller on the wrong transformer can be moved to the right one, or unlinked (it then waits on
 * the New controllers page); a waiting controller can be linked here.
 */
export default function EditTransformer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, hasPermission } = useAuth();
  const { isDepot, depotId: myDepot } = useScope();
  const geo = useGeography(token);
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const isSupplier = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
  const canLink = !isSupplier && (hasPermission("transformers.update") || hasPermission("transformers.create") || hasPermission("controllers.update"));

  const [data, setData] = useState<TransformerData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // form
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [type, setType] = useState("");
  const [active, setActive] = useState(true);
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // controller actions
  const [moving, setMoving] = useState<ControllerRow | null>(null);
  const [unlinking, setUnlinking] = useState<ControllerRow | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get<TransformerData & { data?: TransformerData }>(`${API}/api/v1/transformers/${id}`, { headers });
      const d = (res.data?.data ?? res.data) as TransformerData;
      setData(d);
      setLoadError(null);
      return d;
    } catch (e) {
      setLoadError(errText(e, "Could not load this transformer."));
      return null;
    }
  };

  useEffect(() => {
    if (!token || !id) return;
    void load().then((d) => {
      if (!d) return;
      setName(d.name || "");
      setNumber(d.transformerNumber ?? "");
      setType(d.type ?? "");
      setActive(d.isActive ?? true);
      setDepotId(d.depotId != null ? String(d.depotId) : "");
      setLat(d.lat != null ? String(d.lat) : "");
      setLng(d.lng != null ? String(d.lng) : "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  // Fill region / district from the depot once the geography has loaded.
  useEffect(() => {
    if (!geo.loaded || !depotId || regionId || districtId) return;
    const p = geo.pathOf(Number(depotId));
    if (p.districtId) setDistrictId(String(p.districtId));
    if (p.regionId) setRegionId(String(p.regionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.loaded, depotId]);

  const districts = geo.districts.filter((d) => !regionId || String(districtRegionId(d)) === regionId);
  const depots = geo.depots.filter((d) => (districtId ? String(depotDistrictId(d)) === districtId : regionId ? districts.some((x) => x.id === depotDistrictId(d)) : true));

  const save = async () => {
    if (!name.trim()) return setNotice({ tone: "error", text: "Give the transformer a name." });
    if (!isSupplier && !depotId) return setNotice({ tone: "error", text: "Choose the depot this transformer belongs to." });
    const latN = lat.trim() ? Number(lat) : null;
    const lngN = lng.trim() ? Number(lng) : null;
    if ((latN != null && (Number.isNaN(latN) || latN < -23 || latN > -15)) || (lngN != null && (Number.isNaN(lngN) || lngN < 25 || lngN > 34))) {
      return setNotice({ tone: "error", text: "The GPS position must be inside Zimbabwe (latitude about -15 to -23, longitude about 25 to 34)." });
    }
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/v1/transformers/${id}`,
        {
          name: name.trim(),
          transformerNumber: number.trim() || undefined,
          type: type || null,
          isActive: active,
          depotId: isSupplier ? null : Number(depotId),
          lat: latN ?? undefined,
          lng: lngN ?? undefined,
        },
        { headers }
      );
      invalidateCache("/api/v1/transformers");
      setNotice({ tone: "success", text: "Changes saved." });
      void load();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not save the changes.") });
    } finally {
      setSaving(false);
    }
  };

  const afterLinkChange = (text: string) => {
    invalidateCache("/api/v1/transformers");
    invalidateCache("/api/v1/controllers/unmatched");
    setNotice({ tone: "success", text });
    void load();
  };

  const controllers = data?.controllers ?? [];
  const path = geo.pathOf(data?.depotId ?? null);

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Asset register · Edit transformer"
        title={data?.name || (loadError ? "Transformer" : "Loading…")}
        subtitle={
          data
            ? `#${data.id}${data.transformerNumber ? ` · No. ${data.transformerNumber}` : ""} · ${path.regionName} › ${path.districtName} › ${path.depotName}${
                data.supplierCode ? ` · ${displayPartner(data.supplierName, data.supplierCode)}` : ""
              }`
            : "Update the transformer's details and the controllers installed on it."
        }
        actions={
          <>
            <Link to="/transformers" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <ArrowLeft className="h-4 w-4" /> Transformers
            </Link>
            {data ? (
              <Link to={`/transformer/${data.id}`} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
                <ExternalLink className="h-4 w-4" /> Full details
              </Link>
            ) : null}
            <HeroButton onClick={() => void save()} busy={saving} icon={<Save className="h-4 w-4" />}>
              {saving ? "Saving…" : "Save changes"}
            </HeroButton>
          </>
        }
      />

      {loadError ? <Notice>{loadError}</Notice> : null}
      {notice ? (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ details */}
        <Panel icon={<Zap className="h-4 w-4" />} title="Transformer details" subtitle="Name, number, type and status">
          <form
            className="space-y-5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Transformer name *">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 1181 Mufakose area A community hall" />
                </Field>
              </div>
              <Field label="Transformer number" hint="The number painted on the transformer.">
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-9`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. 1181" />
                </div>
              </Field>
              <Field label="Type">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["GROUND_MOUNTED", "Ground (GMT)"],
                    ["POLE_MOUNTED", "Pole (PMT)"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setType(v)}
                      className={`h-10 rounded-xl text-sm font-semibold ring-1 transition ${
                        type === v ? "bg-blue-600 text-white ring-blue-600 shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-slate-200 hover:ring-blue-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> In service
                </p>
                <p className="text-xs text-slate-500">Turn off for a transformer that has been removed or decommissioned.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive(!active)}
                className={`relative h-6 w-11 rounded-full transition ${active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${active ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>

            {!isSupplier ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" /> Where it sits
                </p>
                {isDepot ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {geo.pathOf(myDepot).regionName} › {geo.pathOf(myDepot).districtName} › <b>{geo.pathOf(myDepot).depotName}</b>
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Region">
                      <select
                        className={inputCls}
                        value={regionId}
                        onChange={(e) => {
                          setRegionId(e.target.value);
                          setDistrictId("");
                          setDepotId("");
                        }}
                      >
                        <option value="">All regions</option>
                        {geo.regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="District">
                      <select
                        className={inputCls}
                        value={districtId}
                        onChange={(e) => {
                          setDistrictId(e.target.value);
                          setDepotId("");
                        }}
                      >
                        <option value="">All districts</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Depot *">
                      <select className={inputCls} value={depotId} onChange={(e) => setDepotId(e.target.value)}>
                        <option value="">Choose a depot</option>
                        {depots.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Latitude">
                    <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-17.824858" inputMode="decimal" />
                  </Field>
                  <Field label="Longitude">
                    <input className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="31.053028" inputMode="decimal" />
                  </Field>
                </div>
                {lat && lng ? (
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Check this position on Google Maps
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button onClick={() => navigate("/transformers")}>Cancel</Button>
              <Button type="submit" variant="primary" icon={<Save className="h-4 w-4" />} busy={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </Panel>

        <div className="space-y-4">
        <AtAGlance id={id} token={token} />

        {/* ------------------------------------------------------------ controllers */}
        <Panel
          icon={<Cpu className="h-4 w-4" />}
          title={`Controllers on this transformer (${controllers.length})`}
          subtitle="Move a controller that is on the wrong transformer, or unlink it."
          actions={
            canLink ? (
              <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
                Link a controller
              </Button>
            ) : null
          }
        >
          <div className="space-y-2.5 p-4">
            {!data && !loadError ? <div className="ui-skeleton h-20 w-full" /> : null}
            {data && controllers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
                <Cpu className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">No controller linked</p>
                <p className="text-xs text-slate-500">Link one from the controllers waiting on the New controllers page.</p>
              </div>
            ) : null}
            {controllers.map((c) => {
              const on = isOnline(c.lastReadingAt);
              return (
                <div key={c.id} className="rounded-2xl border border-slate-200 p-3.5 transition hover:border-blue-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{ctlLabel(c)}</p>
                        <Badge on={on} never={!c.lastReadingAt} />
                      </div>
                      <p className="font-mono text-[12px] tracking-wide text-slate-600 dark:text-slate-300">{c.devEui}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.supplierCode ? displayPartner(c.supplierName, c.supplierCode) : "Unknown partner"} · last heard {c.lastReadingAt ? timeAgo(c.lastReadingAt) : "never"}
                      </p>
                    </div>
                  </div>
                  {canLink ? (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setMoving(c)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Move to another transformer
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlinking(c)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300"
                      >
                        <Unlink className="h-3.5 w-3.5" /> Unlink
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
        </div>
      </div>

      {/* ------------------------------------------------------------ dialogs */}
      <MoveDialog
        controller={moving}
        currentId={Number(id)}
        token={token}
        geo={geo}
        onClose={() => setMoving(null)}
        onDone={(target) => {
          const c = moving;
          setMoving(null);
          afterLinkChange(`${c ? ctlLabel(c) : "Controller"} moved to ${target}.`);
        }}
      />

      <Dialog
        open={Boolean(unlinking)}
        onClose={() => setUnlinking(null)}
        icon={<Unlink className="h-4 w-4" />}
        title="Unlink this controller?"
        subtitle={unlinking ? `${ctlLabel(unlinking)} · ${unlinking.devEui}` : undefined}
        footer={
          <>
            <Button onClick={() => setUnlinking(null)}>Cancel</Button>
            <Button
              variant="danger"
              icon={<Unlink className="h-4 w-4" />}
              onClick={async () => {
                if (!unlinking) return;
                try {
                  await axios.post(`${API}/api/v1/controllers/${unlinking.id}/unassign`, {}, { headers });
                  const c = unlinking;
                  setUnlinking(null);
                  afterLinkChange(`${ctlLabel(c)} unlinked. It now waits on the New controllers page.`);
                } catch (e) {
                  setUnlinking(null);
                  setNotice({ tone: "error", text: errText(e, "Could not unlink the controller.") });
                }
              }}
            >
              Unlink
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Its alerts will stop reaching <b>{data?.name}</b>. The controller goes back to <b>New controllers</b>, where it can be linked to the right transformer.
        </p>
      </Dialog>

      <AddDialog
        open={adding}
        token={token}
        onClose={() => setAdding(false)}
        onPick={async (c) => {
          try {
            await axios.post(`${API}/api/v1/controllers/${c.id}/assign`, { transformerId: Number(id) }, { headers });
            setAdding(false);
            afterLinkChange(`${ctlLabel(c)} linked to ${data?.name}.`);
          } catch (e) {
            setAdding(false);
            setNotice({ tone: "error", text: errText(e, "Could not link the controller.") });
          }
        }}
      />
    </div>
  );
}

function Badge({ on, never }: { on: boolean; never: boolean }) {
  const cls = on
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
    : never
      ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
      : "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30";
  const dot = on ? "bg-emerald-500" : never ? "bg-slate-400" : "bg-red-500";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {on ? "Online" : never ? "Never heard" : "Offline"}
    </span>
  );
}

function PickRow({ onClick, title, sub, right }: { onClick: () => void; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50 dark:hover:bg-slate-800">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          {sub ? <span className="block truncate text-xs text-slate-500">{sub}</span> : null}
        </span>
        {right}
      </button>
    </li>
  );
}

/** Pick the transformer a controller should be on, then move it there in one step (assign?move=true). */
function MoveDialog({
  controller,
  currentId,
  token,
  geo,
  onClose,
  onDone,
}: {
  controller: ControllerRow | null;
  currentId: number;
  token: string | null;
  geo: ReturnType<typeof useGeography>;
  onClose: () => void;
  onDone: (targetName: string) => void;
}) {
  const [rows, setRows] = useState<RegistryLite[] | null>(null);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<RegistryLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!controller || !token) return;
    setQ("");
    setTarget(null);
    setErr(null);
    void cachedGet<RegistryLite[]>(`${API}/api/v1/transformers/registry`, token, 30_000).then(setRows).catch(() => setRows([]));
  }, [controller, token]);

  const term = q.trim().toLowerCase();
  const list = (rows ?? [])
    .filter((r) => r.id !== currentId)
    .filter((r) => !term || [r.name, r.transformerNumber, geo.pathOf(r.depotId ?? null).depotName].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
    .slice(0, 40);

  const move = async () => {
    if (!controller || !target) return;
    setBusy(true);
    try {
      await axios.post(
        `${API}/api/v1/controllers/${controller.id}/assign?move=true`,
        { transformerId: target.id },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      onDone(target.name);
    } catch (e) {
      setErr(errText(e, "Could not move the controller."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={Boolean(controller)}
      onClose={onClose}
      icon={<ArrowRightLeft className="h-4 w-4" />}
      title="Move controller to another transformer"
      subtitle={controller ? `${ctlLabel(controller)} · ${controller.devEui}` : undefined}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<ArrowRightLeft className="h-4 w-4" />} busy={busy} disabled={!target} onClick={() => void move()}>
            {target ? `Move to ${target.name}` : "Choose a transformer"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {err ? <Notice>{err}</Notice> : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transformer name, number or depot…" />
        </div>
        <ul className="max-h-[360px] space-y-0.5 overflow-y-auto">
          {rows == null ? <li className="ui-skeleton h-24 w-full" /> : null}
          {rows && list.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">No transformer matches.</li> : null}
          {list.map((r) => {
            const p = geo.pathOf(r.depotId ?? null);
            const sel = target?.id === r.id;
            return (
              <PickRow
                key={r.id}
                onClick={() => setTarget(r)}
                title={
                  <span className={sel ? "text-blue-700 dark:text-blue-300" : ""}>
                    {r.name}
                    {r.transformerNumber ? <span className="ml-1 font-normal text-slate-400">No. {r.transformerNumber}</span> : null}
                  </span>
                }
                sub={`${p.regionName} › ${p.districtName} › ${p.depotName} · ${(r.controllerEuis ?? []).length} controller${(r.controllerEuis ?? []).length === 1 ? "" : "s"}`}
                right={
                  sel ? (
                    <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">Selected</span>
                  ) : (
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-blue-600 ring-1 ring-blue-200">Choose</span>
                  )
                }
              />
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}

/** Link one of the controllers waiting on the New controllers page to this transformer. */
function AddDialog({ open, token, onClose, onPick }: { open: boolean; token: string | null; onClose: () => void; onPick: (c: Unmatched) => void }) {
  const [rows, setRows] = useState<Unmatched[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open || !token) return;
    setQ("");
    void cachedGet<Unmatched[]>(`${API}/api/v1/controllers/unmatched`, token, 15_000, true).then(setRows).catch(() => setRows([]));
  }, [open, token]);
  const term = q.trim().toLowerCase();
  const list = (rows ?? [])
    .filter((c) => !term || [c.devEui, c.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
    .sort((a, b) => Number(!!b.online) - Number(!!a.online))
    .slice(0, 40);
  return (
    <Dialog open={open} onClose={onClose} icon={<Link2 className="h-4 w-4" />} title="Link a controller" subtitle="Controllers heard by partner feeds that are not on any transformer yet" width="max-w-2xl" footer={<Button onClick={onClose}>Close</Button>}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by device EUI or name…" />
        </div>
        <ul className="max-h-[360px] space-y-0.5 overflow-y-auto">
          {rows == null ? <li className="ui-skeleton h-24 w-full" /> : null}
          {rows && list.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">{rows.length ? "No controller matches." : "No controller is waiting."}</li> : null}
          {list.map((c) => (
            <PickRow
              key={c.id}
              onClick={() => onPick(c)}
              title={<span className="font-mono tracking-wide">{c.devEui}</span>}
              sub={`${ctlLabel(c)} · ${c.supplierCode ? displayPartner(c.supplierName, c.supplierCode) : "Unknown partner"} · last heard ${c.lastReadingAt ? timeAgo(c.lastReadingAt) : "never"}`}
              right={
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Link2 className="h-3 w-3" /> Link
                </span>
              }
            />
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ at a glance (right column)

type GlanceRow = {
  status?: string;
  minutesSinceSignal?: number | null;
  lastSignalAt?: string | null;
  reportedArmState?: string | null;
  lastCommandAction?: string | null;
  openAlerts?: number;
  totalAlerts?: number;
  lastAlertAt?: string | null;
};
type GlanceAlert = { id: number; message?: string | null; value?: string | null; createdAt?: string | null; lastSeenAt?: string | null; occurrenceCount?: number | null; caseStatus?: string | null; status?: string | null };

const GLANCE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ONLINE: { label: "Online", cls: "text-emerald-700 bg-emerald-50 ring-emerald-200", dot: "bg-emerald-500" },
  DELAYED: { label: "Delayed", cls: "text-amber-700 bg-amber-50 ring-amber-200", dot: "bg-amber-500" },
  OFFLINE: { label: "Offline", cls: "text-red-700 bg-red-50 ring-red-200", dot: "bg-red-500" },
  NEVER_SEEN: { label: "Never seen", cls: "text-slate-600 bg-slate-100 ring-slate-200", dot: "bg-slate-400" },
  NO_DEVICE: { label: "No device", cls: "text-slate-500 bg-slate-50 ring-slate-200", dot: "bg-slate-300" },
};

/** Live state of the site while you edit it: status, last signal, arm state, alerts and the latest few alerts. */
function AtAGlance({ id, token }: { id?: string; token?: string | null }) {
  const det = useCachedGet<GlanceRow>(token && id ? `${API}/api/v1/transformers/registry/${id}` : null, token, { maxAgeMs: 15_000 });
  const al = useCachedGet<{ content?: GlanceAlert[] }>(token && id ? `${API}/api/v1/alerts?transformerId=${id}&page=0&size=4` : null, token, { maxAgeMs: 15_000 });
  const d = det.data;
  const st = GLANCE_STATUS[d?.status || ""] ?? GLANCE_STATUS.NEVER_SEEN;
  const arm = d?.reportedArmState || (d?.lastCommandAction === "ARM" ? "ARMED" : d?.lastCommandAction === "DISARM" ? "DISARMED" : null);
  const alerts = al.data?.content ?? [];
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-[#0b4fc4] to-red-500" />
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Activity className="h-4 w-4 text-blue-600" /> At a glance
        </h3>
        <Link to={`/transformer/${id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
          Full details <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {det.loading && !d ? (
          Array.from({ length: 4 }).map((_, k) => <div key={k} className="ui-skeleton h-16 rounded-2xl" />)
        ) : (
          <>
            <Tile label="Status">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${st.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
            </Tile>
            <Tile label="Last signal" icon={<Clock className="h-3 w-3" />}>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{d?.lastSignalAt ? timeAgo(d.lastSignalAt) : "Never"}</span>
            </Tile>
            <Tile label="Site security">
              {arm ? (
                <span className={`inline-flex items-center gap-1 text-sm font-semibold ${arm === "ARMED" ? "text-emerald-700" : "text-amber-700"}`}>
                  {arm === "ARMED" ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                  {arm === "ARMED" ? "Armed" : "Disarmed"}
                </span>
              ) : (
                <span className="text-sm text-slate-400">Not reported</span>
              )}
            </Tile>
            <Tile label="Open alerts" icon={<BellRing className="h-3 w-3" />}>
              <span className={`text-sm font-semibold ${d?.openAlerts ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>
                {d?.openAlerts ?? 0}
                <span className="ml-1 text-[11px] font-normal text-slate-400">of {d?.totalAlerts ?? 0}</span>
              </span>
            </Tile>
          </>
        )}
      </div>
      <div className="mt-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Latest alerts</p>
        {al.loading && !al.data ? (
          <div className="space-y-1.5">
            <div className="ui-skeleton h-8 rounded-xl" />
            <div className="ui-skeleton h-8 rounded-xl" />
          </div>
        ) : !alerts.length ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">No alerts recorded for this site.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => {
              const open = !["RESOLVED", "CLOSED", "FALSE_ALARM"].includes(String(a.caseStatus || a.status || "").toUpperCase());
              return (
                <li key={a.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${open ? "bg-red-500" : "bg-slate-300"}`} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                    {a.message || a.value || "Alert"}
                    {a.occurrenceCount && a.occurrenceCount > 1 ? <span className="ml-1 text-[10px] font-bold text-red-600">×{a.occurrenceCount}</span> : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(a.lastSeenAt || a.createdAt || undefined)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Tile({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-2.5 ring-1 ring-slate-200/80 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-800">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}
