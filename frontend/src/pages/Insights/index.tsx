import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowDownUp, Building2, Cpu, Gauge, Loader2, RefreshCcw, ShieldAlert, Siren, Truck, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, useGeography } from "../Registry/geo";

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
  alerts30d: number;
  realThreats30d: number;
  falseAlarms30d: number;
  technicalFaults30d: number;
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

// Status palette (reserved meaning) — always shown with a text label and legend.
const SEGMENTS: Array<{ key: keyof Block; label: string; color: string }> = [
  { key: "online", label: "Online", color: "bg-emerald-500" },
  { key: "delayed", label: "Delayed", color: "bg-amber-500" },
  { key: "offline", label: "Offline", color: "bg-red-500" },
  { key: "neverSeen", label: "Never seen", color: "bg-slate-400" },
  { key: "noDevice", label: "No device", color: "bg-slate-200 dark:bg-slate-700" },
];

type DepotSort = "openAlerts" | "transformers" | "onlinePercent" | "offline" | "alerts30d" | "realThreats30d" | "avgArrivalMinutes" | "name";

export default function Insights() {
  const { token } = useAuth();
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const geo = useGeography(token);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: DepotSort; dir: 1 | -1 }>({ key: "openAlerts", dir: -1 });
  const [regionId, setRegionId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/overview`, { headers });
      setData(res.data as Overview);
      setError(null);
    } catch {
      setError("Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

  const depotRows = useMemo(() => {
    if (!data) return [];
    const rows = data.depots
      .map((d) => ({ ...d, path: geo.pathOf(d.depotId) }))
      .filter((d) => !regionId || String(d.path.regionId) === regionId);
    const v = (d: (typeof rows)[number]) => (sort.key === "name" ? d.path.depotName : (d[sort.key] as number | null) ?? -1);
    return rows.sort((a, b) => {
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [data, geo, regionId, sort]);

  const t = data?.totals;
  const title =
    data?.scope === "PARTNER"
      ? `${data.scopeSupplierName || "Partner"} portal`
      : data?.scope === "DEPOT"
        ? `${geo.pathOf(data.scopeDepotId).depotName} depot`
        : "National overview";
  const subtitle =
    data?.scope === "PARTNER"
      ? "Only the ZESA transformers your devices monitor, wherever they are."
      : data?.scope === "DEPOT"
        ? "Transformers, incidents and vehicles for your depot."
        : "ZESA estate across all monitoring partners: who covers what, how healthy it is, and how incidents end.";

  const sortBy = (key: DepotSort) => setSort((c) => ({ key, dir: c.key === key ? (c.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }));

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] p-5 text-white">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">Insights</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-blue-100/80">{subtitle}</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-900">
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        {t ? (
          <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Hero icon={<Zap className="h-4 w-4" />} label="Transformers" value={t.transformers} sub={`${t.groundMounted} GMT · ${t.poleMounted} PMT`} />
            <Hero icon={<Gauge className="h-4 w-4 text-emerald-300" />} label="Online" value={t.onlinePercent == null ? "—" : `${t.onlinePercent}%`} sub={`${t.online} online · ${t.offline} offline`} />
            <Hero icon={<Siren className="h-4 w-4 text-red-300" />} label="Open incidents" value={t.openAlerts} sub={`${t.alerts30d} alerts in 30 days`} />
            <Hero icon={<ShieldAlert className="h-4 w-4 text-amber-300" />} label="Real threats · 30d" value={t.realThreats30d} sub={t.falseAlarmPercent == null ? "No closed incidents" : `${t.falseAlarmPercent}% false alarms`} />
            <Hero icon={<Truck className="h-4 w-4" />} label="Avg time to arrive" value={t.avgArrivalMinutes == null ? "—" : `${Math.round(t.avgArrivalMinutes)} min`} sub="detection → crew on scene" />
            <Hero icon={<Cpu className="h-4 w-4 text-amber-300" />} label="Unmatched devices" value={t.unmatchedControllers} sub="waiting for a transformer" link="/transformers?tab=unmatched" />
          </div>
        ) : null}
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading && !data ? (
        <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" /> Building overview…
        </div>
      ) : null}

      {data ? (
        <>
          {/* Partner comparison */}
          <section className="space-y-2">
            <div className="flex items-end justify-between px-1">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data.scope === "PARTNER" ? "Your coverage" : "Monitoring partners compared"}</h2>
                <p className="text-xs text-slate-500">Device health, incidents and how they ended over the last 30 days.</p>
              </div>
              <Legend />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.partners.map((p) => (
                <div key={p.supplierCode} className="enterprise-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-bold uppercase text-white">
                        {(p.supplierName || "?").slice(0, 2)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.supplierName}</p>
                        <p className="text-[11px] text-slate-500">
                          {p.transformers} transformers · {p.controllers} devices
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{p.onlinePercent == null ? "—" : `${p.onlinePercent}%`}</p>
                      <p className="text-[11px] text-slate-500">online</p>
                    </div>
                  </div>
                  <StatusBar b={p} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Open incidents" value={p.openAlerts} tone={p.openAlerts ? "text-red-600" : undefined} />
                    <Mini label="Real threats 30d" value={p.realThreats30d} />
                    <Mini label="False alarm %" value={p.falseAlarmPercent == null ? "—" : `${p.falseAlarmPercent}%`} />
                    <Mini label="Alerts 30d" value={p.alerts30d} />
                    <Mini label="Avg arrival" value={p.avgArrivalMinutes == null ? "—" : `${Math.round(p.avgArrivalMinutes)}m`} />
                    <Mini label="Unmatched" value={p.unmatchedControllers} tone={p.unmatchedControllers ? "text-amber-600" : undefined} />
                  </div>
                  <Link to={`/transformers?partner=${p.supplierCode}`} className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline">
                    View transformers →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Depot view */}
          <section className="enterprise-card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Building2 className="h-4 w-4 text-blue-600" /> Depots
                </h2>
                <p className="text-xs text-slate-500">Where incidents happen and how fast crews get there. Sorted by open incidents.</p>
              </div>
              {data.scope === "NATIONAL" ? (
                <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="enterprise-chip px-3 py-2 text-sm outline-none dark:text-slate-100">
                  <option value="">All regions</option>
                  {geo.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.1em] text-slate-500 dark:bg-slate-900/60">
                  <tr>
                    <Th k="name" s={sort} on={sortBy}>Depot</Th>
                    <Th k="transformers" s={sort} on={sortBy}>Transformers</Th>
                    <Th k="onlinePercent" s={sort} on={sortBy}>Device health</Th>
                    <Th k="openAlerts" s={sort} on={sortBy}>Open</Th>
                    <Th k="alerts30d" s={sort} on={sortBy}>Alerts 30d</Th>
                    <Th k="realThreats30d" s={sort} on={sortBy}>Real threats</Th>
                    <Th k="avgArrivalMinutes" s={sort} on={sortBy}>Avg arrival</Th>
                    {data.scope !== "PARTNER" ? <th className="px-4 py-3">Vehicles</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {depotRows.map((d) => (
                    <tr key={d.depotId ?? -1} className="hover:bg-blue-50/40 dark:hover:bg-slate-900">
                      <td className="px-4 py-3">
                        <Link to={d.depotId ? `/transformers?depot=${d.depotId}` : "/transformers"} className="font-semibold text-slate-900 hover:text-blue-700 dark:text-slate-100">
                          {d.path.depotName}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {d.path.regionName} › {d.path.districtName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{d.transformers}</td>
                      <td className="w-[220px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right font-semibold text-slate-800 dark:text-slate-100">{d.onlinePercent == null ? "—" : `${d.onlinePercent}%`}</span>
                          <div className="flex-1">
                            <StatusBar b={d} thin />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.openAlerts ? (
                          <Link to="/response" className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
                            {d.openAlerts}
                          </Link>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{d.alerts30d}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {d.realThreats30d}
                        {d.falseAlarmPercent != null ? <span className="ml-1 text-[11px] text-slate-400">({d.falseAlarmPercent}% false)</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{d.avgArrivalMinutes == null ? "—" : `${Math.round(d.avgArrivalMinutes)} min`}</td>
                      {data.scope !== "PARTNER" ? (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
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
                  {depotRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                        No depots in this view.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatusBar({ b, thin }: { b: Block; thin?: boolean }) {
  const total = Math.max(b.transformers, 1);
  return (
    <div className={`${thin ? "" : "mt-3"} flex ${thin ? "h-2" : "h-2.5"} w-full gap-[2px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800`}>
      {SEGMENTS.map((s) => {
        const n = b[s.key] as number;
        return n > 0 ? <div key={String(s.key)} className={`${s.color} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(n / total) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden flex-wrap gap-3 text-[11px] text-slate-500 md:flex">
      {SEGMENTS.map((s) => (
        <span key={String(s.key)} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${s.color}`} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Hero({ icon, label, value, sub, link }: { icon: ReactNode; label: string; value: ReactNode; sub: string; link?: string }) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[11px] text-blue-100/75">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-blue-100/65">{sub}</p>
    </>
  );
  return link ? (
    <Link to={link} className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">{body}</div>
  );
}

function Mini({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-900">
      <p className={`text-sm font-semibold ${tone || "text-slate-900 dark:text-slate-100"}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function Th({ k, s, on, children }: { k: DepotSort; s: { key: DepotSort; dir: number }; on: (k: DepotSort) => void; children: ReactNode }) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button type="button" onClick={() => on(k)} className={`inline-flex items-center gap-1 uppercase ${s.key === k ? "text-blue-700 dark:text-blue-300" : ""}`}>
        {children}
        <ArrowDownUp className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}
