import { MapPinned, MapPinOff, Radio, WifiOff, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import MapExplorer from "../../components/maps/MapExplorer";
import { HeroButton, HeroStat, HeroStats, PageHero, fmtNum } from "../../components/ui/page";
import type { EstateStats } from "../Dashboard/DashboardHome";

const API = import.meta.env.VITE_API_BASE_URL || "";

/** Sites: every transformer location on one map, with the same side panel as the dashboard. */
export default function SiteIndex() {
  const { token } = useAuth();
  const stats = useCachedGet<EstateStats>(token ? `${API}/api/v1/transformers/stats` : null, token, { maxAgeMs: 30_000 });
  const s = stats.data;
  const loading = !s;
  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Assets · Sites"
        title="Transformer sites"
        subtitle="Find any site on the map. Search by name or device EUI, zoom into an area, and open a site to see its devices and recent alerts."
        actions={<HeroButton onClick={() => void stats.reload()} busy={stats.refreshing}>Refresh</HeroButton>}
      >
        <HeroStats cols={5}>
          <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Sites" value={fmtNum(s?.transformers)} sub={s ? `${s.groundMounted} GMT · ${s.poleMounted} PMT` : undefined} loading={loading} />
          <HeroStat icon={<MapPinned className="h-3.5 w-3.5" />} label="On the map" value={fmtNum(s?.mapped)} sub="have coordinates" loading={loading} />
          <HeroStat icon={<MapPinOff className="h-3.5 w-3.5 text-amber-300" />} label="Not on the map" value={fmtNum(s ? s.transformers - s.mapped : null)} sub="missing coordinates" tone={s && s.transformers - s.mapped ? "warn" : undefined} to="/transformers" loading={loading} />
          <HeroStat icon={<Radio className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={fmtNum(s?.online)} sub={s?.onlinePercent != null ? `${s.onlinePercent}% of devices` : undefined} tone="good" loading={loading} />
          <HeroStat icon={<WifiOff className="h-3.5 w-3.5 text-red-300" />} label="Offline" value={fmtNum(s?.offline)} sub={s ? `${s.delayed} delayed` : undefined} tone={s?.offline ? "bad" : undefined} loading={loading} />
        </HeroStats>
      </PageHero>
      <MapExplorer height="h-[calc(100vh-280px)] min-h-[560px]" />
    </div>
  );
}
