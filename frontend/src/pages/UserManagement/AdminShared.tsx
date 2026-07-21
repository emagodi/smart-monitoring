import type { ReactNode } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

interface StatsCardProps {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "purple" | "amber";
}

const toneClasses: Record<NonNullable<StatsCardProps["tone"]>, string> = {
  blue: "from-blue-500/10 to-blue-50 text-blue-700",
  green: "from-emerald-500/10 to-emerald-50 text-emerald-700",
  purple: "from-violet-500/10 to-violet-50 text-violet-700",
  amber: "from-amber-500/10 to-amber-50 text-amber-700",
};

export const AdminShell = ({
  title,
  description,
  actions,
  stats,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  stats?: StatsCardProps[];
  children: ReactNode;
}) => {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageBreadcrumb pageTitle={title} />

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:bg-white/5 dark:text-gray-400">
              Enterprise Workspace
            </span>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white lg:text-[28px]">
                {title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-2.5 lg:justify-end">{actions}</div> : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl border border-slate-200/80 bg-gradient-to-br px-4 py-4 shadow-sm dark:border-gray-800 ${toneClasses[stat.tone ?? "blue"]}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {stat.label}
                </p>
                <p className="mt-2.5 text-2xl font-semibold tracking-tight">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
};

export const ToolbarCard = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    {children}
  </div>
);

export const DataCard = ({ children }: { children: ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    {children}
  </div>
);

export const EmptyState = ({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <div className="rounded-2xl bg-gray-100 p-3 dark:bg-gray-800">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gray-400">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h3>
    <p className="max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">{message}</p>
    {action}
  </div>
);
