import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, MapPin, Zap, Activity, Building2, X } from 'lucide-react';

interface Transformer {
  id: number;
  name: string;
  capacity?: number;
  isActive?: boolean;
  depotId?: number;
  depot?: { id: number; name: string };
  lat?: number;
  lng?: number;
}

interface DepotOption { id: number; name: string }

export default function TransformersIndex() {
  const { token } = useAuth();
  const [items, setItems] = useState<Transformer[]>([]);
  const [depots, setDepots] = useState<DepotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE'>('ALL');
  const [depotFilter, setDepotFilter] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [active, setActive] = useState<Transformer | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [capacityInput, setCapacityInput] = useState<number | ''>('');
  const [isActiveInput, setIsActiveInput] = useState<boolean>(true);
  const [depotInput, setDepotInput] = useState<number | ''>('');
  const [latInput, setLatInput] = useState<number | ''>('');
  const [lngInput, setLngInput] = useState<number | ''>('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const normalizeList = (payload: unknown): Transformer[] => {
    if (Array.isArray(payload)) return payload as Transformer[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as Transformer[];
    }
    return [];
  };

  const fetchDepotOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots`, { headers });
      const arr = Array.isArray(res.data) ? (res.data as DepotOption[]) : ((res.data?.data as DepotOption[]) ?? []);
      setDepots(arr.map((d) => ({ id: d.id, name: d.name })));
    } catch {
      setDepots([]);
    }
  }, [API_BASE_URL, headers]);

  const fetchTransformers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = typeof depotFilter === 'number'
        ? `${API_BASE_URL}/api/v1/transformers/depot/${depotFilter}`
        : `${API_BASE_URL}/api/v1/transformers`;
      const res = await axios.get(url, { headers });
      setItems(normalizeList(res.data));
    } catch {
      setError('Failed to fetch transformers');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, depotFilter]);

  useEffect(() => {
    if (token) {
      fetchDepotOptions();
      fetchTransformers();
    }
  }, [token, fetchDepotOptions, fetchTransformers]);

  const openCreate = () => {
    setNameInput('');
    setCapacityInput('');
    setIsActiveInput(true);
    setDepotInput('');
    setLatInput('');
    setLngInput('');
    setActive(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (row: Transformer) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/${row.id}`, { headers });
      const t = (res.data as Transformer) || row;
      setActive(t);
      setNameInput(t.name);
      setCapacityInput(typeof t.capacity === 'number' ? t.capacity : '');
      setIsActiveInput(t.isActive ?? true);
      setDepotInput(t.depot?.id ?? t.depotId ?? '');
      setLatInput(typeof t.lat === 'number' ? t.lat : '');
      setLngInput(typeof t.lng === 'number' ? t.lng : '');
    } catch {
      setActive(row);
      setNameInput(row.name);
      setCapacityInput(typeof row.capacity === 'number' ? row.capacity : '');
      setIsActiveInput(row.isActive ?? true);
      setDepotInput(row.depot?.id ?? row.depotId ?? '');
      setLatInput(typeof row.lat === 'number' ? row.lat : '');
      setLngInput(typeof row.lng === 'number' ? row.lng : '');
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (row: Transformer) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/${row.id}`, { headers });
      setActive(res.data as Transformer);
    } catch {
      setActive(row);
    }
    setShowView(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      if (capacityInput === '' || typeof capacityInput !== 'number' || capacityInput <= 0) { setFormError('Enter capacity'); return; }
      if (!depotInput || typeof depotInput !== 'number') { setFormError('Select a depot'); return; }
      if (latInput === '' || typeof latInput !== 'number') { setFormError('Enter latitude'); return; }
      if (lngInput === '' || typeof lngInput !== 'number') { setFormError('Enter longitude'); return; }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(`${API_BASE_URL}/api/v1/transformers/create`, { name: nameInput.trim(), capacity: capacityInput, isActive: isActiveInput, depotId: depotInput, lat: latInput, lng: lngInput }, { headers });
      setShowCreate(false);
      setNameInput('');
      setCapacityInput('');
      setIsActiveInput(true);
      setDepotInput('');
      setLatInput('');
      setLngInput('');
      await fetchTransformers();
      setNotice({ variant: 'success', title: 'Transformer created', message: 'The transformer was created successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create transformer');
      setNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the transformer.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!active) return;
      if (!nameInput || nameInput.trim().length < 2) { setFormError('Enter a valid name'); return; }
      if (capacityInput === '' || typeof capacityInput !== 'number' || capacityInput <= 0) { setFormError('Enter capacity'); return; }
      if (!depotInput || typeof depotInput !== 'number') { setFormError('Select a depot'); return; }
      if (latInput === '' || typeof latInput !== 'number') { setFormError('Enter latitude'); return; }
      if (lngInput === '' || typeof lngInput !== 'number') { setFormError('Enter longitude'); return; }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(`${API_BASE_URL}/api/v1/transformers/${active.id}`, { name: nameInput.trim(), capacity: capacityInput, isActive: isActiveInput, depotId: depotInput, lat: latInput, lng: lngInput }, { headers });
      setShowEdit(false);
      setActive(null);
      setNameInput('');
      setCapacityInput('');
      setIsActiveInput(true);
      setDepotInput('');
      setLatInput('');
      setLngInput('');
      await fetchTransformers();
      setNotice({ variant: 'success', title: 'Transformer updated', message: 'Changes were saved successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update transformer');
      setNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the transformer.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteTransformer = async (id: number) => {
    if (!window.confirm('Delete this transformer?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/transformers/${id}`, { headers });
      await fetchTransformers();
      setNotice({ variant: 'success', title: 'Transformer deleted', message: 'The transformer was deleted successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setError('Failed to delete transformer');
      setNotice({ variant: 'error', title: 'Delete failed', message: 'Could not delete the transformer.' });
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const filtered = items.filter((t) => {
    // Status Filter
    if (statusFilter === 'ACTIVE' && !t.isActive) return false;
    if (statusFilter === 'MAINTENANCE' && t.isActive) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    const depotName = depots.find(x => x.id === (t.depot?.id ?? t.depotId))?.name ?? '';
    return (
      t.name.toLowerCase().includes(q) ||
      String(t.capacity ?? '').toLowerCase().includes(q) ||
      (t.isActive ? 'active' : 'maintenance').includes(q) ||
      depotName.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="p-4">Loading transformers...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.variant} title={notice.title} message={notice.message} />
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-black dark:text-white">Transformers</h2>
        <div className="flex items-center gap-2">
          <Button size="xs" onClick={openCreate} startIcon={<Plus className="w-4 h-4" />}>Add Transformer</Button>
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

              {/* Status [All] */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded">Status</span>
                <select 
                  value={statusFilter} 
                  onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }} 
                  className="text-sm border-none bg-transparent font-medium focus:ring-0 cursor-pointer"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>

              {/* Depot [All] - Replaces "Age" in image */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded">Depot</span>
                <select 
                  value={depotFilter} 
                  onChange={(e) => { setDepotFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }} 
                  className="text-sm border-none bg-transparent font-medium focus:ring-0 cursor-pointer max-w-[150px]"
                >
                  <option value="">All</option>
                  {depots.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="flex-1 max-w-md relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  placeholder="Search all records" 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm" 
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchTransformers()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 shadow-sm"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button 
                onClick={() => { setSearch(''); setStatusFilter('ALL'); setDepotFilter(''); setPage(1); }} 
                className="inline-flex items-center px-4 py-2 border border-yellow-500 text-sm font-medium rounded-md text-yellow-600 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Transformer</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Capacity</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action(s)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No transformers found.
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={openCreate} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add Transformer</button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((t) => {
                  const depotName = depots.find(x => x.id === (t.depot?.id ?? t.depotId))?.name ?? t.depot?.name ?? '—';
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-700">{t.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{depotName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{typeof t.capacity === 'number' ? `${t.capacity} kVA` : '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {t.isActive ? 'ACTIVE' : 'MAINTENANCE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <ActionMenu
                          onView={() => openView(t)}
                          onEdit={() => openEdit(t)}
                         /*  onDelete={() => deleteTransformer(t.id)} */
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
            <div className="flex-1 flex justify-between sm:hidden">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Next</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Showing <span className="font-medium text-gray-900">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium text-gray-900">{filtered.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md -space-x-px shadow-sm" aria-label="Pagination">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-blue-900 border-blue-900 text-white'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <TransformerCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        name={nameInput}
        setName={setNameInput}
        capacity={capacityInput}
        setCapacity={setCapacityInput}
        isActive={isActiveInput}
        setIsActive={setIsActiveInput}
        depotId={depotInput}
        setDepotId={setDepotInput}
        lat={latInput}
        setLat={setLatInput}
        lng={lngInput}
        setLng={setLngInput}
        depots={depots}
        saving={savingCreate}
        error={formError}
      />
      <TransformerEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        name={nameInput}
        setName={setNameInput}
        capacity={capacityInput}
        setCapacity={setCapacityInput}
        isActive={isActiveInput}
        setIsActive={setIsActiveInput}
        depotId={depotInput}
        setDepotId={setDepotInput}
        lat={latInput}
        setLat={setLatInput}
        lng={lngInput}
        setLng={setLngInput}
        depots={depots}
        saving={savingEdit}
        error={formError}
      />
      <TransformerViewModal open={showView} onClose={() => setShowView(false)} transformer={active} depots={depots} />
    </div>
  );
}

function SearchableSelect({ options, value, onChange, placeholder }: { options: { id: number; name: string }[]; value: number | ''; onChange: (v: number | '') => void; placeholder?: string }) {
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
          <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M12.9 14.32a8 8 0 111.414-1.414l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search…'}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white pl-10 pr-8 py-2 shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm hover:border-gray-400"
        />
        <button type="button" onClick={() => setOpen(v => !v)} className="absolute inset-y-0 right-0 px-2 text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z"/></svg>
        </button>
      </div>
      {open && (
        <div className="absolute z-10 mt-2 w-full rounded-md border border-gray-200 bg-white shadow focus:outline-none">
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

export function TransformerCreateModal({ open, onClose, onSubmit, name, setName, capacity, setCapacity, isActive, setIsActive, depotId, setDepotId, lat, setLat, lng, setLng, depots, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; capacity: number | ''; setCapacity: (v: number | '') => void; isActive: boolean; setIsActive: (v: boolean) => void; depotId: number | ''; setDepotId: (v: number | '') => void; lat: number | ''; setLat: (v: number | '') => void; lng: number | ''; setLng: (v: number | '') => void; depots: DepotOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <form onSubmit={onSubmit}>
        <div className="relative">
          {/* Header Background */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Create Transformer</h3>
              <button 
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-blue-100">Add a new transformer to the network.</p>
          </div>

          {/* Content Body */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              
              {/* Name Input */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Transformer Name *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Zap className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter transformer name" 
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
              </div>

              {/* Capacity and Depot */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Capacity (kVA) *</label>
                  <input 
                    type="number" 
                    value={capacity === '' ? '' : String(capacity)} 
                    onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))} 
                    placeholder="e.g. 500" 
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Depot Location *</label>
                  <SearchableSelect options={depots} value={depotId} onChange={setDepotId} placeholder="Select depot" />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Operational Status</p>
                      <p className="text-xs text-gray-500">{isActive ? 'Transformer will be active' : 'Transformer in maintenance'}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="peer sr-only" />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20"></div>
                  </label>
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Geographic Coordinates *</label>
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-3 border border-gray-100">
                  <div>
                    <span className="block text-xs text-gray-400 mb-1">Latitude</span>
                    <input 
                      type="number" 
                      step="any" 
                      value={lat === '' ? '' : String(lat)} 
                      onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="Lat" 
                      className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 mb-1">Longitude</span>
                    <input 
                      type="number" 
                      step="any" 
                      value={lng === '' ? '' : String(lng)} 
                      onChange={(e) => setLng(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="Lng" 
                      className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error creating transformer</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button 
                type="button" 
                onClick={onClose} 
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 104 12z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Transformer'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function TransformerEditModal({ open, onClose, onSubmit, name, setName, capacity, setCapacity, isActive, setIsActive, depotId, setDepotId, lat, setLat, lng, setLng, depots, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; name: string; setName: (v: string) => void; capacity: number | ''; setCapacity: (v: number | '') => void; isActive: boolean; setIsActive: (v: boolean) => void; depotId: number | ''; setDepotId: (v: number | '') => void; lat: number | ''; setLat: (v: number | '') => void; lng: number | ''; setLng: (v: number | '') => void; depots: DepotOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <form onSubmit={onSubmit}>
        <div className="relative">
          {/* Header Background */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Transformer</h3>
              <button 
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-blue-100">Update the transformer's information and status.</p>
          </div>

          {/* Content Body */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              
              {/* Name Input */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Transformer Name *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Zap className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter transformer name" 
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
              </div>

              {/* Capacity and Depot */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Capacity (kVA) *</label>
                  <input 
                    type="number" 
                    value={capacity === '' ? '' : String(capacity)} 
                    onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))} 
                    placeholder="e.g. 500" 
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Depot Location *</label>
                  <SearchableSelect options={depots} value={depotId} onChange={setDepotId} placeholder="Select depot" />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Operational Status</p>
                      <p className="text-xs text-gray-500">{isActive ? 'Transformer is currently active' : 'Transformer is in maintenance'}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="peer sr-only" />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20"></div>
                  </label>
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Geographic Coordinates *</label>
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-3 border border-gray-100">
                  <div>
                    <span className="block text-xs text-gray-400 mb-1">Latitude</span>
                    <input 
                      type="number" 
                      step="any" 
                      value={lat === '' ? '' : String(lat)} 
                      onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="Lat" 
                      className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 mb-1">Longitude</span>
                    <input 
                      type="number" 
                      step="any" 
                      value={lng === '' ? '' : String(lng)} 
                      onChange={(e) => setLng(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="Lng" 
                      className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error saving transformer</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
              <button 
                type="button" 
                onClick={onClose} 
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 104 12z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function TransformerViewModal({ open, onClose, transformer, depots }: { open: boolean; onClose: () => void; transformer: Transformer | null; depots: DepotOption[] }) {
  const depotName = transformer ? (depots.find(x => x.id === (transformer.depot?.id ?? transformer.depotId))?.name ?? transformer.depot?.name ?? '—') : '—';
  
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="relative">
        {/* Header Background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Transformer Details</h3>
            <button 
              onClick={onClose}
              className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-100">Transformer Name</p>
              <p className="text-lg font-bold text-white">{transformer?.name ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            
            {/* Status */}
            <div className="col-span-full">
               <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                 <div className={`flex h-10 w-10 items-center justify-center rounded-full ${transformer?.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                   <Activity className="h-5 w-5" />
                 </div>
                 <div>
                   <p className="text-xs font-medium text-gray-500">Operational Status</p>
                   <div className="flex items-center gap-2">
                     <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${transformer?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                       {transformer?.isActive ? 'ACTIVE' : 'MAINTENANCE'}
                     </span>
                   </div>
                 </div>
               </div>
            </div>

            {/* Capacity */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Capacity</p>
                <p className="text-sm font-semibold text-gray-900">
                  {typeof transformer?.capacity === 'number' ? `${transformer.capacity} kVA` : '—'}
                </p>
              </div>
            </div>

            {/* Depot */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Depot Location</p>
                <p className="text-sm font-semibold text-gray-900">{depotName}</p>
              </div>
            </div>

            {/* Location (Lat/Lng) */}
            <div className="col-span-full border-t border-gray-100 pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="w-full">
                  <p className="text-xs font-medium text-gray-500 mb-1">Geographic Coordinates</p>
                  <div className="grid grid-cols-2 gap-4 rounded-md bg-gray-50 p-3 text-sm">
                    <div>
                      <span className="block text-xs text-gray-400">Latitude</span>
                      <span className="font-mono font-medium text-gray-700">{typeof transformer?.lat === 'number' ? transformer.lat : '—'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400">Longitude</span>
                      <span className="font-mono font-medium text-gray-700">{typeof transformer?.lng === 'number' ? transformer.lng : '—'}</span>
                    </div>
                  </div>
                </div>
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
