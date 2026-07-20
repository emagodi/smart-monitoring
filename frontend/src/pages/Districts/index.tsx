import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Building2,
  Filter,
  Hash,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

interface District {
  id: number;
  name: string;
  regionId?: number;
  region?: { id: number; name: string };
}

interface RegionOption {
  id: number;
  name: string;
}

type NoticeState = {
  variant: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
};

type DistrictFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  name: string;
  setName: (value: string) => void;
  regionId: number | '';
  setRegionId: (value: number | '') => void;
  regions: RegionOption[];
  saving?: boolean;
  error?: string | null;
  mode: 'create' | 'edit';
};

const getRegionName = (district: District, regions: RegionOption[]) =>
  regions.find((region) => region.id === (district.region?.id ?? district.regionId))?.name ??
  district.region?.name ??
  '—';

function ModalErrorNotice({ error }: { error?: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
      {error}
    </div>
  );
}

export default function DistrictsIndex() {
  const { token, hasPermission } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<District | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [regionInput, setRegionInput] = useState<number | ''>('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<number | ''>('');
  const [totalElements, setTotalElements] = useState(0);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const canCreate = hasPermission('districts.create');
  const canUpdate = hasPermission('districts.update');
  const canDelete = hasPermission('districts.delete');

  const normalizeList = (payload: unknown): District[] => {
    if (Array.isArray(payload)) return payload as District[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const value = obj?.[key] as unknown;
      if (Array.isArray(value)) return value as District[];
    }
    return [];
  };

  const fetchRegionsOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions?page=0&size=1000`, { headers });
      const responseData = res.data as any;
      let list: RegionOption[] = [];

      if (Array.isArray(responseData)) {
        list = responseData;
      } else if (Array.isArray(responseData?.content)) {
        list = responseData.content;
      } else if (Array.isArray(responseData?.data)) {
        list = responseData.data;
      }

      setRegions(list.map((region) => ({ id: region.id, name: region.name })));
    } catch {
      setRegions([]);
    }
  }, [API_BASE_URL, headers]);

  const fetchDistricts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let data: District[] = [];
      let total = 0;

      if (regionFilter) {
        const res = await axios.get(`${API_BASE_URL}/api/v1/districts/region/${regionFilter}`, { headers });
        data = normalizeList(res.data);

        if (search) {
          const query = search.trim().toLowerCase();
          data = data.filter((district) => district.name.toLowerCase().includes(query));
        }

        total = data.length;
      } else {
        const nextPage = page - 1;
        const url = `${API_BASE_URL}/api/v1/districts?page=${nextPage}&size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
        const res = await axios.get(url, { headers });
        const responseData = res.data as any;

        if (responseData?.content) {
          data = responseData.content;
          total = responseData.totalElements || responseData.content.length;
        } else if (Array.isArray(responseData)) {
          data = responseData;
          total = responseData.length;
        } else if (responseData?.data) {
          data = responseData.data;
          total = responseData.total || responseData.data.length;
        } else {
          data = normalizeList(responseData);
          total = data.length;
        }
      }

      setDistricts(data);
      setTotalElements(total);
    } catch {
      setError('Failed to fetch districts');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, page, pageSize, regionFilter, search]);

  useEffect(() => {
    if (!token) return;
    fetchRegionsOptions();
    fetchDistricts();
  }, [token, fetchDistricts, fetchRegionsOptions]);

  const openCreate = () => {
    setNameInput('');
    setRegionInput('');
    setActiveDistrict(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (district: District) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/districts/${district.id}`, { headers });
      const nextDistrict = (res.data as District) || district;
      setActiveDistrict(nextDistrict);
      setNameInput(nextDistrict.name);
      setRegionInput(nextDistrict.region?.id ?? nextDistrict.regionId ?? '');
    } catch {
      setActiveDistrict(district);
      setNameInput(district.name);
      setRegionInput(district.region?.id ?? district.regionId ?? '');
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (district: District) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/districts/${district.id}`, { headers });
      setActiveDistrict(res.data as District);
    } catch {
      setActiveDistrict(district);
    }
    setShowView(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!nameInput || nameInput.trim().length < 2) {
        setFormError('Enter a valid name');
        return;
      }
      if (!regionInput || typeof regionInput !== 'number') {
        setFormError('Select a region');
        return;
      }

      setSavingCreate(true);
      setFormError(null);
      await axios.post(
        `${API_BASE_URL}/api/v1/districts/create`,
        { name: nameInput.trim(), regionId: regionInput },
        { headers }
      );
      setShowCreate(false);
      setNameInput('');
      setRegionInput('');
      await fetchDistricts();
      setNotice({
        variant: 'success',
        title: 'District created',
        message: 'The district was created successfully.',
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create district');
      setNotice({
        variant: 'error',
        title: 'Create failed',
        message: 'Could not create the district.',
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeDistrict) return;
      if (!nameInput || nameInput.trim().length < 2) {
        setFormError('Enter a valid name');
        return;
      }
      if (!regionInput || typeof regionInput !== 'number') {
        setFormError('Select a region');
        return;
      }

      setSavingEdit(true);
      setFormError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/districts/${activeDistrict.id}`,
        { name: nameInput.trim(), regionId: regionInput },
        { headers }
      );
      setShowEdit(false);
      setActiveDistrict(null);
      setNameInput('');
      setRegionInput('');
      await fetchDistricts();
      setNotice({
        variant: 'success',
        title: 'District updated',
        message: 'Changes were saved successfully.',
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update district');
      setNotice({
        variant: 'error',
        title: 'Update failed',
        message: 'Could not update the district.',
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (district: District) => {
    setActiveDistrict(district);
    setDeleteError(null);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!activeDistrict) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await axios.delete(`${API_BASE_URL}/api/v1/districts/${activeDistrict.id}`, { headers });
      setShowDelete(false);
      setActiveDistrict(null);
      await fetchDistricts();
      setNotice({
        variant: 'success',
        title: 'District deleted',
        message: 'The district was deleted successfully.',
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setDeleteError('Failed to delete district');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalElements / pageSize) || 1;
  const paginated = regionFilter ? districts.slice((page - 1) * pageSize, page * pageSize) : districts;
  const pageStart = totalElements === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = totalElements === 0 ? 0 : Math.min(page * pageSize, totalElements);

  const selectedRegionName = useMemo(() => {
    if (!regionFilter) return 'All regions';
    return regions.find((region) => region.id === regionFilter)?.name ?? 'Selected region';
  }, [regionFilter, regions]);

  const visibleMetrics = useMemo(() => {
    const regionIds = new Set<number>();
    let assignedCount = 0;

    paginated.forEach((district) => {
      const regionId = district.region?.id ?? district.regionId;
      if (typeof regionId === 'number') {
        assignedCount += 1;
        regionIds.add(regionId);
      }
    });

    return {
      visibleRows: paginated.length,
      assignedCount,
      unassignedCount: paginated.length - assignedCount,
      regionCoverage: regionIds.size,
    };
  }, [paginated]);

  const topRegionMix = useMemo(() => {
    const counts = new Map<string, number>();
    const source = regionFilter ? districts : paginated;

    source.forEach((district) => {
      const label = getRegionName(district, regions);
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [districts, paginated, regionFilter, regions]);

  if (loading) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading districts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Alert variant={notice.variant} title={notice.title} message={notice.message} />}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Districts',
            value: totalElements,
            subtitle: 'Total district records in the current dataset',
            icon: <Building2 className="h-6 w-6" />,
            tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300',
          },
          {
            label: 'Regions',
            value: regions.length,
            subtitle: 'Available region assignments for district mapping',
            icon: <MapPin className="h-6 w-6" />,
            tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/14 dark:text-indigo-300',
          },
          {
            label: 'Visible Rows',
            value: visibleMetrics.visibleRows,
            subtitle: regionFilter ? 'Rows displayed from the selected region scope' : 'Rows loaded on the current page',
            icon: <Search className="h-6 w-6" />,
            tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300',
          },
          {
            label: 'Assigned',
            value: visibleMetrics.assignedCount,
            subtitle: 'Districts on screen with a region mapping',
            icon: <ShieldCheck className="h-6 w-6" />,
            tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300',
          },
        ].map((card) => (
          <div key={card.label} className="enterprise-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.subtitle}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.tone}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.75fr]">
        <div className="enterprise-card overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  District Table
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                   District registry
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={fetchDistricts}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setSearch('');
                    setRegionFilter('');
                    setPage(1);
                  }}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                >
                  <Filter className="h-4 w-4" />
                  Reset
                </button>
                {canCreate && (
                  <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add District
                  </button>
                )}
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

              <div className="enterprise-chip flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Region</span>
                <div className="min-w-[220px]">
                  <SearchableSelect
                    options={regions}
                    value={regionFilter}
                    onChange={(value) => {
                      setRegionFilter(value);
                      setPage(1);
                    }}
                    placeholder="All regions"
                    compact
                  />
                </div>
              </div>

              <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search districts..."
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
                  <th className="px-3 py-2.5">District</th>
                  <th className="px-3 py-2.5">Region</th>
                  <th className="px-3 py-2.5">Overview</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12">
                      <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <p>No districts found for the current filter.</p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <button
                            onClick={fetchDistricts}
                            className="enterprise-chip rounded-full px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                          >
                            Refresh
                          </button>
                          {canCreate && (
                            <button
                              onClick={openCreate}
                              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              Add District
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((district) => {
                    const regionName = getRegionName(district, regions);
                    const isAssigned = regionName !== '—';

                    return (
                      <tr key={district.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <Building2 className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                                {district.name}
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                District ID #{district.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isAssigned
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {regionName}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isAssigned ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                                }`}
                              />
                              {isAssigned ? 'Mapped to region' : 'Needs assignment'}
                            </span>
                            <p className="text-[12px] text-slate-400 dark:text-slate-500">
                              {isAssigned
                                ? `Operationally aligned with ${regionName}`
                                : 'No region relationship is available for this district'}
                            </p>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ActionMenu
                            placement="bottom-end"
                            onView={() => openView(district)}
                            onEdit={canUpdate ? () => openEdit(district) : undefined}
                            onDelete={canDelete ? () => openDelete(district) : undefined}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {pageStart} to {pageEnd} of {totalElements} districts
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
                  District Summary
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                  Filter and coverage overview
                </h3>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                ['Current region', selectedRegionName],
                ['Visible coverage', `${visibleMetrics.regionCoverage} region${visibleMetrics.regionCoverage === 1 ? '' : 's'}`],
                ['Assigned on screen', visibleMetrics.assignedCount],
                ['Unassigned on screen', visibleMetrics.unassignedCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="enterprise-subtle-card flex items-center justify-between px-3 py-2.5"
                >
                  <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="enterprise-card p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Region Mix
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Strongest district concentration
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {topRegionMix.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No district-to-region mix is available yet.
                </div>
              ) : (
                topRegionMix.map(([label, count]) => {
                  const denominator = Math.max(regionFilter ? districts.length : paginated.length, 1);
                  const width = (count / denominator) * 100;

                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{label}</span>
                        <span className="text-slate-500 dark:text-slate-400">{count} district{count === 1 ? '' : 's'}</span>
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

      <DistrictCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        name={nameInput}
        setName={setNameInput}
        regionId={regionInput}
        setRegionId={setRegionInput}
        regions={regions}
        saving={savingCreate}
        error={formError}
      />
      <DistrictEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        name={nameInput}
        setName={setNameInput}
        regionId={regionInput}
        setRegionId={setRegionInput}
        regions={regions}
        saving={savingEdit}
        error={formError}
      />
      <DistrictViewModal
        open={showView}
        onClose={() => setShowView(false)}
        district={activeDistrict}
        regions={regions}
      />
      <DistrictDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
        district={activeDistrict}
        deleting={deleting}
        error={deleteError}
      />
    </div>
  );
}

function DistrictFormModal({
  open,
  onClose,
  onSubmit,
  name,
  setName,
  regionId,
  setRegionId,
  regions,
  saving,
  error,
  mode,
}: DistrictFormModalProps) {
  const isEdit = mode === 'edit';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[90vh] max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                {isEdit ? <Building2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  {isEdit ? 'Edit District' : 'Create District'}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {isEdit ? 'Update district information' : 'Add a new operating district'}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Keep district CRUD in a centered modal without leaving the monitoring workspace.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Workflow</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isEdit ? 'Edit in modal' : 'Create in modal'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Module</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Districts</p>
              </div>
            </div>

            <ModalErrorNotice error={error} />

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  District Information
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Primary details
                </h4>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  District name *
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Building2 className="h-4.5 w-4.5 text-blue-500" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter district name"
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Region *
                </label>
                <SearchableSelect
                  options={regions}
                  value={regionId}
                  onChange={setRegionId}
                  placeholder="Select region"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Assign the district to the region responsible for field operations and monitoring.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? isEdit
                    ? 'Saving...'
                    : 'Creating...'
                  : isEdit
                    ? 'Save Changes'
                    : 'Create District'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function DistrictCreateModal(props: Omit<DistrictFormModalProps, 'mode'>) {
  return <DistrictFormModal {...props} mode="create" />;
}

export function DistrictEditModal(props: Omit<DistrictFormModalProps, 'mode'>) {
  return <DistrictFormModal {...props} mode="edit" />;
}

export function DistrictViewModal({
  open,
  onClose,
  district,
  regions,
}: {
  open: boolean;
  onClose: () => void;
  district: District | null;
  regions: RegionOption[];
}) {
  if (!district) return null;

  const regionName = getRegionName(district, regions);
  const isAssigned = regionName !== '—';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[88vh] max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  District Details
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {district.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Centered modal view for fast district context and mapping details.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  District health snapshot
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  isAssigned
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isAssigned ? 'Assigned' : 'Unassigned'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'District ID', value: `#${district.id}` },
                { label: 'Mapped region', value: regionName },
                { label: 'Workflow', value: 'Centered modal' },
                { label: 'State', value: isAssigned ? 'Ready for operations' : 'Needs mapping' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Identifiers</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">District key</p>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">#{district.id}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Region assignment</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {isAssigned
                      ? `${district.name} is aligned to ${regionName}.`
                      : 'This district does not currently have a mapped region.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function DistrictDeleteModal({
  open,
  onClose,
  onConfirm,
  district,
  deleting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  district: District | null;
  deleting: boolean;
  error?: string | null;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="w-full max-w-md overflow-hidden rounded-[28px] border border-red-200 bg-white p-0 shadow-2xl dark:border-red-500/20 dark:bg-slate-900"
      backdropBlur={true}
    >
      <div className="px-6 py-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
          !
        </div>
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete District?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-950 dark:text-slate-50">
            {district?.name || 'this district'}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="mt-5">
          <ModalErrorNotice error={error} />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}


