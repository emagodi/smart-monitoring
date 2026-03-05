import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, X, Search, Filter, Loader2, Building2, MapPin, Hash } from 'lucide-react';

interface District {
  id: number;
  name: string;
  regionId?: number;
  region?: { id: number; name: string };
}

interface RegionOption { id: number; name: string }

export default function DistrictsIndex() {
  const { token } = useAuth();
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
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);
  
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [regionFilter, setRegionFilter] = useState<number | ''>('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const normalizeList = (payload: unknown): District[] => {
    if (Array.isArray(payload)) return payload as District[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as District[];
    }
    return [];
  };

  const fetchRegionsOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions`, { headers });
      const arr = Array.isArray(res.data) ? (res.data as RegionOption[]) : ((res.data?.data as RegionOption[]) ?? []);
      setRegions(arr.map((r) => ({ id: r.id, name: r.name })));
    } catch {
      setRegions([]);
    }
  }, [API_BASE_URL, headers]);

  const fetchDistricts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/api/v1/districts`, { headers });
      setDistricts(normalizeList(res.data));
    } catch {
      setError('Failed to fetch districts');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (token) {
      fetchRegionsOptions();
      fetchDistricts();
    }
  }, [token, fetchRegionsOptions, fetchDistricts]);

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
      const d = (res.data as District) || district;
      setActiveDistrict(d);
      setNameInput(d.name);
      setRegionInput(d.region?.id ?? d.regionId ?? '');
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
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      if (!regionInput || typeof regionInput !== 'number') { setFormError('Select a region'); return; }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(`${API_BASE_URL}/api/v1/districts/create`, { name: nameInput.trim(), regionId: regionInput }, { headers });
      setShowCreate(false);
      setNameInput('');
      setRegionInput('');
      await fetchDistricts();
      setNotice({ variant: 'success', title: 'District created', message: 'The district was created successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create district');
      setNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the district.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeDistrict) return;
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      if (!regionInput || typeof regionInput !== 'number') { setFormError('Select a region'); return; }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(`${API_BASE_URL}/api/v1/districts/${activeDistrict.id}`, { name: nameInput.trim(), regionId: regionInput }, { headers });
      setShowEdit(false);
      setActiveDistrict(null);
      setNameInput('');
      setRegionInput('');
      await fetchDistricts();
      setNotice({ variant: 'success', title: 'District updated', message: 'Changes were saved successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update district');
      setNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the district.' });
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
      setNotice({ variant: 'success', title: 'District deleted', message: 'The district was deleted successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setDeleteError('Failed to delete district');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = districts.filter((d) => {
    const q = search.trim().toLowerCase();
    const rName = regions.find(r => r.id === (d.region?.id ?? d.regionId))?.name ?? '';
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || rName.toLowerCase().includes(q);
    const matchesRegion = !regionFilter || (d.region?.id ?? d.regionId) === regionFilter;
    return matchesSearch && matchesRegion;
  });
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /><span className="ml-2 text-gray-500">Loading districts...</span></div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.variant} title={notice.title} message={notice.message} />
      )}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Districts</h2>
           <p className="mt-1 text-sm text-gray-500">Manage and monitor your districts.</p>
        </div>
        <div className="flex items-center gap-2">
         <Button size="sm" onClick={openCreate} startIcon={<Plus className="w-4 h-4" />}>Add District</Button> 
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-900 border border-gray-100">
        <div className="p-4 border-b border-gray-100 space-y-4">
          {/* Top Filter Bar */}
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

               {/* Region Filter */}
              <div className="flex items-center gap-2">
                 <span className="text-sm font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded">Region</span>
                 <div className="w-[200px]">
                    <SearchableSelect 
                        options={regions} 
                        value={regionFilter} 
                        onChange={(v) => { setRegionFilter(v); setPage(1); }} 
                        placeholder="All Regions" 
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
                  placeholder="Search districts..." 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm" 
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchDistricts()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 shadow-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button 
                onClick={() => { setSearch(''); setRegionFilter(''); setPage(1); }} 
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Region</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-600">
                    No districts found.
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={fetchDistricts} className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Refresh</button>
                      <button onClick={openCreate} className="rounded bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Add District</button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((d) => {
                  const rName = regions.find(r => r.id === (d.region?.id ?? d.regionId))?.name ?? d.region?.name ?? '—';
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-700">{d.name}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <ActionMenu
                          placement="bottom-end"
                          onView={() => openView(d)}
                          onEdit={() => openEdit(d)}
                          onDelete={() => openDelete(d)}
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
                  <button onClick={() => setPage(1)} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">«</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum ? 'z-10 bg-blue-900 border-blue-900 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{pageNum}</button>
                    );
                  })}
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">»</button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

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
      <DistrictViewModal open={showView} onClose={() => setShowView(false)} district={activeDistrict} regions={regions} />
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

