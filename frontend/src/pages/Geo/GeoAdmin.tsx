import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Check, ChevronRight, Gauge, MapPinned, Pencil, Plus, Siren, Trash2, Warehouse, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import RemoteSelect from "../../components/ui/page/RemoteSelect";
import { useCachedGet } from "../../lib/cache";
import { API_BASE_URL, depotDistrictId, districtRegionId, useGeography } from "../Registry/geo";
import {
  Button,
  CountBadge,
  Dialog,
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
  StatusLegend,
  compareBy,
  nextSort,
  tableCls,
  type SortState,
} from "../../components/ui/page";

export type GeoLevel = "region" | "district" | "depot";

type Rollup = {
  transformers: number;
  online: number;
  delayed: number;
  offline: number;
  neverSeen: number;
  noDevice: number;
  openAlerts: number;
  alerts24h: number;
  realThreats24h: number;
  vehicles: number;
  vehiclesAvailable: number;
  arrivalSum: number;
  arrivalN: number;
};

type DepotBlock = Partial<Rollup> & { depotId?: number | null; avgArrivalMinutes?: number | null };
type Overview = { depots: DepotBlock[] };

type Row = Rollup & {
  id: number;
  name: string;
  parentLabel: string;
  regionId: number | null;
  districtId: number | null;
  children: number;
  grandChildren: number;
  onlinePercent: number | null;
  avgArrival: number | null;
};

type SortKey = "name" | "children" | "transformers" | "onlinePercent" | "offline" | "openAlerts" | "alerts24h" | "avgArrival";

const META: Record<GeoLevel, { title: string; plural: string; eyebrow: string; icon: ReactNode; perm: string; api: string; subtitle: string }> = {
  region: {
    title: "Region",
    plural: "Regions",
    eyebrow: "Assets · Regions",
    icon: <MapPinned className="h-4 w-4" />,
    perm: "regions",
    api: "regions",
    subtitle: "Operating regions, how healthy their transformers are and where incidents are open. Click a region to see its districts.",
  },
  district: {
    title: "District",
    plural: "Districts",
    eyebrow: "Assets · Districts",
    icon: <MapPinned className="h-4 w-4" />,
    perm: "districts",
    api: "districts",
    subtitle: "Districts within each region. Click a district to see its depots.",
  },
  depot: {
    title: "Depot",
    plural: "Depots",
    eyebrow: "Assets · Depots",
    icon: <Warehouse className="h-4 w-4" />,
    perm: "depots",
    api: "depots",
    subtitle: "Service depots: the transformers they look after, device health, open incidents and response vehicles. Click a depot to see its transformers.",
  },
};

const empty = (): Rollup => ({ transformers: 0, online: 0, delayed: 0, offline: 0, neverSeen: 0, noDevice: 0, openAlerts: 0, alerts24h: 0, realThreats24h: 0, vehicles: 0, vehiclesAvailable: 0, arrivalSum: 0, arrivalN: 0 });

const add = (into: Rollup, b: DepotBlock) => {
  for (const k of ["transformers", "online", "delayed", "offline", "neverSeen", "noDevice", "openAlerts", "alerts24h", "realThreats24h", "vehicles", "vehiclesAvailable"] as const) {
    into[k] += Number(b[k] ?? 0);
  }
  if (b.avgArrivalMinutes != null) {
    into.arrivalSum += b.avgArrivalMinutes;
    into.arrivalN += 1;
  }
};

const pct = (r: Rollup) => {
  const withDevice = r.transformers - r.noDevice;
  return withDevice > 0 ? Math.min(100, Math.round((100 * r.online) / withDevice)) : null;
};

const errText = (e: unknown, fallback: string) => {
  const d = (e as { response?: { data?: { message?: string } | string; status?: number } })?.response;
  if (d?.status === 403) return "You do not have permission to do that.";
  if (typeof d?.data === "string" && d.data) return d.data;
  return (d?.data as { message?: string } | undefined)?.message || fallback;
};

/**
 * One page design for Regions, Districts and Depots: hero with headline figures, a filterable,
 * sortable table with device health and incidents rolled up from the (cached) overview, and
 * create / rename / delete dialogs. Nothing here loads transformers one by one.
 */
