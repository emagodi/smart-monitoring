import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertOctagon, Check, CheckCircle2, Plus, Wrench } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { cachedGet } from "../../lib/cache";
import { Button, Chips, Dialog, EmptyRow, Field, HeroStat, HeroStats, inputCls, MobileFilters, Notice, PageHero, Pager, Panel, SearchBox, SelectBox, SkeletonRows, tableCls } from "../../components/ui/page";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import { TransformerPicker, usePartners } from "../Installations/components";
import { fmtDateTime, who } from "../Installations/shared";
import axios from "axios";

const API = (import.meta.env.VITE_API_BASE_URL || "") + "/api/v1/faults";

export const FAULT_TYPES: Record<string, string> = {
  FALSE_TRIGGERING: "Keeps triggering falsely",
  SENSOR_FAULT: "Sensor fault",
  POWER_SUPPLY: "Power supply",
  BATTERY: "Battery",
  COMMUNICATION: "Communication / signal",
  SIREN_LIGHTS: "Siren or flash lights",
  TAMPERED: "Tampered / damaged",
  DEVICE_OFFLINE: "Device offline",
  OTHER: "Other",
};

export type Fault = {
  id: number;
  transformerId: number;
  transformerName: string;
  transformerNumber?: string | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  alertId?: number | null;
  faultType: string;
  description?: string | null;
  status: "OPEN" | "RESOLVED";
  reportedBy?: string | null;
  reportedAt?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  ageHours?: number | null;
};

/** Raise a fault alarm: usable from the transformer list (preset transformer) or the Faults page. */
export function RaiseFaultDialog({
  open,
  onClose,
  onDone,
  transformer,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  transformer?: { id: number; name: string; transformerNumber?: string | null } | null;
}) {
  const { token } = useAuth();
  const [txs, setTxs] = useState<Array<{ id: number; name: string; transformerNumber?: string | null }>>([]);
  const [type, setType] = useState("SENSOR_FAULT");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setTxs(transformer ? [transformer] : []);
  }, [open, transformer]);
  const target = txs[txs.length - 1];
  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await axios.post(API, { transformerId: target.id, faultType: type, description: desc }, { headers: { Authorization: `Bearer ${token}` } });
      setDesc("");
      onDone();
    } catch (e) {
      setError(apiError(e, "Could not raise the fault."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<Wrench className="h-5 w-5" />}
      title="Raise a fault alarm"
      subtitle="An equipment problem on the monitoring kit (not an intrusion). The partner is expected to fix it; it shows on the transformer until resolved."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={!target} onClick={() => void submit()}>
            Raise fault
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
        {transformer ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold dark:bg-slate-900">
            {transformer.name}
            {transformer.transformerNumber ? <span className="ml-1 font-normal text-slate-500">No. {transformer.transformerNumber}</span> : null}
          </p>
        ) : (
          <Field label="Transformer">
            <TransformerPicker token={token} value={txs.slice(-1)} onChange={(v) => setTxs(v.slice(-1))} />
          </Field>
        )}
        <Field label="What is wrong?">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(FAULT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Details">
          <textarea className={`${inputCls} h-24 py-2`} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Door sensor triggers every night at ~02:00 with nobody on site" />
        </Field>
      </div>
    </Dialog>
  );
}

