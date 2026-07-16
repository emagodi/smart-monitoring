import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '../../components/ui/alert/Alert';
import Button from '../../components/ui/button/Button';
import { Search, Loader2, Cpu, Settings, Link2, Save } from 'lucide-react';
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
}

export default function NewControllersIndex() {
  const { token, hasPermission, user } = useAuth();
  const navigate = useNavigate();
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
          .map((item) => ({ id: item.id, name: item.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err) {
      console.error('Transformer lookup error:', err);
      setTransformers([]);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (token) {
      fetchControllers();
      fetchTransformers();
    } else {
       console.log('No token available');
    }
  }, [token, fetchControllers, fetchTransformers]);

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
      setShowAssign(false);
      setActive(null);
      setTransformerInput('');
      await fetchControllers();
      await fetchTransformers();
    } catch (err: any) {
      console.error(err);
      setAssignError(err.response?.data?.message || 'Failed to assign controller.');
    } finally {
      setAssigning(false);
    }
  };

  const filtered = items.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.deviceId.toLowerCase().includes(q) ||
      c.devEui.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /><span className="ml-2 text-gray-500">Loading controllers...</span></div>;

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={() => fetchControllers()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">      
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
             <Cpu className="w-8 h-8 text-brand-500" />
             New Controllers
           </h2>
           <p className="mt-1 text-sm text-gray-500">
             {isSupplierUser
               ? 'Assign unlinked controllers to any transformer visible to your organisation.'
               : 'Manage unassigned controllers and assign them to transformers.'}
           </p>
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

              {/* Search Bar */}
              <div className="flex-1 max-w-md relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search controllers..." 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm" 
                />
              </div>
            </div>
            
             <button 
                onClick={() => fetchControllers()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 shadow-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Refresh
              </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Device ID</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">DevEUI</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                    No unassigned controllers found.
                  </td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-700">{c.name}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{c.deviceId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{c.devEui}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                         <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800">
                           {c.type}
                         </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {canUpdate ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openAssign(c)}>
                            <Link2 className="w-4 h-4 mr-1" /> Assign
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/new-controllers/${c.id}/edit`)}>
                            <Settings className="w-4 h-4 mr-1" /> Edit
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No access</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
               <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Previous</button>
               <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Next</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Showing <span className="font-medium text-gray-900">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium text-gray-900">{filtered.length}</span> results</p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">«</button>
                  {/* Simple pagination logic */}
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">»</button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} className="max-w-xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl" backdropBlur={true}>
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 px-6 py-6">
          <h3 className="text-xl font-bold text-white">Assign To Transformer</h3>
          <p className="mt-1 text-sm text-brand-100">Link this controller to a supplier-visible transformer.</p>
        </div>
        <form onSubmit={submitAssign} className="space-y-6 p-6">
          {assignError ? <Alert variant="error" title="Assignment" message={assignError} /> : null}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
            <InfoCard label="Controller" value={active?.name || '—'} />
            <InfoCard label="Device ID" value={active?.deviceId || '—'} />
            <InfoCard label="Current Assignment" value={active?.transformer?.name || 'Unassigned'} />
            <InfoCard label="Last Updated" value={active?.updatedAt ? new Date(active.updatedAt).toLocaleString() : 'Not yet updated'} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Transformer</label>
            <SearchableSelect
              options={transformers}
              value={transformerInput}
              onChange={(value) => setTransformerInput(value)}
              placeholder={isSupplierUser ? 'Select organisation transformer...' : 'Select transformer...'}
            />
            <p className="mt-2 text-xs text-gray-500">
              {isSupplierUser
                ? 'Only transformers visible to your organisation are listed here.'
                : 'Select the transformer that should own this controller.'}
            </p>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAssign(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={assigning}>
              {!assigning ? <Save className="w-4 h-4 mr-1" /> : null}
              Save Assignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