export default function GeoAdmin({ level }: { level: GeoLevel }) {
  const meta = META[level];
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const geo = useGeography(token);
  const ov = useCachedGet<Overview>(token ? `${API_BASE_URL}/api/v1/transformers/overview` : null, token, { maxAgeMs: 30_000 });

  const [q, setQ] = useState(params.get("q") || "");
  const regionFilter = params.get("region") || "";
  const districtFilter = params.get("district") || "";
  const [sort, setSort] = useState<SortState<SortKey>>({ key: level === "depot" ? "openAlerts" : "transformers", dir: -1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id?: number; name: string; parentId: string } | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission(`${meta.perm}.create`);
  const canUpdate = hasPermission(`${meta.perm}.update`);
  const canDelete = hasPermission(`${meta.perm}.delete`);

  const setFilter = (key: "region" | "district", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "region") next.delete("district");
    setParams(next, { replace: true });
    setPage(0);
  };

  // Roll the per-depot overview up to districts and regions (no extra requests).
  const rollups = useMemo(() => {
    const byDepot = new Map<number, Rollup>();
    const byDistrict = new Map<number, Rollup>();
    const byRegion = new Map<number, Rollup>();
    const totals = empty();
    for (const b of ov.data?.depots ?? []) {
      add(totals, b);
      if (b.depotId == null) continue;
      const d = empty();
      add(d, b);
      byDepot.set(b.depotId, d);
      const path = geo.pathOf(b.depotId);
      if (path.districtId != null) {
        if (!byDistrict.has(path.districtId)) byDistrict.set(path.districtId, empty());
        add(byDistrict.get(path.districtId)!, b);
      }
      if (path.regionId != null) {
        if (!byRegion.has(path.regionId)) byRegion.set(path.regionId, empty());
        add(byRegion.get(path.regionId)!, b);
      }
    }
    return { byDepot, byDistrict, byRegion, totals };
  }, [geo, ov.data]);

  const rows: Row[] = useMemo(() => {
    const finish = (base: Omit<Row, keyof Rollup | "onlinePercent" | "avgArrival">, r: Rollup | undefined): Row => {
      const x = r ?? empty();
      return { ...base, ...x, onlinePercent: pct(x), avgArrival: x.arrivalN ? Math.round(x.arrivalSum / x.arrivalN) : null };
    };
    if (level === "region") {
      return geo.regions.map((r) => {
        const districts = geo.districts.filter((d) => districtRegionId(d) === r.id);
        const ids = new Set(districts.map((d) => d.id));
        const depots = geo.depots.filter((p) => ids.has(depotDistrictId(p) ?? -1));
        return finish({ id: r.id, name: r.name, parentLabel: "", regionId: r.id, districtId: null, children: districts.length, grandChildren: depots.length }, rollups.byRegion.get(r.id));
      });
    }
    if (level === "district") {
      return geo.districts.map((d) => {
        const regionId = districtRegionId(d);
        const depots = geo.depots.filter((p) => depotDistrictId(p) === d.id);
        return finish(
          { id: d.id, name: d.name, parentLabel: geo.regionById.get(regionId ?? -1)?.name ?? "No region", regionId, districtId: d.id, children: depots.length, grandChildren: 0 },
          rollups.byDistrict.get(d.id)
        );
      });
    }
    return geo.depots.map((p) => {
      const path = geo.pathOf(p.id);
      return finish(
        { id: p.id, name: p.name, parentLabel: `${path.regionName} › ${path.districtName}`, regionId: path.regionId, districtId: path.districtId, children: 0, grandChildren: 0 },
        rollups.byDepot.get(p.id)
      );
    });
  }, [geo, level, rollups]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter((r) => !regionFilter || String(r.regionId) === regionFilter)
      .filter((r) => !districtFilter || String(r.districtId) === districtFilter)
      .filter((r) => !term || `${r.name} ${r.parentLabel}`.toLowerCase().includes(term))
      .sort(compareBy((r) => (sort.key === "name" ? r.name : (r[sort.key] as number | null)), sort.dir));
  }, [districtFilter, q, regionFilter, rows, sort]);

  const shown = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const onSort = (k: SortKey) => {
    setSort((c) => nextSort(c, k, ["name"]));
    setPage(0);
  };

  // Totals for the hero follow the current filter.
  const view = useMemo(() => {
    const r = empty();
    for (const row of filtered) add(r, { ...row, avgArrivalMinutes: row.avgArrival });
    return r;
  }, [filtered]);

  const districtsForFilter = geo.districts.filter((d) => !regionFilter || String(districtRegionId(d)) === regionFilter);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return setNotice({ tone: "error", text: `Enter the ${meta.title.toLowerCase()} name.` });
    if (level !== "region" && !editing.parentId) return setNotice({ tone: "error", text: `Choose the ${level === "district" ? "region" : "district"}.` });
    const body = level === "region" ? { name } : level === "district" ? { name, regionId: Number(editing.parentId) } : { name, districtId: Number(editing.parentId) };
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      setBusy(true);
      if (editing.id) await axios.put(`${API_BASE_URL}/api/v1/${meta.api}/${editing.id}`, body, { headers });
      else await axios.post(`${API_BASE_URL}/api/v1/${meta.api}/create`, body, { headers });
      setNotice({ tone: "success", text: `${meta.title} “${name}” ${editing.id ? "updated" : "created"}.` });
      setEditing(null);
      geo.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, `Could not save the ${meta.title.toLowerCase()}.`) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      setBusy(true);
      await axios.delete(`${API_BASE_URL}/api/v1/${meta.api}/${deleting.id}`, { headers });
      setNotice({ tone: "success", text: `${meta.title} “${deleting.name}” deleted.` });
      setDeleting(null);
      geo.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, `Could not delete the ${meta.title.toLowerCase()}. It may still have ${level === "region" ? "districts" : level === "district" ? "depots" : "transformers"}.`) });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const drill = (r: Row) => {
    if (level === "region") navigate(`/districts?region=${r.id}`);
    else if (level === "district") navigate(`/depots?region=${r.regionId ?? ""}&district=${r.id}`);
    else navigate(`/transformers?depot=${r.id}`);
  };

  const loading = !geo.loaded;
  const statsLoading = ov.loading && !ov.data;
  const childLabel = level === "region" ? "Districts" : level === "district" ? "Depots" : null;
  const cols = 8 + (childLabel ? 1 : 0) + (level === "depot" ? 1 : 0);
  const viewPct = pct(view);

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow={meta.eyebrow}
        title={meta.plural}
        subtitle={meta.subtitle}
        actions={
          <>
            <HeroButton onClick={() => { geo.refresh(); void ov.reload(); }} busy={ov.refreshing}>Refresh</HeroButton>
            {canCreate ? (
              <HeroButton icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ name: "", parentId: level === "district" ? regionFilter : level === "depot" ? districtFilter : "" })}>
                New {meta.title.toLowerCase()}
              </HeroButton>
            ) : null}
          </>
        }
      >
        <HeroStats cols={6}>
          <HeroStat icon={<MapPinned className="h-3.5 w-3.5" />} label="Regions" value={geo.regions.length} sub="operating regions" to="/regions" loading={loading} />
          <HeroStat icon={<MapPinned className="h-3.5 w-3.5" />} label="Districts" value={geo.districts.length} sub="across all regions" to="/districts" loading={loading} />
          <HeroStat icon={<Building2 className="h-3.5 w-3.5" />} label="Depots" value={geo.depots.length} sub="service hubs" to="/depots" loading={loading} />
          <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={view.transformers.toLocaleString()} sub={regionFilter || districtFilter || q ? "in this view" : "monitored"} loading={statsLoading} />
          <HeroStat icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="Online" value={viewPct == null ? "—" : `${viewPct}%`} sub={`${view.online} online · ${view.offline} offline`} tone="good" loading={statsLoading} />
          <HeroStat icon={<Siren className="h-3.5 w-3.5 text-red-300" />} label="Open incidents" value={view.openAlerts.toLocaleString()} sub={`${view.alerts24h} alerts in the last 24 hours`} tone={view.openAlerts ? "bad" : undefined} loading={statsLoading} />
        </HeroStats>
      </PageHero>

      {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}

      <Panel
        icon={meta.icon}
        title={`${filtered.length.toLocaleString()} ${filtered.length === 1 ? meta.title.toLowerCase() : meta.plural.toLowerCase()}`}
        subtitle={level === "depot" ? "Sorted by open incidents. Health counts only transformers that have a device." : "Health counts only transformers that have a device."}
        actions={<StatusLegend className="hidden md:flex" />}
        toolbar={
          <>
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={`Find a ${meta.title.toLowerCase()}…`} className="max-w-sm" />
            {level !== "region" ? (
              <SelectBox value={regionFilter} onChange={(v) => setFilter("region", v)} label="Region">
                <option value="">All regions</option>
                {geo.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectBox>
            ) : null}
            {level === "depot" ? (
              <SelectBox value={districtFilter} onChange={(v) => setFilter("district", v)} label="District">
                <option value="">All districts</option>
                {districtsForFilter.map((d) => (
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
          <table className={`${tableCls.table} min-w-[960px]`}>
            <thead className={tableCls.thead}>
              <tr>
                <SortTh k="name" sort={sort} onSort={onSort}>{meta.title}</SortTh>
                {childLabel ? <SortTh k="children" sort={sort} onSort={onSort}>{childLabel}</SortTh> : null}
                <SortTh k="transformers" sort={sort} onSort={onSort}>Transformers</SortTh>
                <SortTh k="onlinePercent" sort={sort} onSort={onSort}>Device health</SortTh>
                <SortTh k="offline" sort={sort} onSort={onSort}>Offline</SortTh>
                <SortTh k="openAlerts" sort={sort} onSort={onSort}>Open</SortTh>
                <SortTh k="alerts24h" sort={sort} onSort={onSort}>Alerts 24h</SortTh>
                <SortTh k="avgArrival" sort={sort} onSort={onSort}>Avg arrival</SortTh>
                {level === "depot" ? <th className={tableCls.th}>Vehicles</th> : null}
                <th className={`${tableCls.th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading ? <SkeletonRows rows={6} cols={cols} /> : null}
              {shown.map((r) => (
                <tr key={r.id} className={`${tableCls.tr} cursor-pointer`} onClick={() => drill(r)}>
                  <td className={tableCls.td}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">{meta.icon}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{level === "region" ? `${r.grandChildren} depots` : r.parentLabel}</p>
                      </div>
                    </div>
                  </td>
                  {childLabel ? <td className={tableCls.td}>{r.children}</td> : null}
                  <td className={tableCls.td}>{statsLoading ? <span className="ui-skeleton inline-block h-3 w-8" /> : r.transformers.toLocaleString()}</td>
                  <td className={`${tableCls.td} w-[220px]`}>{statsLoading ? <span className="ui-skeleton inline-block h-2 w-32" /> : <HealthCell b={r} percent={r.onlinePercent} />}</td>
                  <td className={tableCls.td}>{r.offline ? <span className="font-semibold text-red-600">{r.offline}</span> : <span className="text-slate-400">0</span>}</td>
                  <td className={tableCls.td} onClick={(e) => e.stopPropagation()}>
                    <CountBadge n={r.openAlerts} to="/response" />
                  </td>
                  <td className={tableCls.td}>{r.alerts24h}</td>
                  <td className={tableCls.td}>{r.avgArrival == null ? "—" : `${r.avgArrival} min`}</td>
                  {level === "depot" ? (
                    <td className={tableCls.td}>
                      {r.vehicles ? (
                        <span>
                          <b>{r.vehiclesAvailable}</b>/{r.vehicles} free
                        </span>
                      ) : (
                        <span className="text-amber-600">none</span>
                      )}
                    </td>
                  ) : null}
                  <td className={`${tableCls.td} text-right`} onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      {canUpdate ? (
                        <button
                          type="button"
                          title="Rename"
                          onClick={() => setEditing({ id: r.id, name: r.name, parentId: String(level === "district" ? r.regionId ?? "" : level === "depot" ? r.districtId ?? "" : "") })}
                          className="rounded-full p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button type="button" title="Delete" onClick={() => setDeleting(r)} className="rounded-full p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      <Link to={level === "depot" ? `/transformers?depot=${r.id}` : level === "district" ? `/depots?region=${r.regionId ?? ""}&district=${r.id}` : `/districts?region=${r.id}`} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" title="Open">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 ? <EmptyRow cols={cols}>{rows.length ? "Nothing matches these filters." : `No ${meta.plural.toLowerCase()} yet.`}</EmptyRow> : null}
            </tbody>
          </table>
        </div>
        {filtered.length > 10 ? (
          <Pager
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(0);
            }}
          />
        ) : null}
      </Panel>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        icon={editing?.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        title={editing?.id ? `Edit ${meta.title.toLowerCase()}` : `New ${meta.title.toLowerCase()}`}
        subtitle={level === "region" ? "Regions group districts." : level === "district" ? "A district belongs to one region." : "A depot belongs to one district."}
        width="max-w-2xl"
        footer={
          <>
            <Button size="lg" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="lg" variant="primary" onClick={() => void save()} busy={busy} icon={editing?.id ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}>
              {editing?.id ? "Save changes" : `Create ${meta.title.toLowerCase()}`}
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-5 py-1">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {meta.title} name <span className="text-red-500">*</span>
              </span>
              <input
                autoFocus
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                placeholder={level === "region" ? "e.g. Harare Region" : level === "district" ? "e.g. Harare District" : "e.g. Southerton Depot"}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20"
              />
            </label>
            {level !== "region" ? (
              <div className="space-y-1.5">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {level === "district" ? "Region" : "District"} <span className="text-red-500">*</span>
                </span>
                <RemoteSelect
                  kind={level === "district" ? "region" : "district"}
                  value={editing.parentId}
                  onChange={(id) => setEditing((cur) => (cur ? { ...cur, parentId: id } : cur))}
                  placeholder={level === "district" ? "Search and choose the region…" : "Search and choose the district…"}
                />
                <span className="block text-xs text-slate-500">
                  {level === "district" ? "Type to search; regions load as you scroll." : "Type a district or region name; districts load as you scroll."}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        icon={<Trash2 className="h-4 w-4" />}
        title={`Delete ${meta.title.toLowerCase()}?`}
        subtitle="This cannot be undone."
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void remove()} busy={busy}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <b>{deleting?.name}</b> will be removed.
          {deleting && deleting.transformers ? ` It still has ${deleting.transformers} transformers; move them to another depot first.` : ""}
        </p>
      </Dialog>
    </div>
  );
}
