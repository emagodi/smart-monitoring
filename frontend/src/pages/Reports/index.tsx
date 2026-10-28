import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileSpreadsheet, FileText, MapPin, MapPinOff, RefreshCw, Router, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { Button, Chips, EmptyRow, HeroStat, HeroStats, MobileFilters, Notice, PageHero, Pager, Panel, SearchBox, SelectBox, SkeletonRows, tableCls } from "../../components/ui/page";
import {
  STATUS_INFO,
  coordsOf,
  countByStatus,
  downloadGatewayCsv,
  downloadGatewayPdf,
  fmtAgo,
  fmtCoord,
  fmtDateTime,
  lastSeenOf,
  loadAllGateways,
  mapsUrl,
  statusOf,
  type GatewayStatus,
  type ReportGateway,
} from "./gatewayReport";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type StatusFilter = GatewayStatus | "ALL";
type LocationFilter = "ALL" | "YES" | "NO";

const REPORTS = [
  {
    id: "gateways",
    title: "Gateway locations & status",
    description: "Every gateway with its coordinates (latitude / longitude) and whether it is online or offline right now.",
    icon: <Router className="h-5 w-5" />,
    formats: ["PDF", "CSV"],
  },
] as const;

export default function ReportsPage() {
  const { token, user } = useAuth();
  const { isDepot } = useScope();

  const [rows, setRows] = useState<ReportGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [region, setRegion] = useState("ALL");
  const [depot, setDepot] = useState("ALL");
  const [location, setLocation] = useState<LocationFilter>("ALL");
  const [includeDecommissioned, setIncludeDecommissioned] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  useEffect(() => {
    if (!token) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    loadAllGateways(API_BASE_URL, token, ctrl.signal)
      .then((list) => {
        setRows(list);
        setLoadedAt(new Date());
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        console.error(e);
        setError("Could not load gateways. Check your connection and try again.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [token, reloadKey]);

  const active = useMemo(() => (includeDecommissioned ? rows : rows.filter((g) => !g.decommissioned)), [rows, includeDecommissioned]);

  const regions = useMemo(() => [...new Set(active.map((g) => g.regionName).filter(Boolean) as string[])].sort(), [active]);
  const depots = useMemo(
    () => [...new Set(active.filter((g) => region === "ALL" || g.regionName === region).map((g) => g.depotName).filter(Boolean) as string[])].sort(),
    [active, region]
  );

  // Everything except the status filter: used for the status chip counts.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return active.filter((g) => {
      if (region !== "ALL" && g.regionName !== region) return false;
      if (depot !== "ALL" && g.depotName !== depot) return false;
      if (location === "YES" && !coordsOf(g)) return false;
      if (location === "NO" && coordsOf(g)) return false;
      if (q && ![g.name, g.gatewayEui, g.loriotGatewayId, g.depotName, g.regionName].some((v) => v && v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [active, region, depot, location, search]);

  const filtered = useMemo(() => {
    const list = status === "ALL" ? scoped : scoped.filter((g) => statusOf(g) === status);
    return list.slice().sort((a, b) => (a.regionName || "~").localeCompare(b.regionName || "~") || (a.depotName || "~").localeCompare(b.depotName || "~") || (a.name || "").localeCompare(b.name || ""));
  }, [scoped, status]);

  const counts = useMemo(() => countByStatus(scoped), [scoped]);
  const allCounts = useMemo(() => countByStatus(active), [active]);
  const noLocation = useMemo(() => active.filter((g) => !coordsOf(g)).length, [active]);

  useEffect(() => setPage(0), [status, region, depot, location, search, includeDecommissioned, pageSize]);
  useEffect(() => {
    if (depot !== "ALL" && !depots.includes(depot)) setDepot("ALL");
  }, [depots, depot]);

  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const generatedBy = useMemo(() => {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return name || user?.email || user?.username || "TAIS user";
  }, [user]);

  const filterSummary = useMemo<Array<[string, string]>>(
    () => [
      ["Status", status === "ALL" ? "All" : STATUS_INFO[status].label],
      ["Region", region === "ALL" ? "All" : region],
      ["Depot", depot === "ALL" ? "All" : depot],
      ["Location", location === "ALL" ? "All" : location === "YES" ? "With coordinates" : "Without coordinates"],
      ...(search.trim() ? ([["Search", `"${search.trim()}"`]] as Array<[string, string]>) : []),
      ...(includeDecommissioned ? ([["Decommissioned", "Included"]] as Array<[string, string]>) : []),
    ],
    [status, region, depot, location, search, includeDecommissioned]
  );

  const pdf = useCallback(async () => {
    setBusy("pdf");
    setError(null);
    try {
      await downloadGatewayPdf(filtered, { generatedBy, filters: filterSummary });
    } catch (e) {
      console.error(e);
      setError("The PDF could not be created. Please try again.");
    } finally {
      setBusy(null);
    }
  }, [filtered, generatedBy, filterSummary]);

  const csv = useCallback(() => {
    setBusy("csv");
    try {
      downloadGatewayCsv(filtered);
    } finally {
      setBusy(null);
    }
  }, [filtered]);

  const activeFilters = [region !== "ALL", depot !== "ALL", location !== "ALL", includeDecommissioned].filter(Boolean).length;
  const statusOptions: Array<{ value: StatusFilter; label: string; count?: number; dot?: string }> = [
    { value: "ALL", label: "All", count: scoped.length },
    ...(Object.keys(STATUS_INFO) as GatewayStatus[])
      .filter((s) => s === "ONLINE" || s === "OFFLINE" || counts[s] > 0 || status === s)
      .map((s) => ({ value: s, label: STATUS_INFO[s].label, count: counts[s], dot: STATUS_INFO[s].dot })),
  ];

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Reports"
        title="Reports"
        subtitle="Choose a report, narrow it down with the filters, and download it as a PDF (or CSV for Excel). Reports use live data at the moment you download."
        actions={
          <Button icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
            Refresh data
          </Button>
        }
      >
        <HeroStats cols={4}>
          <HeroStat icon={<Router className="h-3.5 w-3.5" />} label="Gateways" value={active.length.toLocaleString()} sub={loadedAt ? `Updated ${fmtAgo(loadedAt.toISOString())}` : " "} loading={loading} onClick={() => setStatus("ALL")} active={status === "ALL"} />
          <HeroStat icon={<Wifi className="h-3.5 w-3.5" />} label="Online" value={allCounts.ONLINE.toLocaleString()} tone="good" sub={active.length ? `${Math.round((allCounts.ONLINE / active.length) * 100)}% of fleet` : " "} loading={loading} onClick={() => setStatus("ONLINE")} active={status === "ONLINE"} />
          <HeroStat icon={<WifiOff className="h-3.5 w-3.5" />} label="Offline" value={allCounts.OFFLINE.toLocaleString()} tone="bad" sub={active.length ? `${Math.round((allCounts.OFFLINE / active.length) * 100)}% of fleet` : " "} loading={loading} onClick={() => setStatus("OFFLINE")} active={status === "OFFLINE"} />
          <HeroStat icon={<MapPinOff className="h-3.5 w-3.5" />} label="No coordinates" value={noLocation.toLocaleString()} tone={noLocation ? "warn" : undefined} sub="missing lat / long" loading={loading} onClick={() => setLocation(location === "NO" ? "ALL" : "NO")} active={location === "NO"} />
        </HeroStats>
      </PageHero>

      {/* report catalogue */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.id} className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-4 ring-2 ring-blue-500/20 dark:border-blue-500/30 dark:from-slate-900 dark:to-blue-950/30">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0a2a6b] to-[#0b4fc4] text-white shadow-sm shadow-blue-600/30">{r.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{r.description}</p>
                <div className="mt-2 flex gap-1.5">
                  {r.formats.map((f) => (
                    <span key={f} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">Selected</span>
          </div>
        ))}
      </div>

      {error ? (
        <Notice tone="error" onClose={() => setError(null)}>
          {error}
        </Notice>
      ) : null}

      <Panel
        title="Gateway locations & status"
        icon={<FileText className="h-4 w-4" />}
        subtitle={
          loading ? "Loading gateways…" : `${filtered.length.toLocaleString()} gateway${filtered.length === 1 ? "" : "s"} will be in the report${status !== "ALL" || activeFilters || search.trim() ? " (filtered)" : ""}`
        }
        actions={
          <>
            <Button size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={csv} busy={busy === "csv"} disabled={loading || !!busy || filtered.length === 0}>
              CSV
            </Button>
            <Button size="sm" variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={pdf} busy={busy === "pdf"} disabled={loading || !!busy}>
              {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </>
        }
        toolbar={
          <div className="flex w-full flex-col gap-2.5">
            <Chips value={status} onChange={setStatus} options={statusOptions} />
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={search} onChange={setSearch} placeholder="Search gateway, EUI, depot…" className="max-w-sm" />
              <MobileFilters active={activeFilters}>
                {!isDepot ? (
                  <SelectBox label="Region" value={region} onChange={setRegion}>
                    <option value="ALL">All regions</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                {!isDepot ? (
                  <SelectBox label="Depot" value={depot} onChange={setDepot}>
                    <option value="ALL">All depots</option>
                    {depots.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                <SelectBox label="Location" value={location} onChange={(v) => setLocation(v as LocationFilter)}>
                  <option value="ALL">All</option>
                  <option value="YES">With coordinates</option>
                  <option value="NO">Without coordinates</option>
                </SelectBox>
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <input type="checkbox" checked={includeDecommissioned} onChange={(e) => setIncludeDecommissioned(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
                  Include decommissioned
                </label>
              </MobileFilters>
            </div>
          </div>
        }
      >
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Gateway</th>
                <th className={tableCls.th}>Region / depot</th>
                <th className={tableCls.th}>Coordinates</th>
                <th className={tableCls.th}>Status</th>
                <th className={tableCls.th}>Last seen</th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading ? (
                <SkeletonRows rows={pageSize > 10 ? 10 : pageSize} cols={5} />
              ) : pageRows.length === 0 ? (
                <EmptyRow cols={5}>No gateways match these filters.</EmptyRow>
              ) : (
                pageRows.map((g) => {
                  const c = coordsOf(g);
                  const s = statusOf(g);
                  const seen = lastSeenOf(g);
                  return (
                    <tr key={g.id} className={tableCls.tr}>
                      <td className={tableCls.td} data-label="Gateway">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{g.name || `Gateway ${g.id}`}</p>
                        <p className="font-mono text-[11px] text-slate-500">{g.gatewayEui || g.loriotGatewayId || "—"}</p>
                      </td>
                      <td className={tableCls.td} data-label="Region / depot">
                        <p>{g.depotName || "—"}</p>
                        <p className="text-[11px] text-slate-500">{g.regionName || "No region"}</p>
                      </td>
                      <td className={tableCls.td} data-label="Coordinates">
                        {c ? (
                          <a href={mapsUrl(c)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-blue-700 hover:underline dark:text-blue-300">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {fmtCoord(c.lat)}, {fmtCoord(c.lng)}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs italic text-amber-700 dark:text-amber-400">
                            <MapPinOff className="h-3.5 w-3.5" /> No location
                          </span>
                        )}
                      </td>
                      <td className={tableCls.td} data-label="Status">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_INFO[s].pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_INFO[s].dot}`} />
                          {STATUS_INFO[s].label}
                        </span>
                      </td>
                      <td className={tableCls.td} data-label="Last seen">
                        <p className="whitespace-nowrap text-xs">{fmtDateTime(seen)}</p>
                        {seen ? <p className="text-[11px] text-slate-500">{fmtAgo(seen)}</p> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 ? <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} /> : null}
      </Panel>
    </div>
  );
}
