import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import axios from "axios";
import { CarFront, Loader2, MessageCircle, Pencil, Phone, Plus, Search, Trash2, Truck, Users, Wrench } from "lucide-react";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, Depot, Vehicle, apiError, formatTime, normalizeList } from "./shared";

type Form = {
  registration: string;
  callSign: string;
  vehicleType: string;
  depotId: string;
  status: Vehicle["status"];
  crewLeadName: string;
  crewLeadPhone: string;
  crewLeadWhatsapp: string;
  crewLeadEmail: string;
  crewSize: string;
  notes: string;
};

const EMPTY: Form = {
  registration: "",
  callSign: "",
  vehicleType: "Rapid response 4x4",
  depotId: "",
  status: "AVAILABLE",
  crewLeadName: "",
  crewLeadPhone: "",
  crewLeadWhatsapp: "",
  crewLeadEmail: "",
  crewSize: "2",
  notes: "",
};

const STATUS_STYLE: Record<Vehicle["status"], { label: string; chip: string; dot: string }> = {
  AVAILABLE: { label: "Available", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", dot: "bg-emerald-500" },
  DISPATCHED: { label: "On a job", chip: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30", dot: "bg-blue-500" },
  OUT_OF_SERVICE: { label: "Out of service", chip: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700", dot: "bg-slate-400" },
};

export default function Fleet() {
  const { token, hasPermission } = useAuth();
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const canEdit = hasPermission("fleet.update");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [v, d] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/response/vehicles`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }).catch(() => ({ data: [] })),
      ]);
      setVehicles(normalizeList<Vehicle>(v.data));
      setDepots(normalizeList<Depot>(d.data).sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
    } catch (e) {
      setError(apiError(e, "Could not load the fleet."));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, Vehicle[]>();
    vehicles
      .filter(
        (v) =>
          !q ||
          [v.registration, v.callSign, v.depotName, v.crewLeadName, v.crewLeadPhone].filter(Boolean).some((t) => String(t).toLowerCase().includes(q))
      )
      .forEach((v) => {
        const key = v.depotName || "No depot assigned";
        map.set(key, [...(map.get(key) || []), v]);
      });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [search, vehicles]);

  const counts = useMemo(
    () => ({
      total: vehicles.length,
      available: vehicles.filter((v) => v.status === "AVAILABLE").length,
      busy: vehicles.filter((v) => v.status === "DISPATCHED").length,
      out: vehicles.filter((v) => v.status === "OUT_OF_SERVICE").length,
      depots: new Set(vehicles.map((v) => v.depotId).filter(Boolean)).size,
    }),
    [vehicles]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      registration: v.registration,
      callSign: v.callSign || "",
      vehicleType: v.vehicleType || "",
      depotId: v.depotId ? String(v.depotId) : "",
      status: v.status,
      crewLeadName: v.crewLeadName || "",
      crewLeadPhone: v.crewLeadPhone || "",
      crewLeadWhatsapp: v.crewLeadWhatsapp || "",
      crewLeadEmail: v.crewLeadEmail || "",
      crewSize: v.crewSize ? String(v.crewSize) : "",
      notes: v.notes || "",
    });
    setFormError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!form.registration.trim()) {
      setFormError("Registration is required.");
      return;
    }
    if (!form.crewLeadPhone.trim() && !form.crewLeadWhatsapp.trim() && !form.crewLeadEmail.trim()) {
      setFormError("Add at least one crew contact (phone, WhatsApp or email) so dispatches can reach the crew.");
      return;
    }
    const depot = depots.find((d) => String(d.id) === form.depotId);
    const body = {
      ...form,
      depotId: depot ? depot.id : null,
      depotName: depot ? depot.name : null,
      crewSize: form.crewSize ? Number(form.crewSize) : null,
    };
    try {
      setSaving(true);
      setFormError(null);
      if (editing) await axios.put(`${API_BASE_URL}/api/v1/response/vehicles/${editing.id}`, body, { headers });
      else await axios.post(`${API_BASE_URL}/api/v1/response/vehicles`, body, { headers });
      setOpen(false);
      void load();
    } catch (e) {
      setFormError(apiError(e, "Could not save the vehicle."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v: Vehicle) => {
    if (!window.confirm(`Remove ${v.registration} from the fleet?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/response/vehicles/${v.id}`, { headers });
      void load();
    } catch (e) {
      setError(apiError(e, "Could not remove the vehicle."));
    }
  };

  const set = (key: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] p-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">Loss control</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Rapid-response fleet</h1>
            <p className="mt-1 max-w-xl text-sm text-blue-100/80">
              Vehicles by depot, with the crew lead who receives the dispatch link. Keep contacts current: they are how crews get called out.
            </p>
          </div>
          {canEdit ? (
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-50">
              <Plus className="h-4 w-4" /> Add vehicle
            </button>
          ) : null}
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Vehicles" value={counts.total} icon={<Truck className="h-4 w-4" />} />
          <Stat label="Available" value={counts.available} icon={<CarFront className="h-4 w-4 text-emerald-300" />} />
          <Stat label="On a job" value={counts.busy} icon={<CarFront className="h-4 w-4 text-sky-300" />} />
          <Stat label="Out of service" value={counts.out} icon={<Wrench className="h-4 w-4 text-slate-300" />} />
          <Stat label="Depots covered" value={counts.depots} icon={<Users className="h-4 w-4" />} />
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="enterprise-chip flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registration, call sign, depot or crew lead…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Loading fleet…
        </div>
      ) : grouped.length === 0 ? (
        <div className="enterprise-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Truck className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No vehicles yet</p>
          <p className="max-w-sm text-xs text-slate-500">Register each loss-control vehicle with its depot and crew lead. Dispatchers then pick from this list on the Response Desk.</p>
          {canEdit ? (
            <button type="button" onClick={openCreate} className="mt-1 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Add the first vehicle
            </button>
          ) : null}
        </div>
      ) : (
        grouped.map(([depot, list]) => (
          <section key={depot} className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {depot} <span className="text-slate-400">· {list.length}</span>
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map((v) => {
                const s = STATUS_STYLE[v.status];
                return (
                  <div key={v.id} className="enterprise-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{v.callSign || v.registration}</p>
                          <p className="text-xs text-slate-500">
                            {v.callSign ? v.registration : ""} {v.vehicleType ? `· ${v.vehicleType}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${s.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                    {v.status === "DISPATCHED" && v.currentTransformerName ? (
                      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        At <span className="font-semibold">{v.currentTransformerName}</span> · {(v.currentDispatchStatus || "").replace("_", " ").toLowerCase()} since{" "}
                        {formatTime(v.currentDispatchedAt)}
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <p className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-slate-400" /> {v.crewLeadName || "No crew lead"} {v.crewSize ? `· crew of ${v.crewSize}` : ""}
                      </p>
                      {v.crewLeadPhone ? (
                        <a href={`tel:${v.crewLeadPhone}`} className="flex items-center gap-2 hover:text-blue-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" /> {v.crewLeadPhone}
                        </a>
                      ) : null}
                      {v.crewLeadWhatsapp ? (
                        <p className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-slate-400" /> {v.crewLeadWhatsapp}
                        </p>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <button type="button" onClick={() => openEdit(v)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button type="button" onClick={() => void remove(v)} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-500/30">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="side-panel">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editing ? `Edit ${editing.registration}` : "Add response vehicle"}</h3>
            <p className="text-xs text-slate-500">The crew lead receives the dispatch link by SMS, WhatsApp or email.</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {formError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div> : null}
            <Grid>
              <Field label="Registration *">
                <input value={form.registration} onChange={set("registration")} placeholder="AFE 1234" className={inputCls} />
              </Field>
              <Field label="Call sign">
                <input value={form.callSign} onChange={set("callSign")} placeholder="RR-HRE-01" className={inputCls} />
              </Field>
              <Field label="Vehicle type">
                <input value={form.vehicleType} onChange={set("vehicleType")} className={inputCls} />
              </Field>
              <Field label="Depot">
                <select value={form.depotId} onChange={set("depotId")} className={inputCls}>
                  <option value="">Select depot…</option>
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={set("status")} className={inputCls} disabled={editing?.status === "DISPATCHED"}>
                  <option value="AVAILABLE">Available</option>
                  <option value="OUT_OF_SERVICE">Out of service</option>
                  {editing?.status === "DISPATCHED" ? <option value="DISPATCHED">On a job</option> : null}
                </select>
              </Field>
              <Field label="Crew size">
                <input type="number" min={1} value={form.crewSize} onChange={set("crewSize")} className={inputCls} />
              </Field>
            </Grid>
            <p className="pt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Crew lead</p>
            <Grid>
              <Field label="Name">
                <input value={form.crewLeadName} onChange={set("crewLeadName")} className={inputCls} />
              </Field>
              <Field label="Phone (SMS)">
                <input value={form.crewLeadPhone} onChange={set("crewLeadPhone")} placeholder="0772 000 000" className={inputCls} />
              </Field>
              <Field label="WhatsApp">
                <input value={form.crewLeadWhatsapp} onChange={set("crewLeadWhatsapp")} placeholder="263772000000" className={inputCls} />
              </Field>
              <Field label="Email">
                <input value={form.crewLeadEmail} onChange={set("crewLeadEmail")} className={inputCls} />
              </Field>
            </Grid>
            <Field label="Notes">
              <textarea value={form.notes} onChange={set("notes")} rows={3} className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add vehicle"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-[11px] text-blue-100/75">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
