import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, X, Loader2, Search, Building2, MapPin, Filter } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

interface Depot {
  id: number;
  name: string;
  districtId?: number;
  district?: { id: number; name: string; regionId?: number };
}

interface DistrictOption { id: number; name: string; regionId?: number }

export default function DepotsIndex() {
  const { token, hasPermission } = useAuth();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [districtFilter, setDistrictFilter] = useState<number | ''>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeDepot, setActiveDepot] = useState<Depot | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [districtInput, setDistrictInput] = useState<number | ''>('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const canCreate = hasPermission('depots.create');
  const canUpdate = hasPermission('depots.update');
  const canDelete = hasPermission('depots.delete');

  const normalizeList = (payload: unknown): Depot[] => {
    if (Array.isArray(payload)) return payload as Depot[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as Depot[];
    }
    return [];
  };

  const fetchDistrictOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/districts?page=0&size=1000`, { headers });
      const data = res.data as any;
      let arr: any[] = [];
      if (Array.isArray(data)) {
        arr = data;
      } else if (Array.isArray(data?.content)) {
        arr = data.content;
      } else if (Array.isArray(data?.data)) {
        arr = data.data;
      }
      setDistricts(arr.map((d) => ({ id: d.id, name: d.name, regionId: d.regionId ?? d.region_id })));
    } catch {
      setDistricts([]);
    }
  }, [API_BASE_URL, headers]);

  const fetchDepots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots`, { headers });
      const list = normalizeList(res.data);
      setDepots(list.map((d: any) => ({
        id: d.id,
        name: d.name ?? '',
        districtId: d.districtId ?? d.district_id,
        district: d.district,
      })) as Depot[]);
    } catch {
      setError('Failed to fetch depots');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (token) {
      fetchDistrictOptions();
      fetchDepots();
    }
  }, [token, fetchDistrictOptions, fetchDepots]);

  const openCreate = () => {
    setNameInput('');
    setDistrictInput('');
    setActiveDepot(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (depot: Depot) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots/${depot.id}`, { headers });
      const d = (res.data as Depot) || depot;
      setActiveDepot(d);
      setNameInput(d.name);
      const distId = d.district?.id ?? d.districtId;
      setDistrictInput(distId ?? '');
    } catch {
      setActiveDepot(depot);
      setNameInput(depot.name);
      const distId = depot.district?.id ?? depot.districtId;
      setDistrictInput(distId ?? '');
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (depot: Depot) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots/${depot.id}`, { headers });
      setActiveDepot(res.data as Depot);
    } catch {
      setActiveDepot(depot);
    }
    setShowView(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      if (!districtInput || typeof districtInput !== 'number') { setFormError('Select a district'); return; }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(`${API_BASE_URL}/api/v1/depots/create`, { name: nameInput.trim(), districtId: districtInput }, { headers });
      setShowCreate(false);
      setNameInput('');
      setDistrictInput('');
      await fetchDepots();
      setNotice({ variant: 'success', title: 'Depot created', message: 'The depot was created successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create depot');
      setNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the depot.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeDepot) return;
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      if (!districtInput || typeof districtInput !== 'number') { setFormError('Select a district'); return; }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(`${API_BASE_URL}/api/v1/depots/${activeDepot.id}`, { name: nameInput.trim(), districtId: districtInput }, { headers });
      setShowEdit(false);
      setActiveDepot(null);
      setNameInput('');
      setDistrictInput('');
      await fetchDepots();
      setNotice({ variant: 'success', title: 'Depot updated', message: 'Changes were saved successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update depot');
      setNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the depot.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteDepot = async (id: number) => {
    if (!window.confirm('Delete this depot?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/depots/${id}`, { headers });
      await fetchDepots();
      setNotice({ variant: 'success', title: 'Depot deleted', message: 'The depot was deleted successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setError('Failed to delete depot');
      setNotice({ variant: 'error', title: 'Delete failed', message: 'Could not delete the depot.' });
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const filtered = depots.filter((d) => {
    const matchesDistrict = districtFilter === '' || Number(d.districtId) === Number(districtFilter);
    const q = search.trim().toLowerCase();
    if (!q) return matchesDistrict;
    const distName = districts.find(x => x.id === (d.district?.id ?? d.districtId))?.name ?? '';
    return matchesDistrict && (d.name.toLowerCase().includes(q) || distName.toLowerCase().includes(q));
  });
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(paginated.map((d) => d.id));
    else setSelectedIds([]);
  };
  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  };

  if (loading) return <div className="p-4">Loading depots...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.variant} title={notice.title} message={notice.message} />
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-black dark:text-white">Depots</h2>
        <div className="flex items-center gap-2">
          {/* <button onClick={fetchDepots} className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Refresh</button> */}
          {canCreate ? <Button size="xs" onClick={openCreate} startIcon={<Plus className="w-4 h-4" />}>Add Depot</Button> : null}
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-900 border border-gray-100">
        <div className="p-4 border-b border-gray-100 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Show [N] */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded">Show</span>
                <select 
                  value={pageSize} 
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} 
                  className="text-sm border-none bg-transparent font-medium focus:ring-0 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

               {/* District Filter */}
              <div className="flex items-center gap-2">
                 <span className="text-sm font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded">District</span>
                 <div className="w-[200px]">
                    <SearchableSelect 
                        options={districts} 
                        value={districtFilter} 
                        onChange={(v) => { setDistrictFilter(v); setPage(1); }} 
                        placeholder="All Districts" 
                        compact
                    />
                 </div>
              </div>

              {/* Search Bar */}
              <div className="flex-1 max-w-md relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search depots..." 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm" 
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchDepots()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 shadow-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button 
                onClick={() => { setSearch(''); setDistrictFilter(''); setPage(1); }} 
                className="inline-flex items-center px-4 py-2 border border-yellow-500 text-sm font-medium rounded-md text-yellow-600 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <Filter className="h-4 w-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">District</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-600">
                    No depots found.
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={fetchDepots} className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Refresh</button>
                      {canCreate ? <button onClick={openCreate} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90">Add Depot</button> : null}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((d) => {
                  const targetId = d.district?.id ?? d.districtId;
                  const distName = districts.find(x => String(x.id) === String(targetId))?.name ?? d.district?.name ?? '—';
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-700">{d.name}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{distName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <ActionMenu
                          placement="bottom-end"
                          onView={() => openView(d)}
                          onEdit={canUpdate ? () => openEdit(d) : undefined}
                          onDelete={canDelete ? () => deleteDepot(d.id) : undefined}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> results</p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">«</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum ? 'z-10 bg-blue-900 border-blue-900 text-white' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>{pageNum}</button>
                    );
                  })}
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">»</button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <DepotCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        name={nameInput}
        setName={setNameInput}
        districtId={districtInput}
        setDistrictId={setDistrictInput}
        districts={districts}
        saving={savingCreate}
        error={formError}
      />
      <DepotEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        name={nameInput}
        setName={setNameInput}
        districtId={districtInput}
        setDistrictId={setDistrictInput}
        districts={districts}
        saving={savingEdit}
        error={formError}
      />
      <DepotViewModal open={showView} onClose={() => setShowView(false)} depot={activeDepot} districts={districts} />
    </div>
  );
}

