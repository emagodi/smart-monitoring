import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { cachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { Button, Chips, EmptyRow, HeroStat, HeroStats, MobileFilters, Notice, PageHero, Pager, Panel, SearchBox, SelectBox, SkeletonRows, tableCls } from "../../components/ui/page";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import { usePartners } from "../Installations/components";
import { STATUS_META, daysBetween, fmtDate, fmtDateTime, who, type InstallStatus, type Installation } from "../Installations/shared";
import { FAULT_TYPES, type Fault } from "../Faults";
import { downloadTableCsv, downloadTablePdf, type ReportColumn } from "../../lib/tablePdf";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

type Paged<T> = { content: T[]; totalElements: number; counts?: Record<string, number> };

type Config<T> = {
  eyebrow: string;
  title: string;
  subtitle: string;
  fileName: string;
  endpoint: string;
  statuses: Array<{ value: string; label: string; dot?: string }>;
  defaultStatus?: string;
  statusParam?: string;
  dateFields?: Array<{ value: string; label: string }>;
  columns: (ctx: Ctx) => Array<ReportColumn<T> & { render?: (row: T) => ReactNode; partnerOnly?: boolean }>;
  tiles: (rows: T[], counts: Record<string, number>) => Array<{ label: string; value: string; color?: [number, number, number]; tone?: "good" | "bad" | "warn" }>;
  footnote?: string;
};

type Ctx = { depotName: (id?: number | null) => string; regionName: (id?: number | null) => string };

function TableReport<T extends { id: number }>({ cfg }: { cfg: Config<T> }) {
  const { token, user } = useAuth();
  const { isPartner, isDepot } = useScope();
  const geo = useGeography(token);
  const partners = usePartners(token);
  const [status, setStatus] = useState(cfg.defaultStatus ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateField, setDateField] = useState(cfg.dateFields?.[0]?.value ?? "");
  const [regionId, setRegionId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [partner, setPartner] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<T[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [busy, setBusy] = useState(false);

  const depotIds = useMemo(() => {
    if (depotId) return depotId;
    if (!regionId) return "";
    return geo.depots.filter((d) => geo.pathOf(d.id).regionId === Number(regionId)).map((d) => d.id).join(",");
  }, [depotId, regionId, geo]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ page: "0", size: "5000" });
      if (status) qs.set(cfg.statusParam ?? "status", status);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (dateField) qs.set("dateField", dateField);
      if (depotIds) qs.set("depotIds", depotIds);
      if (partner) qs.set("supplierCode", partner);
      if (q.trim()) qs.set("q", q.trim());
      setLoading(true);
      cachedGet<Paged<T>>(`${BASE}${cfg.endpoint}?${qs}`, token, 30_000)
        .then((r) => {
          setRows(r?.content ?? []);
          setCounts(r?.counts ?? {});
          setError(null);
          setPage(0);
        })
        .catch((e) => setError(apiError(e, "Could not load the report.")))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [token, status, from, to, dateField, depotIds, partner, q, cfg.endpoint, cfg.statusParam]);

  const ctx: Ctx = { depotName: (id) => (id ? geo.pathOf(id).depotName : "—"), regionName: (id) => (id ? geo.pathOf(id).regionName : "") };
  const cols = cfg.columns(ctx).filter((c) => !(isPartner && c.partnerOnly));
  const tiles = cfg.tiles(rows, counts);
  const filters: Array<[string, string]> = [
    ["Status", cfg.statuses.find((s) => s.value === status)?.label ?? "All"],
    ["Dates", from || to ? `${cfg.dateFields?.find((d) => d.value === dateField)?.label ?? ""} ${from || "start"} to ${to || "today"}`.trim() : "All"],
    ["Region", regionId ? geo.regions.find((r) => r.id === Number(regionId))?.name ?? "" : "All"],
    ["Depot", depotId ? ctx.depotName(Number(depotId)) : "All"],
    ["Partner", partner ? partners.find((p) => p[0] === partner)?.[1] ?? partner : isPartner ? "Mine" : "All"],
    ...(q.trim() ? ([["Search", `"${q.trim()}"`]] as Array<[string, string]>) : []),
  ];
  const generatedBy = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "TAIS user";
  const exportAs = async (kind: "pdf" | "csv") => {
    setBusy(true);
    try {
      const spec = { title: cfg.title, generatedBy, filters, fileName: cfg.fileName, columns: cols, rows, tiles, footnote: cfg.footnote };
      if (kind === "pdf") await downloadTablePdf(spec);
      else downloadTableCsv(spec);
    } finally {
      setBusy(false);
    }
  };
  const pageRows = rows.slice(page * size, (page + 1) * size);

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <>
            <Button icon={<FileSpreadsheet className="h-3.5 w-3.5" />} disabled={loading || busy} onClick={() => void exportAs("csv")}>
              CSV
            </Button>
            <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} busy={busy} disabled={loading} onClick={() => void exportAs("pdf")}>
              Download PDF
            </Button>
          </>
        }
      >
        <HeroStats cols={tiles.length >= 6 ? 6 : tiles.length >= 5 ? 5 : 4}>
          {tiles.map((t) => (
            <HeroStat key={t.label} label={t.label} value={t.value} tone={t.tone} loading={loading && !rows.length} />
          ))}
        </HeroStats>
      </PageHero>
      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      <Panel
        subtitle={loading ? "Loading…" : `${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"} will be in the report`}
        toolbar={
          <div className="flex w-full flex-col gap-2.5">
            <Chips value={status} onChange={setStatus} options={cfg.statuses.map((s) => ({ ...s, count: s.value ? counts[s.value] : undefined }))} />
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder="Transformer, number…" className="max-w-xs" />
              <MobileFilters active={[from, to, regionId, depotId, partner].filter(Boolean).length}>
                {cfg.dateFields?.length ? (
                  <SelectBox label="Date" value={dateField} onChange={setDateField}>
                    {cfg.dateFields.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  From
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
                </label>
                <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  To
                  <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
                </label>
                {!isDepot && !isPartner ? (
                  <SelectBox label="Region" value={regionId} onChange={(v) => { setRegionId(v); setDepotId(""); }}>
                    <option value="">All</option>
                    {geo.regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                {!isDepot ? (
                  <SelectBox label="Depot" value={depotId} onChange={setDepotId}>
                    <option value="">All</option>
                    {geo.depots
                      .filter((d) => !regionId || geo.pathOf(d.id).regionId === Number(regionId))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </SelectBox>
                ) : null}
                {!isPartner ? (
                  <SelectBox label="Partner" value={partner} onChange={setPartner}>
                    <option value="">All</option>
                    {partners.map(([c, nm]) => (
                      <option key={c} value={c}>
                        {nm}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
              </MobileFilters>
            </div>
          </div>
        }
      >
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                {cols.map((c) => (
                  <th key={c.header} className={`${tableCls.th} ${c.align === "right" ? "text-right" : ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading && !rows.length ? (
                <SkeletonRows rows={6} cols={cols.length} />
              ) : !pageRows.length ? (
                <EmptyRow cols={cols.length}>Nothing matches these filters.</EmptyRow>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className={tableCls.tr}>
                    {cols.map((c) => (
                      <td key={c.header} className={`${tableCls.td} ${c.align === "right" ? "text-right tabular-nums" : ""}`} data-label={c.header}>
                        {c.render ? c.render(r) : (c.value(r) ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 ? <Pager page={page} pageSize={size} total={rows.length} onPage={setPage} onPageSize={(s) => { setSize(s); setPage(0); }} /> : null}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ installations

const pill = (status: InstallStatus) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[status]?.pill ?? ""}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status]?.dot ?? ""}`} />
    {STATUS_META[status]?.short ?? status}
  </span>
);

const installationsCfg: Config<Installation> = {
  eyebrow: "Reports · installation",
  title: "Installations report",
  subtitle: "Which partner installed on which transformer and when, and where each site is in the commissioning process.",
  fileName: "installations-report",
  endpoint: "/api/v1/lifecycle/installations",
  statuses: [
    { value: "", label: "All" },
    ...(["INSTALLED", "READY", "SCHEDULED", "FAILED", "COMMISSIONED", "CANCELLED"] as InstallStatus[]).map((s) => ({ value: s, label: STATUS_META[s].short, dot: STATUS_META[s].dot })),
  ],
  dateFields: [
    { value: "installed", label: "Installed" },
    { value: "ready", label: "Ready" },
    { value: "tentative", label: "Tentative date" },
    { value: "commissioned", label: "Commissioned" },
  ],
  columns: (ctx) => [
    { header: "Transformer", value: (r) => r.transformerName, width: 42, render: (r) => <span><b className="text-slate-900 dark:text-slate-100">{r.transformerName}</b><span className="block text-[11px] text-slate-500">{r.transformerNumber ? `No. ${r.transformerNumber}` : ""}</span></span> },
    { header: "No.", value: (r) => r.transformerNumber, width: 16 },
    { header: "Partner", value: (r) => displayPartner(r.supplierName ?? r.supplierCode), partnerOnly: true },
    { header: "Depot", value: (r) => ctx.depotName(r.depotId) },
    { header: "Region", value: (r) => ctx.regionName(r.depotId) },
    { header: "Green light", value: (r) => r.requestReference },
    { header: "Installed", value: (r) => fmtDate(r.installedOn) },
    { header: "Ready", value: (r) => (r.readyAt ? fmtDate(r.readyAt) : null) },
    { header: "Tentative", value: (r) => (r.tentativeDate ? fmtDate(r.tentativeDate) : null) },
    { header: "Status", value: (r) => STATUS_META[r.status]?.label ?? r.status, render: (r) => pill(r.status) },
    { header: "Attempts", value: (r) => r.attempts, align: "right" },
    { header: "Commissioned", value: (r) => (r.commissionedAt ? fmtDate(r.commissionedAt) : null) },
    { header: "Days to commission", value: (r) => (r.commissionedAt ? daysBetween(r.installedOn, r.commissionedAt) : null), align: "right" },
  ],
  tiles: (rows) => {
    const c = (s: InstallStatus) => rows.filter((r) => r.status === s).length;
    const done = rows.filter((r) => r.commissionedAt);
    const avg = done.length ? Math.round(done.reduce((s, r) => s + (daysBetween(r.installedOn, r.commissionedAt) ?? 0), 0) / done.length) : null;
    return [
      { label: "Installations", value: String(rows.length) },
      { label: "Ready / scheduled", value: String(c("READY") + c("SCHEDULED")), tone: "warn" },
      { label: "Failed, to retest", value: String(c("FAILED")), tone: "bad", color: [220, 38, 38] },
      { label: "Commissioned", value: String(c("COMMISSIONED")), tone: "good", color: [5, 150, 105] },
      { label: "Avg days to commission", value: avg == null ? "—" : String(avg) },
    ];
  },
  footnote: "Status as at generation. Days to commission = installed date to final Loss Control pass.",
};

// ------------------------------------------------------------------ commissioning attempts

type AttemptRow = {
  id: number;
  installationId: number;
  attemptNo: number;
  status: "DRAFT" | "PASSED" | "FAILED";
  testDate?: string;
  ssNumber?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  transformerName: string;
  transformerNumber?: string;
  supplierCode?: string;
  supplierName?: string;
  depotId?: number;
  installedOn?: string;
  totalAttempts?: number;
};

const commissioningCfg: Config<AttemptRow> = {
  eyebrow: "Reports · commissioning",
  title: "Commissioning attempts report",
  subtitle: "Every PAT commissioning attempt with its result, who decided it and why. Failed attempts show what must be fixed before the next one.",
  fileName: "commissioning-report",
  endpoint: "/api/v1/lifecycle/commissioning",
  statusParam: "result",
  statuses: [
    { value: "", label: "All" },
    { value: "PASSED", label: "Passed", dot: "bg-emerald-500" },
    { value: "FAILED", label: "Failed", dot: "bg-red-500" },
    { value: "DRAFT", label: "In progress", dot: "bg-slate-400" },
  ],
  columns: (ctx) => [
    { header: "Transformer", value: (r) => r.transformerName, width: 42 },
    { header: "No.", value: (r) => r.transformerNumber, width: 16 },
    { header: "Partner", value: (r) => displayPartner(r.supplierName ?? r.supplierCode), partnerOnly: true },
    { header: "Depot", value: (r) => ctx.depotName(r.depotId) },
    { header: "Attempt", value: (r) => `${r.attemptNo} of ${r.totalAttempts ?? r.attemptNo}`, align: "right" },
    { header: "Test date", value: (r) => fmtDate(r.testDate) },
    {
      header: "Result",
      value: (r) => (r.status === "PASSED" ? "Passed" : r.status === "FAILED" ? "Failed" : "In progress"),
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "PASSED" ? "bg-emerald-100 text-emerald-700" : r.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
          {r.status === "PASSED" ? "Passed" : r.status === "FAILED" ? "Failed" : "In progress"}
        </span>
      ),
    },
    { header: "Decided by", value: (r) => (r.decidedBy ? who(r.decidedBy) : null) },
    { header: "Decided", value: (r) => (r.decidedAt ? fmtDateTime(r.decidedAt) : null) },
    { header: "Reason / note", value: (r) => r.decisionNote, width: 60 },
  ],
  tiles: (rows) => {
    const passed = rows.filter((r) => r.status === "PASSED").length;
    const failed = rows.filter((r) => r.status === "FAILED").length;
    const firstTime = rows.filter((r) => r.status === "PASSED" && r.attemptNo === 1).length;
    return [
      { label: "Attempts", value: String(rows.length) },
      { label: "Passed", value: String(passed), tone: "good", color: [5, 150, 105] },
      { label: "Failed", value: String(failed), tone: "bad", color: [220, 38, 38] },
      { label: "Pass rate", value: passed + failed ? `${Math.round((passed / (passed + failed)) * 100)}%` : "—" },
      { label: "First-time pass", value: passed ? `${Math.round((firstTime / passed) * 100)}%` : "—" },
    ];
  },
};

// ------------------------------------------------------------------ fault alarms

const faultsCfg: Config<Fault> = {
  eyebrow: "Reports · fault alarms",
  title: "Fault alarms report",
  subtitle: "Equipment faults per transformer and partner: what failed, when it was raised and how long it took to fix.",
  fileName: "fault-alarms-report",
  endpoint: "/api/v1/faults",
  defaultStatus: "ALL",
  statuses: [
    { value: "ALL", label: "All" },
    { value: "OPEN", label: "Open", dot: "bg-red-500" },
    { value: "RESOLVED", label: "Fixed", dot: "bg-emerald-500" },
  ],
  columns: (ctx) => [
    { header: "Transformer", value: (r) => r.transformerName, width: 42 },
    { header: "No.", value: (r) => r.transformerNumber, width: 16 },
    { header: "Partner", value: (r) => displayPartner(r.supplierName ?? r.supplierCode), partnerOnly: true },
    { header: "Depot", value: (r) => ctx.depotName(r.depotId) },
    { header: "Fault", value: (r) => FAULT_TYPES[r.faultType] ?? r.faultType },
    { header: "Details", value: (r) => r.description, width: 60 },
    { header: "Raised", value: (r) => fmtDateTime(r.reportedAt) },
    { header: "Status", value: (r) => (r.status === "OPEN" ? "Open" : "Fixed") },
    { header: "Fixed", value: (r) => (r.resolvedAt ? fmtDateTime(r.resolvedAt) : null) },
    { header: "Hours", value: (r) => r.ageHours, align: "right" },
  ],
  tiles: (rows) => {
    const open = rows.filter((r) => r.status === "OPEN").length;
    const fixed = rows.filter((r) => r.status === "RESOLVED");
    const avg = fixed.length ? Math.round(fixed.reduce((s, r) => s + (r.ageHours ?? 0), 0) / fixed.length) : null;
    return [
      { label: "Fault alarms", value: String(rows.length) },
      { label: "Open", value: String(open), tone: "bad", color: [220, 38, 38] },
      { label: "Fixed", value: String(fixed.length), tone: "good", color: [5, 150, 105] },
      { label: "Avg hours to fix", value: avg == null ? "—" : String(avg) },
    ];
  },
};

export const InstallationsReport = () => <TableReport cfg={installationsCfg} />;
export const CommissioningReport = () => <TableReport cfg={commissioningCfg} />;
export const FaultsReport = () => <TableReport cfg={faultsCfg} />;