export default function FaultsPage() {
  const { token, hasPermission } = useAuth();
  const { isPartner, isDepot } = useScope();
  const geo = useGeography(token);
  const partners = usePartners(token);
  const [params] = useSearchParams();
  const canRecord = hasPermission("faults.record");
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [type, setType] = useState("");
  const [partner, setPartner] = useState("");
  const [depotId, setDepotId] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [data, setData] = useState<{ content: Fault[]; totalElements: number; counts: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [raise, setRaise] = useState(false);
  const [resolveFor, setResolveFor] = useState<Fault | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [busy, setBusy] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size), status });
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set("type", type);
    if (partner) p.set("supplierCode", partner);
    if (depotId) p.set("depotIds", depotId);
    return p.toString();
  }, [page, size, status, q, type, partner, depotId]);

  const load = useCallback(
    async (force = false) => {
      if (!token) return;
      setLoading(true);
      try {
        setData(await cachedGet(`${API}?${qs}`, token, 15_000, force));
        setError(null);
      } catch (e) {
        setError(apiError(e, "Could not load fault alarms."));
      } finally {
        setLoading(false);
      }
    },
    [qs, token]
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(0), [status, q, type, partner, depotId, size]);

  const resolve = async () => {
    if (!resolveFor) return;
    setBusy(true);
    try {
      await axios.post(`${API}/${resolveFor.id}/resolve`, { note: resolveNote }, { headers: { Authorization: `Bearer ${token}` } });
      setResolveFor(null);
      setResolveNote("");
      setNotice("Fault marked as fixed.");
      void load(true);
    } catch (e) {
      setError(apiError(e, "Could not resolve."));
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts ?? {};
  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Reaction"
        title="Fault alarms"
        subtitle="Equipment faults on transformer monitoring kits: raised from the transformer list, the Response Desk (closing an incident as a technical fault) or here. The partner fixes them; ZESA tracks how long it takes."
        actions={
          canRecord ? (
            <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setRaise(true)}>
              Raise fault
            </Button>
          ) : null
        }
      >
        <HeroStats cols={3}>
          <HeroStat icon={<AlertOctagon className="h-3.5 w-3.5" />} label="Open faults" value={counts.OPEN ?? 0} tone={(counts.OPEN ?? 0) > 0 ? "bad" : "good"} onClick={() => setStatus("OPEN")} active={status === "OPEN"} />
          <HeroStat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Fixed" value={counts.RESOLVED ?? 0} tone="good" onClick={() => setStatus("RESOLVED")} active={status === "RESOLVED"} />
          <HeroStat icon={<Wrench className="h-3.5 w-3.5" />} label="All" value={(counts.OPEN ?? 0) + (counts.RESOLVED ?? 0)} onClick={() => setStatus("ALL")} active={status === "ALL"} />
        </HeroStats>
      </PageHero>
      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {notice ? (
        <Notice tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Notice>
      ) : null}
      <Panel
        toolbar={
          <div className="flex w-full flex-col gap-2.5">
            <Chips value={status} onChange={setStatus} options={[{ value: "OPEN", label: "Open", count: counts.OPEN ?? 0, dot: "bg-red-500" }, { value: "RESOLVED", label: "Fixed", count: counts.RESOLVED ?? 0, dot: "bg-emerald-500" }, { value: "ALL", label: "All" }]} />
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder="Transformer, number, details…" className="max-w-sm" />
              <MobileFilters active={[type, partner, depotId].filter(Boolean).length}>
                <SelectBox label="Fault" value={type} onChange={setType}>
                  <option value="">All</option>
                  {Object.entries(FAULT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </SelectBox>
                {!isPartner ? (
                  <SelectBox label="Partner" value={partner} onChange={setPartner}>
                    <option value="">All</option>
                    {partners.map(([c, n]) => (
                      <option key={c} value={c}>
                        {n}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                {!isDepot ? (
                  <SelectBox label="Depot" value={depotId} onChange={setDepotId}>
                    <option value="">All</option>
                    {geo.depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
              </MobileFilters>
            </div>
          </div>
        }
      >
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Transformer</th>
                <th className={tableCls.th}>Fault</th>
                {!isPartner ? <th className={tableCls.th}>Partner</th> : null}
                <th className={tableCls.th}>Raised</th>
                <th className={tableCls.th}>Status</th>
                <th className={`${tableCls.th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading && !data ? (
                <SkeletonRows rows={5} cols={6} />
              ) : !data?.content.length ? (
                <EmptyRow cols={6}>{status === "OPEN" ? "No open fault alarms." : "No fault alarms match."}</EmptyRow>
              ) : (
                data.content.map((f) => (
                  <tr key={f.id} className={tableCls.tr}>
                    <td className={tableCls.td} data-label="Transformer">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{f.transformerName}</p>
                      <p className="text-[11px] text-slate-500">
                        {f.transformerNumber ? `No. ${f.transformerNumber} · ` : ""}
                        {f.depotId ? geo.pathOf(f.depotId).depotName : ""}
                      </p>
                    </td>
                    <td className={tableCls.td} data-label="Fault">
                      <p className="font-medium">{FAULT_TYPES[f.faultType] ?? f.faultType}</p>
                      {f.description ? <p className="max-w-xs truncate text-[11px] text-slate-500" title={f.description}>{f.description}</p> : null}
                      {f.alertId ? <p className="text-[10px] text-slate-400">from incident #{f.alertId}</p> : null}
                    </td>
                    {!isPartner ? (
                      <td className={tableCls.td} data-label="Partner">
                        {f.supplierName ?? f.supplierCode ?? "—"}
                      </td>
                    ) : null}
                    <td className={tableCls.td} data-label="Raised">
                      <p className="whitespace-nowrap text-xs">{fmtDateTime(f.reportedAt)}</p>
                      <p className="text-[11px] capitalize text-slate-500">by {who(f.reportedBy)}</p>
                    </td>
                    <td className={tableCls.td} data-label="Status">
                      {f.status === "OPEN" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          Open · {f.ageHours != null ? (f.ageHours < 48 ? `${f.ageHours} h` : `${Math.round(f.ageHours / 24)} d`) : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" title={f.resolutionNote ?? ""}>
                          Fixed {fmtDateTime(f.resolvedAt)}
                        </span>
                      )}
                    </td>
                    <td className={`${tableCls.td} text-right`} data-actions>
                      {canRecord && f.status === "OPEN" ? (
                        <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setResolveFor(f)}>
                          Mark fixed
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalElements > 0 ? <Pager page={page} pageSize={size} total={data.totalElements} onPage={setPage} onPageSize={setSize} /> : null}
      </Panel>

      <RaiseFaultDialog open={raise} onClose={() => setRaise(false)} onDone={() => { setRaise(false); setNotice("Fault alarm raised."); void load(true); }} />
      {resolveFor ? (
        <Dialog
          open
          onClose={() => setResolveFor(null)}
          icon={<Check className="h-5 w-5" />}
          title="Mark the fault as fixed"
          subtitle={`${resolveFor.transformerName} · ${FAULT_TYPES[resolveFor.faultType] ?? resolveFor.faultType}`}
          footer={
            <>
              <Button onClick={() => setResolveFor(null)}>Back</Button>
              <Button variant="primary" busy={busy} onClick={() => void resolve()}>
                Mark fixed
              </Button>
            </>
          }
        >
          <Field label="What was done?">
            <textarea className={`${inputCls} h-24 py-2`} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="e.g. Door switch replaced by partner technician 12/11" />
          </Field>
        </Dialog>
      ) : null}
    </div>
  );
}
