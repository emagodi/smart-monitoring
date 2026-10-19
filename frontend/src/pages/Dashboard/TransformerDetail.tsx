import { useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Cpu,
  Hash,
  Lock,
  MapPin,
  MapPinned,
  Pencil,
  Radio,
  ShieldCheck,
  ShieldOff,
  Siren,
  Unlock,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { invalidateCache, useCachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { useGeography } from "../Registry/geo";
import { CONTROL_PARTNERS } from "../Partners";
import { Button, Dialog, EmptyRow, HeroStat, HeroStats, Notice, PageHero, Pager, Panel, STATUS_META, StatusPill, tableCls, timeAgo } from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

/** GET /api/v1/transformers/registry/{id} */
type Detail = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  type?: string | null;
  active?: boolean;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lat?: number | null;
  lng?: number | null;
  lastSignalAt?: string | null;
  minutesSinceSignal?: number | null;
  status: string;
  controllerCount: number;
  controllerEuis: string[];
  reportedArmState?: "ARMED" | "DISARMED" | null;
  lastCommandAction?: string | null;
  lastCommandStatus?: string | null;
  lastCommandAt?: string | null;
  openAlerts: number;
  totalAlerts: number;
  lastAlertAt?: string | null;
  lastAlertMessage?: string | null;
  createdAt?: string | null;
};

type AlertRow = {
  id: number;
  value?: string | null;
  message?: string | null;
  sensorType?: string | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  occurrenceCount?: number | null;
  caseStatus?: string | null;
  status?: string | null;
  assignedToName?: string | null;
};

type AlertPage = { content?: AlertRow[]; totalElements?: number };

const CASE: Record<string, string> = {
  NEW: "bg-red-50 text-red-700 ring-red-200",
  ACKNOWLEDGED: "bg-amber-50 text-amber-700 ring-amber-200",
  DISPATCHED: "bg-blue-50 text-blue-700 ring-blue-200",
  EN_ROUTE: "bg-blue-50 text-blue-700 ring-blue-200",
  ON_SCENE: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FALSE_ALARM: "bg-slate-100 text-slate-600 ring-slate-200",
};

const typeLabel = (t?: string | null) => (t === "GROUND_MOUNTED" ? "Ground mounted (GMT)" : t === "POLE_MOUNTED" ? "Pole mounted (PMT)" : "Type not set");

const errText = (e: unknown, fallback: string) => {
  const r = (e as { response?: { data?: { message?: string } | string; status?: number } })?.response;
  if (r?.status === 403) return "Your role cannot do that.";
  if (typeof r?.data === "string" && r.data) return r.data;
  return (r?.data as { message?: string } | undefined)?.message || fallback;
};

/** One transformer: where it is, its devices, site security and its alert history. */
export default function TransformerDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, hasPermission } = useAuth();
  const geo = useGeography(token);
  const [alertPage, setAlertPage] = useState(0);
  const [confirm, setConfirm] = useState<"arm" | "disarm" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const det = useCachedGet<Detail>(token && id ? `${API}/api/v1/transformers/registry/${id}` : null, token, {
    maxAgeMs: 15_000,
    refreshMs: 30_000,
    errorText: "This transformer could not be found, or you do not have access to it.",
  });
  const alerts = useCachedGet<AlertPage>(token && id ? `${API}/api/v1/alerts?transformerId=${id}&page=${alertPage}&size=10` : null, token, { maxAgeMs: 15_000 });

  const d = det.data;
  const path = geo.pathOf(d?.depotId);
  const partner = displayPartner(d?.supplierName, d?.supplierCode);
  const armed = d?.reportedArmState ? d.reportedArmState === "ARMED" : d?.lastCommandAction ? (d.lastCommandAction.toUpperCase().startsWith("DISARM") ? false : d.lastCommandAction.toUpperCase().startsWith("ARM") ? true : null) : null;
  const control = Boolean(d?.supplierCode && CONTROL_PARTNERS.has(d.supplierCode.toLowerCase()) && d.controllerCount > 0);
  const canEdit = !user?.supplierCode && hasPermission("transformers.update");
  const meta = STATUS_META[d?.status ?? "NO_DEVICE"] ?? STATUS_META.NO_DEVICE;
  const rows = alerts.data?.content ?? [];
  const total = alerts.data?.totalElements ?? 0;

  const send = async () => {
    if (!confirm || !d) return;
    try {
      setBusy(true);
      const res = await axios.post(`${API}/api/v1/oculus-control/transformers/${d.id}/${confirm}`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      setNotice({ tone: "success", text: (res.data as { message?: string } | null)?.message || `${confirm === "arm" ? "Arm" : "Disarm"} command sent. The device confirms on its next check-in.` });
      invalidateCache(`/api/v1/transformers/registry`);
      void det.reload();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, `Could not ${confirm} this site.`) });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (det.error && !d) {
    return (
      <div className="space-y-4">
        <Notice>{det.error}</Notice>
        <Button onClick={() => navigate(-1)} icon={<ArrowLeft className="h-4 w-4" />}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow={`Transformer${d?.transformerNumber ? ` · No. ${d.transformerNumber}` : ""}`}
        title={
          d ? (
            <span className="flex flex-wrap items-center gap-3">
              {d.name}
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-white/20`}>
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
            </span>
          ) : (
            <span className="inline-block h-7 w-64 animate-pulse rounded-lg bg-white/15" />
          )
        }
        subtitle={d ? `${path.regionName} › ${path.districtName} › ${path.depotName} · ${partner}` : "Loading…"}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {d?.lat != null && d?.lng != null ? (
              <Link to={`/sites?t=${d.id}`} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
                <MapPinned className="h-4 w-4" /> Show on map
              </Link>
            ) : null}
            {canEdit ? (
              <Link to={`/transformers/${id}/edit`} className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition hover:bg-blue-50">
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            ) : null}
          </>
        }
      >
        <HeroStats cols={6}>
          <HeroStat icon={<Radio className="h-3.5 w-3.5" />} label="Last signal" value={d ? timeAgo(d.lastSignalAt) : "—"} sub={meta.label} tone={d?.status === "ONLINE" ? "good" : d?.status === "OFFLINE" ? "bad" : undefined} loading={!d} />
          <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open alerts" value={d?.openAlerts ?? "—"} sub={d?.lastAlertAt ? `last ${timeAgo(d.lastAlertAt)}` : "none recorded"} tone={d?.openAlerts ? "bad" : "good"} loading={!d} />
          <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="All alerts" value={d?.totalAlerts?.toLocaleString() ?? "—"} sub="since monitoring began" loading={!d} />
          <HeroStat
            icon={armed ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> : <ShieldOff className="h-3.5 w-3.5 text-amber-300" />}
            label="Site security"
            value={armed == null ? "Unknown" : armed ? "Armed" : "Disarmed"}
            sub={d?.lastCommandAt ? timeAgo(d.lastCommandAt) : "no command yet"}
            tone={armed ? "good" : armed === false ? "warn" : undefined}
            loading={!d}
          />
          <HeroStat icon={<Cpu className="h-3.5 w-3.5" />} label="Devices" value={d?.controllerCount ?? "—"} sub={d?.controllerCount ? "linked" : "none linked"} loading={!d} />
          <HeroStat icon={<Building2 className="h-3.5 w-3.5" />} label="Partner" value={<span className="text-base">{partner}</span>} sub={control ? "remote control" : "monitoring"} to={d?.supplierCode ? `/partners/${d.supplierCode}` : undefined} loading={!d} />
        </HeroStats>
      </PageHero>

      {notice ? (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Alert history */}
        <Panel
          icon={<Siren className="h-4 w-4" />}
          title="Alert history"
          subtitle="Newest first. Repeat triggers on an open case are grouped into one row."
          actions={
            <Link to={`/alerts?q=${encodeURIComponent(d?.name ?? "")}`} className="text-xs font-semibold text-blue-600 hover:underline">
              Open in Alerts →
            </Link>
          }
        >
          <div className={tableCls.wrap}>
            <table className={`${tableCls.table} min-w-[640px]`}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Alert</th>
                  <th className={tableCls.th}>Status</th>
                  <th className={tableCls.th}>Detected</th>
                  <th className={tableCls.th}>Handled by</th>
                </tr>
              </thead>
              <tbody className={tableCls.tbody}>
                {!alerts.data && !alerts.error ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6">
                      <div className="ui-skeleton h-4 w-2/3" />
                    </td>
                  </tr>
                ) : null}
                {rows.map((a) => {
                  const st = (a.caseStatus || a.status || "NEW").toUpperCase();
                  return (
                    <tr key={a.id} className={tableCls.tr}>
                      <td className={tableCls.td}>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{a.value || a.message || "Alert"}</span>
                        {a.occurrenceCount && a.occurrenceCount > 1 ? <span className="ml-1.5 rounded-full bg-red-50 px-1.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200">×{a.occurrenceCount}</span> : null}
                        {a.sensorType ? <p className="text-[11px] text-slate-500">{a.sensorType.replace(/_/g, " ").toLowerCase()}</p> : null}
                      </td>
                      <td className={tableCls.td}>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${CASE[st] ?? CASE.NEW}`}>{st.replace(/_/g, " ").toLowerCase()}</span>
                      </td>
                      <td className={tableCls.td}>
                        <span className="text-[13px]">{a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}</span>
                        {a.lastSeenAt && a.lastSeenAt !== a.createdAt ? <p className="text-[11px] text-slate-500">last {timeAgo(a.lastSeenAt)}</p> : null}
                      </td>
                      <td className={tableCls.td}>{a.assignedToName || <span className="text-slate-400">Unassigned</span>}</td>
                    </tr>
                  );
                })}
                {alerts.data && rows.length === 0 ? <EmptyRow cols={4}>No alerts recorded for this transformer.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
          {total > 10 ? <Pager page={alertPage} pageSize={10} total={total} onPage={setAlertPage} /> : null}
        </Panel>

        {/* Side: details, devices, control */}
        <div className="space-y-4">
          <Panel icon={<Zap className="h-4 w-4" />} title="Details">
            <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <Row icon={<Hash className="h-3.5 w-3.5" />} k="Transformer number" v={d?.transformerNumber || "Not set"} />
              <Row icon={<Zap className="h-3.5 w-3.5" />} k="Type" v={typeLabel(d?.type)} />
              <Row icon={<Building2 className="h-3.5 w-3.5" />} k="Depot" v={path.depotName} sub={`${path.districtName} · ${path.regionName}`} />
              <Row icon={<Radio className="h-3.5 w-3.5" />} k="Partner" v={partner} />
              <Row
                icon={<MapPin className="h-3.5 w-3.5" />}
                k="GPS position"
                v={
                  d?.lat != null && d?.lng != null ? (
                    <a href={`https://maps.google.com/?q=${d.lat},${d.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      {Number(d.lat).toFixed(5)}, {Number(d.lng).toFixed(5)}
                    </a>
                  ) : (
                    "Not set"
                  )
                }
              />
              <Row icon={<AlertTriangle className="h-3.5 w-3.5" />} k="Added" v={d?.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"} />
            </dl>
          </Panel>

          <Panel icon={<Cpu className="h-4 w-4" />} title="Devices" subtitle={d?.controllerCount ? `${d.controllerCount} linked` : "No device linked yet"}>
            <div className="space-y-2 p-4">
              {d?.controllerEuis?.length ? (
                d.controllerEuis.map((e) => (
                  <div key={e} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span className="font-mono text-[12px] text-slate-700 dark:text-slate-200">{e}</span>
                    <StatusPill status={d.status} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Link a device on{" "}
                  <Link to="/new-controllers" className="font-semibold text-blue-600 hover:underline">
                    New controllers
                  </Link>
                  .
                </p>
              )}
            </div>
          </Panel>

          {control ? (
            <Panel icon={<ShieldCheck className="h-4 w-4" />} title="Site control" subtitle="Arm or disarm the site's intrusion alarm.">
              <div className="flex gap-2 p-4">
                <Button size="lg" variant="primary" icon={<Lock className="h-4 w-4" />} disabled={!hasPermission("control.arm") || armed === true} onClick={() => setConfirm("arm")}>
                  Arm site
                </Button>
                <Button size="lg" variant="secondary" icon={<Unlock className="h-4 w-4" />} disabled={!hasPermission("control.disarm") || armed === false} onClick={() => setConfirm("disarm")}>
                  Disarm site
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        icon={confirm === "arm" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        title={`${confirm === "arm" ? "Arm" : "Disarm"} ${d?.name ?? ""}?`}
        subtitle={path.depotName}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm === "arm" ? "primary" : "danger"} busy={busy} onClick={() => void send()}>
              {confirm === "arm" ? "Arm site" : "Disarm site"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {confirm === "arm"
            ? "Intrusion alerts and sirens for this site will be switched on."
            : "Intrusion alerts for this site stop until it is armed again. Only disarm when a crew is authorised to work there."}
        </p>
      </Dialog>
    </div>
  );
}

function Row({ icon, k, v, sub }: { icon: ReactNode; k: string; v: ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon}
        {k}
      </dt>
      <dd className="text-right text-[13px] font-semibold text-slate-800 dark:text-slate-100">
        {v}
        {sub ? <span className="block text-[11px] font-normal text-slate-500">{sub}</span> : null}
      </dd>
    </div>
  );
}