export function DistrictCreateModal({ open, onClose, onSubmit, name, setName, regionId, setRegionId, regions, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; regionId: number | ''; setRegionId: (v: number | '') => void; regions: RegionOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Districts</h3>
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
                <p className="text-xl font-bold text-white">Add New District</p>
                <p className="text-sm text-blue-100">Enter district details below</p>
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

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <div className="relative rounded-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="District Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Region *</label>
            <SearchableSelect options={regions} value={regionId} onChange={setRegionId} placeholder="Select region" />
            <p className="mt-1 text-xs text-gray-500">The region this district belongs to.</p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create District'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DistrictEditModal({ open, onClose, onSubmit, name, setName, regionId, setRegionId, regions, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; regionId: number | ''; setRegionId: (v: number | '') => void; regions: RegionOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Districts</h3>
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
                <p className="text-xl font-bold text-white">Edit District</p>
                <p className="text-sm text-blue-100">Update district details</p>
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

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <div className="relative rounded-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="District Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Region *</label>
            <SearchableSelect options={regions} value={regionId} onChange={setRegionId} placeholder="Select region" />
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DistrictViewModal({ open, onClose, district, regions }: { open: boolean; onClose: () => void; district: District | null; regions: RegionOption[] }) {
  if (!district) return null;
  const rName = regions.find(r => r.id === (district.region?.id ?? district.regionId))?.name ?? district.region?.name ?? '—';

  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="relative">
        {/* Header Background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">District Details</h3>
            <button 
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
              <p className="text-sm font-medium text-blue-100">District Name</p>
              <p className="text-lg font-bold text-white">{district.name}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            
            {/* Region */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Region</p>
                <p className="text-sm font-semibold text-gray-900">{rName}</p>
              </div>
            </div>

            {/* District ID */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Hash className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">District ID</p>
                <p className="text-sm font-semibold text-gray-900">#{district.id}</p>
              </div>
            </div>

          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={onClose} 
              className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function DistrictDeleteModal({ open, onClose, onConfirm, district, deleting, error }: { open: boolean; onClose: () => void; onConfirm: () => void; district: District | null; deleting: boolean; error?: string | null }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-md w-full p-0 overflow-hidden rounded-2xl" backdropBlur={true}>
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-bold text-white">Delete District</h3>
           <button 
             type="button"
             onClick={onClose}
             className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
           >
             <X className="h-5 w-5" />
           </button>
        </div>
        <p className="mt-2 text-sm text-red-100">This action cannot be undone.</p>
      </div>
      
      <div className="p-6 space-y-4">
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

        <p className="text-gray-600">
            Are you sure you want to delete the district <span className="font-bold text-gray-900">{district?.name}</span>?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={deleting} 
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {deleting ? 'Deleting...' : 'Delete District'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SearchableSelect({ options, value, onChange, placeholder, compact }: { options: { id: number; name: string }[]; value: number | ''; onChange: (v: number | '') => void; placeholder?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = typeof value === 'number' ? options.find(o => o.id === value) : undefined;

  useEffect(() => {
    setQuery(selected ? selected.name : '');
  }, [selected]);

  const filtered = options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative">
      <div className="relative group">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className={`h-4 w-4 ${compact ? 'text-gray-400' : 'text-gray-400 group-focus-within:text-blue-500'}`} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search…'}
          className={compact 
            ? "block w-full pl-9 pr-8 py-1.5 border-none bg-transparent text-sm font-medium focus:ring-0 placeholder-gray-400"
            : "mt-1 block w-full rounded-md border border-gray-300 bg-white pl-10 pr-8 py-2 shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm hover:border-gray-400"
          }
        />
        <button type="button" onClick={() => setOpen(v => !v)} className="absolute inset-y-0 right-0 px-2 text-gray-400 hover:text-gray-600">
           <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z"/></svg>
        </button>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none py-1">
          <ul className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
            ) : (
              filtered.map(opt => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.id); setQuery(opt.name); setOpen(false); }}
                    className={`flex w-full px-3 py-2 text-left text-sm ${value === opt.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                  >
                    {opt.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
