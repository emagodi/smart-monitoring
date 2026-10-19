import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { Activity, ArrowLeft, ChevronRight, Cpu, DoorOpen, Gauge, Loader2, Lock, ShieldCheck, ShieldOff, ShieldQuestion, Siren, Unlock, WifiOff, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cachedGet, invalidateCache, useCachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { useScope } from "../../lib/scope";
import { useGeography } from "../Registry/geo";
import {
  Button,
  Chips,
  CountBadge,
  Dialog,
  EmptyRow,
  HeroButton,
  HeroStat,
  HeroStats,
  Notice,
  PageHero,
  Pager,
  Panel,
  SearchBox,
  SelectBox,
  SkeletonRows,
  STATUS_META,
  tableCls,
  timeAgo,
} from "../../components/ui/page";
import { CONTROL_PARTNERS, type Overview } from "./index";

const API = import.meta.env.VITE_API_BASE_URL || "";

/** Row of GET /api/v1/oculus-control/transformers (partners with remote control). */
type ControlRow = {
  transformerId: number;
  transformerName: string;
  transformerType?: string | null;
  depotId?: number | null;
  controllerCount?: number | null;
  controllerDevEui?: string | null;
  controlAvailable?: boolean | null;
  availabilityReason?: string | null;
  armState?: string | null;
  effectiveArmState?: string | null;
  confirmationStatus?: string | null;
  controllerStatus?: string | null;
  minutesSinceLastTelemetry?: number | null;
  motionDetected?: boolean | null;
  secondaryAlertDetected?: boolean | null;
  secondaryAlertLabel?: string | null;
  lastCommandAction?: string | null;
  lastCommandAt?: string | null;
  lastCommandRequestedBy?: string | null;
};

/** Row of GET /api/v1/transformers/registry. */
type RegistryRow = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  type?: string | null;
  depotId?: number | null;
  supplierCode?: string | null;
  status: string;
  minutesSinceSignal?: number | null;
  controllerEuis: string[];
  lastCommandAction?: string | null;
  lastCommandAt?: string | null;
  openAlerts: number;
};

/** One table row, whatever the partner. */
type Site = {
  id: number;
  name: string;
  number?: string | null;
  type: "GMT" | "PMT" | null;
  depotId: number | null;
  eui: string | null;
  devices: number;
  device: "ONLINE" | "DELAYED" | "OFFLINE" | "NEVER_SEEN" | "NO_DEVICE";
  minutes: number | null;
  motion: boolean | null;
  door: boolean | null;
  arm: "ARMED" | "DISARMED" | "UNKNOWN";
  confirmation: string | null;
  lastCommandAt: string | null;
  lastCommandBy: string | null;
  controllable: boolean;
  reason: string | null;
  openAlerts: number;
};

type Filter = "all" | "ARMED" | "DISARMED" | "UNKNOWN" | "ONLINE" | "OFFLINE" | "ALERTING";

const typeOf = (t?: string | null): Site["type"] => (t === "GROUND_MOUNTED" || t === "GMT" ? "GMT" : t === "POLE_MOUNTED" || t === "PMT" ? "PMT" : null);
const deviceOf = (s?: string | null): Site["device"] =>
  s === "ONLINE" || s === "DELAYED" || s === "OFFLINE" || s === "NEVER_SEEN" ? s : s === "NO_KEEPALIVE" ? "NEVER_SEEN" : "NO_DEVICE";
const armOf = (s?: string | null): Site["arm"] => (s === "ARMED" || s === "ARM" ? "ARMED" : s === "DISARMED" || s === "DISARM" ? "DISARMED" : "UNKNOWN");

const CONFIRM: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: "Confirmed by device", tone: "text-emerald-600" },
  PENDING_KEEPALIVE: { label: "Waiting for device", tone: "text-blue-600" },
  SENDING_COMMAND: { label: "Sending…", tone: "text-blue-600" },
  KEEPALIVE_OVERDUE: { label: "Device overdue", tone: "text-amber-600" },
  TELEMETRY_MISMATCH: { label: "Device disagrees", tone: "text-red-600" },
  COMMAND_FAILED: { label: "Command failed", tone: "text-red-600" },
};

