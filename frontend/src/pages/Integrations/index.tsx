import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { ClipboardCopy, FlaskConical, Loader2, Pencil, Plug, Plus, RadioTower, RefreshCcw, Trash2, Webhook } from "lucide-react";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../Registry/geo";

type Integration = {
  id: number;
  supplierCode: string;
  supplierName?: string | null;
  name: string;
  transport: "LORIOT_WEBSOCKET" | "HTTP_PUSH";
  endpointUrlMasked?: string | null;
  pushPath?: string | null;
  pushSecret?: string | null;
  decoderKey: string;
  defaultControllerType?: string | null;
  autoRegister: boolean;
  enabled: boolean;
  status?: string | null;
  lastError?: string | null;
  lastConnectedAt?: string | null;
  lastMessageAt?: string | null;
  messagesReceived: number;
  devicesRegistered: number;
};

type Decoder = { key: string; label: string };

const STATUS_STYLE: Record<string, { label: string; chip: string; dot: string }> = {
  CONNECTED: { label: "Connected", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  LISTENING: { label: "Listening", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  PENDING: { label: "Starting", chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  DISCONNECTED: { label: "Reconnecting", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  SKIPPED_LEGACY: { label: "Legacy feed active", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  ERROR: { label: "Error", chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  MISCONFIGURED: { label: "Needs URL", chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  STOPPED: { label: "Disabled", chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};

const blankForm = {
  supplierCode: "",
  supplierName: "",
  name: "",
  transport: "LORIOT_WEBSOCKET",
  endpointUrl: "",
  decoderKey: "dragino-lt22222",
  defaultControllerType: "",
  autoRegister: true,
  enabled: true,
  regenerateSecret: false,
};

const since = (iso?: string | null) => {
  if (!iso) return "never";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return "just now";
  if (m < 60) return `${Math.floor(m)} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

export default function IntegrationsPage() {
  const { token, hasPermission } = useAuth();
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const canManage = hasPermission("integrations.manage");
  const [items, setItems] = useState<Integration[]>([]);
  const [decoders, setDecoders] = useState<Decoder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [test, setTest] = useState({ decoderKey: "dragino-lt22222", payloadHex: "0000000000000000b4ff41", port: "2", messageJson: "" });
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [i, d] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/supplier-integrations`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/supplier-integrations/decoders`, { headers }),
      ]);
      setItems(Array.isArray(i.data) ? i.data : []);
      setDecoders(Array.isArray(d.data) ? d.data : []);
      setError(null);
    } catch {
      setError("Could not load integrations (needs the integrations.read permission).");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!token) return;
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, [load, token]);

  const openForm = (i?: Integration) => {
    setEditing(i || null);
    setForm(
      i
        ? {
            supplierCode: i.supplierCode,
            supplierName: i.supplierName || "",
            name: i.name,
            transport: i.transport,
            endpointUrl: "",
            decoderKey: i.decoderKey,
            defaultControllerType: i.defaultControllerType || "",
            autoRegister: i.autoRegister,
            enabled: i.enabled,
            regenerateSecret: false,
          }
        : blankForm
    );
    setFormError(null);
    setOpen(true);
  };

  const save = async () => {
    try {
      setSaving(true);
      setFormError(null);
      if (editing) await axios.put(`${API_BASE_URL}/api/v1/supplier-integrations/${editing.id}`, form, { headers });
      else await axios.post(`${API_BASE_URL}/api/v1/supplier-integrations`, form, { headers });
      setOpen(false);
      void load();
    } catch (e) {
      const d = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setFormError(d?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (i: Integration) => {
    if (!window.confirm(`Delete the "${i.name}" feed? Devices and readings are kept.`)) return;
    await axios.delete(`${API_BASE_URL}/api/v1/supplier-integrations/${i.id}`, { headers });
    void load();
  };

  const runTest = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/supplier-integrations/test-decode`,
        { ...test, port: Number(test.port) || 2 },
        { headers }
      );
      setTestResult(JSON.stringify(res.data, null, 2));
    } catch (e) {
      const d = (e as { response?: { data?: { message?: string } } })?.response?.data;
      setTestResult(`Error: ${d?.message || "decode failed"}`);
    }
  };

  const copy = (text: string) => void navigator.clipboard?.writeText(text);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-5 py-4 text-white shadow-[0_18px_40px_-24px_rgba(11,79,196,0.7)]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">Partner telemetry</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">Integrations</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100/80">
              One feed per partner LORIOT application (or HTTP push), each with its own decoder. Every decoder emits the same motion / door / vibration
              signals, so alerts and dispatch work identically for every partner.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/15">
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {canManage ? (
              <button type="button" onClick={() => openForm()} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900">
                <Plus className="h-4 w-4" /> Add partner feed
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-3 lg:grid-cols-2">
        {items.map((i) => {
          const st = STATUS_STYLE[i.enabled ? i.status || "PENDING" : "STOPPED"] || STATUS_STYLE.PENDING;
          return (
            <div key={i.id} className="enterprise-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-700 text-white">
                    {i.transport === "HTTP_PUSH" ? <Webhook className="h-5 w-5" /> : <RadioTower className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{i.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {i.supplierName} · {i.transport === "HTTP_PUSH" ? "HTTP push" : "LORIOT websocket"} · decoder <code>{i.decoderKey}</code>
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${st.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Messages" value={i.messagesReceived.toLocaleString()} />
                <Mini label="Devices auto-added" value={i.devicesRegistered} />
                <Mini label="Last message" value={since(i.lastMessageAt)} />
              </div>
              {i.transport === "LORIOT_WEBSOCKET" ? (
                <p className="mt-3 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">{i.endpointUrlMasked || "No URL set"}</p>
              ) : (
                <div className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <p className="flex items-center justify-between gap-2 font-mono">
                    POST {window.location.origin}
                    {i.pushPath}
                    <button type="button" onClick={() => copy(`${window.location.origin}${i.pushPath}`)}>
                      <ClipboardCopy className="h-3.5 w-3.5" />
                    </button>
                  </p>
                  <p className="flex items-center justify-between gap-2 font-mono">
                    X-Integration-Key: {i.pushSecret ? `${i.pushSecret.slice(0, 6)}…` : "—"}
                    {i.pushSecret ? (
                      <button type="button" onClick={() => copy(i.pushSecret!)}>
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </p>
                </div>
              )}
              {i.lastError && i.enabled ? <p className="mt-2 text-[11px] text-red-600">{i.lastError}</p> : null}
              {canManage ? (
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button type="button" onClick={() => openForm(i)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:text-slate-200">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => void remove(i)} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        {!loading && items.length === 0 && !error ? (
          <div className="enterprise-card flex flex-col items-center gap-2 px-6 py-14 text-center lg:col-span-2">
            <Plug className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No partner feeds yet</p>
          </div>
        ) : null}
      </section>

      {/* Decoder bench */}
      <section className="enterprise-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <FlaskConical className="h-4 w-4 text-violet-600" /> Decoder test bench
        </h2>
        <p className="text-xs text-slate-500">Paste a payload from a partner's device to check what the platform will see before you switch the feed on.</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <select value={test.decoderKey} onChange={(e) => setTest({ ...test, decoderKey: e.target.value })} className={inputCls}>
              {decoders.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <input value={test.payloadHex} onChange={(e) => setTest({ ...test, payloadHex: e.target.value })} placeholder="Payload hex" className={`${inputCls} font-mono`} />
              <input value={test.port} onChange={(e) => setTest({ ...test, port: e.target.value })} placeholder="Port" className={inputCls} />
            </div>
            <textarea
              value={test.messageJson}
              onChange={(e) => setTest({ ...test, messageJson: e.target.value })}
              rows={4}
              placeholder='Optional: full LORIOT/HTTP message JSON, e.g. {"cmd":"gw","EUI":"…","data":"…","decoded":{"door":"open"}}'
              className={`${inputCls} font-mono text-xs`}
            />
            <button type="button" onClick={() => void runTest()} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
              Decode
            </button>
          </div>
          <pre className="min-h-[160px] overflow-auto rounded-2xl bg-slate-950 p-3 text-[11px] text-emerald-200">{testResult || "Result appears here: motion, doorOrVibration, battery and every decoded field."}</pre>
        </div>
      </section>

      <Modal isOpen={open} onClose={() => setOpen(false)} variant="side-panel">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editing ? `Edit ${editing.name}` : "Add partner feed"}</h3>
            <p className="text-xs text-slate-500">Changes apply within 30 seconds; no restart needed.</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {formError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Partner code *">
                <input value={form.supplierCode} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} placeholder="oculus" className={inputCls} />
              </F>
              <F label="Partner name">
                <input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} placeholder="Oculus" className={inputCls} />
              </F>
            </div>
            <F label="Feed name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Oculus LORIOT application" className={inputCls} />
            </F>
            <F label="How data arrives">
              <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })} className={inputCls}>
                <option value="LORIOT_WEBSOCKET">LORIOT application websocket (we connect)</option>
                <option value="HTTP_PUSH">HTTP push (partner posts to us)</option>
              </select>
            </F>
            {form.transport === "LORIOT_WEBSOCKET" ? (
              <F label={editing ? "Websocket URL (leave blank to keep the current one)" : "Websocket URL *"}>
                <input value={form.endpointUrl} onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })} placeholder="wss://eu1.loriot.io/app?token=…" className={`${inputCls} font-mono text-xs`} />
              </F>
            ) : editing ? (
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={form.regenerateSecret} onChange={(e) => setForm({ ...form, regenerateSecret: e.target.checked })} /> Generate a new push key
              </label>
            ) : null}
            <F label="Decoder *">
              <select value={form.decoderKey} onChange={(e) => setForm({ ...form, decoderKey: e.target.value })} className={inputCls}>
                {decoders.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </F>
            <F label="Device type stored on new controllers">
              <input value={form.defaultControllerType} onChange={(e) => setForm({ ...form, defaultControllerType: e.target.value })} placeholder="DRAGINO_LT22222" className={inputCls} />
            </F>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.autoRegister} onChange={(e) => setForm({ ...form, autoRegister: e.target.checked })} /> Register unknown devices automatically (they appear under Transformers › Unmatched)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Feed enabled
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-200">
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save feed
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function F({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-900">
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
