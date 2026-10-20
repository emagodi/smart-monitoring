import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  CardSim,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Link2Off,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Router,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Dialog, HeroButton, HeroStat, HeroStats, MobileFilters, Notice, PageHero, Pager, inputCls, timeAgo } from "../../components/ui/page";
import { SimModal } from "./SimModal";
import { SimImportDialog } from "./SimImportDialog";
import { PinPukFields, pinPukError, type PinPuk } from "./PinPukFields";
import { ATTENTION, SIM_STATUS, SIM_STATUSES, simStatusMeta, type SimStatus } from "./simMeta";

/**
 * SIM inventory. Counts and filters come from the server for the whole inventory (not just the page on screen).
 * Identifiers and PIN/PUK are masked; people with sims.view_sensitive can reveal them per cell (audited).
 * A SIM without a PIN/PUK on file says so ("Not set") instead of showing stars.
 */

interface SimCardItem {
  id: number;
  iccid: string;
  imsi?: string | null;
  msisdn?: string | null;
  pin?: string | null;
  puk?: string | null;
  hasPin?: boolean | null;
  hasPuk?: boolean | null;
  operator?: string | null;
  networkName?: string | null;
  status: string;
  slotNumber?: number | null;
  assignedGatewayId?: number | null;
  assignedGatewayName?: string | null;
  assignedAt?: string | null;
  notes?: string | null;
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

type Summary = {
  total: number;
  byStatus: Record<string, number>;
  inGateway: number;
  spare: number;
  withPin: number;
  withoutPin: number;
  withPuk: number;
  withoutPuk: number;
  operators: string[];
};

type Tri = "" | "yes" | "no";
type Revealed = { pin: string; puk: string; iccid: string; imsi?: string | null; msisdn?: string | null };

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  for (const key of ["content", "data", "items", "records"]) {
    const v = obj?.[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
};

const tail = (v?: string | null, keep = 4) => {
  if (!v) return null;
  const digits = v.replace(/\*/g, "");
  return digits.slice(-keep);
};
const maskedIccid = (v?: string | null) => (v ? `•••• •••• ${tail(v) ?? ""}` : "—");
const maskedNumber = (v?: string | null) => (v ? `••• ${tail(v) ?? ""}` : "—");
const groupDigits = (v: string) => v.replace(/(.{4})/g, "$1 ").trim();
const errMsg = (e: unknown, fallback: string) => {
  const ax = e as { response?: { data?: { message?: string } | string } };
  const d = ax.response?.data;
  return (typeof d === "string" && d) || (typeof d === "object" && d?.message) || fallback;
};

export default function SimsIndex() {
  const { token, hasPermission } = useAuth();
  const API = import.meta.env.VITE_API_BASE_URL || "";
  const headers = useMemo<Record<string, string>>(() => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)), [token]);

  const canViewSensitive = hasPermission("sims.view_sensitive");
  const canAssign = hasPermission("sims.assign");
  const canUnassign = hasPermission("sims.unassign");
  const canCreate = hasPermission("sims.create");
  const canEdit = hasPermission("sims.edit");

