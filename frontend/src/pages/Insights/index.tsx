import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Award, Building2, ChevronDown, ChevronRight, Clock3, Cpu, Gauge, Handshake, ShieldAlert, Siren, Truck, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import { displayName, displayPartner } from "../../lib/brand";
import { API_BASE_URL, useGeography } from "../Registry/geo";
import {
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
  SelectBox,
  SkeletonRows,
  SortTh,
  StatusBar,
  StatusLegend,
  compareBy,
  nextSort,
  tableCls,
  type SortState,
} from "../../components/ui/page";

type Block = {
  supplierCode?: string;
  supplierName?: string;
  depotId?: number | null;
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
  onlinePercent: number | null;
  falseAlarmPercent: number | null;
  avgArrivalMinutes: number | null;
  vehicles?: number;
  vehiclesAvailable?: number;
};

type Overview = {
  scope: "NATIONAL" | "PARTNER" | "DEPOT";
  scopeSupplierName?: string | null;
  scopeDepotId?: number | null;
  totals: Block;
  partners: Block[];
  depots: Block[];
};

type PartnerSort = "name" | "transformers" | "onlinePercent" | "offline" | "openAlerts" | "alerts24h" | "realThreats24h" | "falseAlarmPercent" | "avgArrivalMinutes" | "unmatchedControllers";
type DepotSort = "name" | "transformers" | "onlinePercent" | "offline" | "openAlerts" | "alerts24h" | "realThreats24h" | "avgArrivalMinutes";

const mins = (n?: number | null) => (n == null ? "—" : `${Math.round(n)} min`);

export default function Insights({ view = "partners" }: { view?: "partners" | "depots" }) {
  const { token } = useAuth();
  const geo = useGeography(token);
  const ov = useCachedGet<Overview>(token ? `${API_BASE_URL}/api/v1/transformers/overview` : null, token, { maxAgeMs: 30_000, errorText: "Could not load the overview." });
  const data = ov.data;
  const t = data?.totals;

  const title =
    data?.scope === "PARTNER" ? `${displayName(data.scopeSupplierName) || "Partner"} portal` : data?.scope === "DEPOT" ? `${geo.pathOf(data.scopeDepotId).depotName} depot` : "National overview";
  const subtitle =
    data?.scope === "PARTNER"
      ? "Only the ZESA transformers your devices monitor, wherever they are."
      : data?.scope === "DEPOT"
        ? "Transformers, incidents and vehicles for your depot."
        : "ZESA estate across all monitoring partners: who covers what, how healthy it is, and how incidents end.";

  return (
    <div className="space-y-4">
      <PageHero eyebrow="Insights" title={title} subtitle={subtitle} actions={<HeroButton onClick={() => void ov.reload()} busy={ov.loading || ov.refreshing}>Refresh</HeroButton>}>
        <HeroStats cols={6}>
          <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={t?.transformers.toLocaleString() ?? "—"} sub={t ? `${t.groundMounted} GMT · ${t.poleMounted} PMT` : undefined} loading={!t} to="/transformers" />
          <HeroStat icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={t?.onlinePercent == null ? "—" : `${t.onlinePercent}%`} sub={t ? `${t.online} online · ${t.offline} offline` : undefined} tone="good" loading={!t} />
          <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open incidents" value={t?.openAlerts.toLocaleString() ?? "—"} sub={t ? `${t.alerts24h} alerts in the last 24 hours` : undefined} tone={t?.openAlerts ? "bad" : undefined} loading={!t} />
          <HeroStat icon={<ShieldAlert className="h-3.5 w-3.5 text-amber-300" />} label="Real threats · 24h" value={t?.realThreats24h ?? "—"} sub={t ? (t.falseAlarmPercent == null ? "No closed incidents" : `${t.falseAlarmPercent}% false alarms`) : undefined} loading={!t} />
          <HeroStat icon={<Truck className="h-3.5 w-3.5" />} label="Avg time to arrive" value={mins(t?.avgArrivalMinutes)} sub="detection → crew on scene" loading={!t} />
          <HeroStat icon={<Cpu className="h-3.5 w-3.5 text-amber-300" />} label="Unmatched devices" value={t?.unmatchedControllers ?? "—"} sub="waiting for a transformer" to="/new-controllers" loading={!t} />
        </HeroStats>
      </PageHero>

      {ov.error && !data ? <Notice>{ov.error}</Notice> : null}

      {data?.scope !== "PARTNER" ? (
        <nav className="flex gap-2">
          <TabLink to="/insights" active={view === "partners"} icon={<Handshake className="h-4 w-4" />} label="Monitoring partners" count={data?.partners.filter((p) => p.supplierCode !== "unassigned").length} />
          <TabLink to="/insights/depots" active={view === "depots"} icon={<Building2 className="h-4 w-4" />} label="Depots" count={data?.depots.filter((d) => d.depotId != null).length} />
        </nav>
      ) : null}

      {view === "partners" && data?.scope !== "PARTNER" ? <PartnersPanel partners={data?.partners} loading={!data} /> : <DepotsPanel data={data} geo={geo} />}
    </div>
  );
}

