/** SIM lifecycle states (server enum SimCardStatus) with the label, colours and meaning shown in the UI. */
export const SIM_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "ACTIVE",
  "SUSPENDED",
  "LOST",
  "DAMAGED",
  "EXPIRED",
  "DECOMMISSIONED",
  "RETIRED",
] as const;

export type SimStatus = (typeof SIM_STATUSES)[number];

export const SIM_STATUS: Record<SimStatus, { label: string; hint: string; pill: string; dot: string }> = {
  AVAILABLE: {
    label: "Available",
    hint: "Spare stock, ready to go into a gateway",
    pill: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30",
    dot: "bg-blue-500",
  },
  ASSIGNED: {
    label: "Assigned",
    hint: "Installed in a gateway",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    label: "Active",
    hint: "Live on the network",
    pill: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-500/30",
    dot: "bg-teal-500",
  },
  SUSPENDED: {
    label: "Suspended",
    hint: "Barred by the operator or by policy",
    pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
    dot: "bg-amber-500",
  },
  LOST: {
    label: "Lost",
    hint: "Lost or stolen",
    pill: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30",
    dot: "bg-red-500",
  },
  DAMAGED: {
    label: "Damaged",
    hint: "Physically damaged",
    pill: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30",
    dot: "bg-rose-500",
  },
  EXPIRED: {
    label: "Expired",
    hint: "Past its expiry date",
    pill: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-500/30",
    dot: "bg-orange-500",
  },
  DECOMMISSIONED: {
    label: "Decommissioned",
    hint: "Deactivated with the operator",
    pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    dot: "bg-slate-500",
  },
  RETIRED: {
    label: "Retired",
    hint: "Taken out of the inventory",
    pill: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
    dot: "bg-slate-400",
  },
};

export const simStatusMeta = (s?: string | null) => SIM_STATUS[(s || "").toUpperCase() as SimStatus] ?? SIM_STATUS.AVAILABLE;

/** Statuses that mean the SIM needs someone's attention. */
export const ATTENTION: SimStatus[] = ["SUSPENDED", "LOST", "DAMAGED", "EXPIRED"];