  // ------------------------------------------------------------------ filters
  const [status, setStatus] = useState<SimStatus | "">("");
  const [assigned, setAssigned] = useState<Tri>("");
  const [pin, setPin] = useState<Tri>("");
  const [puk, setPuk] = useState<Tri>("");
  const [operator, setOperator] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => setPage(0), [status, assigned, pin, puk, operator, search, pageSize]);

  const activeExtra = [assigned, pin, puk, operator].filter(Boolean).length;
  const anyFilter = Boolean(status || activeExtra || search);
  const clearFilters = () => {
    setStatus("");
    setAssigned("");
    setPin("");
    setPuk("");
    setOperator("");
    setSearchInput("");
  };

  // ------------------------------------------------------------------ data
  const [items, setItems] = useState<SimCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const r = await axios.get<Summary>(`${API}/api/v1/sim-cards/summary`, { headers });
      setSummary(r.data);
    } catch {
      /* tiles fall back to dashes */
    }
  }, [API, headers, token]);

  const fetchSims = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, size: pageSize, sort: "id,desc" };
      if (status) params.status = status;
      if (operator) params.operator = operator;
      if (search) params.search = search;
      if (assigned) params.assigned = assigned === "yes";
      if (pin) params.hasPin = pin === "yes";
      if (puk) params.hasPuk = puk === "yes";
      const r = await axios.get<{ content?: SimCardItem[]; totalElements?: number }>(`${API}/api/v1/sim-cards`, { headers, params });
      setItems(normalizeList<SimCardItem>(r.data));
      setTotal(typeof r.data?.totalElements === "number" ? r.data.totalElements : 0);
    } catch (e) {
      setError(errMsg(e, "Could not load the SIM inventory."));
    } finally {
      setLoading(false);
    }
  }, [API, headers, token, page, pageSize, status, operator, search, assigned, pin, puk]);

  useEffect(() => void fetchSims(), [fetchSims]);
  useEffect(() => void fetchSummary(), [fetchSummary]);
  const refreshAll = () => {
    void fetchSims();
    void fetchSummary();
  };

  // ------------------------------------------------------------------ reveal (audited, per SIM, cached)
  const [revealed, setRevealed] = useState<Map<number, Revealed>>(new Map());
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [revealing, setRevealing] = useState<number | null>(null);
  const isShown = (id: number, f: string) => visible.has(`${id}:${f}`);
  const toggle = async (sim: SimCardItem, f: string) => {
    const key = `${sim.id}:${f}`;
    if (!revealed.has(sim.id)) {
      if (!canViewSensitive) return;
      setRevealing(sim.id);
      try {
        const r = await axios.post(`${API}/api/v1/sim-cards/${sim.id}/reveal-sensitive`, { reason: "SIM inventory table reveal" }, { headers });
        const d = (r.data || {}) as Record<string, string>;
        setRevealed((m) => new Map(m).set(sim.id, { pin: d.pin || "", puk: d.puk || "", iccid: d.iccid || sim.iccid, imsi: d.imsi ?? sim.imsi, msisdn: d.msisdn ?? sim.msisdn }));
      } catch (e) {
        setError(errMsg(e, "Could not reveal this SIM's details."));
        setRevealing(null);
        return;
      }
      setRevealing(null);
    }
    setVisible((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };
  const hideAll = () => setVisible(new Set());

  // ------------------------------------------------------------------ dialogs
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SimCardItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [retireTarget, setRetireTarget] = useState<SimCardItem | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<SimCardItem | null>(null);
  const [unassignReason, setUnassignReason] = useState("");
  const [assignTarget, setAssignTarget] = useState<SimCardItem | null>(null);
  const [gateways, setGateways] = useState<GatewayPickerItem[]>([]);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwSearch, setGwSearch] = useState("");
  const [gatewayId, setGatewayId] = useState<number | null>(null);
  const [slot, setSlot] = useState(1);
  const [assignReason, setAssignReason] = useState("");
  const [assignCodes, setAssignCodes] = useState<PinPuk>({ pin: "", puk: "" });
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const openAssign = async (sim: SimCardItem) => {
    setAssignTarget(sim);
    setGatewayId(null);
    setSlot(sim.slotNumber || 1);
    setAssignReason("");
    setAssignCodes({ pin: "", puk: "" });
    setGwSearch("");
    setDialogError(null);
    if (gateways.length) return;
    setGwLoading(true);
    try {
      const r = await axios.get(`${API}/api/v1/gateways`, { headers, params: { page: 0, size: 500 } });
      setGateways(normalizeList<GatewayPickerItem>(r.data));
    } catch {
      setGateways([]);
    } finally {
      setGwLoading(false);
    }
  };
  const shownGateways = useMemo(() => {
    const q = gwSearch.trim().toLowerCase();
    const list = q ? gateways.filter((g) => [g.name, g.regionName, g.depotName].join(" ").toLowerCase().includes(q)) : gateways;
    return list.slice(0, 60);
  }, [gateways, gwSearch]);

  const submitAssign = async () => {
    if (!assignTarget || !gatewayId || pinPukError(assignCodes)) return;
    setBusy(true);
    setDialogError(null);
    try {
      await axios.post(
        `${API}/api/v1/gateways/${gatewayId}/sims/assign`,
        { simId: assignTarget.id, slotNumber: slot, reason: assignReason || "Assigned from SIM inventory", pin: assignCodes.pin || undefined, puk: assignCodes.puk || undefined },
        { headers }
      );
      setAssignTarget(null);
      refreshAll();
    } catch (e) {
      setDialogError(errMsg(e, "Could not assign this SIM."));
    } finally {
      setBusy(false);
    }
  };
  const submitUnassign = async () => {
    if (!unassignTarget) return;
    setBusy(true);
    setDialogError(null);
    try {
      await axios.post(`${API}/api/v1/sim-cards/${unassignTarget.id}/unassign`, { reason: unassignReason || "Removed from gateway" }, { headers });
      setUnassignTarget(null);
      refreshAll();
    } catch (e) {
      setDialogError(errMsg(e, "Could not remove this SIM from its gateway."));
    } finally {
      setBusy(false);
    }
  };
  const submitRetire = async () => {
    if (!retireTarget) return;
    setBusy(true);
    setDialogError(null);
    try {
      await axios.delete(`${API}/api/v1/sim-cards/${retireTarget.id}`, { headers });
      setRetireTarget(null);
      refreshAll();
    } catch (e) {
      setDialogError(errMsg(e, "Could not retire this SIM."));
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ derived
  const s = summary;
  const by = s?.byStatus ?? {};
  const attention = ATTENTION.reduce((n, k) => n + (by[k] ?? 0), 0);
  const pct = (n?: number) => (s && s.total ? Math.round(((n ?? 0) / s.total) * 100) : 0);
  const fmt = (n?: number) => (s ? (n ?? 0).toLocaleString() : "—");

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Assets · SIM cards"
        title="SIM inventory"
        subtitle={`Every gateway SIM: where it is, its state and whether its PIN and PUK are on file. ${canViewSensitive ? "Numbers and codes are masked: tap the eye to reveal (logged)." : "Numbers and codes are masked for your role."}`}
        actions={
          <>
            <HeroButton onClick={refreshAll} busy={loading}>Refresh</HeroButton>
            {canCreate ? (
              <>
                <HeroButton icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
                  Upload Excel
                </HeroButton>
                <HeroButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  New SIM
                </HeroButton>
              </>
            ) : null}
          </>
        }
      >
        <HeroStats cols={6}>
          <HeroStat icon={<CardSim className="h-3.5 w-3.5" />} label="SIM cards" value={fmt(s?.total)} sub={`${s?.operators.length ?? 0} operator${s?.operators.length === 1 ? "" : "s"}`} loading={!s} onClick={clearFilters} active={!anyFilter} />
          <HeroStat icon={<Router className="h-3.5 w-3.5 text-emerald-300" />} label="In a gateway" value={fmt(s?.inGateway)} sub={`${pct(s?.inGateway)}% deployed`} tone="good" loading={!s} onClick={() => setAssigned(assigned === "yes" ? "" : "yes")} active={assigned === "yes"} />
          <HeroStat icon={<Link2Off className="h-3.5 w-3.5 text-sky-300" />} label="Spare stock" value={fmt(s?.spare)} sub="ready to install" loading={!s} onClick={() => setAssigned(assigned === "no" ? "" : "no")} active={assigned === "no"} />
          <HeroStat icon={<KeyRound className="h-3.5 w-3.5 text-emerald-300" />} label="PIN on file" value={fmt(s?.withPin)} sub={s ? `${s.withoutPin.toLocaleString()} without a PIN` : ""} tone={s && s.withoutPin ? "warn" : "good"} loading={!s} onClick={() => setPin(pin === "no" ? "" : "no")} active={pin === "no"} />
          <HeroStat icon={<Lock className="h-3.5 w-3.5 text-emerald-300" />} label="PUK on file" value={fmt(s?.withPuk)} sub={s ? `${s.withoutPuk.toLocaleString()} without a PUK` : ""} tone={s && s.withoutPuk ? "warn" : "good"} loading={!s} onClick={() => setPuk(puk === "no" ? "" : "no")} active={puk === "no"} />
          <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />} label="Need attention" value={fmt(attention)} sub="suspended · lost · damaged · expired" tone={attention ? "bad" : undefined} loading={!s} onClick={() => setStatus(status === "SUSPENDED" ? "" : "SUSPENDED")} active={status === "SUSPENDED"} />
        </HeroStats>
      </PageHero>

      {error ? (
        <Notice tone="error" onClose={() => setError(null)}>
          {error}
        </Notice>
      ) : null}

      <section className="ui-panel overflow-hidden">
        {/* Status: every lifecycle state, with counts for the whole inventory */}
        <div className="border-b border-slate-200/80 px-4 pb-3 pt-3.5 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Status</p>
            {anyFilter ? (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                <X className="h-3.5 w-3.5" /> Clear all filters
              </button>
            ) : null}
          </div>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <StatusChip on={!status} label="All" count={s?.total} onClick={() => setStatus("")} />
            {SIM_STATUSES.map((k) => (
              <StatusChip key={k} on={status === k} label={SIM_STATUS[k].label} dot={SIM_STATUS[k].dot} count={by[k]} title={SIM_STATUS[k].hint} onClick={() => setStatus(status === k ? "" : k)} />
            ))}
          </div>
        </div>

        {/* Search + location / credential filters */}
        <div className="flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/60 px-4 py-3 md:flex-row md:flex-wrap md:items-center dark:border-slate-800 dark:bg-slate-900/40">
          <label className="relative flex min-w-0 flex-1 items-center md:min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ICCID, IMSI, number, operator or gateway…"
              className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-8 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {searchInput ? (
              <button type="button" onClick={() => setSearchInput("")} className="absolute right-3 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <MobileFilters active={activeExtra}>
            <Segmented label="Gateway" value={assigned} onChange={setAssigned} options={[["", "Any"], ["yes", "In a gateway"], ["no", "Spare"]]} />
            <Segmented label="PIN" value={pin} onChange={setPin} options={[["", "Any"], ["yes", "On file"], ["no", "Not set"]]} />
            <Segmented label="PUK" value={puk} onChange={setPuk} options={[["", "Any"], ["yes", "On file"], ["no", "Not set"]]} />
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">All operators</option>
              {(s?.operators ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </MobileFilters>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-slate-500">
          <span>
            {loading ? "Loading…" : `${total.toLocaleString()} SIM${total === 1 ? "" : "s"}${anyFilter ? " match" : " in the inventory"}`}
          </span>
          {visible.size ? (
            <button type="button" onClick={hideAll} className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
              <EyeOff className="h-3.5 w-3.5" /> Hide revealed values
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.1em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">SIM card</th>
                <th className="px-4 py-2.5 font-semibold">Number</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">PIN</th>
                <th className="px-4 py-2.5 font-semibold">PUK</th>
                <th className="px-4 py-2.5 font-semibold">Gateway</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && !items.length ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <span className="block h-8 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : !items.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <CardSim className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{anyFilter ? "No SIMs match these filters" : "No SIM cards yet"}</p>
                    <p className="text-xs text-slate-500">{anyFilter ? "Try clearing a filter." : "Upload the operator's Excel sheet or add a SIM by hand."}</p>
                  </td>
                </tr>
              ) : (
                items.map((sim) => {
                  const r = revealed.get(sim.id);
                  const meta = simStatusMeta(sim.status);
                  const retired = sim.status === "RETIRED";
                  const inGateway = Boolean(sim.assignedGatewayId);
                  return (
                    <tr key={sim.id} className={`transition hover:bg-blue-50/40 dark:hover:bg-slate-900 ${retired ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-[#0a2a6b] text-white shadow-sm shadow-blue-600/20">
                            <CardSim className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <Secret
                              value={r && isShown(sim.id, "iccid") ? groupDigits(r.iccid) : maskedIccid(sim.iccid)}
                              shown={isShown(sim.id, "iccid")}
                              canReveal={canViewSensitive}
                              busy={revealing === sim.id}
                              onToggle={() => void toggle(sim, "iccid")}
                              strong
                            />
                            <p className="truncate text-[11px] text-slate-500">
                              {sim.operator || "No operator"}
                              {sim.networkName ? ` · ${sim.networkName}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {sim.msisdn ? (
                          <Secret
                            value={r && isShown(sim.id, "msisdn") ? r.msisdn || "—" : maskedNumber(sim.msisdn)}
                            shown={isShown(sim.id, "msisdn")}
                            canReveal={canViewSensitive}
                            busy={revealing === sim.id}
                            onToggle={() => void toggle(sim, "msisdn")}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.pill}`} title={meta.hint}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Code
                          has={sim.hasPin}
                          value={r && isShown(sim.id, "pin") ? r.pin : null}
                          shown={isShown(sim.id, "pin")}
                          canReveal={canViewSensitive}
                          busy={revealing === sim.id}
                          onToggle={() => void toggle(sim, "pin")}
                          onAdd={canEdit && !retired ? () => setEditTarget(sim) : undefined}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Code
                          has={sim.hasPuk}
                          value={r && isShown(sim.id, "puk") ? r.puk : null}
                          shown={isShown(sim.id, "puk")}
                          canReveal={canViewSensitive}
                          busy={revealing === sim.id}
                          onToggle={() => void toggle(sim, "puk")}
                          onAdd={canEdit && !retired ? () => setEditTarget(sim) : undefined}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        {inGateway ? (
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-slate-800 dark:text-slate-100">
                              <Router className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              {sim.assignedGatewayName || `Gateway #${sim.assignedGatewayId}`}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Slot {sim.slotNumber ?? 1}
                              {sim.assignedAt ? ` · ${timeAgo(sim.assignedAt)}` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> Spare
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit ? <RowBtn icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => setEditTarget(sim)} /> : null}
                          {inGateway ? (
                            canUnassign ? (
                              <RowBtn
                                icon={<Link2Off className="h-3.5 w-3.5" />}
                                label="Remove"
                                tone="amber"
                                onClick={() => {
                                  setUnassignTarget(sim);
                                  setUnassignReason("");
                                  setDialogError(null);
                                }}
                              />
                            ) : null
                          ) : canAssign && !retired ? (
                            <RowBtn icon={<Link2 className="h-3.5 w-3.5" />} label="Assign" tone="green" onClick={() => void openAssign(sim)} />
                          ) : null}
                          {canEdit && !retired && !inGateway ? (
                            <RowBtn
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              label="Retire"
                              tone="red"
                              iconOnly
                              onClick={() => {
                                setRetireTarget(sim);
                                setDialogError(null);
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </section>

      {/* ------------------------------------------------------------ dialogs */}
      <SimImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={refreshAll} apiBase={API} headers={headers} />

      <SimModal isOpen={createOpen} onClose={() => setCreateOpen(false)} isEdit={false} onSaved={refreshAll} headers={headers} apiBaseUrl={API} canViewSensitive={canViewSensitive} />
      <SimModal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        isEdit
        existing={editTarget}
        onSaved={() => {
          if (editTarget) {
            setRevealed((m) => {
              const n = new Map(m);
              n.delete(editTarget.id);
              return n;
            });
          }
          refreshAll();
        }}
        headers={headers}
        apiBaseUrl={API}
        canViewSensitive={canViewSensitive}
      />

      <Dialog
        open={Boolean(assignTarget)}
        onClose={() => !busy && setAssignTarget(null)}
        width="max-w-2xl"
        icon={<Link2 className="h-5 w-5" />}
        title="Put this SIM in a gateway"
        subtitle={assignTarget ? `${maskedIccid(assignTarget.iccid)} · ${assignTarget.operator || "No operator"}` : undefined}
        footer={
          <>
            <Button onClick={() => setAssignTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Link2 className="h-3.5 w-3.5" />} busy={busy} disabled={!gatewayId || Boolean(pinPukError(assignCodes))} onClick={() => void submitAssign()}>
              Assign SIM
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {dialogError ? <Notice tone="error">{dialogError}</Notice> : null}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">Gateway</p>
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input value={gwSearch} onChange={(e) => setGwSearch(e.target.value)} placeholder="Search gateway, region or depot…" className={`${inputCls} pl-9`} />
            </label>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              {gwLoading ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Loading gateways…
                </p>
              ) : !shownGateways.length ? (
                <p className="py-8 text-center text-sm text-slate-500">No gateways found.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shownGateways.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setGatewayId(g.id)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${gatewayId === g.id ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{g.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {g.regionName || "—"} · {g.depotName || "—"}
                          </span>
                        </span>
                        {gatewayId === g.id ? (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Selected</span>
                        ) : g.effectiveStatus ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{g.effectiveStatus.replace(/_/g, " ")}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Slot</span>
              <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} className={inputCls}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    Slot {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Reason (optional)</span>
              <input value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder="e.g. New install, replacement SIM" className={inputCls} />
            </label>
          </div>
          <PinPukFields value={assignCodes} onChange={setAssignCodes} hasPin={assignTarget?.hasPin} hasPuk={assignTarget?.hasPuk} />
        </div>
      </Dialog>

      <Dialog
        open={Boolean(unassignTarget)}
        onClose={() => !busy && setUnassignTarget(null)}
        icon={<Link2Off className="h-5 w-5" />}
        title="Remove SIM from its gateway"
        subtitle={unassignTarget ? `${maskedIccid(unassignTarget.iccid)} in ${unassignTarget.assignedGatewayName || "its gateway"}` : undefined}
        footer={
          <>
            <Button onClick={() => setUnassignTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" icon={<Link2Off className="h-3.5 w-3.5" />} busy={busy} onClick={() => void submitUnassign()}>
              Remove SIM
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {dialogError ? <Notice tone="error">{dialogError}</Notice> : null}
          <p className="text-sm text-slate-600 dark:text-slate-300">The SIM goes back to spare stock and the gateway is left without a SIM in that slot. Its PIN and PUK stay on file.</p>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Reason (optional)</span>
            <input value={unassignReason} onChange={(e) => setUnassignReason(e.target.value)} placeholder="e.g. Gateway replaced, SIM faulty" className={inputCls} />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(retireTarget)}
        onClose={() => !busy && setRetireTarget(null)}
        icon={<Trash2 className="h-5 w-5" />}
        title="Retire this SIM?"
        subtitle={retireTarget ? `${maskedIccid(retireTarget.iccid)} · ${retireTarget.operator || "No operator"}` : undefined}
        footer={
          <>
            <Button onClick={() => setRetireTarget(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} busy={busy} onClick={() => void submitRetire()}>
              Retire SIM
            </Button>
          </>
        }
      >
        {dialogError ? <Notice tone="error">{dialogError}</Notice> : null}
        <p className="text-sm text-slate-600 dark:text-slate-300">It stays in the records with status Retired and can no longer be assigned. You can change the status back later from Edit.</p>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------- pieces

function StatusChip({ on, label, count, dot, title, onClick }: { on: boolean; label: string; count?: number; dot?: string; title?: string; onClick: () => void }) {
  const empty = count === 0;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
        on
          ? "bg-blue-600 text-white ring-blue-600 shadow-sm shadow-blue-600/20"
          : `bg-white ring-slate-200 hover:ring-blue-300 dark:bg-slate-900 dark:ring-slate-700 ${empty ? "text-slate-400" : "text-slate-700 dark:text-slate-200"}`
      }`}
    >
      {dot ? <span className={`h-2 w-2 rounded-full ${on ? "bg-white" : dot} ${empty && !on ? "opacity-40" : ""}`} /> : null}
      {label}
      {count !== undefined ? <span className={`rounded-full px-1.5 text-[10px] font-bold ${on ? "bg-white/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{count.toLocaleString()}</span> : null}
    </button>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:w-auto">{label}</span>
      <div className="inline-flex flex-1 rounded-full bg-white p-0.5 ring-1 ring-slate-200 md:flex-none dark:bg-slate-900 dark:ring-slate-700">
        {options.map(([v, l]) => (
          <button
            key={v || "any"}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition md:flex-none ${
              value === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-blue-700 dark:text-slate-300"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Secret({ value, shown, canReveal, busy, onToggle, strong }: { value: string; shown: boolean; canReveal: boolean; busy: boolean; onToggle: () => void; strong?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`whitespace-nowrap font-mono tracking-wide ${strong ? "text-[13px] font-semibold text-slate-900 dark:text-slate-50" : "text-xs text-slate-700 dark:text-slate-200"}`}>{value}</span>
      {canReveal ? (
        <button type="button" onClick={onToggle} disabled={busy} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label={shown ? "Hide" : "Reveal"}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </span>
  );
}

/** PIN / PUK cell: masked with a reveal eye when on file, a clear "Not set" badge when it is not. */
function Code({ has, value, shown, canReveal, busy, onToggle, onAdd }: { has?: boolean | null; value: string | null; shown: boolean; canReveal: boolean; busy: boolean; onToggle: () => void; onAdd?: () => void }) {
  if (!has) {
    const badge = (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        <KeyRound className="h-3 w-3" /> Not set
      </span>
    );
    return onAdd ? (
      <button type="button" onClick={onAdd} className="group inline-flex items-center gap-1" title="Add it">
        {badge}
        <Plus className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-blue-600" />
      </button>
    ) : (
      badge
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
        <ShieldCheck className="h-3 w-3" />
        {shown && value ? value : "••••"}
      </span>
      {canReveal ? (
        <button type="button" onClick={onToggle} disabled={busy} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label={shown ? "Hide" : "Reveal"}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </span>
  );
}

function RowBtn({ icon, label, onClick, tone = "blue", iconOnly }: { icon: ReactNode; label: string; onClick: () => void; tone?: "blue" | "green" | "amber" | "red"; iconOnly?: boolean }) {
  const t = {
    blue: "text-slate-700 ring-slate-200 hover:text-blue-700 hover:ring-blue-300 dark:text-slate-200 dark:ring-slate-700",
    green: "text-emerald-700 ring-emerald-200 hover:bg-emerald-50 dark:text-emerald-300 dark:ring-emerald-500/30",
    amber: "text-amber-700 ring-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:ring-amber-500/30",
    red: "text-red-600 ring-red-200 hover:bg-red-50 dark:text-red-300 dark:ring-red-500/30",
  }[tone];
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold ring-1 transition dark:bg-slate-900 ${t}`}>
      {icon}
      {iconOnly ? null : label}
    </button>
  );
}