export function DepotCreateModal({ open, onClose, onSubmit, name, setName, districtId, setDistrictId, districts, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; districtId: number | ''; setDistrictId: (v: number | '') => void; districts: DistrictOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Depots</h3>
           <button 
             type="button"
             onClick={onClose}
             className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
           >
             <X className="h-5 w-5" />
           </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <Plus className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xl font-bold text-white">Add New Depot</p>
                <p className="text-sm text-blue-100">Enter the details below</p>
            </div>
        </div>
      </div>
      
      <form onSubmit={onSubmit} className="p-6 space-y-6">
        {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-6">
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <div className="relative rounded-md">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Building2 className="h-4 w-4 text-blue-500" />
                    </div>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Depot Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">District *</label>
                <SearchableSelect options={districts} value={districtId} onChange={setDistrictId} placeholder="Select District" />
                <p className="mt-1 text-xs text-gray-500">The district this depot belongs to.</p>
            </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button 
            type="submit" 
            disabled={saving} 
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {saving ? 'Creating...' : 'Create Depot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DepotEditModal({ open, onClose, onSubmit, name, setName, districtId, setDistrictId, districts, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; districtId: number | ''; setDistrictId: (v: number | '') => void; districts: DistrictOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Depots</h3>
           <button 
             type="button"
             onClick={onClose}
             className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
           >
             <X className="h-5 w-5" />
           </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <Building2 className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xl font-bold text-white">Edit Depot</p>
                <p className="text-sm text-blue-100">Update depot details</p>
            </div>
        </div>
      </div>
      
      <form onSubmit={onSubmit} className="p-6 space-y-6">
        {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-6">
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <div className="relative rounded-md">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Building2 className="h-4 w-4 text-blue-500" />
                    </div>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Depot Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">District *</label>
                <SearchableSelect options={districts} value={districtId} onChange={setDistrictId} placeholder="Select District" />
                <p className="mt-1 text-xs text-gray-500">The district this depot belongs to.</p>
            </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button 
            type="submit" 
            disabled={saving} 
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {saving ? 'Updating...' : 'Update Depot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DepotViewModal({ open, onClose, depot, districts }: { open: boolean; onClose: () => void; depot: Depot | null; districts: DistrictOption[]; }) {
  const distName = depot ? (districts.find(x => x.id === (depot.district?.id ?? depot.districtId))?.name ?? depot.district?.name ?? '—') : '—';
  
  if (!depot) return null;

  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Depots</h3>
           <button 
             type="button"
             onClick={onClose}
             className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
           >
             <X className="h-5 w-5" />
           </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <Building2 className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xl font-bold text-white">{depot.name}</p>
                <p className="text-sm text-blue-100">Depot Details</p>
            </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">{depot.name}</span>
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">District</label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">{distName}</span>
                </div>
            </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Close</button>
        </div>
      </div>
    </Modal>
  );
}
