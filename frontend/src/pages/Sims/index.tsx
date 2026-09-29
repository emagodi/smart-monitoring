import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Router,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CardSim,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../../components/ui/modal";
import { SimModal } from "./SimModal";

type SimStatus = "ACTIVE" | "INACTIVE" | "ASSIGNED" | "UNASSIGNED" | "SUSPENDED";

interface SimCardItem {
  id: number;
  iccid: string;
  imsi?: string | null;
  msisdn?: string | null;
  maskedMsisdn?: string | null;
  pin: string;
  puk: string;
  operator?: string | null;
  networkName?: string | null;
  status: SimStatus;
  slotNumber?: number | null;
  assignedGatewayId?: number | null;
  assignedGatewayName?: string | null;
  assignedAt?: string | null;
  unassignedAt?: string | null;
  activatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface GatewayPickerItem {
  id: number;
  name: string;
  regionName?: string | null;
  depotName?: string | null;
  effectiveStatus?: string | null;
}

type PagePayload<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return [];
};

const normalizePage = <T,>(payload: unknown) => {
  const obj = payload as PagePayload<T> | null;
  const items = normalizeList<T>(payload);
  return {
    items,
    totalElements: typeof obj?.totalElements === "number" ? obj.totalElements : items.length,
    totalPages: typeof obj?.totalPages === "number" ? obj.totalPages : 1,
    page: typeof obj?.number === "number" ? obj.number : 0,
    size: typeof obj?.size === "number" ? obj.size : items.length || 25,
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const looksAlreadyMasked = (value?: string | null) =>
  typeof value === "string" && value.length > 0 && value.includes("*");

const maskIccid = (iccid?: string | null) => {
  if (looksAlreadyMasked(iccid)) return iccid as string;
  if (!iccid) return "************0000";
  if (iccid.length <= 4) return `************${iccid}`;
  return `************${iccid.slice(-4)}`;
};

const maskImsi = (imsi?: string | null) => {
  if (looksAlreadyMasked(imsi)) return imsi as string;
  if (!imsi) return "********0000";
  if (imsi.length <= 4) return `********${imsi}`;
  return `********${imsi.slice(-4)}`;
};

const maskMsisdn = (msisdn?: string | null, fallback?: string | null) => {
  const value = msisdn || fallback;
  if (looksAlreadyMasked(value)) return value as string;
  if (!value) return "****0000";
  if (value.length <= 4) return `****${value}`;
  return `****${value.slice(-4)}`;
};

const statusTone = (status: SimStatus) => {
  switch (status) {
    case "ACTIVE":
    case "ASSIGNED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "SUSPENDED":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300";
    case "INACTIVE":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
};

const statusLabel = (status: SimStatus) => {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "ASSIGNED":
      return "Assigned";
    case "UNASSIGNED":
      return "Unassigned";
    case "SUSPENDED":
      return "Suspended";
    default:
      return status;
  }
};

const STATUS_FILTERS: Array<{ value: SimStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  highlight,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: ReactNode;
  highlight?: "blue" | "red" | "emerald" | "amber" | "neutral" | "slate";
}) => {
  const hl = highlight || "neutral";
  const valueTone =
    hl === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : hl === "red"
        ? "text-red-600 dark:text-red-300"
        : hl === "emerald"
          ? "text-emerald-600 dark:text-emerald-300"
          : hl === "amber"
            ? "text-amber-600 dark:text-amber-300"
            : hl === "slate"
              ? "text-slate-600 dark:text-slate-300"
              : "text-slate-950 dark:text-slate-50";
  const iconTone =
    hl === "red"
      ? "border border-red-100 bg-red-50/90 text-red-600 dark:border-red-500/10 dark:bg-red-500/10 dark:text-red-300"
      : hl === "emerald"
        ? "border border-emerald-100 bg-emerald-50/80 text-emerald-600 dark:border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300"
        : hl === "amber"
          ? "border border-amber-100 bg-amber-50/80 text-amber-600 dark:border-amber-500/10 dark:bg-amber-500/10 dark:text-amber-300"
          : hl === "slate"
            ? "border border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            : "border border-blue-100 bg-blue-50/80 text-blue-600 dark:border-blue-500/10 dark:bg-blue-500/10 dark:text-blue-300";
  return (
    <div className="enterprise-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={`mt-2 text-[28px] font-semibold tracking-tight ${valueTone}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="mt-1.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${iconTone}`}>{icon}</div>
      </div>
    </div>
  );
};

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-xs text-slate-700 dark:text-slate-200 ${className}`}>{children}</td>;
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
        active
          ? "border-blue-200 bg-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

export default function SimsIndex() {
  const { token, hasPermission } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  const [items, setItems] = useState<SimCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SimStatus | "ALL">("ALL");
  const [selectedOperator, setSelectedOperator] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [revealingSimId, setRevealingSimId] = useState<number | null>(null);
  const [revealedMap, setRevealedMap] = useState<Map<number, { pin: string; puk: string; iccid: string; imsi?: string | null; msisdn?: string | null }>>(new Map());
  const [visibleFieldsMap, setVisibleFieldsMap] = useState<Map<number, Set<string>>>(new Map());

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [assignTargetSim, setAssignTargetSim] = useState<SimCardItem | null>(null);
  const [unassignTargetSim, setUnassignTargetSim] = useState<SimCardItem | null>(null);
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | null>(null);
  const [assignSlot, setAssignSlot] = useState<number>(1);
  const [assignReason, setAssignReason] = useState("");
  const [unassignReason, setUnassignReason] = useState("");
  const [gatewayPickerLoading, setGatewayPickerLoading] = useState(false);
  const [gatewayPickerItems, setGatewayPickerItems] = useState<GatewayPickerItem[]>([]);
  const [gatewayPickerSearch, setGatewayPickerSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canViewSensitive = hasPermission("sims.view_sensitive");
  const canAssign = hasPermission("sims.assign");
  const canUnassign = hasPermission("sims.unassign");
  const canCreateSim = hasPermission("sims.create");
  const canEditSim = hasPermission("sims.edit");

  const [createSimModalOpen, setCreateSimModalOpen] = useState(false);
  const [editSimModalOpen, setEditSimModalOpen] = useState(false);
  const [simModalTarget, setSimModalTarget] = useState<SimCardItem | null>(null);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const openCreateSimModal = () => {
    setSimModalTarget(null);
    setCreateSimModalOpen(true);
  };

  const openEditSimModal = (item: SimCardItem) => {
    setSimModalTarget(item);
    setEditSimModalOpen(true);
  };

  const closeSimModals = () => {
    setCreateSimModalOpen(false);
    setEditSimModalOpen(false);
    setSimModalTarget(null);
  };

  const retireSim = async (id: number) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/sim-cards/${id}`, { headers });
      await fetchSims();
    } catch (e) {
      console.error(e);
      setError("Failed to retire SIM.");
    }
  };

  const fetchSims = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = { page, size: pageSize };
      const lifecycleFilter = ["ASSIGNED", "UNASSIGNED"].includes(statusFilter) ? "ALL" : statusFilter;
      if (lifecycleFilter !== "ALL") params.status = lifecycleFilter;
      if (selectedOperator !== "ALL") params.operator = selectedOperator;
      if (search.trim()) params.search = search.trim();

      const response = await axios.get(`${API_BASE_URL}/api/v1/sim-cards`, { headers, params });
      const normalized = normalizePage<SimCardItem>(response.data);
      setItems(normalized.items);
      setTotalElements(normalized.totalElements);
      setTotalPages(Math.max(normalized.totalPages, 1));
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load SIM card inventory.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, token, page, pageSize, statusFilter, selectedOperator, search]);

  const visibleItems = useMemo(() => {
    if (statusFilter === "ASSIGNED") return items.filter((i) => Boolean(i.assignedGatewayId));
    if (statusFilter === "UNASSIGNED") return items.filter((i) => !i.assignedGatewayId);
    return items;
  }, [items, statusFilter]);

  const effectiveTotal = useMemo(() => {
    if (statusFilter === "ASSIGNED" || statusFilter === "UNASSIGNED") return visibleItems.length;
    return totalElements;
  }, [statusFilter, visibleItems.length, totalElements]);

  useEffect(() => {
    if (token) {
      void fetchSims();
    }
  }, [fetchSims, token]);

  const totals = useMemo(() => {
    const summary = {
      total: totalElements,
      assigned: 0,
      unassigned: 0,
      active: 0,
      suspended: 0,
      inactive: 0,
    };
    items.forEach((item) => {
      if (item.status === "ASSIGNED" || item.assignedGatewayId) summary.assigned += 1;
      if (!item.assignedGatewayId) summary.unassigned += 1;
      if (item.status === "ACTIVE") summary.active += 1;
      if (item.status === "SUSPENDED") summary.suspended += 1;
      if (item.status === "INACTIVE") summary.inactive += 1;
    });
    return summary;
  }, [items, totalElements]);

  const operatorOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.operator) set.add(item.operator);
    });
    return [...set].sort();
  }, [items]);

  const openAssignModal = async (sim: SimCardItem) => {
    setAssignTargetSim(sim);
    setSelectedGatewayId(null);
    setAssignSlot(sim.slotNumber || 1);
    setAssignReason("");
    setGatewayPickerItems([]);
    setGatewayPickerSearch("");
    setAssignModalOpen(true);
    try {
      setGatewayPickerLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/v1/gateways`, {
        headers,
        params: { page: 0, size: 500 },
      });
      setGatewayPickerItems(normalizeList<GatewayPickerItem>(response.data));
    } catch (gatewayError) {
      console.error(gatewayError);
      setGatewayPickerItems([]);
    } finally {
      setGatewayPickerLoading(false);
    }
  };

  const openUnassignModal = (sim: SimCardItem) => {
    setUnassignTargetSim(sim);
    setUnassignReason("");
    setUnassignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignTargetSim(null);
    setSelectedGatewayId(null);
    setAssignReason("");
    setGatewayPickerItems([]);
    setGatewayPickerSearch("");
  };

  const closeUnassignModal = () => {
    setUnassignModalOpen(false);
    setUnassignTargetSim(null);
    setUnassignReason("");
  };

  const submitAssign = async () => {
    if (!assignTargetSim || !selectedGatewayId) return;
    try {
      setSubmitting(true);
      await axios.post(
        `${API_BASE_URL}/api/v1/gateways/${selectedGatewayId}/sims/assign`,
        {
          simId: assignTargetSim.id,
          slotNumber: assignSlot,
          reason: assignReason || "Operator assigned SIM",
        },
        { headers }
      );
      closeAssignModal();
      await fetchSims();
    } catch (assignError) {
      console.error(assignError);
      setError("Failed to assign SIM card.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitUnassign = async () => {
    if (!unassignTargetSim) return;
    try {
      setSubmitting(true);
      await axios.post(
        `${API_BASE_URL}/api/v1/sim-cards/${unassignTargetSim.id}/unassign`,
        { reason: unassignReason || "Operator unassigned SIM" },
        { headers }
      );
      closeUnassignModal();
      await fetchSims();
    } catch (unassignError) {
      console.error(unassignError);
      setError("Failed to unassign SIM card.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRevealed = (simId: number) => revealedMap.get(simId) || null;

  const isFieldVisible = (simId: number, field: string) => {
    const fields = visibleFieldsMap.get(simId);
    return fields?.has(field) ?? false;
  };

  const clearAllRevealed = () => {
    setRevealedMap(new Map());
    setVisibleFieldsMap(new Map());
  };

  const clearRevealedForSim = (simId: number | null | undefined) => {
    if (!simId) {
      clearAllRevealed();
      return;
    }
    setRevealedMap((prev) => {
      const next = new Map(prev);
      next.delete(simId);
      return next;
    });
    setVisibleFieldsMap((prev) => {
      const next = new Map(prev);
      next.delete(simId);
      return next;
    });
  };

  const toggleFieldVisible = (simId: number, field: string) => {
    setVisibleFieldsMap((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(simId) ?? []);
      if (set.has(field)) set.delete(field);
      else set.add(field);
      next.set(simId, set);
      return next;
    });
  };

  const inlineToggleReveal = async (sim: SimCardItem, field: string) => {
    const alreadyRevealed = getRevealed(sim.id);
    const currentlyVisible = isFieldVisible(sim.id, field);

    if (alreadyRevealed) {
      toggleFieldVisible(sim.id, field);
      return;
    }

    if (currentlyVisible) {
      toggleFieldVisible(sim.id, field);
      return;
    }

    if (!canViewSensitive) return;

    try {
      setRevealingSimId(sim.id);
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/sim-cards/${sim.id}/reveal-sensitive`,
        { reason: "inline table reveal (UI)" },
        { headers }
      );
      const data = (response.data || {}) as Record<string, unknown>;
      setRevealedMap((prev) => {
        const next = new Map(prev);
        next.set(sim.id, {
          pin: (data.pin as string) || "",
          puk: (data.puk as string) || "",
          iccid: (data.iccid as string) || sim.iccid,
          imsi: (data.imsi as string | undefined) ?? sim.imsi,
          msisdn: (data.msisdn as string | undefined) ?? sim.msisdn,
        });
        return next;
      });
      toggleFieldVisible(sim.id, field);
    } catch (revealError) {
      console.error(revealError);
      setError("Failed to reveal sensitive SIM data.");
    } finally {
      setRevealingSimId(null);
    }
  };

  const FieldEyeToggle = ({ sim, field, titleShow, titleHide }: { sim: SimCardItem; field: string; titleShow: string; titleHide: string }) => {
    if (!canViewSensitive) return null;
    const revealed = getRevealed(sim.id);
    const showing = revealed && isFieldVisible(sim.id, field);
    return (
      <button
        type="button"
        disabled={revealingSimId === sim.id}
        onClick={() => void inlineToggleReveal(sim, field)}
        className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        title={showing ? titleHide : titleShow}
      >
        {revealingSimId === sim.id ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : showing ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    );
  };

  const filteredGatewayPickerItems = useMemo(() => {
    const query = gatewayPickerSearch.trim().toLowerCase();
    if (!query) return gatewayPickerItems.slice(0, 50);
    return gatewayPickerItems
      .filter((item) =>
        [item.name, item.regionName, item.depotName]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 50);
  }, [gatewayPickerItems, gatewayPickerSearch]);

  const pageStart = visibleItems.length === 0 ? 0 : page * pageSize + 1;
  const pageEnd = visibleItems.length === 0 ? 0 : page * pageSize + visibleItems.length;

  return (
    <div className="space-y-4">
      <section className="enterprise-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
              SIM Inventory
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              Subscriber identity module cards
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              PIN/PUK/ICCID masked by default. Click the per-field eye icon to reveal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
              {canViewSensitive ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Sensitive reveal enabled
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  Sensitive reveal disabled
                </>
              )}
            </div>
            {canCreateSim ? (
              <button
                type="button"
                onClick={openCreateSimModal}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                New SIM
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void fetchSims()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total SIMs"
          value={totals.total}
          subtitle="Cards registered in SIM inventory."
          icon={<CardSim className="h-5 w-5" />}
          highlight="blue"
        />
        <StatCard
          title="Assigned"
          value={items.filter((i) => i.assignedGatewayId).length}
          subtitle="Currently assigned to a gateway slot."
          icon={<Link2 className="h-5 w-5" />}
          highlight="emerald"
        />
        <StatCard
          title="Unassigned"
          value={items.filter((i) => !i.assignedGatewayId).length}
          subtitle="Available for assignment to gateways."
          icon={<Link2Off className="h-5 w-5" />}
          highlight="slate"
        />
        <StatCard
          title="Active"
          value={items.filter((i) => i.status === "ACTIVE" || i.status === "ASSIGNED").length}
          subtitle="Operator state reported as active."
          icon={<Shield className="h-5 w-5" />}
          highlight="emerald"
        />
        <StatCard
          title="Suspended"
          value={items.filter((i) => i.status === "SUSPENDED").length}
          subtitle="Cards suspended by operator or policy."
          icon={<ShieldAlert className="h-5 w-5" />}
          highlight="amber"
        />
        <StatCard
          title="Inactive"
          value={items.filter((i) => i.status === "INACTIVE" || i.status === "UNASSIGNED").length}
          subtitle="Cards pending activation or deactivated."
          icon={<Smartphone className="h-5 w-5" />}
          highlight="red"
        />
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-50 via-white to-red-50 p-4 dark:border-slate-800 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  SIM Table
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Sensitive fields masked — tap the per-cell eye to reveal
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={statusFilter === filter.value}
                    label={filter.label}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setPage(0);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 xl:max-w-[560px]">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-w-[180px] flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:col-span-1">
                  Operator
                  <select
                    value={selectedOperator}
                    onChange={(event) => {
                      setSelectedOperator(event.target.value);
                      setPage(0);
                    }}
                    className="mt-0.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs normal-case font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">All operators</option>
                    {operatorOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-end gap-2 pt-4 text-[11px] font-normal text-slate-500 dark:text-slate-400 sm:pt-0 sm:normal-case sm:tracking-normal">
                  <span className="hidden sm:inline">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPage(0);
                      setPageSize(Number(event.target.value));
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
              <div className="enterprise-chip flex items-center gap-3 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search ICCID last-4, MSISDN, operator, gateway name..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-4 py-20 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span>Loading SIM card inventory...</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            No SIM cards found for the current filters.
          </div>
        ) : (
          <div className="w-full col-span-full overflow-x-auto">
            <table className="min-w-[1020px] w-full">
              <thead className="bg-gradient-to-r from-blue-50/80 via-white to-red-50/70 dark:from-blue-500/10 dark:via-slate-900 dark:to-red-500/10">
                <tr className="text-left">
                  <Th>Status</Th>
                  <Th>ICCID</Th>
                  <Th>MSISDN</Th>
                  <Th>Operator</Th>
                  <Th>PIN</Th>
                  <Th>PUK</Th>
                  <Th>Gateway</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const revealed = getRevealed(item.id);
                  const isAssigned = Boolean(item.assignedGatewayId);
                  const effectiveStatus: SimStatus = isAssigned
                    ? "ASSIGNED"
                    : (item.status === "ASSIGNED" ? "ACTIVE" : (item.status as SimStatus) ?? "ACTIVE");
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-slate-200/80 text-xs transition hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-red-50/30 dark:border-slate-800 dark:hover:from-blue-500/5 dark:hover:to-red-500/5"
                    >
                      <Td>
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(effectiveStatus)}`}>
                          {statusLabel(effectiveStatus)}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono min-w-0 truncate text-slate-700 dark:text-slate-200">
                            {revealed && isFieldVisible(item.id, "iccid") ? revealed.iccid : maskIccid(item.iccid)}
                          </p>
                          <FieldEyeToggle sim={item} field="iccid" titleShow="Reveal ICCID" titleHide="Hide ICCID" />
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono min-w-0 truncate text-slate-600 dark:text-slate-300">
                            {revealed && isFieldVisible(item.id, "msisdn") ? (revealed.msisdn ?? maskMsisdn(item.msisdn, item.maskedMsisdn)) : maskMsisdn(item.msisdn, item.maskedMsisdn)}
                          </p>
                          <FieldEyeToggle sim={item} field="msisdn" titleShow="Reveal MSISDN" titleHide="Hide MSISDN" />
                        </div>
                      </Td>
                      <Td>
                        <p className="text-slate-700 dark:text-slate-200">{item.operator || item.networkName || "—"}</p>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono tracking-widest min-w-0 truncate text-slate-700 dark:text-slate-200">
                            {revealed && isFieldVisible(item.id, "pin") ? revealed.pin : "****"}
                          </p>
                          <FieldEyeToggle sim={item} field="pin" titleShow="Reveal PIN" titleHide="Hide PIN" />
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono tracking-widest min-w-0 truncate text-slate-700 dark:text-slate-200">
                            {revealed && isFieldVisible(item.id, "puk") ? revealed.puk : "****"}
                          </p>
                          <FieldEyeToggle sim={item} field="puk" titleShow="Reveal PUK" titleHide="Hide PUK" />
                        </div>
                      </Td>
                      <Td>
                        {item.assignedGatewayId ? (
                          <div className="space-y-0.5">
                            <p className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                              <Router className="h-3.5 w-3.5 text-blue-500" />
                              {item.assignedGatewayName || `Gateway #${item.assignedGatewayId}`}
                            </p>
                            {typeof item.slotNumber === "number" ? (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Slot {item.slotNumber}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-slate-400 dark:text-slate-500">Unassigned</p>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {canEditSim ? (
                            <button
                              type="button"
                              onClick={() => openEditSimModal(item)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          ) : null}
                          {canAssign && !item.assignedGatewayId ? (
                            <button
                              type="button"
                              onClick={() => void openAssignModal(item)}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                            >
                              <Link2 className="h-3 w-3" />
                              Assign
                            </button>
                          ) : null}
                          {canUnassign && item.assignedGatewayId ? (
                            <button
                              type="button"
                              onClick={() => openUnassignModal(item)}
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                            >
                              <Link2Off className="h-3 w-3" />
                              Unassign
                            </button>
                          ) : null}
                          {canEditSim && item.status !== "RETIRED" ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Retire SIM ${maskIccid(item.iccid)}? This sets status to RETIRED and removes it from available inventory but keeps audit history.`)) {
                                  void retireSim(item.id);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" />
                              Retire
                            </button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {pageStart}-{pageEnd} of {effectiveTotal.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                className="enterprise-chip rounded-full px-3 py-2 text-xs font-medium text-slate-700 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {effectiveTotal === 0 ? 0 : page + 1} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      <Modal
        isOpen={assignModalOpen}
        onClose={closeAssignModal}
        className="max-w-3xl overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
        backdropBlur
      >
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-50 via-white to-red-50 px-5 py-4 dark:border-slate-800 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                Assign SIM Card
              </p>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                Link SIM to gateway slot
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {assignTargetSim ? (
                  <>
                    <span className="font-mono">{maskIccid(assignTargetSim.iccid)}</span>
                    {assignTargetSim.operator ? ` · ${assignTargetSim.operator}` : ""}
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={closeAssignModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Slot Number</span>
              <select
                value={assignSlot}
                onChange={(event) => setAssignSlot(Number(event.target.value))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={1}>Slot 1</option>
                <option value={2}>Slot 2</option>
                <option value={3}>Slot 3</option>
                <option value={4}>Slot 4</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assignment Reason</span>
              <input
                value={assignReason}
                onChange={(event) => setAssignReason(event.target.value)}
                placeholder="e.g. Replacement SIM for GW-7"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Gateway</span>
                <div className="enterprise-chip relative flex items-center gap-3 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={gatewayPickerSearch}
                    onChange={(event) => setGatewayPickerSearch(event.target.value)}
                    placeholder="Search gateway name, region, depot..."
                    className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                </div>
              </label>
            </div>
            <div className="max-h-[340px] overflow-y-auto rounded-[22px] border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60">
              {gatewayPickerLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  Loading gateway picker...
                </div>
              ) : filteredGatewayPickerItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No gateways available for assignment.
                </div>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {filteredGatewayPickerItems.map((gw) => (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSelectedGatewayId(gw.id)}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                        selectedGatewayId === gw.id ? "bg-blue-50/80 dark:bg-blue-500/10" : "hover:bg-white dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{gw.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {gw.regionName || "—"} · {gw.depotName || "—"}
                        </p>
                      </div>
                      {gw.effectiveStatus ? (
                        <span className="shrink-0 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                          {gw.effectiveStatus.replace("_", " ")}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={closeAssignModal}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitAssign()}
              disabled={submitting || !selectedGatewayId}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Confirm assign
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={unassignModalOpen}
        onClose={closeUnassignModal}
        className="max-w-md overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
        backdropBlur
      >
        <div className="border-b border-slate-200/80 bg-gradient-to-r from-red-50 via-white to-blue-50 px-5 py-4 dark:border-slate-800 dark:from-red-500/10 dark:via-slate-950 dark:to-blue-500/10">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600 dark:text-red-300">
                Unassign SIM Card
              </p>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                Remove SIM from gateway
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {unassignTargetSim ? (
                  <>
                    <span className="font-mono">{maskIccid(unassignTargetSim.iccid)}</span>
                    {unassignTargetSim.assignedGatewayName ? (
                      <> · from {unassignTargetSim.assignedGatewayName}</>
                    ) : null}
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={closeUnassignModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reason</span>
            <textarea
              value={unassignReason}
              onChange={(event) => setUnassignReason(event.target.value)}
              placeholder="e.g. SIM failure, gateway decommission, replacement"
              rows={4}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeUnassignModal}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitUnassign()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              Confirm unassign
            </button>
          </div>
        </div>
      </Modal>

      <SimModal
        isOpen={createSimModalOpen}
        onClose={closeSimModals}
        isEdit={false}
        onSaved={() => {
          clearAllRevealed();
          void fetchSims();
        }}
        headers={headers!}
        apiBaseUrl={API_BASE_URL}
      />
      {simModalTarget ? (
        <SimModal
          isOpen={editSimModalOpen}
          onClose={closeSimModals}
          isEdit={true}
          existing={simModalTarget}
          onSaved={() => {
            clearRevealedForSim(simModalTarget.id);
            void fetchSims();
          }}
          headers={headers!}
          apiBaseUrl={API_BASE_URL}
        />
      ) : null}
    </div>
  );
}
