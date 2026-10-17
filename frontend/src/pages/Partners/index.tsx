import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronRight, Cpu, Gauge, Handshake, Plug, ShieldCheck, ShieldOff, Siren, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import {
  Chips,
  CountBadge,
  EmptyRow,
  HealthCell,
  HeroButton,
  HeroStat,
  HeroStats,
  Notice,
  PageHero,
  Pager,
  Panel,
  SearchBox,
  SkeletonRows,
  SortTh,
  StatusLegend,
  compareBy,
  nextSort,
  tableCls,
  timeAgo,
  type SortState,
} from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

export type PartnerBlock = {
  supplierCode?: string;
  supplierName?: string;
  transformers: number;
  online: number;
  delayed: number;
  offline: number;
  neverSeen: number;
  noDevice: number;
  controllers: number;
  unmatchedControllers: number;
  openAlerts: number;
  alerts24h: number;
  realThreats24h: number;
  falseAlarms24h: number;
  technicalFaults24h: number;
  groundMounted: number;
  poleMounted: number;
  mapped: number;
  armed?: number;
  disarmed?: number;
  onlinePercent: number | null;
  falseAlarmPercent: number | null;
  avgArrivalMinutes: number | null;
};

export type Overview = {
  scope: "NATIONAL" | "PARTNER" | "DEPOT";
  scopeSupplierCode?: string | null;
  scopeSupplierName?: string | null;
  totals: PartnerBlock;
  partners: PartnerBlock[];
};

type Integration = { supplierCode: string; enabled: boolean; status?: string | null; lastMessageAt?: string | null; transport?: string };

/** Partners whose devices can be armed and disarmed from the platform today. */
export const CONTROL_PARTNERS = new Set(["oculus"]);

const FEED: Record<string, { label: string; dot: string }> = {
  CONNECTED: { label: "Feed connected", dot: "bg-emerald-500" },
  LISTENING: { label: "Feed listening", dot: "bg-emerald-500" },
  PENDING: { label: "Feed starting", dot: "bg-blue-500" },
  DISCONNECTED: { label: "Feed reconnecting", dot: "bg-amber-500" },
  SKIPPED_LEGACY: { label: "Legacy feed", dot: "bg-emerald-500" },
  ERROR: { label: "Feed error", dot: "bg-red-500" },
  MISCONFIGURED: { label: "Feed needs URL", dot: "bg-red-500" },
  STOPPED: { label: "Feed disabled", dot: "bg-slate-400" },
};

type Filter = "all" | "alerting" | "offline" | "control" | "unmatched";
type SortKey = "name" | "transformers" | "controllers" | "onlinePercent" | "offline" | "armed" | "disarmed" | "openAlerts" | "unmatchedControllers";

/**
 * Partners: every monitoring partner as one row with its summary. Click a partner to open its
 * transformers (and, for partners we can control, arm / disarm them). Replaces one sidebar link
 * per partner, so the menu stays the same length however many partners join.
 */
