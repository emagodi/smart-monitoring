import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlarmClock,
  BarChart3,
  Building2,
  CarFront,
  Clock3,
  Flame,
  Gauge,
  Handshake,
  Headset,
  Inbox,
  LineChart,
  MapPinned,
  PieChart as PieIcon,
  Radio,
  ShieldCheck,
  ShieldOff,
  Siren,
  Timer,
  Truck,
  UserX,
  WifiOff,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import { displayName, displayPartner } from "../../lib/brand";
import { useGeography } from "../Registry/geo";
import { HeroButton, HeroStat, HeroStats, Notice, PageHero, fmtNum, timeAgo } from "../../components/ui/page";
import { AreaTrend, Bars, BarsWithLine, C, ChartCard, Donut, Empty, Pipeline, RankBars } from "../../components/charts/DashCharts";
import type { AlertSummary, AlertTrends, EstateStats, Overview } from "./types";
import { STATUS_META, activeDispatch, eventText, statusOf, vehicleLabel, type Board, type IncidentAlert } from "../Response/shared";

const API = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Role-based dashboard. Each persona gets the numbers it acts on:
 *  - Executive: estate health, trends, outcomes, where the trouble is (depots, partners)
 *  - Contact centre: the live alert queue, alerts per hour, busiest transformers
 *  - Dispatch: incidents waiting for a vehicle, the fleet, crews in the field
 *  - Partner: the partner's own transformers, devices and alerts
 * Admins can switch between the internal views. The live map lives on the Sites page.
 */
type ViewKey = "executive" | "control" | "dispatch" | "partner";

