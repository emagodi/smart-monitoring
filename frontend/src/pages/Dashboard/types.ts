/** GET /api/v1/transformers/stats: one small, cached roll-up for the caller's scope. */
export type EstateStats = {
  scope: "NATIONAL" | "PARTNER" | "DEPOT";
  scopeSupplierName?: string | null;
  scopeDepotId?: number | null;
  transformers: number;
  groundMounted: number;
  poleMounted: number;
  online: number;
  delayed: number;
  offline: number;
  neverSeen: number;
  noDevice: number;
  onlinePercent: number | null;
  armed: number;
  disarmed: number;
  armUnknown: number;
  openAlerts: number;
  transformersAlerting: number;
  unmatchedControllers: number;
  mapped: number;
  depotsCovered: number;
};

/** GET /api/v1/alerts/summary */
export type AlertSummary = {
  total: number;
  open: number;
  newCount: number;
  acknowledged: number;
  dispatched: number;
  enRoute: number;
  onScene: number;
  resolved: number;
  falseAlarm: number;
  unassigned: number;
  last24h: number;
  totalEvents: number;
  transformersWithOpenAlerts: number;
  monthly: Array<{ month: string; alerts: number; events: number }>;
  realThreats30d: number;
  falseAlarms30d: number;
  technicalFaults30d: number;
  avgAcknowledgeMinutes: number | null;
  avgDispatchMinutes: number | null;
  avgArrivalMinutes: number | null;
  avgCloseMinutes: number | null;
};

/** GET /api/v1/alerts/trends */
export type AlertTrends = {
  hourly: Array<{ hour: string; label: string; alerts: number }>;
  daily: Array<{ day: string; label: string; alerts: number; realThreats: number; falseAlarms: number }>;
  byType: Array<{ type: string; alerts: number }>;
  outcomes7d: { realThreats: number; falseAlarms: number; technicalFaults: number; resolvedOther: number };
  hotTransformers: Array<{ id: number; name: string; depotId: number | null; openAlerts: number; status: string }>;
  generatedAt: string;
};

/** One row of /api/v1/transformers/overview partners[] or depots[] */
export type OverviewRow = {
  supplierCode?: string;
  supplierName?: string;
  depotId?: number | null;
  transformers: number;
  online: number;
  offline: number;
  delayed: number;
  neverSeen: number;
  openAlerts: number;
  alerts24h: number;
  realThreats24h: number;
  armed: number;
  disarmed: number;
  onlinePercent: number | null;
};

export type Overview = { partners?: OverviewRow[]; depots?: OverviewRow[]; totals?: Record<string, number> };
