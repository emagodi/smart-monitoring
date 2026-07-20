import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '../../components/ui/alert/Alert';
import {
  Search,
  Loader2,
  Cpu,
  Settings,
  Link2,
  Save,
  RefreshCcw,
  Filter,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Modal } from '../../components/ui/modal';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

interface Controller {
  id: number;
  deviceId: string;
  devEui: string;
  name: string;
  type: string;
  transformerId?: number;
  transformer?: { id: number; name: string };
  createdAt?: string;
  updatedAt?: string;
}

interface TransformerOption {
  id: number;
  name: string;
  description?: string;
  searchText?: string;
  badge?: string;
}

export default function NewControllersIndex() {
  const { token, hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const initialLoadTokenRef = useRef<string | null>(null);
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';
  const [items, setItems] = useState<Controller[]>([]);
  const [transformers, setTransformers] = useState<TransformerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [active, setActive] = useState<Controller | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [transformerInput, setTransformerInput] = useState<number | ''>('');
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const canUpdate = hasPermission('controllers.update');

  const normalizeList = (payload: unknown): Controller[] => {
    if (Array.isArray(payload)) return payload as Controller[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as Controller[];
    }
    return [];
  };

  const fetchControllers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get<any>(`${API_BASE_URL}/api/v1/controllers`, { headers });
      const list = normalizeList(res.data);
      // Filter for controllers without transformerId
      const unassigned = list.filter(c => !c.transformerId);
      setItems(unassigned);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch controllers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchTransformers = useCallback(async () => {
    try {
      const res = await axios.get<any>(`${API_BASE_URL}/api/v1/transformers/assignment-options`, { headers });
      const list = normalizeList(res.data);
      setTransformers(
        list
          .map((item) => ({
            id: item.id,
            name: item.name,
            description: buildTransformerDescription(item),
            searchText: buildTransformerSearchText(item),
            badge: item.supplierName || item.type || undefined,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err) {
      console.error('Transformer lookup error:', err);
      setTransformers([]);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (!token) {
      initialLoadTokenRef.current = null;
      return;
    }

    if (initialLoadTokenRef.current === token) return;

    initialLoadTokenRef.current = token;
    void fetchControllers();
    void fetchTransformers();
  }, [token, fetchControllers, fetchTransformers]);

  const closeAssign = () => {
    setShowAssign(false);
    setActive(null);
    setTransformerInput('');
    setAssignError(null);
  };

  const openAssign = (controller: Controller) => {
    setActive(controller);
    setTransformerInput(controller.transformerId ?? '');
    setAssignError(null);
    setShowAssign(true);
  };

  const submitAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    if (!transformerInput || typeof transformerInput !== 'number') {
      setAssignError('Select a transformer for this controller.');
      return;
    }
    try {
      setAssigning(true);
      setAssignError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/controllers/${active.id}`,
        {
          deviceId: active.deviceId,
          devEui: active.devEui,
          type: active.type,
          name: active.name,
          transformerId: transformerInput,
        },
        { headers }
      );
      closeAssign();
      await fetchControllers();
      await fetchTransformers();
    } catch (err: any) {
      console.error(err);
      setAssignError(err.response?.data?.message || 'Failed to assign controller.');
    } finally {
      setAssigning(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((controller) => {
      return (
        controller.name.toLowerCase().includes(q) ||
        controller.deviceId.toLowerCase().includes(q) ||
        controller.devEui.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const resultsFrom = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const resultsTo = filtered.length === 0 ? 0 : Math.min(page * pageSize, filtered.length);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const controllerTypes = useMemo(() => {
    const breakdown = new Map<string, number>();
    items.forEach((controller) => {
      const key = controller.type || 'Unknown';
      breakdown.set(key, (breakdown.get(key) || 0) + 1);
    });

    return Array.from(breakdown.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [items]);

  const totals = useMemo(
    () => ({
      unassigned: items.length,
      transformerOptions: transformers.length,
      filtered: filtered.length,
      visible: paginated.length,
      types: controllerTypes.length,
    }),
    [controllerTypes.length, filtered.length, items.length, paginated.length, transformers.length]
  );

  if (loading) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading controllers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            onClick={() => {
              void fetchControllers();
              void fetchTransformers();
            }}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Unassigned Controllers"
          value={totals.unassigned}
          subtitle="Controllers waiting for transformer ownership"
          icon={<Cpu className="h-6 w-6" />}
          tone="bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300"
        />
        <MetricCard
          label="Transformer Options"
          value={totals.transformerOptions}
          subtitle="Available assignment targets from the lookup service"
          icon={<Link2 className="h-6 w-6" />}
          tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/14 dark:text-indigo-300"
        />
        <MetricCard
          label="Search Matches"
          value={totals.filtered}
          subtitle="Controllers in the active filter workspace"
          icon={<Search className="h-6 w-6" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300"
        />
        <MetricCard
          label="Controller Types"
          value={totals.types}
          subtitle="Distinct hardware types awaiting configuration"
          icon={<ShieldCheck className="h-6 w-6" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.72fr]">
        <div className="enterprise-card overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Assignment Workspace
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  New controller intake and transformer linking
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400 md:text-sm">
                  {isSupplierUser
                    ? 'Assign unlinked controllers to transformers visible to your organisation.'
                    : 'Review unassigned controllers and connect them to the correct transformers.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                >
                  <Filter className="h-4 w-4" />
                  Reset
                </button>
                <button
                  onClick={() => {
                    void fetchControllers();
                    void fetchTransformers();
                  }}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="enterprise-chip inline-flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search controllers, device IDs, or DevEUI..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto p-4 pt-0">
            <table className="min-w-full border-separate border-spacing-y-2.5">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  <th className="px-3 py-2.5">Controller</th>
                  <th className="px-3 py-2.5">Device ID</th>
                  <th className="px-3 py-2.5">DevEUI</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12">
                      <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {search.trim()
                          ? 'No unassigned controllers match the current search.'
                          : 'No unassigned controllers are waiting for assignment.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((controller) => (
                    <tr key={controller.id} className="enterprise-subtle-card">
                      <td className="rounded-l-[22px] px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                            <Cpu className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                              {controller.name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                              Ready for transformer assignment
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {controller.deviceId}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                          {controller.devEui}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          {formatTypeLabel(controller.type)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Unassigned
                          </span>
                          <span className="text-[12px] text-slate-400 dark:text-slate-500">
                            Awaiting transformer link
                          </span>
                        </div>
                      </td>
                      <td className="rounded-r-[22px] px-3 py-3">
                        {canUpdate ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openAssign(controller)}
                              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              <Link2 className="h-4 w-4" />
                              Assign
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/new-controllers/${controller.id}/edit`)}
                              className="enterprise-chip inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                            >
                              <Settings className="h-4 w-4" />
                              Edit
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-xs text-slate-400 dark:text-slate-500">No access</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {resultsFrom} to {resultsTo} of {filtered.length} controllers
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                >
                  Previous
                </button>
                <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">
                  {page}
                </div>
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="enterprise-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Assignment Summary
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                  Operator readiness rail
                </h3>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <SummaryStat label="Pending controllers" value={totals.unassigned} />
              <SummaryStat label="Visible controllers" value={totals.filtered} mutedZero />
              <SummaryStat label="Current page window" value={totals.visible} mutedZero />
              <SummaryStat label="Lookup options" value={totals.transformerOptions} mutedZero />
              <SummaryStat
                label="Assignment access"
                value={canUpdate ? 'Enabled' : 'Restricted'}
                accent={canUpdate ? 'success' : 'muted'}
              />
            </div>

            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Scope</p>
              <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                {isSupplierUser ? 'Supplier-visible transformer catalogue' : 'Full transformer assignment catalogue'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {isSupplierUser
                  ? 'The assignment list is limited to transformers exposed to the current supplier organisation.'
                  : 'Operators can route controllers to any transformer returned by the assignment options endpoint.'}
              </p>
            </div>
          </div>

          <div className="enterprise-card p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Controller Mix
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Types awaiting assignment
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {controllerTypes.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No controller types available yet.
                </div>
              ) : (
                controllerTypes.slice(0, 5).map((type) => {
                  const width = totals.unassigned ? (type.count / totals.unassigned) * 100 : 0;

                  return (
                    <div key={type.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatTypeLabel(type.label)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {type.count} controller{type.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                          style={{ width: `${Math.max(width, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <Modal
        isOpen={showAssign}
        onClose={closeAssign}
        variant="center"
        showCloseButton={false}
        className="max-h-[90vh] max-w-[640px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        backdropBlur={true}
      >
        <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Assign Controller
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    Link controller to transformer
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Centered assignment flow that keeps the operator in the intake workspace.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAssign}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form onSubmit={submitAssign} className="flex flex-1 flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
              {assignError ? <Alert variant="error" title="Assignment" message={assignError} /> : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Workflow</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Centered modal assignment
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Available targets</p>
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      transformers.length > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {transformers.length.toLocaleString()} transformer option{transformers.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                    Controller Snapshot
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                    Assignment details
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoCard label="Controller" value={active?.name || '—'} />
                  <InfoCard label="Device ID" value={active?.deviceId || '—'} />
                  <InfoCard label="Current assignment" value={active?.transformer?.name || 'Unassigned'} />
                  <InfoCard
                    label="Last updated"
                    value={active?.updatedAt ? new Date(active.updatedAt).toLocaleString() : 'Not yet updated'}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                    Transformer Selection
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                    Choose assignment target
                  </h4>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Transformer *
                  </label>
                  <SearchableSelect
                    options={transformers}
                    value={transformerInput}
                    onChange={(value) => setTransformerInput(value)}
                    placeholder={isSupplierUser ? 'Select organisation transformer...' : 'Select transformer...'}
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {isSupplierUser
                      ? 'Only transformers visible to your organisation are available in this selector.'
                      : 'Select the transformer that should own this controller after assignment.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAssign}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {assigning ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  tone,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="enterprise-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p
            className={`mt-2 text-3xl font-semibold tracking-tight ${
              value > 0 ? 'text-slate-950 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {value.toLocaleString()}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent = 'default',
  mutedZero = false,
}: {
  label: string;
  value: string | number;
  accent?: 'default' | 'success' | 'muted';
  mutedZero?: boolean;
}) {
  const isZero = typeof value === 'number' && value === 0;
  const valueTone =
    accent === 'success'
      ? 'text-emerald-600 dark:text-emerald-300'
      : accent === 'muted' || (mutedZero && isZero)
        ? 'text-slate-400 dark:text-slate-500'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="enterprise-subtle-card flex items-center justify-between px-3 py-2.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${valueTone}`}>{value}</span>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function formatTypeLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTransformerDescription(item: any) {
  const parts = [
    item.type ? item.type.replaceAll('_', ' ') : null,
    item.capacity ? `${item.capacity} kVA` : null,
    item.supplierName || null,
    item.locationLabel || (item.lat != null && item.lng != null ? `${item.lat}, ${item.lng}` : null),
  ].filter(Boolean);
  return parts.join(' | ');
}

function buildTransformerSearchText(item: any) {
  return [
    item.name,
    item.type,
    item.capacity,
    item.supplierName,
    item.supplierCode,
    item.depotId,
    item.lat,
    item.lng,
  ]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ');
}
