import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import { Plus, X, Search, Filter, Loader2, Map, Globe, Hash } from 'lucide-react';

interface Region {
  id: number;
  name: string;
  districts?: unknown[];
}

export default function RegionsIndex() {
  const { token } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);
  
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const normalizeRegions = (payload: unknown): Region[] => {
    if (Array.isArray(payload)) return payload as Region[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as Region[];
    }
    return [];
  };

  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions`, { headers });
      setRegions(normalizeRegions(res.data));
    } catch {
      setError('Failed to fetch regions');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (token) fetchRegions();
  }, [token, fetchRegions]);

  const openCreate = () => {
    setNameInput('');
    setActiveRegion(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (region: Region) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions/${region.id}`, { headers });
      const r = (res.data as Region) || region;
      setActiveRegion(r);
      setNameInput(r.name);
    } catch {
      setActiveRegion(region);
      setNameInput(region.name);
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (region: Region) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions/${region.id}`, { headers });
      setActiveRegion(res.data as Region);
    } catch {
      setActiveRegion(region);
    }
    setShowView(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(`${API_BASE_URL}/api/v1/regions/create`, { name: nameInput.trim() }, { headers });
      setShowCreate(false);
      setNameInput('');
      await fetchRegions();
      setNotice({ variant: 'success', title: 'Region created', message: 'The region was created successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create region');
      setNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the region.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeRegion) return;
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(`${API_BASE_URL}/api/v1/regions/${activeRegion.id}`, { name: nameInput.trim() }, { headers });
      setShowEdit(false);
      setActiveRegion(null);
      setNameInput('');
      await fetchRegions();
      setNotice({ variant: 'success', title: 'Region updated', message: 'Changes were saved successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update region');
      setNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the region.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (region: Region) => {
    setActiveRegion(region);
    setDeleteError(null);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!activeRegion) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await axios.delete(`${API_BASE_URL}/api/v1/regions/${activeRegion.id}`, { headers });
      setShowDelete(false);
      setActiveRegion(null);
      await fetchRegions();
      setNotice({ variant: 'success', title: 'Region deleted', message: 'The region was deleted successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setDeleteError('Failed to delete region');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = regions.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /><span className="ml-2 text-gray-500">Loading regions...</span></div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.variant} title={notice.title} message={notice.message} />
      )}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Regions</h2>
           <p className="mt-1 text-sm text-gray-500">Manage and monitor your regions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={openCreate} 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Add Region
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-900 border border-gray-100">
        <div className="p-4 border-b border-gray-100 space-y-4">
          {/* Top Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Show [N] */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Show</span>
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

              {/* Search Bar */}
              <div className="flex-1 max-w-md relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search regions..." 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchRegions()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button 
                onClick={() => { setSearch(''); setPage(1); }} 
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Districts</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-600">
                    No regions found.
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={fetchRegions} className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Refresh</button>
                      <button onClick={openCreate} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add Region</button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((region) => (
                  <tr key={region.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-700">{region.name}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800">{Array.isArray(region.districts) ? region.districts.length : 0}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <ActionMenu
                        placement="bottom-end"
                        onView={() => openView(region)}
                        onEdit={() => openEdit(region)}
                        onDelete={() => openDelete(region)}
                      />
                    </td>
                  </tr>
                ))
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

      <RegionsCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        name={nameInput}
        setName={setNameInput}
        saving={savingCreate}
        error={formError}
      />
      <RegionsEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        name={nameInput}
        setName={setNameInput}
        saving={savingEdit}
        error={formError}
      />
      <RegionsViewModal open={showView} onClose={() => setShowView(false)} region={activeRegion} />
      <RegionsDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
        region={activeRegion}
        deleting={deleting}
        error={deleteError}
      />
    </div>
  );
}

export function RegionsCreateModal({ open, onClose, onSubmit, name, setName, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Regions</h3>
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
                <p className="text-xl font-bold text-white">Add New Region</p>
                <p className="text-sm text-blue-100">Enter region details below</p>
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
                <Map className="h-5 w-5 text-blue-500" />
              </div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Region Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create Region'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RegionsEditModal({ open, onClose, onSubmit, name, setName, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Regions</h3>
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
                <Map className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xl font-bold text-white">Edit Region</p>
                <p className="text-sm text-blue-100">Update region details</p>
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
                <Map className="h-5 w-5 text-blue-500" />
              </div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Region Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
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

export function RegionsViewModal({ open, onClose, region }: { open: boolean; onClose: () => void; region: Region | null; }) {
  if (!region) return null;

  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="relative">
        {/* Header Background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Region Details</h3>
            <button 
              onClick={onClose}
              className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
              <Map className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-100">Region Name</p>
              <p className="text-lg font-bold text-white">{region.name}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            
            {/* Districts Count */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Districts</p>
                <p className="text-sm font-semibold text-gray-900">{Array.isArray(region.districts) ? region.districts.length : 0}</p>
              </div>
            </div>

            {/* Region ID */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Hash className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Region ID</p>
                <p className="text-sm font-semibold text-gray-900">#{region.id}</p>
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

export function RegionsDeleteModal({ open, onClose, onConfirm, region, deleting, error }: { open: boolean; onClose: () => void; onConfirm: () => void; region: Region | null; deleting: boolean; error?: string | null }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-md w-full p-0 overflow-hidden rounded-2xl" backdropBlur={true}>
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-bold text-white">Delete Region</h3>
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
            Are you sure you want to delete the region <span className="font-bold text-gray-900">{region?.name}</span>?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={deleting} 
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {deleting ? 'Deleting...' : 'Delete Region'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
