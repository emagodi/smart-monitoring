/**
 * Dashboard chart kit (Recharts). One look for every dashboard card: thin bars with rounded
 * data ends, recessive grid, hover tooltips, legends for 2+ series, colours by role:
 *  - series blue for volume, red only for threats / critical, status colours keep their meaning
 *    (green online, amber delayed, red offline, grey never seen).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const C = {
  blue: "#2a78d6",
  blueSoft: "#93c0f0",
  red: "#e34948",
  orange: "#eb6834",
  aqua: "#1baf7a",
  violet: "#6250d6",
  yellow: "#eda100",
  magenta: "#e87ba4",
  slate: "#94a3b8",
  slateLight: "#cbd5e1",
  // status (reserved meaning)
  online: "#10b981",
  delayed: "#f59e0b",
  offline: "#ef4444",
  never: "#94a3b8",
};

const axis = { fontSize: 11, fill: "#64748b" };

// ------------------------------------------------------------------ card shell

export function ChartCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  height = 240,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number | null;
}) {
  return (
    <section className={`ui-panel flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-3.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {icon ? <span className="text-blue-600 dark:text-blue-400">{icon}</span> : null}
            {title}
          </h3>
          {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex-1 px-2 pb-3" style={height ? { height } : undefined}>
        {children}
      </div>
    </section>
  );
}

function TipBox({ label, rows }: { label?: ReactNode; rows: Array<{ name: string; value: ReactNode; color: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {label ? <p className="mb-1 font-semibold text-slate-800 dark:text-slate-100">{label}</p> : null}
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
          {r.name}: <b className="text-slate-900 dark:text-slate-100">{r.value}</b>
        </p>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; label?: ReactNode; payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tip = (raw: any) => {
  const p = raw as TipProps;
  return p.active && p.payload?.length ? (
    <TipBox label={p.label} rows={p.payload.map((x) => ({ name: String(x.name ?? ""), value: (x.value ?? 0).toLocaleString(), color: String(x.color ?? C.blue) }))} />
    ) : null;
};

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: ReactNode }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] text-slate-600 dark:text-slate-300">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value != null ? <b className="text-slate-900 dark:text-slate-100">{i.value}</b> : null}
        </span>
      ))}
    </div>
  );
}

export function Empty({ children = "Nothing to show yet." }: { children?: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-400">{children}</div>;
}

// ------------------------------------------------------------------ charts

/** Vertical bars, one series (e.g. alerts per hour). */
export function Bars({ data, x, y, name, color = C.blue, highlightLast }: { data: Array<Record<string, unknown>>; x: string; y: string; name: string; color?: string; highlightLast?: boolean }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap={3}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="0" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip content={tip} cursor={{ fill: "rgba(42,120,214,0.08)" }} />
        <Bar dataKey={y} name={name} radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((_, i) => (
            <Cell key={i} fill={highlightLast && i === data.length - 1 ? C.red : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Volume bars with a threat line on the same scale (alerts and real threats per day). */
export function BarsWithLine({ data, x, bar, line, barName, lineName }: { data: Array<Record<string, unknown>>; x: string; bar: string; line: string; barName: string; lineName: string }) {
  if (!data.length) return <Empty />;
  return (
    <div className="flex h-full flex-col">
      <Legend items={[{ label: barName, color: C.blue }, { label: lineName, color: C.red }]} />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="dashBarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.blue} stopOpacity={0.95} />
                <stop offset="100%" stopColor={C.blue} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} />
            <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip content={tip} cursor={{ fill: "rgba(42,120,214,0.08)" }} />
            <Bar dataKey={bar} name={barName} fill="url(#dashBarFill)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Line dataKey={line} name={lineName} stroke={C.red} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Smooth area (e.g. monthly alerts). */
export function AreaTrend({ data, x, y, name }: { data: Array<Record<string, unknown>>; x: string; y: string; name: string }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
            <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip content={tip} />
        <Area dataKey={y} name={name} stroke={C.blue} strokeWidth={2} fill="url(#dashArea)" type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Donut with the total in the middle and a labelled legend (identity never by colour alone). */
export function Donut({ data, centerLabel, onSlice }: { data: Array<{ name: string; value: number; color: string; to?: string }>; centerLabel: string; onSlice?: (name: string) => void }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  return (
    <div className="flex h-full items-center gap-3">
      <div className="relative h-full min-h-[150px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={(raw: unknown) => { const p = raw as TipProps; return (p.active && p.payload?.length ? <TipBox rows={[{ name: String(p.payload[0].name), value: `${p.payload[0].value?.toLocaleString()} (${Math.round(((p.payload[0].value ?? 0) / total) * 100)}%)`, color: String((p.payload[0].payload as { color?: string })?.color ?? C.blue) }]} /> : null); }} />
            <Pie
              data={data.filter((d) => d.value > 0)}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="var(--donut-gap, #fff)"
              strokeWidth={2}
              onClick={(d: { name?: string }) => onSlice && d?.name && onSlice(d.name)}
              cursor={onSlice ? "pointer" : undefined}
            >
              {data
                .filter((d) => d.value > 0)
                .map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{total.toLocaleString()}</span>
          <span className="text-[11px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-[46%] space-y-1.5 text-xs">
        {data.map((d) => {
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                <span className="truncate text-slate-600 dark:text-slate-300">{d.name}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                {d.value.toLocaleString()} <span className="font-normal text-slate-400">{Math.round((d.value / total) * 100)}%</span>
              </span>
            </>
          );
          return (
            <li key={d.name}>
              {d.to ? (
                <Link to={d.to} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-2 px-1.5 py-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Horizontal ranked bars (top depots, partners). Values are labelled at the bar end. */
export function RankBars({ data, unit = "", color = C.blue, max }: { data: Array<{ name: string; value: number; to?: string; sub?: string; color?: string }>; unit?: string; color?: string; max?: number }) {
  if (!data.length) return <Empty />;
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5 px-2 pt-1">
      {data.map((d) => {
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                {d.name}
                {d.sub ? <span className="ml-1 text-[11px] font-normal text-slate-400">{d.sub}</span> : null}
              </span>
              <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                {d.value.toLocaleString()}
                {unit}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, (d.value / top) * 100)}%`, background: d.color ?? color }} />
            </div>
          </>
        );
        return (
          <li key={d.name}>
            {d.to ? (
              <Link to={d.to} className="block rounded-lg px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                {row}
              </Link>
            ) : (
              <div className="px-1 py-0.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Stage pipeline (open incidents by stage) as stacked chips with counts. */
export function Pipeline({ stages }: { stages: Array<{ name: string; value: number; color: string; to?: string }> }) {
  const total = Math.max(1, stages.reduce((s, x) => s + x.value, 0));
  return (
    <div className="space-y-3 px-2 pt-2">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {stages.map((s) => (s.value ? <div key={s.name} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full first:rounded-l-full last:rounded-r-full" title={`${s.name}: ${s.value}`} /> : null))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stages.map((s) => {
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{s.value.toLocaleString()}</span>
            </>
          );
          return s.to ? (
            <Link key={s.name} to={s.to} className="flex flex-col rounded-xl bg-slate-50 px-3 py-2 transition hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-800">
              {body}
            </Link>
          ) : (
            <div key={s.name} className="flex flex-col rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
