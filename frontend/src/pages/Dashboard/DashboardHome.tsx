import { useMemo } from "react";
import { Building2, Gauge, MapPinned, ShieldCheck, ShieldOff, Siren, WifiOff, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import { displayName } from "../../lib/brand";
import { useGeography } from "../Registry/geo";
import MapExplorer from "../../components/maps/MapExplorer";
import { HeroButton, HeroStat, HeroStats, Notice, PageHero, fmtNum } from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

/** GET /api/v1/transformers/stats: one small, cached roll-up for the caller's scope. */
export type EstateStats = {
  scope: "NATIONAL" | "PARTNER" | "DEPOT";
  scopeSupplierName?: string | null;
  scopeDepotId?: number | null;
  transformers: number;
  groundMounted: number;
  poleMounted: number;
  online: number;
  delayed: number;
  offline: number;
  neverSeen: number;
  noDevice: number;
  onlinePercent: number | null;
  armed: number;
  disarmed: number;
  armUnknown: number;
  openAlerts: number;
  transformersAlerting: number;
  unmatchedControllers: number;
  mapped: number;
  depotsCovered: number;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function DashboardHome() {
  const { token, user, hasPermission } = useAuth();
  const geo = useGeography(token);
  const stats = useCachedGet<EstateStats>(token ? `${API}/api/v1/transformers/stats` : null, token, {
    maxAgeMs: 30_000,
    refreshMs: 60_000,
    errorText: "Could not load the estate figures.",
  });
  const s = stats.data;
  const loading = stats.loading && !s;

  const firstName = (user as { firstname?: string; first_name?: string } | null)?.firstname || (user as { first_name?: string } | null)?.first_name || "";
  const scopeLabel = useMemo(() => {
    if (!s) return "Loading your view…";
    if (s.scope === "PARTNER") return `${displayName(s.scopeSupplierName) || "Partner"} portal · the ZESA transformers your devices monitor`;
    if (s.scope === "DEPOT") return `${geo.pathOf(s.scopeDepotId).depotName} depot`;
    return "National operations · every region, depot and monitoring partner";
  }, [geo, s]);

  const canRegions = hasPermission("regions.read") && s?.scope !== "PARTNER";
  const canDepots = hasPermission("depots.read") && s?.scope !== "PARTNER";
  const canAlerts = hasPermission("alerts.read") || hasPermission("response.read");
  const incidentsLink = hasPermission("response.read") ? "/response" : hasPermission("alerts.read") ? "/alerts" : undefined;
  const tiles = 5 + (canAlerts ? 1 : 0) + (canRegions ? 1 : 0) + (canDepots ? 1 : 0);

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Dashboard"
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle={scopeLabel}
        actions={<HeroButton onClick={() => void stats.reload()} busy={stats.refreshing || stats.loading}>Refresh</HeroButton>}
      >
        <HeroStats cols={tiles as 5 | 6 | 7 | 8}>
          {canRegions ? (
            <HeroStat icon={<MapPinned className="h-3.5 w-3.5" />} label="Regions" value={geo.loaded ? fmtNum(geo.regions.length) : "…"} sub={`${geo.districts.length} districts`} to="/regions" loading={!geo.loaded} />
          ) : null}
          {canDepots ? (
            <HeroStat icon={<Building2 className="h-3.5 w-3.5" />} label="Depots" value={geo.loaded ? fmtNum(geo.depots.length) : "…"} sub={s ? `${s.depotsCovered} with transformers` : undefined} to="/depots" loading={!geo.loaded} />
          ) : null}
          <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={fmtNum(s?.transformers)} sub={s ? `${s.groundMounted} GMT · ${s.poleMounted} PMT` : undefined} to="/transformers" loading={loading} />
          <HeroStat icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={fmtNum(s?.online)} sub={s?.onlinePercent != null ? `${s.onlinePercent}% of devices` : "devices reporting"} tone="good" to="/transformers?status=ONLINE" loading={loading} />
          <HeroStat icon={<WifiOff className="h-3.5 w-3.5 text-red-300" />} label="Offline" value={fmtNum(s?.offline)} sub={s ? `${s.delayed} delayed · ${s.neverSeen} never seen` : undefined} tone={s?.offline ? "bad" : undefined} to="/transformers?status=OFFLINE" loading={loading} />
          <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="Armed" value={fmtNum(s?.armed)} sub="sites protected" to="/transformers?arm=ARMED" loading={loading} />
          <HeroStat icon={<ShieldOff className="h-3.5 w-3.5 text-amber-300" />} label="Disarmed" value={fmtNum(s?.disarmed)} sub={s ? `${s.armUnknown} not reported` : undefined} tone={s?.disarmed ? "warn" : undefined} to="/transformers?arm=DISARMED" loading={loading} />
          {canAlerts ? (
            <HeroStat
              icon={<Siren className="h-3.5 w-3.5 text-red-300" />}
              label="Open incidents"
              value={fmtNum(s?.openAlerts)}
              sub={s ? `${s.transformersAlerting} transformers alerting` : undefined}
              tone={s?.openAlerts ? "bad" : "good"}
              to={incidentsLink}
              loading={loading}
            />
          ) : null}
        </HeroStats>
      </PageHero>

      {stats.error && !s ? <Notice>{stats.error}</Notice> : null}

      <MapExplorer height="h-[calc(100vh-300px)] min-h-[560px]" showList={false} />
    </div>
  );
}
