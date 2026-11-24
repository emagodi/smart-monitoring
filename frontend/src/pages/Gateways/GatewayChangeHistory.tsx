import { useEffect, useState, type ReactElement } from "react";
import { ArrowRight, Cloud, GitMerge, Loader2, Pencil, PlusCircle, RotateCcw, Trash2, Unplug, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cachedGet } from "../../lib/cache";

const API = import.meta.env.VITE_API_BASE_URL || "";

type Change = {
  id: number;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  source: string;
  actor?: string | null;
  note?: string | null;
  changedAt?: string | null;
};

const FIELD: Record<string, string> = {
  name: "Name",
  loriotGatewayId: "LORIOT id",
  gatewayEui: "Gateway EUI",
  macAddress: "MAC address",
  serialNumber: "Serial number",
  imei: "IMEI",
  manufacturer: "Manufacturer",
  model: "Model",
  firmwareVersion: "Firmware",
  networkId: "Network id",
  networkName: "Network",
  operator: "Operator",
  customer: "Customer",
  description: "Description",
  latitude: "Latitude",
  longitude: "Longitude",
  address: "Address",
  locationSource: "Location source",
  regionName: "Region",
  districtName: "District",
  depotName: "Depot",
  depotId: "Depot id",
  commissioningDate: "Commissioning date",
  decommissioned: "Decommissioned",
};

const ACTION: Record<string, { label: string; icon: ReactElement; tone: string }> = {
  CREATE: { label: "Added", icon: <PlusCircle className="h-3.5 w-3.5" />, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  UPDATE: { label: "Changed", icon: <Pencil className="h-3.5 w-3.5" />, tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  MERGE: { label: "Merged in", icon: <GitMerge className="h-3.5 w-3.5" />, tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  MERGED_INTO: { label: "Merged away", icon: <GitMerge className="h-3.5 w-3.5" />, tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  DELETE: { label: "Deleted", icon: <Trash2 className="h-3.5 w-3.5" />, tone: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
  DECOMMISSION: { label: "Decommissioned", icon: <Unplug className="h-3.5 w-3.5" />, tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  REMOVED_IN_LORIOT: { label: "Removed in LORIOT", icon: <Cloud className="h-3.5 w-3.5" />, tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  BACK_IN_LORIOT: { label: "Back in LORIOT", icon: <RotateCcw className="h-3.5 w-3.5" />, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
};

const when = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Audit trail of a gateway: what changed (from LORIOT or by whom), old and new values. */
export default function GatewayChangeHistory({ gatewayId }: { gatewayId: number }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setRows(null);
    setError(null);
    cachedGet<{ content: Change[] }>(`${API}/api/v1/gateways/${gatewayId}/changes?size=100`, token, 10_000, true)
      .then((r) => setRows(r?.content ?? []))
      .catch(() => setError("Could not load the change history."));
  }, [gatewayId, token]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!rows)
    return (
      <p className="flex items-center gap-2 py-6 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
      </p>
    );
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-xs text-slate-500">
        No changes recorded yet. From now on, renames, re-registrations, EUI / MAC / location changes from LORIOT and every edit, merge or delete here are listed.
      </p>
    );

  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-slate-800">
      {rows.map((c) => {
        const a = ACTION[c.action] ?? ACTION.UPDATE;
        const fromLoriot = c.source === "LORIOT_SYNC";
        return (
          <li key={c.id} className="relative">
            <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500 dark:border-slate-950" />
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${a.tone}`}>
                {a.icon}
                {c.action === "UPDATE" && c.field ? FIELD[c.field] ?? c.field : a.label}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                {fromLoriot ? <Cloud className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {fromLoriot ? "LORIOT" : c.actor || "User"}
              </span>
              <span className="text-slate-400">· {when(c.changedAt)}</span>
            </div>
            {c.action === "UPDATE" && c.field ? (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-red-700 line-through decoration-red-300 dark:bg-red-500/10 dark:text-red-300">{c.oldValue ?? "empty"}</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{c.newValue ?? "empty"}</span>
              </p>
            ) : null}
            {c.note && !(c.action === "UPDATE" && /^(Edited|Changed in LORIOT)$/.test(c.note)) ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{c.note.replace(/ Record was: .*$/, "")}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