export default function PartnersPage() {
  const { token, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const ov = useCachedGet<Overview>(token ? `${API}/api/v1/transformers/overview` : null, token, { maxAgeMs: 30_000, errorText: "Could not load partners." });
  const feeds = useCachedGet<Integration[]>(token && hasPermission("integrations.read") ? `${API}/api/v1/supplier-integrations` : null, token, { maxAgeMs: 60_000 });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "transformers", dir: -1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const feedByCode = useMemo(() => {
    const m = new Map<string, Integration>();
    for (const f of feeds.data ?? []) if (!m.has(f.supplierCode) || f.enabled) m.set(f.supplierCode, f);
    return m;
  }, [feeds.data]);

  const partners = useMemo(
    () =>
      (ov.data?.partners ?? [])
        .filter((p) => p.supplierCode && p.supplierCode !== "unassigned")
        .map((p) => ({ ...p, label: displayPartner(p.supplierName, p.supplierCode), control: CONTROL_PARTNERS.has(String(p.supplierCode).toLowerCase()) })),
    [ov.data]
  );
  const noPartner = ov.data?.partners.find((p) => p.supplierCode === "unassigned");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return partners
      .filter((p) => !term || p.label.toLowerCase().includes(term) || String(p.supplierCode).toLowerCase().includes(term))
      .filter((p) =>
        filter === "alerting" ? p.openAlerts > 0 : filter === "offline" ? p.offline > 0 : filter === "control" ? p.control : filter === "unmatched" ? p.unmatchedControllers > 0 : true
      )
      .sort(compareBy((p) => (sort.key === "name" ? p.label : ((p[sort.key] as number | null | undefined) ?? 0)), sort.dir));
  }, [filter, partners, q, sort]);

  // A partner's own users go straight to their partner page.
  const ownCode = user?.supplierCode || (ov.data?.scope === "PARTNER" ? ov.data.scopeSupplierCode : null);
  if (ownCode) return <Navigate to={`/partners/${ownCode}`} replace />;

  const t = partners.reduce(
    (a, p) => ({
      transformers: a.transformers + p.transformers,
      controllers: a.controllers + p.controllers,
      armed: a.armed + (p.armed ?? 0),
      disarmed: a.disarmed + (p.disarmed ?? 0),
      openAlerts: a.openAlerts + p.openAlerts,
      unmatched: a.unmatched + p.unmatchedControllers,
      online: a.online + p.online,
      withDevice: a.withDevice + (p.transformers - p.noDevice),
    }),
    { transformers: 0, controllers: 0, armed: 0, disarmed: 0, openAlerts: 0, unmatched: 0, online: 0, withDevice: 0 }
  );
  const loading = !ov.data;
  const shown = rows.slice(page * pageSize, page * pageSize + pageSize);
  const onSort = (k: SortKey) => {
    setSort((c) => nextSort(c, k, ["name"]));
    setPage(0);
  };
  const count = (f: Filter) =>
    partners.filter((p) => (f === "alerting" ? p.openAlerts > 0 : f === "offline" ? p.offline > 0 : f === "control" ? p.control : f === "unmatched" ? p.unmatchedControllers > 0 : true)).length;

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Operations · Partners"
        title="Monitoring partners"
        subtitle="Every partner that monitors ZESA transformers. Pick a partner to see its transformers, their devices and, where supported, arm or disarm sites."
        actions={<HeroButton onClick={() => void ov.reload()} busy={ov.refreshing || ov.loading}>Refresh</HeroButton>}
      >
        <HeroStats cols={6}>
          <HeroStat icon={<Handshake className="h-3.5 w-3.5" />} label="Partners" value={partners.length} sub={`${partners.filter((p) => p.control).length} with remote control`} loading={loading} />
          <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={t.transformers.toLocaleString()} sub={`${t.controllers.toLocaleString()} devices`} loading={loading} />
          <HeroStat icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={t.withDevice ? `${Math.round((100 * t.online) / t.withDevice)}%` : "—"} sub={`${t.online} devices reporting`} tone="good" loading={loading} />
          <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="Armed" value={t.armed.toLocaleString()} sub={`${t.disarmed} disarmed`} loading={loading} />
          <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open incidents" value={t.openAlerts.toLocaleString()} sub="across all partners" tone={t.openAlerts ? "bad" : undefined} loading={loading} />
          <HeroStat icon={<Cpu className="h-3.5 w-3.5 text-amber-300" />} label="Unmatched devices" value={t.unmatched.toLocaleString()} sub="waiting for a transformer" tone={t.unmatched ? "warn" : undefined} to="/transformers?tab=unmatched" loading={loading} />
        </HeroStats>
      </PageHero>

      {ov.error && !ov.data ? <Notice>{ov.error}</Notice> : null}

      <Panel
        icon={<Handshake className="h-4 w-4" />}
        title={`${rows.length} partner${rows.length === 1 ? "" : "s"}`}
        subtitle="Click a partner to open its transformers."
        actions={<StatusLegend className="hidden md:flex" />}
        toolbar={
          <>
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Find a partner by name or code…" className="max-w-sm" />
            <Chips<Filter>
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(0);
              }}
              options={[
                { value: "all", label: "All", count: partners.length },
                { value: "alerting", label: "Open incidents", dot: "bg-red-500", count: count("alerting") },
                { value: "offline", label: "Offline devices", dot: "bg-amber-500", count: count("offline") },
                { value: "control", label: "Remote control", dot: "bg-blue-500", count: count("control") },
                { value: "unmatched", label: "Unmatched devices", dot: "bg-slate-400", count: count("unmatched") },
              ]}
            />
          </>
        }
      >
        <div className={tableCls.wrap}>
          <table className={`${tableCls.table} min-w-[1040px]`}>
            <thead className={tableCls.thead}>
              <tr>
                <SortTh k="name" sort={sort} onSort={onSort}>Partner</SortTh>
                <SortTh k="transformers" sort={sort} onSort={onSort}>Transformers</SortTh>
                <SortTh k="onlinePercent" sort={sort} onSort={onSort}>Device health</SortTh>
                <SortTh k="offline" sort={sort} onSort={onSort}>Offline</SortTh>
                <SortTh k="armed" sort={sort} onSort={onSort}>Armed</SortTh>
                <SortTh k="disarmed" sort={sort} onSort={onSort}>Disarmed</SortTh>
                <SortTh k="openAlerts" sort={sort} onSort={onSort}>Open</SortTh>
                <SortTh k="unmatchedControllers" sort={sort} onSort={onSort}>Unmatched</SortTh>
                <th className={`${tableCls.th} text-right`}> </th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading ? <SkeletonRows rows={5} cols={9} /> : null}
              {shown.map((p) => {
                const feed = feedByCode.get(String(p.supplierCode));
                const fs = feed ? FEED[feed.enabled ? feed.status || "PENDING" : "STOPPED"] ?? FEED.PENDING : null;
                return (
                  <tr key={p.supplierCode} className={`${tableCls.tr} cursor-pointer`} onClick={() => navigate(`/partners/${p.supplierCode}`)}>
                    <td className={tableCls.td}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-bold uppercase text-white shadow-sm shadow-blue-600/25">
                          {p.label.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-semibold text-slate-900 dark:text-slate-100">
                            {p.label}
                            {p.control ? (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30">
                                Remote control
                              </span>
                            ) : null}
                          </p>
                          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            {p.controllers.toLocaleString()} devices
                            {fs ? (
                              <>
                                <span>·</span>
                                <span className={`h-1.5 w-1.5 rounded-full ${fs.dot}`} />
                                {fs.label}
                                {feed?.lastMessageAt ? ` · last message ${timeAgo(feed.lastMessageAt)}` : ""}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tableCls.td}>
                      <span className="font-semibold">{p.transformers.toLocaleString()}</span>
                      <span className="ml-1 text-[11px] text-slate-400">
                        {p.groundMounted} GMT · {p.poleMounted} PMT
                      </span>
                    </td>
                    <td className={`${tableCls.td} w-[210px]`}>
                      <HealthCell b={p} percent={p.onlinePercent} />
                    </td>
                    <td className={tableCls.td}>{p.offline ? <span className="font-semibold text-red-600">{p.offline}</span> : <span className="text-slate-400">0</span>}</td>
                    <td className={tableCls.td}>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="h-3.5 w-3.5" /> {p.armed ?? 0}
                      </span>
                    </td>
                    <td className={tableCls.td}>
                      <span className={`inline-flex items-center gap-1 font-semibold ${p.disarmed ? "text-amber-700 dark:text-amber-300" : "text-slate-400"}`}>
                        <ShieldOff className="h-3.5 w-3.5" /> {p.disarmed ?? 0}
                      </span>
                    </td>
                    <td className={tableCls.td} onClick={(e) => e.stopPropagation()}>
                      <CountBadge n={p.openAlerts} to="/response" />
                    </td>
                    <td className={tableCls.td} onClick={(e) => e.stopPropagation()}>
                      <CountBadge n={p.unmatchedControllers} tone="amber" to="/transformers?tab=unmatched" />
                    </td>
                    <td className={`${tableCls.td} text-right`}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 ? <EmptyRow cols={9}>{partners.length ? "No partner matches these filters." : "No partners yet. Add one under Integrations."}</EmptyRow> : null}
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

      {noPartner && noPartner.transformers ? (
        <Notice tone="info">
          <span className="inline-flex items-center gap-1.5">
            <Plug className="h-4 w-4" /> {noPartner.transformers} transformers have no partner yet. Set their partner on the Transformers page so they appear here.
          </span>
        </Notice>
      ) : null}
    </div>
  );
}