// ------------------------------------------------------------------ partners

function PartnersPanel({ partners, loading }: { partners?: Block[]; loading: boolean }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState<PartnerSort>>({ key: "transformers", dir: -1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => {
    const list = (partners ?? []).map((p) => ({ ...p, label: displayPartner(p.supplierName, p.supplierCode === "unassigned" ? null : p.supplierCode) }));
    const term = q.trim().toLowerCase();
    const filtered = term ? list.filter((p) => p.label.toLowerCase().includes(term) || (p.supplierCode || "").toLowerCase().includes(term)) : list;
    return filtered.sort(compareBy((p) => (sort.key === "name" ? p.label : (p[sort.key] as number | null)), sort.dir));
  }, [partners, q, sort]);

  const real = (partners ?? []).filter((p) => p.supplierCode !== "unassigned" && p.transformers > 0);
  const best = [...real].filter((p) => p.onlinePercent != null).sort((a, b) => (b.onlinePercent ?? 0) - (a.onlinePercent ?? 0))[0];
  const busiest = [...real].sort((a, b) => b.openAlerts - a.openAlerts)[0];
  const fastest = [...real].filter((p) => p.avgArrivalMinutes != null).sort((a, b) => (a.avgArrivalMinutes ?? 0) - (b.avgArrivalMinutes ?? 0))[0];

  const onSort = (k: PartnerSort) => {
    setSort((c) => nextSort(c, k, ["name"]));
    setPage(0);
  };
  const shown = rows.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <Panel
      icon={<Handshake className="h-4 w-4" />}
      title="Monitoring partners"
      subtitle={`${real.length} partner${real.length === 1 ? "" : "s"} · device health, incidents and how they ended in the last 24 hours. Click a partner for detail.`}
      actions={<StatusLegend className="hidden md:flex" />}
      toolbar={
        <>
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Find a partner…" className="max-w-xs" />
          <div className="ml-auto hidden flex-wrap gap-2 lg:flex">
            <Highlight icon={<Award className="h-3.5 w-3.5 text-emerald-600" />} label="Best device health" value={best ? `${displayPartner(best.supplierName, best.supplierCode)} · ${best.onlinePercent}%` : "—"} />
            <Highlight icon={<Siren className="h-3.5 w-3.5 text-red-600" />} label="Most open incidents" value={busiest && busiest.openAlerts ? `${displayPartner(busiest.supplierName, busiest.supplierCode)} · ${busiest.openAlerts}` : "None open"} />
            <Highlight icon={<Clock3 className="h-3.5 w-3.5 text-blue-600" />} label="Fastest arrival" value={fastest ? `${displayPartner(fastest.supplierName, fastest.supplierCode)} · ${mins(fastest.avgArrivalMinutes)}` : "—"} />
          </div>
        </>
      }
    >
      <div className={tableCls.wrap}>
        <table className={`${tableCls.table} min-w-[1080px]`}>
          <thead className={tableCls.thead}>
            <tr>
              <SortTh k="name" sort={sort} onSort={onSort}>Partner</SortTh>
              <SortTh k="transformers" sort={sort} onSort={onSort}>Transformers</SortTh>
              <SortTh k="onlinePercent" sort={sort} onSort={onSort}>Device health</SortTh>
              <SortTh k="offline" sort={sort} onSort={onSort}>Offline</SortTh>
              <SortTh k="openAlerts" sort={sort} onSort={onSort}>Open</SortTh>
              <SortTh k="alerts24h" sort={sort} onSort={onSort}>Alerts 24h</SortTh>
              <SortTh k="realThreats24h" sort={sort} onSort={onSort}>Real threats</SortTh>
              <SortTh k="falseAlarmPercent" sort={sort} onSort={onSort}>False alarm</SortTh>
              <SortTh k="avgArrivalMinutes" sort={sort} onSort={onSort}>Avg arrival</SortTh>
              <SortTh k="unmatchedControllers" sort={sort} onSort={onSort}>Unmatched</SortTh>
            </tr>
          </thead>
          <tbody className={tableCls.tbody}>
            {loading ? <SkeletonRows rows={4} cols={10} /> : null}
            {shown.map((p) => {
              const key = p.supplierCode || "unassigned";
              const isOpen = open === key;
              return (
                <Fragment key={key}>
                  <tr className={`${tableCls.tr} cursor-pointer ${isOpen ? "bg-blue-50/50 dark:bg-slate-900" : ""}`} onClick={() => setOpen(isOpen ? null : key)}>
                    <td className={tableCls.td}>
                      <div className="flex items-center gap-2.5">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-[11px] font-bold uppercase text-white">{p.label.slice(0, 2)}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{p.label}</p>
                          <p className="text-[11px] text-slate-500">{p.controllers} devices</p>
                        </div>
                      </div>
                    </td>
                    <td className={tableCls.td}>{p.transformers.toLocaleString()}</td>
                    <td className={`${tableCls.td} w-[200px]`}>
                      <HealthCell b={p} percent={p.onlinePercent} />
                    </td>
                    <td className={tableCls.td}>{p.offline ? <span className="font-semibold text-red-600">{p.offline}</span> : <span className="text-slate-400">0</span>}</td>
                    <td className={tableCls.td}>
                      <CountBadge n={p.openAlerts} />
                    </td>
                    <td className={tableCls.td}>{p.alerts24h}</td>
                    <td className={tableCls.td}>{p.realThreats24h}</td>
                    <td className={tableCls.td}>{p.falseAlarmPercent == null ? "—" : `${p.falseAlarmPercent}%`}</td>
                    <td className={tableCls.td}>{mins(p.avgArrivalMinutes)}</td>
                    <td className={tableCls.td}>
                      <CountBadge n={p.unmatchedControllers} tone="amber" />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-slate-50/70 dark:bg-slate-900/50">
                      <td colSpan={10} className="px-4 py-4">
                        <PartnerDetail p={p} label={p.label} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!loading && rows.length === 0 ? <EmptyRow cols={10}>{q ? "No partner matches that search." : "No partners yet."}</EmptyRow> : null}
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
  );
}

function PartnerDetail({ p, label }: { p: Block; label: string }) {
  const closed = p.realThreats24h + p.falseAlarms24h + p.technicalFaults24h;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Device health</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{p.onlinePercent == null ? "—" : `${p.onlinePercent}%`} <span className="text-sm font-normal text-slate-500">online</span></p>
        <div className="mt-2">
          <StatusBar b={p} />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[11px]">
          <Small n={p.online} l="Online" c="text-emerald-600" />
          <Small n={p.delayed} l="Delayed" c="text-amber-600" />
          <Small n={p.offline} l="Offline" c="text-red-600" />
          <Small n={p.neverSeen} l="Never seen" />
          <Small n={p.noDevice} l="No device" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Incidents · last 24 hours</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Small n={p.alerts24h} l="Alerts" big />
          <Small n={p.openAlerts} l="Open now" c={p.openAlerts ? "text-red-600" : undefined} big />
          <Small n={p.realThreats24h} l="Real threats" big />
          <Small n={closed} l="Closed" big />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{p.falseAlarmPercent == null ? "No closed incidents yet." : `${p.falseAlarmPercent}% of closed incidents were false alarms.`}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Coverage</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Small n={p.groundMounted} l="Ground (GMT)" big />
          <Small n={p.poleMounted} l="Pole (PMT)" big />
          <Small n={p.mapped} l="On the map" big />
          <Small n={p.unmatchedControllers} l="Unmatched" c={p.unmatchedControllers ? "text-amber-600" : undefined} big />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/transformers?partner=${p.supplierCode ?? ""}`} className="rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700">
            {label} transformers →
          </Link>
          {p.unmatchedControllers ? (
            <Link to="/new-controllers" className="rounded-full border border-amber-300 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50">
              Match devices
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ depots

function DepotsPanel({ data, geo }: { data?: Overview; geo: ReturnType<typeof useGeography> }) {
  const [regionId, setRegionId] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState<DepotSort>>({ key: "openAlerts", dir: -1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.depots
      .map((d) => ({ ...d, path: geo.pathOf(d.depotId) }))
      .filter((d) => !regionId || String(d.path.regionId) === regionId)
      .filter((d) => !term || `${d.path.depotName} ${d.path.districtName} ${d.path.regionName}`.toLowerCase().includes(term))
      .sort(compareBy((d) => (sort.key === "name" ? d.path.depotName : (d[sort.key] as number | null)), sort.dir));
  }, [data, geo, q, regionId, sort]);

  const onSort = (k: DepotSort) => {
    setSort((c) => nextSort(c, k, ["name"]));
    setPage(0);
  };
  const shown = rows.slice(page * pageSize, page * pageSize + pageSize);
  const partner = data?.scope === "PARTNER";

  return (
    <Panel
      icon={<Building2 className="h-4 w-4" />}
      title="Depots"
      subtitle="Where incidents happen and how fast crews get there."
      toolbar={
        <>
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Find a depot, district or region…" className="max-w-sm" />
          {data?.scope === "NATIONAL" ? (
            <SelectBox value={regionId} onChange={(v) => { setRegionId(v); setPage(0); }} label="Region">
              <option value="">All regions</option>
              {geo.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectBox>
          ) : null}
        </>
      }
    >
      <div className={tableCls.wrap}>
        <table className={`${tableCls.table} min-w-[980px]`}>
          <thead className={tableCls.thead}>
            <tr>
              <SortTh k="name" sort={sort} onSort={onSort}>Depot</SortTh>
              <SortTh k="transformers" sort={sort} onSort={onSort}>Transformers</SortTh>
              <SortTh k="onlinePercent" sort={sort} onSort={onSort}>Device health</SortTh>
              <SortTh k="offline" sort={sort} onSort={onSort}>Offline</SortTh>
              <SortTh k="openAlerts" sort={sort} onSort={onSort}>Open</SortTh>
              <SortTh k="alerts24h" sort={sort} onSort={onSort}>Alerts 24h</SortTh>
              <SortTh k="realThreats24h" sort={sort} onSort={onSort}>Real threats</SortTh>
              <SortTh k="avgArrivalMinutes" sort={sort} onSort={onSort}>Avg arrival</SortTh>
              {!partner ? <th className={tableCls.th}>Vehicles</th> : null}
            </tr>
          </thead>
          <tbody className={tableCls.tbody}>
            {!data ? <SkeletonRows rows={5} cols={partner ? 8 : 9} /> : null}
            {shown.map((d) => (
              <tr key={d.depotId ?? -1} className={tableCls.tr}>
                <td className={tableCls.td}>
                  <Link to={d.depotId ? `/transformers?depot=${d.depotId}` : "/transformers"} className="font-semibold text-slate-900 hover:text-blue-700 dark:text-slate-100">
                    {d.path.depotName}
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    {d.path.regionName} › {d.path.districtName}
                  </p>
                </td>
                <td className={tableCls.td}>{d.transformers}</td>
                <td className={`${tableCls.td} w-[220px]`}>
                  <HealthCell b={d} percent={d.onlinePercent} />
                </td>
                <td className={tableCls.td}>{d.offline ? <span className="font-semibold text-red-600">{d.offline}</span> : <span className="text-slate-400">0</span>}</td>
                <td className={tableCls.td}>
                  <CountBadge n={d.openAlerts} to="/response" />
                </td>
                <td className={tableCls.td}>{d.alerts24h}</td>
                <td className={tableCls.td}>
                  {d.realThreats24h}
                  {d.falseAlarmPercent != null ? <span className="ml-1 text-[11px] text-slate-400">({d.falseAlarmPercent}% false)</span> : null}
                </td>
                <td className={tableCls.td}>{mins(d.avgArrivalMinutes)}</td>
                {!partner ? (
                  <td className={tableCls.td}>
                    {d.vehicles ? (
                      <span>
                        <b>{d.vehiclesAvailable}</b>/{d.vehicles} free
                      </span>
                    ) : (
                      <span className="text-amber-600">none</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {data && rows.length === 0 ? <EmptyRow cols={9}>No depots in this view.</EmptyRow> : null}
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
  );
}

function TabLink({ to, active, icon, label, count }: { to: string; active: boolean; icon: ReactNode; label: string; count?: number }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-slate-900 text-white shadow-sm dark:bg-blue-600" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {icon}
      {label}
      {count != null ? <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>{count}</span> : null}
    </Link>
  );
}

function Highlight({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
      {icon}
      <span className="text-slate-500">{label}:</span>
      <b className="text-slate-800 dark:text-slate-100">{value}</b>
    </div>
  );
}

function Small({ n, l, c, big }: { n: number; l: string; c?: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-1.5 dark:bg-slate-900">
      <p className={`${big ? "text-base" : "text-sm"} font-semibold ${c ?? "text-slate-900 dark:text-slate-100"}`}>{n.toLocaleString()}</p>
      <p className="text-[10px] text-slate-500">{l}</p>
    </div>
  );
}
