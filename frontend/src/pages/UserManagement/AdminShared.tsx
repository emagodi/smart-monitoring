import type { ReactNode } from "react";
import { HeroStat, HeroStats, PageHero } from "../../components/ui/page";

interface StatsCardProps {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "purple" | "amber";
}


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
    <div className="space-y-4">
      <PageHero eyebrow={`Administration · ${title}`} title={title} subtitle={description} actions={actions}>
        {stats && stats.length > 0 ? (
          <HeroStats cols={stats.length >= 6 ? 6 : stats.length <= 3 ? 3 : (stats.length as 4 | 5)}>
            {stats.map((stat) => (
              <HeroStat key={stat.label} label={stat.label} value={typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value} tone={stat.tone === "green" ? "good" : stat.tone === "amber" ? "warn" : undefined} />
            ))}
          </HeroStats>
        ) : null}
      </PageHero>

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