const errText = (e: unknown, fallback: string) => {
  const r = (e as { response?: { data?: { message?: string } | string; status?: number } })?.response;
  if (r?.status === 403) return "Your role cannot do that. Ask an administrator for the arm / disarm permission.";
  if (typeof r?.data === "string" && r.data) return r.data;
  return (r?.data as { message?: string } | undefined)?.message || fallback;
};

/**
 * One partner: its transformers with device health, live sensor state and site security.
 * Partners whose devices accept commands (Oqulus today) get Arm / Disarm on every row.
 */
export default function PartnerDetail() {
  const { code = "" } = useParams<{ code: string }>();
  const partnerCode = code.toLowerCase();
  const { token, user, hasPermission } = useAuth();
  const geo = useGeography(token);
  const control = CONTROL_PARTNERS.has(partnerCode);
  const isOwnPartner = Boolean(user?.supplierCode);
  const { isDepot, depotId } = useScope();
  const inDepot = isDepot ? ` in ${geo.pathOf(depotId).depotName} depot` : "";

  const ov = useCachedGet<Overview>(token ? `${API}/api/v1/transformers/overview` : null, token, { maxAgeMs: 30_000 });
  const reg = useCachedGet<RegistryRow[]>(token ? `${API}/api/v1/transformers/registry` : null, token, { maxAgeMs: 20_000, errorText: "Could not load the transformers." });
  const ctl = useCachedGet<ControlRow[]>(token && control ? `${API}/api/v1/oculus-control/transformers` : null, token, {
    maxAgeMs: 15_000,
    refreshMs: 30_000,
    errorText: "Could not load live control state.",
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [depot, setDepot] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [confirm, setConfirm] = useState<{ site: Site; action: "arm" | "disarm" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [optimistic, setOptimistic] = useState<Record<number, Site["arm"]>>({});

  const block = ov.data?.partners.find((p) => String(p.supplierCode).toLowerCase() === partnerCode);
  const name = displayPartner(block?.supplierName, partnerCode);

  const sites: Site[] = useMemo(() => {
    const regRows = (reg.data ?? []).filter((r) => String(r.supplierCode || "").toLowerCase() === partnerCode);
    const regById = new Map((reg.data ?? []).map((r) => [r.id, r]));
    if (control && ctl.data) {
      return ctl.data
        .filter((c) => c.transformerId > 0 && !String(c.transformerName || "").startsWith("Unassigned"))
        .map((c) => {
          const r = regById.get(c.transformerId);
          return {
            id: c.transformerId,
            name: c.transformerName,
            number: r?.transformerNumber ?? null,
            type: typeOf(c.transformerType ?? r?.type),
            depotId: c.depotId ?? r?.depotId ?? null,
            eui: c.controllerDevEui ?? r?.controllerEuis?.[0] ?? null,
            devices: c.controllerCount ?? r?.controllerEuis?.length ?? 0,
            device: deviceOf(c.controllerStatus),
            minutes: c.minutesSinceLastTelemetry ?? null,
            motion: c.motionDetected ?? null,
            door: c.secondaryAlertDetected ?? null,
            arm: optimistic[c.transformerId] ?? armOf(c.effectiveArmState || c.armState),
            confirmation: c.confirmationStatus ?? null,
            lastCommandAt: c.lastCommandAt ?? null,
            lastCommandBy: c.lastCommandRequestedBy ?? null,
            controllable: Boolean(c.controlAvailable),
            reason: c.availabilityReason ?? null,
            openAlerts: r?.openAlerts ?? 0,
          };
        });
    }
    return regRows.map((r) => ({
      id: r.id,
      name: r.name,
      number: r.transformerNumber ?? null,
      type: typeOf(r.type),
      depotId: r.depotId ?? null,
      eui: r.controllerEuis?.[0] ?? null,
      devices: r.controllerEuis?.length ?? 0,
      device: deviceOf(r.status),
      minutes: r.minutesSinceSignal ?? null,
      motion: null,
      door: null,
      arm: armOf(r.lastCommandAction),
      confirmation: null,
      lastCommandAt: r.lastCommandAt ?? null,
      lastCommandBy: null,
      controllable: false,
      reason: "Remote arm / disarm is not available for this partner yet.",
      openAlerts: r.openAlerts ?? 0,
    }));
  }, [control, ctl.data, optimistic, partnerCode, reg.data]);

  const unassignedDevices = control ? (ctl.data ?? []).filter((c) => !(c.transformerId > 0) || String(c.transformerName || "").startsWith("Unassigned")).length : block?.unmatchedControllers ?? 0;

  const stats = useMemo(() => {
    const s = { total: sites.length, armed: 0, disarmed: 0, unknown: 0, online: 0, offline: 0, alerting: 0, controllable: 0 };
    for (const x of sites) {
      if (x.arm === "ARMED") s.armed++;
      else if (x.arm === "DISARMED") s.disarmed++;
      else s.unknown++;
      if (x.device === "ONLINE") s.online++;
      if (x.device === "OFFLINE") s.offline++;
      if (x.openAlerts > 0 || x.motion || x.door) s.alerting++;
      if (x.controllable) s.controllable++;
    }
    return s;
  }, [sites]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sites
      .filter((s) => !depot || String(s.depotId) === depot)
      .filter((s) => {
        switch (filter) {
          case "ARMED":
          case "DISARMED":
          case "UNKNOWN":
            return s.arm === filter;
          case "ONLINE":
            return s.device === "ONLINE";
          case "OFFLINE":
            return s.device === "OFFLINE";
          case "ALERTING":
            return s.openAlerts > 0 || Boolean(s.motion) || Boolean(s.door);
          default:
            return true;
        }
      })
      .filter((s) => {
        if (!term) return true;
        const path = geo.pathOf(s.depotId);
        return [s.name, s.number, s.eui, path.depotName, path.districtName, path.regionName].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const rank = (s: Site) => (s.motion || s.door || s.openAlerts ? 0 : s.device === "OFFLINE" ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
  }, [depot, filter, geo, q, sites]);

  const depotOptions = useMemo(() => {
    const ids = Array.from(new Set(sites.map((s) => s.depotId).filter((d): d is number => d != null)));
    return ids.map((id) => ({ id, name: geo.pathOf(id).depotName })).sort((a, b) => a.name.localeCompare(b.name));
  }, [geo, sites]);

  const shown = rows.slice(page * pageSize, page * pageSize + pageSize);
  const loading = !reg.data || (control && !ctl.data && !ctl.error);
  const canArm = hasPermission("control.arm");
  const canDisarm = hasPermission("control.disarm");

  const pick = (f: Filter) => {
    setFilter((cur) => (cur === f ? "all" : f));
    setPage(0);
  };

  const send = async () => {
    if (!confirm) return;
    const { site, action } = confirm;
    try {
      setBusy(`${site.id}:${action}`);
      const res = await axios.post(`${API}/api/v1/oculus-control/transformers/${site.id}/${action}`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const msg = (res.data as { message?: string } | null)?.message;
      setOptimistic((o) => ({ ...o, [site.id]: action === "arm" ? "ARMED" : "DISARMED" }));
      setNotice({ tone: "success", text: msg || `${action === "arm" ? "Arm" : "Disarm"} command sent to ${site.name}. The device confirms on its next check-in.` });
      setConfirm(null);
      invalidateCache("/api/v1/oculus-control/transformers");
      invalidateCache("/api/v1/transformers/registry");
      void cachedGet(`${API}/api/v1/oculus-control/transformers`, token, 0, true).then(() => {
        void ctl.reload();
        setOptimistic((o) => {
          const n = { ...o };
          delete n[site.id];
          return n;
        });
      });
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, `Could not ${action} ${site.name}.`) });
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow={isOwnPartner ? "Partner portal" : "Operations · Partners"}
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold uppercase ring-1 ring-white/25">{name.slice(0, 2)}</span>
            {name}
            {control ? <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">Remote control</span> : null}
          </span>
        }
        subtitle={
          control
            ? `Every ${name} transformer${inDepot} with its device, live sensors and site security. Arm or disarm a site from its row; the device confirms on its next check-in.`
            : `Every ${name} transformer${inDepot} with its device health and alerts.`
        }
        actions={
          <>
            {!isOwnPartner ? (
              <Link
                to="/partners"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" /> {isDepot ? "Partners in my depot" : "All partners"}
              </Link>
            ) : null}
            <HeroButton
              onClick={() => {
                void reg.reload();
                if (control) void ctl.reload();
              }}
              busy={reg.refreshing || ctl.refreshing}
            >
              Refresh
            </HeroButton>
          </>
        }
      >
        <HeroStats cols={7}>
          <Tile icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={stats.total} sub={`${stats.controllable} controllable`} on={filter === "all"} onClick={() => pick("all")} loading={loading} />
          <Tile icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="Armed" value={stats.armed} sub="sites protected" tone="good" on={filter === "ARMED"} onClick={() => pick("ARMED")} loading={loading} />
          <Tile icon={<ShieldOff className="h-3.5 w-3.5 text-amber-300" />} label="Disarmed" value={stats.disarmed} sub="not protected" tone={stats.disarmed ? "warn" : undefined} on={filter === "DISARMED"} onClick={() => pick("DISARMED")} loading={loading} />
          <Tile icon={<ShieldQuestion className="h-3.5 w-3.5" />} label="Unknown" value={stats.unknown} sub="no command yet" on={filter === "UNKNOWN"} onClick={() => pick("UNKNOWN")} loading={loading} />
          <Tile icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={stats.online} sub="devices reporting" tone="good" on={filter === "ONLINE"} onClick={() => pick("ONLINE")} loading={loading} />
          <Tile icon={<WifiOff className="h-3.5 w-3.5 text-red-300" />} label="Offline" value={stats.offline} sub="not reporting" tone={stats.offline ? "bad" : undefined} on={filter === "OFFLINE"} onClick={() => pick("OFFLINE")} loading={loading} />
          <Tile icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Intrusion now" value={stats.alerting} sub="motion, door or open alert" tone={stats.alerting ? "bad" : undefined} on={filter === "ALERTING"} onClick={() => pick("ALERTING")} loading={loading} />
        </HeroStats>
      </PageHero>

      {notice ? (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}
      {reg.error && !reg.data ? <Notice>{reg.error}</Notice> : null}
      {unassignedDevices > 0 && !isDepot ? (
        <Notice tone="warn">
          {unassignedDevices} {name} device{unassignedDevices === 1 ? " is" : "s are"} reporting but not linked to a transformer yet.{" "}
          <Link to="/new-controllers" className="font-semibold underline">
            Match them
          </Link>
          .
        </Notice>
      ) : null}

      <Panel
        icon={<Activity className="h-4 w-4" />}
        title={`${rows.length.toLocaleString()} transformer${rows.length === 1 ? "" : "s"}`}
        subtitle={control ? "Sites with intrusion or offline devices are listed first. Live state refreshes every 30 seconds." : "Sites with alerts or offline devices are listed first."}
        toolbar={
          <>
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Find by name, number, EUI or depot…" className="max-w-sm" />
            <Chips<Filter>
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(0);
              }}
              options={[
                { value: "all", label: "All", count: stats.total },
                { value: "ARMED", label: "Armed", dot: "bg-emerald-500", count: stats.armed },
                { value: "DISARMED", label: "Disarmed", dot: "bg-amber-500", count: stats.disarmed },
                { value: "ONLINE", label: "Online", dot: "bg-emerald-500", count: stats.online },
                { value: "OFFLINE", label: "Offline", dot: "bg-red-500", count: stats.offline },
                { value: "ALERTING", label: "Intrusion", dot: "bg-red-500", count: stats.alerting },
              ]}
            />
            {depotOptions.length > 1 ? (
              <SelectBox value={depot} onChange={(v) => { setDepot(v); setPage(0); }} label="Depot">
                <option value="">All depots</option>
                {depotOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SelectBox>
            ) : null}
          </>
        }
      >
        <div className={tableCls.wrap}>
          <table className={`${tableCls.table} min-w-[1080px]`}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Transformer</th>
                <th className={tableCls.th}>Device</th>
                {control ? <th className={tableCls.th}>Sensors now</th> : <th className={tableCls.th}>Alerts</th>}
                <th className={tableCls.th}>Site security</th>
                <th className={`${tableCls.th} text-right`}>{control ? "Control" : ""}</th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading ? <SkeletonRows rows={6} cols={5} /> : null}
              {!loading &&
                shown.map((s) => {
                  const path = geo.pathOf(s.depotId);
                  const dev = STATUS_META[s.device] ?? STATUS_META.NO_DEVICE;
                  const intrusion = Boolean(s.motion || s.door);
                  const conf = s.confirmation ? CONFIRM[s.confirmation] : null;
                  return (
                    <tr key={s.id} className={`${tableCls.tr} ${intrusion ? "bg-red-50/40 dark:bg-red-500/5" : ""}`}>
                      <td className={tableCls.td}>
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ring-1 ${
                              s.type === "GMT"
                                ? "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20"
                                : s.type === "PMT"
                                  ? "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20"
                                  : "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
                            }`}
                          >
                            {s.type ?? "—"}
                          </span>
                          <div className="min-w-0">
                            <Link to={`/transformer/${s.id}`} className="block truncate font-semibold text-slate-900 hover:text-blue-700 dark:text-slate-100">
                              {s.name}
                            </Link>
                            <p className="truncate text-[11px] text-slate-500">
                              {s.number ? <span className="font-medium text-slate-600 dark:text-slate-300">No. {s.number} · </span> : null}
                              {path.depotName} · {path.districtName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={tableCls.td}>
                        <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{s.eui ?? "No device"}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ${dev.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${dev.dot}`} />
                            {s.device === "NEVER_SEEN" ? "No check-in" : dev.label}
                          </span>
                          <span className="text-slate-400">{s.minutes != null ? `${minutesText(s.minutes)}` : ""}</span>
                        </p>
                      </td>
                      <td className={tableCls.td}>
                        {control ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Sensor icon={<Activity className="h-3 w-3" />} label={s.motion == null ? "No motion data" : s.motion ? "Motion" : "No motion"} state={s.motion} />
                            <Sensor
                              icon={<DoorOpen className="h-3 w-3" />}
                              label={s.door == null ? (s.type === "PMT" ? "No vibration data" : "No door data") : s.door ? (s.type === "PMT" ? "Vibration" : "Door open") : s.type === "PMT" ? "No vibration" : "Door closed"}
                              state={s.door}
                            />
                          </div>
                        ) : (
                          <CountBadge n={s.openAlerts} to={`/alerts?q=${encodeURIComponent(s.name)}`} />
                        )}
                        {control && s.openAlerts ? (
                          <Link to={`/alerts?q=${encodeURIComponent(s.name)}`} className="mt-1 inline-block text-[11px] font-semibold text-red-600 hover:underline">
                            {s.openAlerts} open alert{s.openAlerts === 1 ? "" : "s"}
                          </Link>
                        ) : null}
                      </td>
                      <td className={tableCls.td}>
                        <ArmBadge arm={s.arm} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          {conf ? <span className={`font-semibold ${conf.tone}`}>{conf.label}</span> : null}
                          {conf && s.lastCommandAt ? " · " : null}
                          {s.lastCommandAt ? `${timeAgo(s.lastCommandAt)}${s.lastCommandBy ? ` by ${s.lastCommandBy.split("@")[0]}` : ""}` : conf ? "" : "No command sent yet"}
                        </p>
                      </td>
                      <td className={`${tableCls.td} text-right`}>
                        {control ? (
                          s.controllable ? (
                            <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                              <button
                                type="button"
                                disabled={!canArm || s.arm === "ARMED" || busy != null}
                                onClick={() => setConfirm({ site: s, action: "arm" })}
                                title={!canArm ? "You need the arm permission" : s.arm === "ARMED" ? "Already armed" : "Arm this site"}
                                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-emerald-300 dark:disabled:text-slate-600"
                              >
                                {busy === `${s.id}:arm` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Arm
                              </button>
                              <button
                                type="button"
                                disabled={!canDisarm || s.arm === "DISARMED" || busy != null}
                                onClick={() => setConfirm({ site: s, action: "disarm" })}
                                title={!canDisarm ? "You need the disarm permission" : s.arm === "DISARMED" ? "Already disarmed" : "Disarm this site"}
                                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500 hover:text-white disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-amber-300 dark:disabled:text-slate-600"
                              >
                                {busy === `${s.id}:disarm` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />} Disarm
                              </button>
                            </div>
                          ) : (
                            <span className="inline-block max-w-[220px] text-left text-[11px] text-slate-400" title={s.reason ?? undefined}>
                              {s.devices ? "Device cannot take commands" : "No device linked"}
                            </span>
                          )
                        ) : (
                          <Link to={`/transformer/${s.id}`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300">
                            View <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {!loading && rows.length === 0 ? (
                <EmptyRow cols={5}>{sites.length ? "Nothing matches these filters." : `No ${name} transformers yet.`}</EmptyRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPage={setPage}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(0);
          }}
        />
      </Panel>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        icon={confirm?.action === "arm" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        title={confirm ? `${confirm.action === "arm" ? "Arm" : "Disarm"} ${confirm.site.name}?` : ""}
        subtitle={confirm ? `${geo.pathOf(confirm.site.depotId).depotName} · device ${confirm.site.eui ?? "—"}` : undefined}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.action === "arm" ? "primary" : "danger"} busy={busy != null} onClick={() => void send()} icon={confirm?.action === "arm" ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}>
              {confirm?.action === "arm" ? "Arm site" : "Disarm site"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {confirm?.action === "arm" ? (
            <p>The site's sirens and intrusion alerts will be switched on. Any movement or door opening raises an alert to the contact centre.</p>
          ) : (
            <p>
              Intrusion alerts for this site stop until it is armed again. Only disarm when a crew is authorised to work there.
            </p>
          )}
          {confirm && confirm.site.device !== "ONLINE" ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Cpu className="mt-0.5 h-4 w-4 shrink-0" /> The device is not reporting right now, so it will apply the command when it next checks in.
            </p>
          ) : null}
          <p className="text-xs text-slate-500">The command is recorded with your name and time.</p>
        </div>
      </Dialog>
    </div>
  );
}

const minutesText = (m: number) => (m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`);

function Tile({
  icon,
  label,
  value,
  sub,
  tone,
  on,
  onClick,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  sub: string;
  tone?: "good" | "bad" | "warn";
  on: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl text-left transition ${on ? "ring-2 ring-white/70" : ""}`} aria-pressed={on}>
      <HeroStat icon={icon} label={label} value={value.toLocaleString()} sub={sub} tone={tone} loading={loading} />
    </button>
  );
}

function Sensor({ icon, label, state }: { icon: ReactNode; label: string; state: boolean | null }) {
  const cls =
    state == null
      ? "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
      : state
        ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

function ArmBadge({ arm }: { arm: Site["arm"] }) {
  if (arm === "ARMED")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
        <ShieldCheck className="h-3.5 w-3.5" /> Armed
      </span>
    );
  if (arm === "DISARMED")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
        <ShieldOff className="h-3.5 w-3.5" /> Disarmed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
      <ShieldQuestion className="h-3.5 w-3.5" /> Unknown
    </span>
  );
}
