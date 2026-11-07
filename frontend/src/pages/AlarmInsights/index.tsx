import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, Download, FileSpreadsheet, Flame, Handshake, ShieldAlert, Timer, Wrench } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { cachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { BarsWithLine, ChartCard } from "../../components/charts/DashCharts";
import { Button, Chips, HeroStat, HeroStats, MobileFilters, Notice, PageHero, Panel, SelectBox, tableCls } from "../../components/ui/page";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import { usePartners } from "../Installations/components";
import { FAULT_TYPES } from "../Faults";
import { downloadTableCsv, downloadTablePdf, type ReportColumn } from "../../lib/tablePdf";
import HeatMap from "./HeatMap";

const API = (import.meta.env.VITE_API_BASE_URL || "") + "/api/v1/analytics/alerts";

type Stats = {
  alerts: number;
  realThreat: number;
  falseAlarm: number;
  technicalFault: number;
  authorised: number;
  otherOutcome: number;
  openCases: number;
  avgAckMinutes?: number | null;
  avgOnSceneMinutes?: number | null;
  ackWithin5: number;
};
type Point = Stats & { transformerId: number; transformerName: string; transformerNumber?: string; lat: number; lng: number; depotId?: number; supplierName?: string; lastAlertAt?: string };
type PartnerRow = Stats & { supplierCode: string; supplierName?: string | null; transformers: number };
type DepotRow = Stats & { depotId?: number | null; transformers: number };
type DayRow = Stats & { day: string };
type FaultRow = { supplierCode: string; supplierName?: string | null; faultType: string; faults: number; openFaults: number; avgHoursToFix?: number | null };
type Analytics = { from: string; to: string; totals: Stats; points: Point[]; byPartner: PartnerRow[]; byDepot: DepotRow[]; byDay: DayRow[]; topTransformers: Point[]; faults: FaultRow[] };

type Mode = "alerts" | "falseAlarm" | "realThreat" | "technicalFault" | "openCases";
const MODES: Array<{ value: Mode; label: string; color: string; dot: string }> = [
  { value: "alerts", label: "All alerts", color: "#dc2626", dot: "bg-red-600" },
  { value: "falseAlarm", label: "False alarms", color: "#d97706", dot: "bg-amber-500" },
  { value: "realThreat", label: "Real threats", color: "#7c3aed", dot: "bg-violet-600" },
  { value: "technicalFault", label: "Technical faults", color: "#0284c7", dot: "bg-sky-600" },
  { value: "openCases", label: "Still open", color: "#0f172a", dot: "bg-slate-800" },
];

const n = (v: unknown) => Number(v ?? 0);
const pct = (a: unknown, b: unknown) => (n(b) > 0 ? Math.round((n(a) / n(b)) * 100) : 0);
const isoDaysAgo = (d: number) => {
  const t = new Date(Date.now() - d * 86_400_000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

export default function AlarmInsights() {
  const { token, user } = useAuth();
  const { isPartner, isDepot } = useScope();
  const geo = useGeography(token);
  const partners = usePartners(token);
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [regionId, setRegionId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [partner, setPartner] = useState("");
  const [mode, setMode] = useState<Mode>("alerts");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const depotIds = useMemo(() => {
    if (depotId) return depotId;
    if (!regionId) return "";
    return geo.depots.filter((d) => geo.pathOf(d.id).regionId === Number(regionId)).map((d) => d.id).join(",");
  }, [depotId, regionId, geo]);

  useEffect(() => {
    if (!token) return;
    const qs = new URLSearchParams({ from, to });
    if (depotIds) qs.set("depotIds", depotIds);
    if (partner) qs.set("supplierCode", partner);
    setLoading(true);
    cachedGet<Analytics>(`${API}?${qs}`, token, 60_000)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(apiError(e, "Could not load alarm analytics.")))
      .finally(() => setLoading(false));
  }, [token, from, to, depotIds, partner]);

  const t = data?.totals;
  const m = MODES.find((x) => x.value === mode)!;
  const points = useMemo(
    () =>
      (data?.points ?? [])
        .map((p) => ({
          transformerId: p.transformerId,
          transformerName: p.transformerName,
          lat: Number(p.lat),
          lng: Number(p.lng),
          value: n(p[mode]),
          sub: `${n(p.alerts)} alerts · ${n(p.falseAlarm)} false · ${n(p.realThreat)} real${p.supplierName ? ` · ${displayPartner(p.supplierName)}` : ""}`,
        }))
        .filter((p) => p.value > 0),
    [data, mode]
  );
  const days = useMemo(() => (data?.byDay ?? []).map((d) => ({ day: d.day.slice(5), alerts: n(d.alerts), falseAlarm: n(d.falseAlarm) })), [data]);
  const partnerName = (r: { supplierCode: string; supplierName?: string | null }) => (r.supplierCode === "-" ? "No partner" : displayPartner(r.supplierName || r.supplierCode));
  const depotName = (id?: number | null) => (id ? geo.pathOf(id).depotName : "No depot");
  const filters: Array<[string, string]> = [
    ["Period", `${from} to ${to}`],
    ["Region", regionId ? geo.regions.find((r) => r.id === Number(regionId))?.name ?? "" : "All"],
    ["Depot", depotId ? depotName(Number(depotId)) : "All"],
    ["Partner", partner ? partners.find((p) => p[0] === partner)?.[1] ?? partner : isPartner ? "Mine" : "All"],
  ];
  const generatedBy = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "TAIS user";

  const partnerCols: Array<ReportColumn<PartnerRow>> = [
    { header: "Partner", value: partnerName, width: 46 },
    { header: "Transformers", value: (r) => n(r.transformers), align: "right" },
    { header: "Alerts", value: (r) => n(r.alerts), align: "right" },
    { header: "Real threats", value: (r) => n(r.realThreat), align: "right" },
    { header: "False alarms", value: (r) => n(r.falseAlarm), align: "right" },
    { header: "False %", value: (r) => `${pct(r.falseAlarm, n(r.alerts) - n(r.openCases))}%`, align: "right" },
    { header: "Technical faults", value: (r) => n(r.technicalFault), align: "right" },
    { header: "Authorised work", value: (r) => n(r.authorised), align: "right" },
    { header: "Still open", value: (r) => n(r.openCases), align: "right" },
    { header: "Avg ack (min)", value: (r) => r.avgAckMinutes ?? "—", align: "right" },
    { header: "Ack within 5 min", value: (r) => `${pct(r.ackWithin5, r.alerts)}%`, align: "right" },
  ];
  const exportPartners = (kind: "pdf" | "csv") => {
    const spec = {
      title: "Alarms & false alarms by partner",
      generatedBy,
      filters,
      fileName: "alarms-by-partner",
      columns: partnerCols,
      rows: data?.byPartner ?? [],
      tiles: t
        ? [
            { label: "Alerts", value: String(n(t.alerts)) },
            { label: "Real threats", value: String(n(t.realThreat)), color: [124, 58, 237] as [number, number, number] },
            { label: "False alarms", value: `${n(t.falseAlarm)} (${pct(t.falseAlarm, n(t.alerts) - n(t.openCases))}%)`, color: [217, 119, 6] as [number, number, number] },
            { label: "Technical faults", value: String(n(t.technicalFault)), color: [2, 132, 199] as [number, number, number] },
            { label: "Avg acknowledge", value: t.avgAckMinutes != null ? `${t.avgAckMinutes} min` : "—" },
          ]
        : [],
      footnote: "False % = false alarms / closed alerts. Outcomes are what the reaction team recorded when closing each incident.",
    };
    if (kind === "pdf") void downloadTablePdf(spec);
    else downloadTableCsv(spec);
  };

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Reaction · analytics"
        title="Alarm insights"
        subtitle="Where alarms happen, how they ended (real threat, false alarm, technical fault, authorised work), how each partner performs, and how fast the team reacts."
        actions={
          <>
            <Button icon={<FileSpreadsheet className="h-3.5 w-3.5" />} disabled={!data} onClick={() => exportPartners("csv")}>
              CSV
            </Button>
            <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} disabled={!data} onClick={() => exportPartners("pdf")}>
              Partner report PDF
            </Button>
          </>
        }
      >
        <HeroStats cols={6}>
          <HeroStat icon={<BellRing className="h-3.5 w-3.5" />} label="Alerts" value={n(t?.alerts)} loading={loading && !data} onClick={() => setMode("alerts")} active={mode === "alerts"} />
          <HeroStat icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Real threats" value={n(t?.realThreat)} tone="bad" loading={loading && !data} onClick={() => setMode("realThreat")} active={mode === "realThreat"} />
          <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="False alarms" value={n(t?.falseAlarm)} sub={t ? `${pct(t.falseAlarm, n(t.alerts) - n(t.openCases))}% of closed` : " "} tone="warn" loading={loading && !data} onClick={() => setMode("falseAlarm")} active={mode === "falseAlarm"} />
          <HeroStat icon={<Wrench className="h-3.5 w-3.5" />} label="Technical faults" value={n(t?.technicalFault)} loading={loading && !data} onClick={() => setMode("technicalFault")} active={mode === "technicalFault"} />
          <HeroStat icon={<Flame className="h-3.5 w-3.5" />} label="Still open" value={n(t?.openCases)} loading={loading && !data} onClick={() => setMode("openCases")} active={mode === "openCases"} />
          <HeroStat icon={<Timer className="h-3.5 w-3.5" />} label="Avg acknowledge" value={t?.avgAckMinutes != null ? `${t.avgAckMinutes} min` : "—"} sub={t ? `${pct(t.ackWithin5, t.alerts)}% within 5 min` : " "} loading={loading && !data} />
        </HeroStats>
      </PageHero>

      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}

      <Panel
        toolbar={
          <div className="flex w-full flex-col gap-2.5">
            <Chips value={mode} onChange={setMode} options={MODES.map((x) => ({ value: x.value, label: x.label, dot: x.dot, count: n(t?.[x.value]) }))} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                From
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
              </label>
              <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                To
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
              </label>
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => { setFrom(isoDaysAgo(d)); setTo(isoDaysAgo(0)); }} className="h-8 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300">
                  {d} days
                </button>
              ))}
              <MobileFilters active={[regionId, depotId, partner].filter(Boolean).length}>
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
        <div className="grid gap-4 p-4 xl:grid-cols-[1.6fr_1fr]">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} /> Heat map · {m.label.toLowerCase()} ({points.reduce((s, p) => s + p.value, 0)} at {points.length} transformers)
            </p>
            <HeatMap points={points} color={m.color} label={m.label.toLowerCase()} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Hottest transformers</p>
            <ol className="space-y-1.5">
              {(data?.topTransformers ?? [])
                .slice()
                .sort((a, b) => n(b[mode]) - n(a[mode]))
                .filter((r) => n(r[mode]) > 0)
                .slice(0, 10)
                .map((r, i) => {
                  const max = Math.max(1, ...(data?.topTransformers ?? []).map((x) => n(x[mode])));
                  return (
                    <li key={r.transformerId} className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                          {i + 1}. {r.transformerName}
                        </span>
                        <span className="shrink-0 font-bold" style={{ color: m.color }}>
                          {n(r[mode])}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-1.5 rounded-full" style={{ width: `${(n(r[mode]) / max) * 100}%`, background: m.color }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {depotName(r.depotId)} · {r.supplierName ? displayPartner(r.supplierName) : "—"} · {n(r.falseAlarm)} false of {n(r.alerts)}
                      </p>
                    </li>
                  );
                })}
              {data && !(data.topTransformers ?? []).some((r) => n(r[mode]) > 0) ? <li className="py-6 text-center text-sm text-slate-500">Nothing in this period.</li> : null}
            </ol>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Alerts per day" subtitle="Bars: all alerts · line: false alarms" icon={<BellRing className="h-4 w-4" />} height={260}>
          <BarsWithLine data={days} x="day" bar="alerts" line="falseAlarm" barName="Alerts" lineName="False alarms" />
        </ChartCard>
        <Panel title="Fault alarms by partner" icon={<Wrench className="h-4 w-4" />} subtitle="Equipment faults raised in the period, and how long partners take to fix them.">
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Partner</th>
                  <th className={tableCls.th}>Fault</th>
                  <th className={`${tableCls.th} text-right`}>Raised</th>
                  <th className={`${tableCls.th} text-right`}>Open</th>
                  <th className={`${tableCls.th} text-right`}>Avg fix</th>
                </tr>
              </thead>
              <tbody className={tableCls.tbody}>
                {(data?.faults ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No fault alarms in this period.
                    </td>
                  </tr>
                ) : (
                  (data?.faults ?? []).map((f, i) => (
                    <tr key={i} className={tableCls.tr}>
                      <td className={tableCls.td} data-label="Partner">{partnerName(f)}</td>
                      <td className={tableCls.td} data-label="Fault">{FAULT_TYPES[f.faultType] ?? f.faultType}</td>
                      <td className={`${tableCls.td} text-right`} data-label="Raised">{n(f.faults)}</td>
                      <td className={`${tableCls.td} text-right`} data-label="Open">{n(f.openFaults)}</td>
                      <td className={`${tableCls.td} text-right`} data-label="Avg fix">{f.avgHoursToFix != null ? `${f.avgHoursToFix} h` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="By partner" icon={<Handshake className="h-4 w-4" />} subtitle="False % is false alarms out of closed alerts. A high false rate points at device placement, sensitivity or tampering-prone sites.">
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                {partnerCols.map((c) => (
                  <th key={c.header} className={`${tableCls.th} ${c.align === "right" ? "text-right" : ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {(data?.byPartner ?? []).map((r) => {
                const fp = pct(r.falseAlarm, n(r.alerts) - n(r.openCases));
                return (
                  <tr key={r.supplierCode} className={tableCls.tr}>
                    {partnerCols.map((c) => (
                      <td key={c.header} className={`${tableCls.td} ${c.align === "right" ? "text-right tabular-nums" : "font-semibold"}`} data-label={c.header}>
                        {c.header === "False %" ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${fp >= 60 ? "bg-red-100 text-red-700" : fp >= 30 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{fp}%</span>
                        ) : (
                          c.value(r)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {data && data.byPartner.length === 0 ? (
                <tr>
                  <td colSpan={partnerCols.length} className="px-4 py-8 text-center text-sm text-slate-500">
                    No alerts in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="By depot" subtitle="Where alarms concentrate and how quickly each area's team acknowledges them.">
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Depot</th>
                <th className={`${tableCls.th} text-right`}>Alerts</th>
                <th className={`${tableCls.th} text-right`}>Real</th>
                <th className={`${tableCls.th} text-right`}>False</th>
                <th className={`${tableCls.th} text-right`}>Faults</th>
                <th className={`${tableCls.th} text-right`}>Open</th>
                <th className={`${tableCls.th} text-right`}>Avg ack</th>
                <th className={`${tableCls.th} text-right`}>Avg on site</th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {(data?.byDepot ?? []).map((r) => (
                <tr key={String(r.depotId)} className={tableCls.tr}>
                  <td className={`${tableCls.td} font-semibold`} data-label="Depot">
                    {depotName(r.depotId)}
                    <span className="block text-[11px] font-normal text-slate-500">{r.depotId ? geo.pathOf(r.depotId).regionName : ""}</span>
                  </td>
                  <td className={`${tableCls.td} text-right`} data-label="Alerts">{n(r.alerts)}</td>
                  <td className={`${tableCls.td} text-right`} data-label="Real">{n(r.realThreat)}</td>
                  <td className={`${tableCls.td} text-right`} data-label="False">{n(r.falseAlarm)}</td>
                  <td className={`${tableCls.td} text-right`} data-label="Faults">{n(r.technicalFault)}</td>
                  <td className={`${tableCls.td} text-right`} data-label="Open">{n(r.openCases)}</td>
                  <td className={`${tableCls.td} text-right`} data-label="Avg ack">{r.avgAckMinutes != null ? `${r.avgAckMinutes} min` : "—"}</td>
                  <td className={`${tableCls.td} text-right`} data-label="Avg on site">{r.avgOnSceneMinutes != null ? `${r.avgOnSceneMinutes} min` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
