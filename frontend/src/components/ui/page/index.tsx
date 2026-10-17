/**
 * Page kit: the shared look for every screen (hero header, compact stats, panels, tables,
 * filters, pagination, status colours). Built from the Insights page so the whole system
 * reads as one product. Use these instead of hand-rolled cards on new or redesigned pages.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search, X } from "lucide-react";

// ------------------------------------------------------------------ hero

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-5 py-4 text-white shadow-[0_18px_40px_-24px_rgba(11,79,196,0.7)]">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">{eyebrow}</p>
          <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 max-w-3xl text-[13px] text-blue-100/80">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="relative mt-4">{children}</div> : null}
    </section>
  );
}

/** Grid for HeroStat tiles; columns adapt to how many tiles there are. */
export function HeroStats({ children, cols = 6 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 | 7 | 8 }) {
  const xl = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6", 7: "xl:grid-cols-7", 8: "xl:grid-cols-8" }[cols];
  return <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 ${xl}`}>{children}</div>;
}

export function HeroStat({
  icon,
  label,
  value,
  sub,
  to,
  loading,
  tone,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  to?: string;
  loading?: boolean;
  tone?: "good" | "bad" | "warn";
}) {
  const valueTone = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-white";
  const body = (
    <>
      <p className="flex items-center gap-1.5 truncate text-[11px] text-blue-100/75">
        {icon}
        {label}
      </p>
      {loading ? (
        <span className="mt-1.5 block h-5 w-14 animate-pulse rounded-md bg-white/15" />
      ) : (
        <p className={`mt-0.5 text-lg font-semibold leading-tight ${valueTone}`}>{value}</p>
      )}
      {sub ? <p className="truncate text-[11px] text-blue-100/60">{loading ? " " : sub}</p> : null}
    </>
  );
  const cls = "min-w-0 rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10";
  return to ? (
    <Link to={to} className={`${cls} transition hover:bg-white/[0.13]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function HeroButton({ onClick, children, busy, icon }: { onClick?: () => void; children: ReactNode; busy?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50"
    >
      {icon ?? <RefreshCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />}
      {children}
    </button>
  );
}

export function HeroLinkButton({ onClick, children, icon }: { onClick?: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
    >
      {icon}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ panels

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = "",
  toolbar,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
}) {
  return (
    <section className={`ui-panel overflow-hidden ${className}`}>
      {title || actions ? (
        <div className="flex flex-col gap-2 border-b border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="min-w-0">
            {title ? (
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {icon ? <span className="text-blue-600 dark:text-blue-400">{icon}</span> : null}
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {toolbar ? <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">{toolbar}</div> : null}
      {children}
    </section>
  );
}

export function Notice({ tone = "error", children, onClose }: { tone?: "error" | "info" | "success" | "warn"; children: ReactNode; onClose?: () => void }) {
  const cls = {
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  }[tone];
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm ${cls}`}>
      <div>{children}</div>
      {onClose ? (
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ buttons & inputs

export function Button({
  children,
  onClick,
  variant = "secondary",
  icon,
  busy,
  disabled,
  type = "button",
  size = "md",
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "sm" | "md" | "lg";
}) {
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  }[variant];
  const s = size === "sm" ? "px-2.5 py-1.5 text-[11px]" : size === "lg" ? "h-11 px-5 text-sm" : "px-3.5 py-2 text-xs";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${s} ${v}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`relative flex min-w-[200px] flex-1 items-center ${className}`}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="absolute right-2.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </label>
  );
}

export function SelectBox({
  value,
  onChange,
  children,
  label,
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <label className={`inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pl-3 pr-1 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      {label ? <span className="font-medium">{label}</span> : null}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 max-w-[220px] rounded-full bg-transparent pr-2 text-sm font-medium text-slate-800 outline-none dark:text-slate-100">
        {children}
      </select>
    </label>
  );
}

export function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number; dot?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
              on ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {o.dot ? <span className={`h-2 w-2 rounded-full ${o.dot}`} /> : null}
            {o.label}
            {o.count != null ? <span className={on ? "text-blue-100" : "text-slate-400"}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ tables

export const tableCls = {
  wrap: "overflow-x-auto",
  table: "w-full text-left text-[13px]",
  thead: "bg-slate-50/80 text-[11px] uppercase tracking-[0.1em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400",
  th: "px-4 py-2.5 font-semibold whitespace-nowrap",
  tbody: "divide-y divide-slate-100 dark:divide-slate-800",
  tr: "transition hover:bg-blue-50/40 dark:hover:bg-slate-900",
  td: "px-4 py-2.5 align-middle text-slate-700 dark:text-slate-200",
};

export type SortState<K extends string> = { key: K; dir: 1 | -1 };

export function SortTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  className = "",
}: {
  k: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  children: ReactNode;
  className?: string;
}) {
  const on = sort.key === k;
  const Icon = on ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`${tableCls.th} ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase ${on ? "text-blue-700 dark:text-blue-300" : ""}`}>
        {children}
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

/** Toggle helper: same column flips direction, a new column starts descending (ascending for text). */
export const nextSort = <K extends string>(cur: SortState<K>, key: K, textKeys: K[] = []): SortState<K> =>
  cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: textKeys.includes(key) ? 1 : -1 };

export const compareBy = <T,>(get: (row: T) => string | number | null | undefined, dir: 1 | -1) => (a: T, b: T) => {
  const x = get(a);
  const y = get(b);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * dir;
  return (x < y ? -1 : x > y ? 1 : 0) * dir;
};

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div className="ui-skeleton h-3.5" style={{ width: `${c === 0 ? 70 : 40 + ((r * 7 + c * 13) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [10, 25, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  sizes?: number[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const nums: Array<number | "…"> = [];
  for (let i = 0; i < pages; i++) {
    if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200/80 px-4 py-2.5 text-xs text-slate-500 sm:flex-row dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span>
          Showing <b className="text-slate-700 dark:text-slate-200">{from.toLocaleString()}–{to.toLocaleString()}</b> of {total.toLocaleString()}
        </span>
        {onPageSize ? (
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              className={`h-7 min-w-7 rounded-full px-2 font-semibold ${n === page ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              {n + 1}
            </button>
          )
        )}
        <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ status colours (reserved meaning)

export type HealthCounts = { online: number; delayed: number; offline: number; neverSeen: number; noDevice: number; transformers?: number };

export const STATUS_SEGMENTS: Array<{ key: keyof HealthCounts; label: string; color: string; hex: string }> = [
  { key: "online", label: "Online", color: "bg-emerald-500", hex: "#10b981" },
  { key: "delayed", label: "Delayed", color: "bg-amber-500", hex: "#f59e0b" },
  { key: "offline", label: "Offline", color: "bg-red-500", hex: "#ef4444" },
  { key: "neverSeen", label: "Never seen", color: "bg-slate-400", hex: "#94a3b8" },
  { key: "noDevice", label: "No device", color: "bg-slate-200 dark:bg-slate-700", hex: "#cbd5e1" },
];

export const STATUS_META: Record<string, { label: string; dot: string; pill: string; hex: string }> = {
  ONLINE: { label: "Online", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", hex: "#10b981" },
  DELAYED: { label: "Delayed", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30", hex: "#f59e0b" },
  OFFLINE: { label: "Offline", dot: "bg-red-500", pill: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30", hex: "#ef4444" },
  NEVER_SEEN: { label: "Never seen", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700", hex: "#94a3b8" },
  NO_DEVICE: { label: "No device", dot: "bg-slate-300", pill: "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700", hex: "#cbd5e1" },
};

export function StatusPill({ status }: { status?: string | null }) {
  const m = STATUS_META[String(status || "NO_DEVICE")] ?? STATUS_META.NO_DEVICE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function StatusBar({ b, thin }: { b: HealthCounts; thin?: boolean }) {
  const total = Math.max(b.transformers ?? STATUS_SEGMENTS.reduce((s, x) => s + (b[x.key] ?? 0), 0), 1);
  return (
    <div className={`flex ${thin ? "h-2" : "h-2.5"} w-full gap-[2px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800`}>
      {STATUS_SEGMENTS.map((s) => {
        const n = b[s.key] ?? 0;
        return n > 0 ? <div key={String(s.key)} className={`${s.color} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(n / total) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
      })}
    </div>
  );
}

/** "82%" + bar: online share of transformers that have a device. */
export function HealthCell({ b, percent }: { b: HealthCounts; percent?: number | null }) {
  return (
    <div className="flex min-w-[160px] items-center gap-2">
      <span className="w-10 text-right font-semibold text-slate-800 dark:text-slate-100">{percent == null ? "—" : `${percent}%`}</span>
      <div className="flex-1">
        <StatusBar b={b} thin />
      </div>
    </div>
  );
}

export function StatusLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 text-[11px] text-slate-500 ${className}`}>
      {STATUS_SEGMENTS.map((s) => (
        <span key={String(s.key)} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${s.color}`} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function CountBadge({ n, to, tone = "red" }: { n: number; to?: string; tone?: "red" | "amber" }) {
  if (!n) return <span className="text-slate-400">0</span>;
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
  const body = <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${cls}`}>{n.toLocaleString()}</span>;
  return to ? <Link to={to}>{body}</Link> : body;
}

export const fmtNum = (n?: number | null) => (n == null ? "—" : n.toLocaleString());
export const fmtPct = (n?: number | null) => (n == null ? "—" : `${n}%`);

export const timeAgo = (iso?: string | null) => {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

// ------------------------------------------------------------------ dialog

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-start gap-3">
            {icon ? <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">{icon}</span> : null}
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
              {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20";
