import { useMemo } from "react";
import { Building2, Gauge, MapPinned, ShieldCheck, ShieldOff, Siren, WifiOff, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import { displayName } from "../../lib/brand";
import { useGeography } from "../Registry/geo";
import MapExplorer from "../../components/maps/MapExplorer";
import type { EstateStats } from "../Dashboard/types";
import { useScope } from "../../lib/scope";
import { HeroButton, HeroStat, HeroStats, Notice, PageHero, fmtNum } from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

/** Sites: the live estate map. Tiles drill into the registry; click a dot to open that site beside the map. */
export default function SiteIndex() {
  const { token, hasPermission } = useAuth();
  const geo = useGeography(token);
  const { isNational } = useScope();
  const stats = useCachedGet<EstateStats>(token ? `${API}/api/v1/transformers/stats` : null, token, {
    maxAgeMs: 30_000,
    refreshMs: 60_000,
    errorText: "Could not load the estate figures.",
  });
  const s = stats.data;
  const loading = stats.loading && !s;

  const scopeLabel = useMemo(() => {
    if (!s) return "Loading your view…";
    if (s.scope === "PARTNER") return `${displayName(s.scopeSupplierName) || "Partner"} portal · the ZESA transformers your devices monitor`;
    if (s.scope === "DEPOT") return `${geo.pathOf(s.scopeDepotId).depotName} depot`;
    return "Every transformer on one map · click a tile to drill into the list, or a dot to open that site";
  }, [geo, s]);

  // Region and depot lists are national pages; depot and partner users only see their own sites.
  const canRegions = isNational && hasPermission("regions.read") && s?.scope === "NATIONAL";
  const canDepots = isNational && hasPermission("depots.read") && s?.scope === "NATIONAL";
  const canAlerts = hasPermission("alerts.read") || hasPermission("response.read");
  const incidentsLink = hasPermission("response.read") ? "/response" : hasPermission("alerts.read") ? "/alerts" : undefined;
  const tiles = 5 + (canAlerts ? 1 : 0) + (canRegions ? 1 : 0) + (canDepots ? 1 : 0);

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Assets · Sites"
        title="Transformer sites"
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
