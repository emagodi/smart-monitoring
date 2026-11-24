import { useState } from "react";
import axios from "axios";
import { AlertTriangle, ArrowLeftRight, Cloud, CloudOff, GitMerge, Loader2, MapPin, CardSim, Trash2 } from "lucide-react";
import { Dialog, Notice } from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

export type DupGateway = {
  id: number;
  name: string;
  gatewayEui?: string | null;
  macAddress?: string | null;
  loriotGatewayId?: string | null;
  effectiveStatus?: string | null;
  lastSeenAt?: string | null;
  inLoriot: boolean;
  simAssigned: boolean;
  depotName?: string | null;
  hasLocation: boolean;
  locationSource?: string | null;
  decommissioned?: boolean;
};

export type DuplicatePair = { keep: DupGateway; remove: DupGateway; reasons: string[] };

const errText = (e: unknown, fallback: string) => {
  const d = (e as { response?: { data?: { message?: string; error?: string } | string } })?.response?.data;
  if (typeof d === "string" && d.trim()) return d;
  if (d && typeof d === "object") return d.message || d.error || fallback;
  return fallback;
};

const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (!Number.isFinite(m)) return "—";
  if (m < 1) return "just now";
  if (m < 60) return `${Math.floor(m)} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

/** Highlights the characters where two EUIs differ, so a one-character typo is obvious. */
function EuiDiff({ a, b }: { a?: string | null; b?: string | null }) {
  if (!a) return <span className="text-slate-400">—</span>;
  const x = a.replace(/[^0-9a-f]/gi, "").toUpperCase();
  const y = (b || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  return (
    <span className="font-mono">
      {x.split("").map((ch, i) => (
        <span key={i} className={y && y.length === x.length && y[i] !== ch ? "rounded bg-amber-200 px-0.5 font-bold text-amber-900" : ""}>
          {ch}
        </span>
      ))}
    </span>
  );
}

function GatewayCard({ g, other, role }: { g: DupGateway; other: DupGateway; role: "keep" | "remove" }) {
  const online = g.effectiveStatus === "ONLINE";
  return (
    <div className={`flex-1 rounded-2xl border p-3 ${role === "keep" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/5" : "border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${role === "keep" ? "text-emerald-700" : "text-red-700"}`}>{role === "keep" ? "Keep" : "Merge in & remove"}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
        {g.name} <span className="text-[11px] font-normal text-slate-400">#{g.id}</span>
      </p>
      <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
        <p>
          EUI <EuiDiff a={g.gatewayEui} b={other.gatewayEui} />
        </p>
        {g.macAddress ? <p className="font-mono">MAC {g.macAddress}</p> : null}
        <p className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 font-semibold ${online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{(g.effectiveStatus || "UNKNOWN").replace("_", " ")}</span>
          <span>seen {ago(g.lastSeenAt)}</span>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1">{g.inLoriot ? <Cloud className="h-3 w-3 text-blue-600" /> : <CloudOff className="h-3 w-3 text-amber-600" />}{g.inLoriot ? "In LORIOT" : "Not in LORIOT"}</span>
          <span className="inline-flex items-center gap-1"><CardSim className="h-3 w-3" />{g.simAssigned ? "SIM assigned" : "No SIM"}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{g.hasLocation ? (g.locationSource || "Location") : "No location"}</span>
        </p>
        {g.depotName ? <p>Depot: {g.depotName}</p> : null}
      </div>
    </div>
  );
}

/** Review gateway records that are probably the same device, and merge the stale one into the live one. */
export function DuplicatesDialog({
  open,
  onClose,
  pairs,
  headers,
  canMerge,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  pairs: DuplicatePair[];
  headers: Record<string, string>;
  canMerge: boolean;
  onChanged: (message: string) => void;
}) {
  const [swapped, setSwapped] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [force, setForce] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const key = (p: DuplicatePair) => `${Math.min(p.keep.id, p.remove.id)}-${Math.max(p.keep.id, p.remove.id)}`;

  const merge = async (p: DuplicatePair) => {
    const k = key(p);
    const keep = swapped[k] ? p.remove : p.keep;
    const remove = swapped[k] ? p.keep : p.remove;
    setBusy(k);
    setError(null);
    try {
      const r = await axios.post<{ moved?: string[] }>(`${API}/api/v1/gateways/${remove.id}/merge`, { targetId: keep.id, force: !!force[k] }, { headers });
      const moved: string[] = r.data?.moved ?? [];
      onChanged(`"${remove.name}" merged into "${keep.name}"${moved.length ? ` (${moved.join(", ")})` : ""}.`);
    } catch (e) {
      setError(errText(e, "Could not merge these gateways."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      icon={<GitMerge className="h-5 w-5" />}
      title="Duplicate gateway records"
      subtitle="Records with exactly the same MAC or EUI: the same device, usually deleted in LORIOT and registered again. Merging moves its SIM, location, depot and transformer links to the one you keep, then removes the old record. Everything is kept in the change history."
    >
      {error ? <Notice>{error}</Notice> : null}
      {pairs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No duplicates found.</p>
      ) : (
        <div className="space-y-4">
          {pairs.map((p) => {
            const k = key(p);
            const keep = swapped[k] ? p.remove : p.keep;
            const remove = swapped[k] ? p.keep : p.remove;
            return (
              <div key={k} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {p.reasons.map((r) => (
                    <li key={r} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <GatewayCard g={keep} other={remove} role="keep" />
                  <button
                    type="button"
                    onClick={() => setSwapped((s) => ({ ...s, [k]: !s[k] }))}
                    title="Swap which one to keep"
                    className="mx-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  <GatewayCard g={remove} other={keep} role="remove" />
                </div>
                {remove.inLoriot ? (
                  <label className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    <input type="checkbox" className="mt-0.5" checked={!!force[k]} onChange={(e) => setForce((f) => ({ ...f, [k]: e.target.checked }))} />
                    <span>
                      <b>"{remove.name}" is still registered in LORIOT</b>, so the next sync would add it back. Delete it in LORIOT first, or tick this to merge anyway.
                    </span>
                  </label>
                ) : null}
                {canMerge ? (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={busy != null || (remove.inLoriot && !force[k])}
                      onClick={() => void merge(p)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                      Merge "{remove.name}" into "{keep.name}"
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

/** Delete a gateway record (its SIM is released). Refused while LORIOT still lists it unless forced. */
export function DeleteGatewayDialog({
  gateway,
  onClose,
  headers,
  canForce,
  onDeleted,
}: {
  gateway: { id: number; name: string; gatewayEui?: string | null; inLoriot?: boolean | null; simAssigned?: boolean } | null;
  onClose: () => void;
  headers: Record<string, string>;
  canForce: boolean;
  onDeleted: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!gateway) return null;
  const stillInLoriot = !!gateway.inLoriot;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await axios.request({
        method: "delete",
        url: `${API}/api/v1/gateways/${gateway.id}`,
        headers: { ...headers, "Content-Type": "application/json" },
        params: { force: force || undefined },
        data: { reason: reason.trim() || undefined },
      });
      const sims = (r.data as { simsReleased?: number } | undefined)?.simsReleased ?? 0;
      setReason("");
      setForce(false);
      onDeleted(`"${gateway.name}" deleted${sims ? `; ${sims} SIM card released` : ""}.`);
    } catch (e) {
      setError(errText(e, "Could not delete this gateway."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      icon={<Trash2 className="h-5 w-5" />}
      title={`Delete "${gateway.name}"?`}
      subtitle={gateway.gatewayEui ? `EUI ${gateway.gatewayEui}` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (stillInLoriot && !force)}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete gateway
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error ? <Notice>{error}</Notice> : null}
        <p className="text-slate-600 dark:text-slate-300">
          The record is removed from TIAS{gateway.simAssigned ? " and its SIM card is released (marked available)" : ""}. Its status history goes with it; the deletion and the record's last details are kept in the change log.
        </p>
        <p className="text-xs text-slate-500">If this is a duplicate of a re-registered gateway, use <b>Duplicates → Merge</b> instead, so its SIM, location and depot move to the live record.</p>
        {stillInLoriot ? (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <b>LORIOT still lists this gateway</b>, so the next sync (within 2 minutes) adds it back. Delete it in LORIOT first, or decommission it here instead.
              {canForce ? (
                <label className="mt-1.5 flex items-center gap-2">
                  <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Delete anyway
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Reason (kept in the change log)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate entry after re-registering in LORIOT"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
      </div>
    </Dialog>
  );
}