const VIEW_META: Record<ViewKey, { label: string; icon: ReactNode; blurb: string }> = {
  executive: { label: "Executive", icon: <BarChart3 className="h-3.5 w-3.5" />, blurb: "Estate health, alert trends and where the risk sits" },
  control: { label: "Contact centre", icon: <Headset className="h-3.5 w-3.5" />, blurb: "The live alert queue and what is happening right now" },
  dispatch: { label: "Dispatch", icon: <Truck className="h-3.5 w-3.5" />, blurb: "Incidents that need a vehicle, crews in the field and the fleet" },
  partner: { label: "Partner", icon: <Handshake className="h-3.5 w-3.5" />, blurb: "The transformers your devices monitor" },
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const mins = (m: number | null | undefined) => (m == null ? "—" : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`);

const VIEW_STORE = "dash.view";

export default function DashboardHome() {
  const { token, user, roles, hasPermission } = useAuth();
  const geo = useGeography(token);

  const isAdmin = roles.some((r) => /^(ROLE[_-])?(ADMIN|ADMINISTRATOR|SUPER_?ADMIN)$/i.test(String(r)));
  const isExecRole = roles.some((r) => /supervisor|manager|director|executive|loss control/i.test(String(r)));
  const isSupplier = !!(user as { supplierCode?: string } | null)?.supplierCode;
  const canAlerts = hasPermission("alerts.read") || hasPermission("response.read") || isSupplier;
  const canResponse = hasPermission("response.read");
  const canDispatch = hasPermission("response.dispatch");

  // Which views this user may open, best fit first.
  const views = useMemo<ViewKey[]>(() => {
    if (isSupplier) return ["partner"];
    if (isAdmin) return ["executive", "control", "dispatch"];
    const v: ViewKey[] = [];
    if (canDispatch) v.push("dispatch");
    if (hasPermission("alerts.read")) v.push("control");
    if (isExecRole || !v.length) v.unshift("executive");
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupplier, isAdmin, canDispatch, isExecRole, user]);

  const [view, setView] = useState<ViewKey>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORE) as ViewKey | null;
      if (saved) return saved;
    } catch {
      /* storage unavailable */
    }
    return "executive";
  });
  const active: ViewKey = views.includes(view) ? view : views[0];
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORE, active);
    } catch {
      /* ignore */
    }
  }, [active]);

  // ------------------------------------------------------------------ data (only what this view needs)
  const opts = { maxAgeMs: 30_000, refreshMs: 60_000 };
  const stats = useCachedGet<EstateStats>(token ? `${API}/api/v1/transformers/stats` : null, token, { ...opts, errorText: "Could not load the estate figures." });
  const summary = useCachedGet<AlertSummary>(token && canAlerts ? `${API}/api/v1/alerts/summary` : null, token, opts);
  const trends = useCachedGet<AlertTrends>(token && canAlerts ? `${API}/api/v1/alerts/trends` : null, token, opts);
  const overview = useCachedGet<Overview>(token && active === "executive" ? `${API}/api/v1/transformers/overview` : null, token, { maxAgeMs: 60_000, refreshMs: 120_000 });
  const board = useCachedGet<Board>(token && canResponse && active === "dispatch" ? `${API}/api/v1/response/board` : null, token, { maxAgeMs: 15_000, refreshMs: 30_000 });
  const latest = useCachedGet<{ content?: IncidentAlert[] }>(
    token && active === "control" && hasPermission("alerts.read") ? `${API}/api/v1/alerts?status=OPEN&size=7` : null,
    token,
    { maxAgeMs: 15_000, refreshMs: 30_000 },
  );

  const s = stats.data;
  const sm = summary.data;
  const tr = trends.data;
  const loading = stats.loading && !s;
  const busy = stats.refreshing || summary.refreshing || trends.refreshing || overview.refreshing || board.refreshing;
  const reloadAll = () => {
    void stats.reload();
    void summary.reload();
    void trends.reload();
    void overview.reload();
    void board.reload();
    void latest.reload();
  };

  const firstName = (user as { firstname?: string; first_name?: string } | null)?.firstname || (user as { first_name?: string } | null)?.first_name || "";
  const scopeLabel = useMemo(() => {
    if (!s) return VIEW_META[active].blurb;
    if (s.scope === "PARTNER") return `${displayName(s.scopeSupplierName) || "Partner"} portal · ${VIEW_META.partner.blurb.toLowerCase()}`;
    if (s.scope === "DEPOT") return `${geo.pathOf(s.scopeDepotId).depotName} depot · ${VIEW_META[active].blurb.toLowerCase()}`;
    return `National · ${VIEW_META[active].blurb.toLowerCase()}`;
  }, [geo, s, active]);

  const incidentsLink = canResponse ? "/response" : hasPermission("alerts.read") ? "/alerts" : undefined;

  // ------------------------------------------------------------------ shared chart data
  const health = s
    ? [
        { name: "Online", value: s.online, color: C.online, to: "/transformers?status=ONLINE" },
        { name: "Delayed", value: s.delayed, color: C.delayed, to: "/transformers?status=DELAYED" },
        { name: "Offline", value: s.offline, color: C.offline, to: "/transformers?status=OFFLINE" },
        { name: "Never heard", value: s.neverSeen, color: C.never, to: "/transformers?status=NEVER_SEEN" },
        { name: "No device", value: s.noDevice, color: C.slateLight, to: "/transformers?status=NO_DEVICE" },
      ]
    : [];
  const armData = s
    ? [
        { name: "Armed", value: s.armed, color: C.blue, to: "/transformers?arm=ARMED" },
        { name: "Disarmed", value: s.disarmed, color: C.red, to: "/transformers?arm=DISARMED" },
        { name: "Not reported", value: s.armUnknown, color: C.slateLight },
      ]
    : [];
  const TYPE_COLORS = [C.blue, C.orange, C.violet, C.red, C.slate, C.aqua, C.magenta];
  const triggers = (tr?.byType ?? []).map((t, i) => ({ name: t.type, value: t.alerts, color: t.type === "Device offline" ? C.slate : t.type === "Other" ? C.slateLight : TYPE_COLORS[i % TYPE_COLORS.length] }));
  const outcomes = tr
    ? [
        { name: "Real threat", value: tr.outcomes7d.realThreats, color: C.red },
        { name: "False alarm", value: tr.outcomes7d.falseAlarms, color: C.slate },
        { name: "Technical fault", value: tr.outcomes7d.technicalFaults, color: C.orange },
        { name: "Resolved (no outcome)", value: tr.outcomes7d.resolvedOther, color: C.blue },
      ]
    : [];
  const stages = sm
    ? [
        { name: "New", value: sm.newCount, color: C.red, to: incidentsLink },
        { name: "Acknowledged", value: sm.acknowledged, color: C.yellow, to: incidentsLink },
        { name: "Dispatched", value: sm.dispatched, color: C.blue, to: incidentsLink },
        { name: "En route", value: sm.enRoute, color: C.violet, to: incidentsLink },
        { name: "On scene", value: sm.onScene, color: C.aqua, to: incidentsLink },
      ]
    : [];
  const hot = (tr?.hotTransformers ?? []).map((h) => ({
    name: h.name,
    value: h.openAlerts,
    sub: h.depotId ? geo.pathOf(h.depotId).depotName : undefined,
    to: `/transformer/${h.id}`,
    color: C.red,
  }));
  const responseTimes = sm
    ? [
        { name: "Alert → acknowledged", value: Math.round(sm.avgAcknowledgeMinutes ?? 0) },
        { name: "Acknowledged → vehicle dispatched", value: Math.round(sm.avgDispatchMinutes ?? 0) },
        { name: "Dispatched → crew on scene", value: Math.round(sm.avgArrivalMinutes ?? 0) },
        { name: "Alert → closed", value: Math.round(sm.avgCloseMinutes ?? 0) },
      ]
    : [];
  const hourly = (tr?.hourly ?? []).map((h) => ({ ...h }));
  const alerts24hTotal = hourly.reduce((a, h) => a + h.alerts, 0);
  const days14 = tr?.daily ?? [];
  const days14Total = days14.reduce((a, d) => a + d.alerts, 0);
  const threats14 = days14.reduce((a, d) => a + d.realThreats, 0);

  // ------------------------------------------------------------------ KPI tiles per view
  const kpis = (): ReactNode[] => {
    const T = (k: string, n: ReactNode) => <Fragment key={k}>{n}</Fragment>;
    if (active === "control")
      return [
        T("new", <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="New alerts" value={fmtNum(sm?.newCount)} sub="waiting to be picked up" tone={sm?.newCount ? "bad" : "good"} to={incidentsLink} loading={!sm} />),
        T("un", <HeroStat icon={<UserX className="h-3.5 w-3.5 text-amber-300" />} label="Unassigned" value={fmtNum(sm?.unassigned)} sub="open with no owner" tone={sm?.unassigned ? "warn" : undefined} to={incidentsLink} loading={!sm} />),
        T("24", <HeroStat icon={<Activity className="h-3.5 w-3.5" />} label="Alerts · 24 h" value={fmtNum(sm?.last24h)} sub={`${fmtNum(alerts24hTotal)} raised this window`} to="/alerts" loading={!sm} />),
        T("ta", <HeroStat icon={<Zap className="h-3.5 w-3.5 text-red-300" />} label="Transformers alerting" value={fmtNum(s?.transformersAlerting)} sub={`${fmtNum(s?.openAlerts)} open alerts`} tone={s?.transformersAlerting ? "bad" : "good"} to="/transformers?alerting=1" loading={loading} />),
        T("ack", <HeroStat icon={<AlarmClock className="h-3.5 w-3.5" />} label="Avg acknowledge" value={mins(sm?.avgAcknowledgeMinutes)} sub="alert to first response" loading={!sm} />),
        T("dis", <HeroStat icon={<ShieldOff className="h-3.5 w-3.5 text-amber-300" />} label="Disarmed sites" value={fmtNum(s?.disarmed)} sub="not protected now" tone={s?.disarmed ? "warn" : undefined} to="/transformers?arm=DISARMED" loading={loading} />),
      ];
    if (active === "dispatch") {
      const b = board.data;
      const fleet = b ? b.vehiclesAvailable + b.vehiclesDispatched + b.vehiclesOutOfService : null;
      return [
        T("open", <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open incidents" value={fmtNum(sm?.open)} sub={`${fmtNum(sm?.newCount)} still new`} tone={sm?.open ? "bad" : "good"} to="/response" loading={!sm} />),
        T("await", <HeroStat icon={<Inbox className="h-3.5 w-3.5 text-amber-300" />} label="Awaiting dispatch" value={fmtNum(sm?.acknowledged)} sub="acknowledged, no vehicle" tone={sm?.acknowledged ? "warn" : undefined} to="/response" loading={!sm} />),
        T("way", <HeroStat icon={<Truck className="h-3.5 w-3.5" />} label="On the way" value={fmtNum(sm ? sm.dispatched + sm.enRoute : null)} sub={sm ? `${sm.dispatched} dispatched · ${sm.enRoute} en route` : undefined} to="/response" loading={!sm} />),
        T("scene", <HeroStat icon={<MapPinned className="h-3.5 w-3.5 text-emerald-300" />} label="On scene" value={fmtNum(sm?.onScene)} sub="crews at the site" to="/response" loading={!sm} />),
        T("free", <HeroStat icon={<CarFront className="h-3.5 w-3.5 text-emerald-300" />} label="Vehicles free" value={b ? `${b.vehiclesAvailable}/${fleet}` : "…"} sub={b ? `${b.vehiclesOutOfService} out of service` : undefined} tone={b && b.vehiclesAvailable === 0 ? "bad" : "good"} to="/fleet" loading={!b && board.loading} />),
        T("arr", <HeroStat icon={<Timer className="h-3.5 w-3.5" />} label="Avg arrival" value={mins(sm?.avgArrivalMinutes)} sub="dispatch to on scene" loading={!sm} />),
      ];
    }
    if (active === "partner")
      return [
        T("tx", <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={fmtNum(s?.transformers)} sub={s ? `${s.groundMounted} GMT · ${s.poleMounted} PMT` : undefined} to="/transformers" loading={loading} />),
        T("on", <HeroStat icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={fmtNum(s?.online)} sub={s?.onlinePercent != null ? `${s.onlinePercent}% of devices` : undefined} tone="good" to="/transformers?status=ONLINE" loading={loading} />),
        T("off", <HeroStat icon={<WifiOff className="h-3.5 w-3.5 text-red-300" />} label="Offline" value={fmtNum(s?.offline)} sub={s ? `${s.delayed} delayed · ${s.neverSeen} never heard` : undefined} tone={s?.offline ? "bad" : undefined} to="/transformers?status=OFFLINE" loading={loading} />),
        T("arm", <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="Armed" value={fmtNum(s?.armed)} sub="sites protected" to="/transformers?arm=ARMED" loading={loading} />),
        T("dis", <HeroStat icon={<ShieldOff className="h-3.5 w-3.5 text-amber-300" />} label="Disarmed" value={fmtNum(s?.disarmed)} sub={s ? `${s.armUnknown} not reported` : undefined} tone={s?.disarmed ? "warn" : undefined} to="/transformers?arm=DISARMED" loading={loading} />),
        T("al", <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open alerts" value={fmtNum(s?.openAlerts)} sub={sm ? `${fmtNum(sm.last24h)} in the last 24 h` : undefined} tone={s?.openAlerts ? "bad" : "good"} to="/alerts" loading={loading} />),
      ];
    // executive
    return [
      T("tx", <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={fmtNum(s?.transformers)} sub={s ? `${s.depotsCovered} depots covered` : undefined} to="/transformers" loading={loading} />),
      T("on", <HeroStat icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Devices online" value={s?.onlinePercent != null ? `${s.onlinePercent}%` : "—"} sub={s ? `${fmtNum(s.online)} reporting · ${fmtNum(s.offline)} offline` : undefined} tone={s?.onlinePercent != null && s.onlinePercent < 80 ? "warn" : "good"} to="/sites" loading={loading} />),
      T("arm", <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="Armed" value={fmtNum(s?.armed)} sub={s ? `${fmtNum(s.disarmed)} disarmed` : undefined} to="/transformers?arm=ARMED" loading={loading} />),
      T("open", <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open incidents" value={fmtNum(sm?.open ?? s?.openAlerts)} sub={s ? `${s.transformersAlerting} transformers alerting` : undefined} tone={(sm?.open ?? s?.openAlerts) ? "bad" : "good"} to={incidentsLink} loading={loading} />),
      T("thr", <HeroStat icon={<Flame className="h-3.5 w-3.5 text-red-300" />} label="Real threats · 30 d" value={fmtNum(sm?.realThreats30d)} sub={sm ? `${fmtNum(sm.falseAlarms30d)} false alarms` : undefined} tone={sm?.realThreats30d ? "bad" : undefined} to="/insights" loading={canAlerts && !sm} />),
      T("arr", <HeroStat icon={<Clock3 className="h-3.5 w-3.5" />} label="Avg time to scene" value={mins(sm?.avgArrivalMinutes)} sub={sm ? `acknowledge ${mins(sm.avgAcknowledgeMinutes)}` : undefined} loading={canAlerts && !sm} />),
    ];
  };
  const tiles = kpis();

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow={`Dashboard · ${VIEW_META[active].label}`}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle={scopeLabel}
        actions={
          <>
            <Link to="/sites" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <MapPinned className="h-4 w-4" /> Live map
            </Link>
            <HeroButton onClick={reloadAll} busy={busy}>
              Refresh
            </HeroButton>
          </>
        }
      >
        {views.length > 1 ? (
          <div className="mb-3 inline-flex flex-wrap gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15" role="tablist">
            {views.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={v === active}
                onClick={() => setView(v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  v === active ? "bg-white text-blue-800 shadow" : "text-blue-100 hover:bg-white/10"
                }`}
              >
                {VIEW_META[v].icon}
                {VIEW_META[v].label}
              </button>
            ))}
          </div>
        ) : null}
        <HeroStats cols={tiles.length as 6}>{tiles}</HeroStats>
      </PageHero>

      {stats.error && !s ? <Notice>{stats.error}</Notice> : null}

      {active === "executive" ? (
        <ExecutiveView
          s={s}
          sm={sm}
          days14={days14}
          days14Total={days14Total}
          threats14={threats14}
          health={health}
          triggers={triggers}
          outcomes={outcomes}
          armData={armData}
          stages={stages}
          responseTimes={responseTimes}
          overview={overview.data}
          canAlerts={canAlerts}
          depotName={(id) => geo.pathOf(id).depotName}
        />
      ) : null}

      {active === "control" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Alerts per hour" subtitle={`Last 24 hours · ${fmtNum(alerts24hTotal)} alerts · the current hour is in red`} icon={<BarChart3 className="h-4 w-4" />} height={260}>
            <Bars data={hourly} x="label" y="alerts" name="Alerts" highlightLast />
          </ChartCard>
          <ChartCard title="Open queue by stage" subtitle={sm ? `${fmtNum(sm.open)} open · ${fmtNum(sm.unassigned)} unassigned` : undefined} icon={<Inbox className="h-4 w-4" />} height={null}>
            {sm ? <Pipeline stages={stages} /> : <Empty>Loading…</Empty>}
          </ChartCard>
          <ChartCard title="Latest open alerts" subtitle="Newest first" icon={<Siren className="h-4 w-4" />} height={null} action={<CardLink to={incidentsLink || "/alerts"}>Open queue</CardLink>}>
            <LatestAlerts rows={latest.data?.content} loading={latest.loading && !latest.data} />
          </ChartCard>
          <ChartCard title="Busiest transformers" subtitle="Most open alerts right now" icon={<Flame className="h-4 w-4" />} height={null}>
            {hot.length ? <RankBars data={hot} color={C.red} /> : <Empty>No transformer has open alerts.</Empty>}
          </ChartCard>
          <ChartCard title="What triggered" subtitle="Alerts by trigger · last 7 days" icon={<PieIcon className="h-4 w-4" />}>
            <Donut data={triggers} centerLabel="alerts" />
          </ChartCard>
        </div>
      ) : null}

      {active === "dispatch" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Crews in the field" subtitle="Open incidents with a vehicle on them" icon={<Truck className="h-4 w-4" />} height={null} action={<CardLink to="/response">Response desk</CardLink>}>
            <ActiveDispatches board={board.data} loading={board.loading && !board.data} />
          </ChartCard>
          <ChartCard title="Fleet right now" subtitle="Vehicles by availability" icon={<CarFront className="h-4 w-4" />}>
            {board.data ? (
              <Donut
                centerLabel="vehicles"
                data={[
                  { name: "Available", value: board.data.vehiclesAvailable, color: C.online, to: "/fleet" },
                  { name: "Dispatched", value: board.data.vehiclesDispatched, color: C.blue, to: "/fleet" },
                  { name: "Out of service", value: board.data.vehiclesOutOfService, color: C.slate, to: "/fleet" },
                ]}
              />
            ) : (
              <Empty>{board.loading ? "Loading…" : "No fleet data."}</Empty>
            )}
          </ChartCard>
          <ChartCard title="Incidents by stage" subtitle="Where open incidents are waiting" icon={<Inbox className="h-4 w-4" />} height={null}>
            {sm ? <Pipeline stages={stages} /> : <Empty>Loading…</Empty>}
          </ChartCard>
          <ChartCard title="Alerts per hour" subtitle="Last 24 hours" icon={<BarChart3 className="h-4 w-4" />}>
            <Bars data={hourly} x="label" y="alerts" name="Alerts" highlightLast />
          </ChartCard>
          <ChartCard title="Response times" subtitle="Average minutes per step · last 30 days" icon={<Timer className="h-4 w-4" />} height={null}>
            {sm ? <RankBars data={responseTimes} unit=" min" color={C.blue} /> : <Empty>Loading…</Empty>}
          </ChartCard>
        </div>
      ) : null}

      {active === "partner" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="Alerts per day" subtitle={`Last 14 days · ${fmtNum(days14Total)} alerts · ${fmtNum(threats14)} real threats`} icon={<LineChart className="h-4 w-4" />} height={270}>
            <BarsWithLine data={days14} x="label" bar="alerts" line="realThreats" barName="Alerts" lineName="Real threats" />
          </ChartCard>
          <ChartCard title="Device health" subtitle="Your controllers by last report" icon={<Radio className="h-4 w-4" />} height={270}>
            <Donut data={health} centerLabel="transformers" />
          </ChartCard>
          <ChartCard title="Arm state" subtitle="Sites armed vs disarmed" icon={<ShieldCheck className="h-4 w-4" />}>
            <Donut data={armData} centerLabel="sites" />
          </ChartCard>
          <ChartCard title="What triggered" subtitle="Last 7 days" icon={<PieIcon className="h-4 w-4" />}>
            <Donut data={triggers} centerLabel="alerts" />
          </ChartCard>
          <ChartCard title="Busiest transformers" subtitle="Most open alerts right now" icon={<Flame className="h-4 w-4" />} height={null}>
            {hot.length ? <RankBars data={hot} color={C.red} /> : <Empty>No transformer has open alerts.</Empty>}
          </ChartCard>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------- executive

function ExecutiveView({
  s,
  sm,
  days14,
  days14Total,
  threats14,
  health,
  triggers,
  outcomes,
  armData,
  stages,
  responseTimes,
  overview,
  canAlerts,
  depotName,
}: {
  s?: EstateStats | null;
  sm?: AlertSummary | null;
  days14: AlertTrends["daily"];
  days14Total: number;
  threats14: number;
  health: Array<{ name: string; value: number; color: string; to?: string }>;
  triggers: Array<{ name: string; value: number; color: string }>;
  outcomes: Array<{ name: string; value: number; color: string }>;
  armData: Array<{ name: string; value: number; color: string; to?: string }>;
  stages: Array<{ name: string; value: number; color: string; to?: string }>;
  responseTimes: Array<{ name: string; value: number }>;
  overview?: Overview | null;
  canAlerts: boolean;
  depotName: (id?: number | null) => string;
}) {
  const depots = (overview?.depots ?? [])
    .filter((d) => d.depotId != null && (d.openAlerts > 0 || d.alerts24h > 0))
    .sort((a, b) => b.openAlerts - a.openAlerts || b.alerts24h - a.alerts24h)
    .slice(0, 7)
    .map((d) => ({ name: depotName(d.depotId), value: d.openAlerts, sub: `${d.alerts24h} in 24 h`, to: `/transformers?depot=${d.depotId}`, color: C.red }));
  const partners = (overview?.partners ?? [])
    .filter((p) => p.supplierCode && p.transformers > 0)
    .map((p) => ({
      name: displayPartner(p.supplierName, p.supplierCode) || "Partner",
      value: p.onlinePercent ?? 0,
      sub: `${p.online}/${p.online + p.offline + p.delayed + p.neverSeen} online`,
      to: `/partners/${encodeURIComponent(p.supplierCode || "")}`,
      color: (p.onlinePercent ?? 0) >= 80 ? C.online : (p.onlinePercent ?? 0) >= 50 ? C.delayed : C.offline,
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 7);
  const monthly = (sm?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {canAlerts ? (
        <ChartCard className="xl:col-span-2" title="Alerts per day" subtitle={`Last 14 days · ${fmtNum(days14Total)} alerts · ${fmtNum(threats14)} confirmed real threats`} icon={<LineChart className="h-4 w-4" />} height={280}>
          <BarsWithLine data={days14} x="label" bar="alerts" line="realThreats" barName="Alerts" lineName="Real threats" />
        </ChartCard>
      ) : null}
      <ChartCard className={canAlerts ? "" : "xl:col-span-2"} title="Device health" subtitle={s ? `${fmtNum(s.transformers)} transformers by last report` : undefined} icon={<Radio className="h-4 w-4" />} height={280}>
        <Donut data={health} centerLabel="transformers" />
      </ChartCard>
      {!canAlerts ? (
        <ChartCard title="Arm state" subtitle="Sites armed vs disarmed" icon={<ShieldCheck className="h-4 w-4" />} height={280}>
          <Donut data={armData} centerLabel="sites" />
        </ChartCard>
      ) : null}

      {canAlerts ? (
        <>
          <ChartCard title="What triggered" subtitle="Alerts by trigger · last 7 days" icon={<PieIcon className="h-4 w-4" />}>
            <Donut data={triggers} centerLabel="alerts" />
          </ChartCard>
          <ChartCard title="How incidents ended" subtitle="Closed in the last 7 days" icon={<ShieldCheck className="h-4 w-4" />}>
            <Donut data={outcomes} centerLabel="closed" />
          </ChartCard>
          <ChartCard title="Arm state" subtitle="Sites armed vs disarmed" icon={<ShieldOff className="h-4 w-4" />}>
            <Donut data={armData} centerLabel="sites" />
          </ChartCard>
        </>
      ) : null}

      {canAlerts ? (
        <ChartCard title="Open incidents by stage" subtitle={sm ? `${fmtNum(sm.open)} open right now` : undefined} icon={<Inbox className="h-4 w-4" />} height={null}>
          {sm ? <Pipeline stages={stages} /> : <Empty>Loading…</Empty>}
        </ChartCard>
      ) : null}
      <ChartCard title="Depots under pressure" subtitle="Most open alerts" icon={<Building2 className="h-4 w-4" />} height={null} action={<CardLink to="/insights/depots">All depots</CardLink>}>
        {overview ? depots.length ? <RankBars data={depots} /> : <Empty>No depot has open alerts.</Empty> : <Empty>Loading…</Empty>}
      </ChartCard>
      <ChartCard title="Partner device uptime" subtitle="% of devices online, weakest first" icon={<Handshake className="h-4 w-4" />} height={null} action={<CardLink to="/partners">All partners</CardLink>}>
        {overview ? partners.length ? <RankBars data={partners} unit="%" max={100} /> : <Empty>No partner devices yet.</Empty> : <Empty>Loading…</Empty>}
      </ChartCard>

      {canAlerts ? (
        <>
          <ChartCard className="xl:col-span-2" title="Alerts per month" subtitle="Long-run trend" icon={<Activity className="h-4 w-4" />} height={240}>
            <AreaTrend data={monthly} x="label" y="alerts" name="Alerts" />
          </ChartCard>
          <ChartCard title="Response times" subtitle="Average minutes per step · last 30 days" icon={<Timer className="h-4 w-4" />} height={null}>
            {sm ? <RankBars data={responseTimes} unit=" min" /> : <Empty>Loading…</Empty>}
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}

const monthLabel = (m: string) => {
  const d = new Date(`${m}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
};

// ---------------------------------------------------------------------- small lists

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800">
      {children} →
    </Link>
  );
}

function LatestAlerts({ rows, loading }: { rows?: IncidentAlert[]; loading: boolean }) {
  if (loading) return <Empty>Loading…</Empty>;
  if (!rows?.length) return <Empty>No open alerts. All quiet.</Empty>;
  return (
    <ul className="divide-y divide-slate-100 px-2 dark:divide-slate-800">
      {rows.map((a) => {
        const st = statusOf(a);
        return (
          <li key={a.id}>
            <Link to={a.transformerId ? `/transformer/${a.transformerId}` : "/alerts"} className="flex items-center gap-3 rounded-lg px-1.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[st].dot}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{a.transformerName || "Unknown transformer"}</span>
                <span className="block truncate text-xs text-slate-500">
                  {eventText(a)}
                  {a.depotName ? ` · ${a.depotName}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right text-[11px] text-slate-500">
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[st].chip}`}>{STATUS_META[st].label}</span>
                <span className="mt-0.5 block">{timeAgo(a.createdAt)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveDispatches({ board, loading }: { board?: Board | null; loading: boolean }) {
  if (loading) return <Empty>Loading…</Empty>;
  const rows = (board?.open ?? []).map((c) => ({ c, d: activeDispatch(c.dispatches) })).filter((x) => x.d);
  const waiting = (board?.open ?? []).filter((c) => !activeDispatch(c.dispatches)).length;
  if (!rows.length)
    return (
      <Empty>
        No crews out right now.{waiting ? ` ${waiting} incident${waiting === 1 ? "" : "s"} waiting for a vehicle.` : ""}
      </Empty>
    );
  return (
    <div className="overflow-x-auto px-2">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-2 py-1.5 font-semibold">Transformer</th>
            <th className="px-2 py-1.5 font-semibold">Vehicle</th>
            <th className="px-2 py-1.5 font-semibold">Crew lead</th>
            <th className="px-2 py-1.5 font-semibold">Stage</th>
            <th className="px-2 py-1.5 text-right font-semibold">Dispatched</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.slice(0, 8).map(({ c, d }) => {
            const st = statusOf(c.alert);
            return (
              <tr key={c.alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-2 py-2">
                  <Link to="/response" className="font-medium text-slate-800 hover:text-blue-600 dark:text-slate-100">
                    {c.alert.transformerName || "Unknown"}
                  </Link>
                  <span className="block text-xs text-slate-500">{c.alert.depotName || "—"}</span>
                </td>
                <td className="px-2 py-2 text-slate-700 dark:text-slate-200">{d ? vehicleLabel(d) : "—"}</td>
                <td className="px-2 py-2 text-slate-700 dark:text-slate-200">{d?.crewLeadName || "—"}</td>
                <td className="px-2 py-2">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[st].chip}`}>{STATUS_META[st].label}</span>
                </td>
                <td className="px-2 py-2 text-right text-xs text-slate-500">{timeAgo(d?.dispatchedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {waiting ? <p className="px-2 pt-2 text-xs text-amber-600">{waiting} more incident{waiting === 1 ? "" : "s"} waiting for a vehicle.</p> : null}
    </div>
  );
}
