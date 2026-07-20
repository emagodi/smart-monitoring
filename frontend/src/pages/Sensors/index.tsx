import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, X, Search, Filter, Loader2, Activity, Cpu, Radio, Router, Link2, Save } from 'lucide-react';

interface Sensor {
  id: number;
  deviceId: string;
  devEui: string;
  name: string;
  type: string;
  transformerId?: number;
  transformer?: { id: number; name: string };
  sensor_reading?: Array<Record<string, any>>;
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
const SENSOR_TYPES = ['temperature', 'contact', 'suspicious_tilt', 'motion', 'video', 'controller'] as const;

export default function SensorsIndex() {
  const { token, hasPermission, user } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';
  const [items, setItems] = useState<Sensor[]>([]);
  const [transformers, setTransformers] = useState<TransformerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [active, setActive] = useState<Sensor | null>(null);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [devEuiInput, setDevEuiInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [typeInput, setTypeInput] = useState('');
  const [transformerInput, setTransformerInput] = useState<number | ''>('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Sensor | null>(null);

  const [transformerFilter, setTransformerFilter] = useState<number | ''>('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  const canCreate = hasPermission('sensors.create');
  const canUpdate = hasPermission('sensors.update');
  const canDelete = hasPermission('sensors.delete');

  const normalizeList = (payload: unknown): Sensor[] => {
    if (Array.isArray(payload)) return payload as Sensor[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as Sensor[];
    }
    return [];
  };

  const fetchTransformerOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/assignment-options`, { headers });
      const arr = Array.isArray(res.data) ? (res.data as TransformerOption[]) : ((res.data?.data as TransformerOption[]) ?? []);
      setTransformers(
        arr
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            description: buildTransformerDescription(t),
            searchText: buildTransformerSearchText(t),
            badge: t.supplierName || t.type || undefined,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      setTransformers([]);
    }
  }, [API_BASE_URL, headers]);

  const fetchSensors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = typeof transformerFilter === 'number'
        ? `${API_BASE_URL}/api/v1/sensors/transformer/${transformerFilter}`
        : `${API_BASE_URL}/api/v1/sensors`;
      const res = await axios.get(url, { headers });
      const list = normalizeList(res.data);
      setItems(list.map((s: any) => ({
        id: s.id,
        deviceId: s.deviceId ?? s.deviceid ?? '',
        devEui: s.devEui ?? s.devEui ?? '',
        name: s.name ?? '',
        type: s.type ?? '',
        transformerId: s.transformerId ?? s.transformer_id,
        transformer: s.transformer,
        sensor_reading: Array.isArray(s.sensor_reading) ? s.sensor_reading : [],
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })) as Sensor[]);
    } catch {
      setError('Failed to fetch sensors');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, transformerFilter]);

  useEffect(() => {
    if (token) {
      fetchTransformerOptions();
      fetchSensors();
    }
  }, [token, fetchTransformerOptions, fetchSensors]);

  const openCreate = () => {
    setDeviceIdInput('');
    setDevEuiInput('');
    setNameInput('');
    setTypeInput('');
    setTransformerInput('');
    setActive(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (row: Sensor) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/sensors/${row.id}`, { headers });
      const s = (res.data as Sensor) || row;
      setActive(s);
      setDeviceIdInput(s.deviceId);
      setDevEuiInput(s.devEui);
      setNameInput(s.name);
      setTypeInput(s.type);
      setTransformerInput(s.transformer?.id ?? s.transformerId ?? '');
    } catch {
      setActive(row);
      setDeviceIdInput(row.deviceId);
      setDevEuiInput(row.devEui);
      setNameInput(row.name);
      setTypeInput(row.type);
      setTransformerInput(row.transformer?.id ?? row.transformerId ?? '');
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (row: Sensor) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/sensors/${row.id}`, { headers });
      setActive(res.data as Sensor);
    } catch {
      setActive(row);
    }
    setShowView(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!deviceIdInput.trim()) { setFormError('Enter deviceId'); return; }
      if (!devEuiInput.trim()) { setFormError('Enter devEui'); return; }
      if (!nameInput.trim()) { setFormError('Enter name'); return; }
      if (!SENSOR_TYPES.includes(typeInput as typeof SENSOR_TYPES[number])) { setFormError('Select a valid type'); return; }
      if (!transformerInput || typeof transformerInput !== 'number') { setFormError('Select a transformer'); return; }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(`${API_BASE_URL}/api/v1/sensors/create`, { deviceId: deviceIdInput.trim(), devEui: devEuiInput.trim(), name: nameInput.trim(), type: typeInput.trim(), transformerId: transformerInput }, { headers });
      setShowCreate(false);
      setDeviceIdInput('');
      setDevEuiInput('');
      setNameInput('');
      setTypeInput('');
      setTransformerInput('');
      await fetchSensors();
      setNotice({ variant: 'success', title: 'Sensor created', message: 'The sensor was created successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create sensor');
      setNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the sensor.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!active) return;
      if (!deviceIdInput.trim()) { setFormError('Enter deviceId'); return; }
      if (!devEuiInput.trim()) { setFormError('Enter devEui'); return; }
      if (!nameInput.trim()) { setFormError('Enter name'); return; }
      if (!SENSOR_TYPES.includes(typeInput as typeof SENSOR_TYPES[number])) { setFormError('Select a valid type'); return; }
      if (!transformerInput || typeof transformerInput !== 'number') { setFormError('Select a transformer'); return; }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(`${API_BASE_URL}/api/v1/sensors/${active.id}`, { deviceId: deviceIdInput.trim(), devEui: devEuiInput.trim(), name: nameInput.trim(), type: typeInput.trim(), transformerId: transformerInput }, { headers });
      setShowEdit(false);
      setActive(null);
      setDeviceIdInput('');
      setDevEuiInput('');
      setNameInput('');
      setTypeInput('');
      setTransformerInput('');
      await fetchSensors();
      setNotice({ variant: 'success', title: 'Sensor updated', message: 'Changes were saved successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update sensor');
      setNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the sensor.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (row: Sensor) => {
    setActive(row);
    setDeleteError(null);
    setShowDelete(true);
  };

  const openAssign = (row: Sensor) => {
    setAssignTarget(row);
    setTransformerInput(row.transformer?.id ?? row.transformerId ?? '');
    setAssignError(null);
    setShowAssign(true);
  };

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;
    try {
      if (!transformerInput || typeof transformerInput !== 'number') {
        setAssignError('Select a transformer for this sensor.');
        return;
      }
      setAssigning(true);
      setAssignError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/sensors/${assignTarget.id}`,
        {
          deviceId: assignTarget.deviceId,
          devEui: assignTarget.devEui,
          name: assignTarget.name,
          type: assignTarget.type,
          transformerId: transformerInput,
        },
        { headers }
      );
      setShowAssign(false);
      setAssignTarget(null);
      setTransformerInput('');
      await fetchSensors();
      await fetchTransformerOptions();
      setNotice({ variant: 'success', title: 'Sensor assigned', message: 'The sensor assignment was updated successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      console.error(err);
      setAssignError(err.response?.data?.message || 'Failed to assign sensor.');
    } finally {
      setAssigning(false);
    }
  };

  const confirmDelete = async () => {
    if (!active) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await axios.delete(`${API_BASE_URL}/api/v1/sensors/${active.id}`, { headers });
      setShowDelete(false);
      setActive(null);
      await fetchSensors();
      setNotice({ variant: 'success', title: 'Sensor deleted', message: 'The sensor was deleted successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setDeleteError('Failed to delete sensor');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = items.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const tName = transformers.find(x => x.id === (s.transformer?.id ?? s.transformerId))?.name ?? '';
    return (
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.deviceId.toLowerCase().includes(q) ||
      s.devEui.toLowerCase().includes(q) ||
      tName.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(paginated.map((s) => s.id));
    else setSelectedIds([]);
  };
  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /><span className="ml-2 text-gray-500">Loading sensors...</span></div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.variant} title={notice.title} message={notice.message} />
      )}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sensors</h2>
           <p className="mt-1 text-sm text-gray-500">
             {isSupplierUser ? 'Manage sensors and assign them to any transformer visible to your organisation.' : 'Manage and monitor your IoT sensors.'}
           </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate ? <Button size="sm" onClick={openCreate} startIcon={<Plus className="w-4 h-4" />}>Add Sensor</Button> : null}
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

               {/* Transformer Filter */}
              <div className="flex items-center gap-2">
                 <span className="text-sm font-bold text-brand-500 bg-brand-50 px-2 py-1 rounded">Transformer</span>
                 <div className="w-[200px]">
                    <SearchableSelect 
                        options={transformers} 
                        value={transformerFilter} 
                        onChange={(v) => { setTransformerFilter(v); setPage(1); }} 
                        placeholder="All Transformers" 
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
                  placeholder="Search sensors..." 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm" 
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchSensors()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 shadow-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button 
                onClick={() => { setSearch(''); setTransformerFilter(''); setPage(1); }} 
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Device ID</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">DevEUI</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Transformer</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    No sensors found.
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={fetchSensors} className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Refresh</button>
                      {canCreate ? <button onClick={openCreate} className="rounded bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Add Sensor</button> : null}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((s) => {
                  const tName = transformers.find(x => x.id === (s.transformer?.id ?? s.transformerId))?.name ?? s.transformer?.name ?? '—';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-700">{s.name}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800">
                           {s.type}
                         </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{s.deviceId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{s.devEui}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <ActionMenu
                          placement="bottom-end"
                          onView={() => openView(s)}
                          onEdit={canUpdate ? () => openEdit(s) : undefined}
                          onDelete={canDelete ? () => openDelete(s) : undefined}
                          extras={canUpdate ? [{
                            label: 'Assign To Transformer',
                            onClick: () => openAssign(s),
                            icon: <Link2 className="w-4 h-4" />
                          }] : undefined}
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
                <p className="text-sm text-gray-500">Showing <span className="font-medium text-gray-900">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium text-gray-900">{filtered.length}</span> results</p>
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

      <SensorCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        deviceId={deviceIdInput}
        setDeviceId={setDeviceIdInput}
        devEui={devEuiInput}
        setDevEui={setDevEuiInput}
        name={nameInput}
        setName={setNameInput}
        type={typeInput}
        setType={setTypeInput}
        transformerId={transformerInput}
        setTransformerId={setTransformerInput}
        transformers={transformers}
        saving={savingCreate}
        error={formError}
      />
      <SensorEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        deviceId={deviceIdInput}
        setDeviceId={setDeviceIdInput}
        devEui={devEuiInput}
        setDevEui={setDevEuiInput}
        name={nameInput}
        setName={setNameInput}
        type={typeInput}
        setType={setTypeInput}
        transformerId={transformerInput}
        setTransformerId={setTransformerInput}
        transformers={transformers}
        saving={savingEdit}
        error={formError}
      />
      <SensorViewModal open={showView} onClose={() => setShowView(false)} sensor={active} transformers={transformers} />
      <SensorDeleteModal 
        open={showDelete} 
        onClose={() => setShowDelete(false)} 
        onConfirm={confirmDelete} 
        sensor={active} 
        deleting={deleting} 
        error={deleteError} 
      />
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} className="max-w-xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
          <h3 className="text-xl font-bold text-white">Assign To Transformer</h3>
          <p className="mt-1 text-sm text-blue-100">Link this sensor to a transformer visible to your organisation.</p>
        </div>
        <form onSubmit={submitAssign} className="space-y-6 p-6">
          {assignError ? <Alert variant="error" title="Assignment" message={assignError} /> : null}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
            <AssignmentInfo label="Sensor" value={assignTarget?.name || '—'} />
            <AssignmentInfo label="Device ID" value={assignTarget?.deviceId || '—'} />
            <AssignmentInfo
              label="Current Assignment"
              value={
                transformers.find((item) => item.id === (assignTarget?.transformer?.id ?? assignTarget?.transformerId))?.name ||
                assignTarget?.transformer?.name ||
                'Unassigned'
              }
            />
            <AssignmentInfo label="Last Updated" value={assignTarget?.updatedAt ? new Date(assignTarget.updatedAt).toLocaleString() : 'Not yet updated'} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Transformer</label>
            <SearchableSelect options={transformers} value={transformerInput} onChange={setTransformerInput} placeholder="Select organisation transformer" />
            <p className="mt-2 text-xs text-gray-500">
              {isSupplierUser ? 'Only transformers visible to your organisation are listed here.' : 'Select the transformer that should own this sensor.'}
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

function AssignmentInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export function SensorDeleteModal({ open, onClose, onConfirm, sensor, deleting, error }: { open: boolean; onClose: () => void; onConfirm: () => void; sensor: Sensor | null; deleting: boolean; error?: string | null }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-md w-full p-0 overflow-hidden rounded-2xl" backdropBlur={true}>
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-bold text-white">Delete Sensor</h3>
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
            Are you sure you want to delete the sensor <span className="font-bold text-gray-900">{sensor?.name}</span>?
            <br />
            All data associated with this sensor will be permanently removed.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={deleting} 
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {deleting ? 'Deleting...' : 'Delete Sensor'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SearchableSelect({ options, value, onChange, placeholder, compact }: { options: TransformerOption[]; value: number | ''; onChange: (v: number | '') => void; placeholder?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = typeof value === 'number' ? options.find(o => o.id === value) : undefined;
  const filtered = options.filter(o =>
    `${o.name} ${o.description || ''} ${o.searchText || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative group">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className={`h-4 w-4 ${compact ? 'text-gray-400' : 'text-gray-400 group-focus-within:text-blue-500'}`} />
        </span>
        <input
          type="text"
          value={open ? query : (query || selected?.name || '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => {
            if (!open && query === selected?.name) {
              setQuery('');
            }
            setOpen(true);
          }}
          placeholder={placeholder || 'Search…'}
          className={compact 
            ? "block w-full pl-9 pr-8 py-1.5 border-none bg-transparent text-sm font-medium focus:ring-0 placeholder-gray-400"
            : "mt-1 block w-full rounded-md border border-gray-300 bg-white pl-10 pr-8 py-2 shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm hover:border-gray-400"
          }
        />
        <button
          type="button"
          onClick={() => {
            setOpen(v => {
              const next = !v;
              if (next && query === selected?.name) {
                setQuery('');
              }
              return next;
            });
          }}
          className="absolute inset-y-0 right-0 px-2 text-gray-400 hover:text-gray-600"
        >
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
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{opt.name}</span>
                        {opt.badge ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">{opt.badge}</span> : null}
                      </span>
                      {opt.description ? <span className="mt-0.5 block truncate text-xs text-gray-500">{opt.description}</span> : null}
                    </span>
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

export function SensorCreateModal({ open, onClose, onSubmit, deviceId, setDeviceId, devEui, setDevEui, name, setName, type, setType, transformerId, setTransformerId, transformers, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; deviceId: string; setDeviceId: (v: string) => void; devEui: string; setDevEui: (v: string) => void; name: string; setName: (v: string) => void; type: string; setType: (v: string) => void; transformerId: number | ''; setTransformerId: (v: number | '') => void; transformers: TransformerOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Sensors</h3>
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
                <p className="text-xl font-bold text-white">Add New Sensor</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                    <div className="relative rounded-md">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Activity className="h-4 w-4 text-blue-500" />
                        </div>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sensor Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type *</label>
                    <div className="relative rounded-md">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Radio className="h-4 w-4 text-blue-500" />
                        </div>
                        <select value={type} onChange={(e) => setType(e.target.value)} className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all">
                        <option value="">Select type</option>
                        {SENSOR_TYPES.map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                        </select>
                    </div>
                </div>
            </div>
             <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Device ID *</label>
                    <div className="relative rounded-md">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Cpu className="h-4 w-4 text-blue-500" />
                        </div>
                        <input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Device ID" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">DevEUI *</label>
                    <div className="relative rounded-md">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Router className="h-4 w-4 text-blue-500" />
                        </div>
                        <input type="text" value={devEui} onChange={(e) => setDevEui(e.target.value)} placeholder="DevEUI" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
             </div>
        </div>

        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Transformer *</label>
            <SearchableSelect options={transformers} value={transformerId} onChange={setTransformerId} placeholder="Select associated transformer" />
            <p className="mt-1 text-xs text-gray-500">The transformer this sensor is attached to.</p>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button 
            type="submit" 
            disabled={saving} 
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {saving ? 'Creating...' : 'Create Sensor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SensorEditModal({ open, onClose, onSubmit, deviceId, setDeviceId, devEui, setDevEui, name, setName, type, setType, transformerId, setTransformerId, transformers, saving, error }: { open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; deviceId: string; setDeviceId: (v: string) => void; devEui: string; setDevEui: (v: string) => void; name: string; setName: (v: string) => void; type: string; setType: (v: string) => void; transformerId: number | ''; setTransformerId: (v: number | '') => void; transformers: TransformerOption[]; saving?: boolean; error?: string | null; }) {
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
        <div className="flex items-center justify-between">
           <h3 className="text-sm font-medium text-blue-100">Sensors</h3>
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
                <Activity className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xl font-bold text-white">Edit Sensor</p>
                <p className="text-sm text-blue-100">Update sensor details</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                    <div className="relative rounded-md">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Activity className="h-4 w-4 text-blue-500" />
                        </div>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sensor Name" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type *</label>
                    <div className="relative rounded-md">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Radio className="h-4 w-4 text-blue-500" />
                        </div>
                        <select value={type} onChange={(e) => setType(e.target.value)} className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all">
                        <option value="">Select type</option>
                        {SENSOR_TYPES.map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                        </select>
                    </div>
                </div>
            </div>
             <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Device ID *</label>
                    <div className="relative rounded-md">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Cpu className="h-4 w-4 text-blue-500" />
                        </div>
                        <input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Device ID" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">DevEUI *</label>
                    <div className="relative rounded-md">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Router className="h-4 w-4 text-blue-500" />
                        </div>
                        <input type="text" value={devEui} onChange={(e) => setDevEui(e.target.value)} placeholder="DevEUI" className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                </div>
             </div>
        </div>

        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Transformer *</label>
            <SearchableSelect options={transformers} value={transformerId} onChange={setTransformerId} placeholder="Select associated transformer" />
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
          <button 
            type="submit" 
            disabled={saving} 
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SensorViewModal({ open, onClose, sensor, transformers }: { open: boolean; onClose: () => void; sensor: Sensor | null; transformers: TransformerOption[] }) {
  const tName = sensor ? (transformers.find(x => x.id === (sensor.transformer?.id ?? sensor.transformerId))?.name ?? sensor.transformer?.name ?? '—') : '—';
  
  return (
    <Modal isOpen={open} onClose={onClose} className="max-w-lg w-full overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
      <div className="relative">
        {/* Header Background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Sensor Details</h3>
            <button 
              onClick={onClose}
              className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-100">Sensor Name</p>
              <p className="text-lg font-bold text-white">{sensor?.name ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            
            {/* Type */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Sensor Type</p>
                <p className="text-sm font-semibold text-gray-900 capitalize">{sensor?.type ?? '—'}</p>
              </div>
            </div>

            {/* Transformer */}
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Associated Transformer</p>
                <p className="text-sm font-semibold text-gray-900">{tName}</p>
              </div>
            </div>

            {/* Device ID & DevEUI */}
            <div className="col-span-full border-t border-gray-100 pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Cpu className="h-4 w-4" />
                </div>
                <div className="w-full">
                  <p className="text-xs font-medium text-gray-500 mb-1">Device Information</p>
                  <div className="grid grid-cols-2 gap-4 rounded-md bg-gray-50 p-3 text-sm">
                    <div>
                      <span className="block text-xs text-gray-400">Device ID</span>
                      <span className="font-mono font-medium text-gray-700 break-all">{sensor?.deviceId ?? '—'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400">DevEUI</span>
                      <span className="font-mono font-medium text-gray-700 break-all">{sensor?.devEui ?? '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Readings Table */}
            {sensor?.sensor_reading && sensor.sensor_reading.length > 0 && (
              <div className="col-span-full border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Readings</h4>
                <div className="max-h-48 overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {sensor.sensor_reading.map((r, idx) => {
                        const ts = r.updated_at || r.created_at;
                        const t = sensor?.type;
                        let display: string | number | undefined = undefined;
                        if (t === 'temperature') display = r.temperature ?? r.value ?? r.temp;
                        else if (t === 'oil_level') display = r.oil_level ?? r.level ?? r.value;
                        else if (t === 'pressure') display = r.pressure ?? r.value;
                        else if (t === 'current') display = r.current ?? r.value;
                        else if (t === 'voltage') display = r.voltage ?? r.value;
                        else if (t === 'humidity') display = r.humidity ?? r.value;
                        else if (t === 'contact') display = r.contact ?? r.value;
                        else if (t === 'motion') display = r.motion ?? r.value;
                        else if (t === 'video') display = r.active ?? r.value;
                        else display = r.value;
                        const unit = t === 'temperature' ? '°C'
                          : t === 'oil_level' ? '%'
                          : t === 'pressure' ? 'PSI'
                          : t === 'current' ? 'A'
                          : t === 'voltage' ? 'V'
                          : t === 'humidity' ? '%'
                          : t === 'contact' ? ''
                          : t === 'motion' ? ''
                          : t === 'video' ? ''
                          : '';
                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{ts ? new Date(ts).toLocaleString() : '—'}</td>
                            <td className="px-3 py-2 text-gray-900 font-medium">
                              {typeof display === 'boolean' ? (display ? 'ACTIVE' : 'INACTIVE') : String(display)} {unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
