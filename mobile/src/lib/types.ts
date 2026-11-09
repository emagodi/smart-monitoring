export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType?: string;
  region?: string | null;
  district?: string | null;
  depot?: string | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  roles: string[];
  permissions: string[];
};

export type CaseStatus = 'NEW' | 'ACKNOWLEDGED' | 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'RESOLVED' | 'FALSE_ALARM';
export type Outcome = 'REAL_THREAT' | 'FALSE_ALARM' | 'TECHNICAL_FAULT' | 'AUTHORISED_ACTIVITY' | 'OTHER';

export type Alert = {
  id: number;
  message?: string | null;
  value?: string | null;
  isAlert?: boolean;
  transformerId?: number | null;
  transformerName?: string | null;
  transformerNumber?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  supplierName?: string | null;
  deviceName?: string | null;
  sensorType?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string | null;
  caseStatus?: CaseStatus | null;
  assignedToName?: string | null;
  acknowledgedAt?: string | null;
  dispatchedAt?: string | null;
  enRouteAt?: string | null;
  onSceneAt?: string | null;
  closedAt?: string | null;
  resolvedAt?: string | null;
  falseAlarmAt?: string | null;
  lastActionAt?: string | null;
  lastActionByName?: string | null;
  lastActionNote?: string | null;
  occurrenceCount?: number | null;
  lastSeenAt?: string | null;
  outcome?: Outcome | null;
  outcomeNote?: string | null;
  closedByName?: string | null;
};

export type Dispatch = {
  id: number;
  vehicleRegistration?: string | null;
  vehicleCallSign?: string | null;
  crewLeadName?: string | null;
  crewLeadPhone?: string | null;
  status: string;
  dispatchedAt?: string | null;
  onSceneAt?: string | null;
};

export type BoardCase = { alert: Alert; dispatches: Dispatch[] };
export type Board = { open: BoardCase[]; recentlyClosed: BoardCase[]; generatedAt?: string };

export type TimelineItem = {
  id: number;
  activityType: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  note?: string | null;
  createdAt?: string | null;
};

export type TStatus = 'ONLINE' | 'DELAYED' | 'OFFLINE' | 'NEVER_SEEN' | 'NO_DEVICE';

export type Transformer = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  type?: 'GROUND_MOUNTED' | 'POLE_MOUNTED' | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lat?: number | null;
  lng?: number | null;
  lastSignalAt?: string | null;
  minutesSinceSignal?: number | null;
  status: TStatus;
  controllerCount: number;
  controllerEuis: string[];
  reportedArmState?: 'ARMED' | 'DISARMED' | null;
  lastCommandAction?: string | null;
  lastCommandStatus?: string | null;
  lastCommandAt?: string | null;
  openAlerts: number;
  totalAlerts: number;
  lastAlertAt?: string | null;
  lastAlertMessage?: string | null;
};

export type TransformerPage = { content: Transformer[]; totalElements: number; counts?: Partial<Record<TStatus, number>> };

export type GStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'NEVER_SEEN' | 'UNKNOWN';

export type Gateway = {
  id: number;
  name: string;
  gatewayEui?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  effectiveStatus?: GStatus | null;
  loriotReportedStatus?: string | null;
  statusReason?: string | null;
  statusChangedAt?: string | null;
  lastLoriotSeenAt?: string | null;
  lastTrafficSeenAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  depotName?: string | null;
  regionName?: string | null;
  networkName?: string | null;
};

export type GatewayLink = {
  gatewayId: number;
  name: string;
  status?: GStatus | null;
  effectiveStatus?: GStatus | null;
  lastHeardAt?: string | null;
  rssi?: number | null;
  lastRssi?: number | null;
  snr?: number | null;
  lastSnr?: number | null;
  gatewayCount?: number;
  uplinks?: number | null;
};

export type GatewayTransformer = {
  transformerId: number;
  transformerName: string;
  transformerNumber?: string | null;
  depotId?: number | null;
  supplierName?: string | null;
  devEui?: string | null;
  lastHeardAt?: string | null;
  lastRssi?: number | null;
  lastSnr?: number | null;
  uplinks?: number | null;
  gatewaysHearing?: number | null;
  source: 'UPLINK' | 'MANUAL';
};

export type Fault = {
  id: number;
  transformerId: number;
  transformerName: string;
  transformerNumber?: string | null;
  depotId?: number | null;
  supplierName?: string | null;
  faultType: string;
  description?: string | null;
  status: 'OPEN' | 'RESOLVED';
  reportedBy?: string | null;
  reportedAt?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  suppressAlerts?: boolean | number | null;
  suppressedTriggers?: number | null;
  alertsClosed?: number | null;
};

export type Installation = {
  id: number;
  transformerId: number;
  transformerName: string;
  transformerNumber?: string | null;
  supplierName?: string | null;
  depotId?: number | null;
  status: 'INSTALLED' | 'READY' | 'SCHEDULED' | 'COMMISSIONED' | 'FAILED' | 'CANCELLED';
  installedOn?: string | null;
  readyAt?: string | null;
  tentativeDate?: string | null;
  commissionedAt?: string | null;
  failedAt?: string | null;
  attempts?: number | null;
  deviceEui?: string | null;
  lastAttemptStatus?: string | null;
  requestReference?: string | null;
};

export type Page<T> = { content: T[]; totalElements: number; counts?: Record<string, number> };

export type EstateStats = {
  transformers: number;
  online: number;
  delayed: number;
  offline: number;
  neverSeen: number;
  noDevice: number;
  onlinePercent: number | null;
  armed: number;
  disarmed: number;
  openAlerts: number;
  transformersAlerting: number;
};

export type AlertSummary = {
  open: number;
  newCount: number;
  last24h: number;
  realThreats30d: number;
  falseAlarms30d: number;
  technicalFaults30d: number;
  avgAcknowledgeMinutes: number | null;
  avgArrivalMinutes: number | null;
  avgCloseMinutes: number | null;
};

export type GatewaySummary = { total: number; online: number; offline: number; degraded: number; neverSeen: number; unknown: number };

export type DutyMe = { onDuty: boolean; depotIds: number[]; rosterConfigured: boolean };

export type Depot = { id: number; name: string };
