import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  Activity,
  Cpu,
  Filter,
  Link2,
  Loader2,
  Plus,
  Radio,
  RefreshCcw,
  Router,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import { Modal } from '../../components/ui/modal';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';
import { useAuth } from '../../context/AuthContext';

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

type Notice = {
  variant: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
};

type SensorType = (typeof SENSOR_TYPES)[number];

type SensorFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  deviceId: string;
  setDeviceId: (value: string) => void;
  devEui: string;
  setDevEui: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  transformerId: number | '';
  setTransformerId: (value: number | '') => void;
  transformers: TransformerOption[];
  saving?: boolean;
  error?: string | null;
  mode: 'create' | 'edit';
};

const SENSOR_TYPES = ['temperature', 'contact', 'suspicious_tilt', 'motion', 'video', 'controller'] as const;
const ALL_TRANSFORMERS_OPTION = '__all_transformers__';

const normalizeList = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];

  for (const key of ['data', 'content', 'items', 'records']) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

const normalizeSensor = (payload: any): Sensor => ({
  id: payload?.id,
  deviceId: payload?.deviceId ?? payload?.deviceid ?? '',
  devEui: payload?.devEui ?? payload?.dev_eui ?? '',
  name: payload?.name ?? '',
  type: payload?.type ?? '',
  transformerId: payload?.transformerId ?? payload?.transformer_id,
  transformer: payload?.transformer,
  sensor_reading: Array.isArray(payload?.sensor_reading) ? payload.sensor_reading : [],
  createdAt: payload?.createdAt ?? payload?.created_at,
  updatedAt: payload?.updatedAt ?? payload?.updated_at,
});

const formatSensorType = (value?: string | null) =>
  (value || 'Unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return 'No recent update';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No recent update';
  return date.toLocaleString();
};

const getTypeTone = (type?: string) => {
  switch (type) {
    case 'temperature':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    case 'contact':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'suspicious_tilt':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    case 'motion':
      return 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300';
    case 'video':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
    case 'controller':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
};

const getReadingSummary = (sensorType: string | undefined, reading: Record<string, any>) => {
  const type = sensorType || '';
  let display: string | number | boolean | undefined;

  if (type === 'temperature') display = reading.temperature ?? reading.value ?? reading.temp;
  else if (type === 'oil_level') display = reading.oil_level ?? reading.level ?? reading.value;
  else if (type === 'pressure') display = reading.pressure ?? reading.value;
  else if (type === 'current') display = reading.current ?? reading.value;
  else if (type === 'voltage') display = reading.voltage ?? reading.value;
  else if (type === 'humidity') display = reading.humidity ?? reading.value;
  else if (type === 'contact') display = reading.contact ?? reading.value;
  else if (type === 'motion') display = reading.motion ?? reading.value;
  else if (type === 'video') display = reading.active ?? reading.value;
  else display = reading.value;

  const unit =
    type === 'temperature'
      ? '°C'
      : type === 'oil_level'
        ? '%'
        : type === 'pressure'
          ? 'PSI'
          : type === 'current'
            ? 'A'
            : type === 'voltage'
              ? 'V'
              : type === 'humidity'
                ? '%'
                : '';

  if (typeof display === 'boolean') return display ? 'ACTIVE' : 'INACTIVE';
  if (display === null || display === undefined || display === '') return 'No value';
  return `${String(display)}${unit ? ` ${unit}` : ''}`;
};

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
  const [notice, setNotice] = useState<Notice | null>(null);
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

  const fetchTransformerOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/assignment-options`, { headers });
      const arr = Array.isArray(res.data)
        ? (res.data as TransformerOption[])
        : ((res.data?.data as TransformerOption[]) ?? []);

      setTransformers(
        arr
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: buildTransformerDescription(item),
            searchText: buildTransformerSearchText(item),
            badge: item.supplierName || item.type || undefined,
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
      const url =
        typeof transformerFilter === 'number'
          ? `${API_BASE_URL}/api/v1/sensors/transformer/${transformerFilter}`
          : `${API_BASE_URL}/api/v1/sensors`;
      const res = await axios.get(url, { headers });
      const list = normalizeList(res.data);
      setItems(list.map((sensor) => normalizeSensor(sensor)));
    } catch {
      setError('Failed to fetch sensors');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, transformerFilter]);

  useEffect(() => {
    if (!token) return;
    void fetchTransformerOptions();
    void fetchSensors();
  }, [token, fetchTransformerOptions, fetchSensors]);

  const transformerLookup = useMemo(
    () => new Map(transformers.map((transformer) => [transformer.id, transformer.name])),
    [transformers]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((sensor) => {
      const transformerName =
        transformerLookup.get(sensor.transformer?.id ?? sensor.transformerId ?? -1) ??
        sensor.transformer?.name ??
        '';

      return (
        sensor.name.toLowerCase().includes(query) ||
        sensor.type.toLowerCase().includes(query) ||
        sensor.deviceId.toLowerCase().includes(query) ||
        sensor.devEui.toLowerCase().includes(query) ||
        transformerName.toLowerCase().includes(query)
      );
    });
  }, [items, search, transformerLookup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const totalSensors = items.length;
    const assignedSensors = items.filter((sensor) => Boolean(sensor.transformerId ?? sensor.transformer?.id)).length;
    const telemetrySensors = items.filter((sensor) => (sensor.sensor_reading?.length ?? 0) > 0).length;
    const distinctTypes = new Set(items.map((sensor) => sensor.type).filter(Boolean)).size;

    return {
      totalSensors,
      assignedSensors,
      unassignedSensors: totalSensors - assignedSensors,
      telemetrySensors,
      distinctTypes,
    };
  }, [items]);

  const typeDistribution = useMemo(() => {
    const grouped = new Map<string, number>();
    items.forEach((sensor) => {
      const key = sensor.type || 'unknown';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const transformerDistribution = useMemo(() => {
    const grouped = new Map<string, number>();
    items.forEach((sensor) => {
      const name =
        transformerLookup.get(sensor.transformer?.id ?? sensor.transformerId ?? -1) ??
        sensor.transformer?.name ??
        'Unassigned';
      grouped.set(name, (grouped.get(name) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items, transformerLookup]);

  const transformerFilterOptions = useMemo(
    () => [
      { id: ALL_TRANSFORMERS_OPTION, name: 'All transformers', description: 'Show the full sensor inventory' },
      ...transformers,
    ],
    [transformers]
  );

  const activeFilterName =
    typeof transformerFilter === 'number'
      ? transformerLookup.get(transformerFilter) ?? 'Selected transformer'
      : 'All transformers';

  const showNotice = (nextNotice: Notice, duration = 4000) => {
    setNotice(nextNotice);
    window.setTimeout(() => setNotice(null), duration);
  };

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
      const sensor = normalizeSensor(res.data || row);
      setActive(sensor);
      setDeviceIdInput(sensor.deviceId);
      setDevEuiInput(sensor.devEui);
      setNameInput(sensor.name);
      setTypeInput(sensor.type);
      setTransformerInput(sensor.transformer?.id ?? sensor.transformerId ?? '');
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
      setActive(normalizeSensor(res.data));
    } catch {
      setActive(row);
    }
    setShowView(true);
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

  const submitCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (!deviceIdInput.trim()) {
        setFormError('Enter deviceId');
        return;
      }
      if (!devEuiInput.trim()) {
        setFormError('Enter devEui');
        return;
      }
      if (!nameInput.trim()) {
        setFormError('Enter name');
        return;
      }
      if (!SENSOR_TYPES.includes(typeInput as SensorType)) {
        setFormError('Select a valid type');
        return;
      }
      if (!transformerInput || typeof transformerInput !== 'number') {
        setFormError('Select a transformer');
        return;
      }

      setSavingCreate(true);
      setFormError(null);
      await axios.post(
        `${API_BASE_URL}/api/v1/sensors/create`,
        {
          deviceId: deviceIdInput.trim(),
          devEui: devEuiInput.trim(),
          name: nameInput.trim(),
          type: typeInput.trim(),
          transformerId: transformerInput,
        },
        { headers }
      );

      setShowCreate(false);
      setDeviceIdInput('');
      setDevEuiInput('');
      setNameInput('');
      setTypeInput('');
      setTransformerInput('');
      await fetchSensors();
      showNotice({ variant: 'success', title: 'Sensor created', message: 'The sensor was created successfully.' });
    } catch {
      setFormError('Failed to create sensor');
      showNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the sensor.' }, 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (!active) return;
      if (!deviceIdInput.trim()) {
        setFormError('Enter deviceId');
        return;
      }
      if (!devEuiInput.trim()) {
        setFormError('Enter devEui');
        return;
      }
      if (!nameInput.trim()) {
        setFormError('Enter name');
        return;
      }
      if (!SENSOR_TYPES.includes(typeInput as SensorType)) {
        setFormError('Select a valid type');
        return;
      }
      if (!transformerInput || typeof transformerInput !== 'number') {
        setFormError('Select a transformer');
        return;
      }

      setSavingEdit(true);
      setFormError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/sensors/${active.id}`,
        {
          deviceId: deviceIdInput.trim(),
          devEui: devEuiInput.trim(),
          name: nameInput.trim(),
          type: typeInput.trim(),
          transformerId: transformerInput,
        },
        { headers }
      );

      setShowEdit(false);
      setActive(null);
      setDeviceIdInput('');
      setDevEuiInput('');
      setNameInput('');
      setTypeInput('');
      setTransformerInput('');
      await fetchSensors();
      showNotice({ variant: 'success', title: 'Sensor updated', message: 'Changes were saved successfully.' });
    } catch {
      setFormError('Failed to update sensor');
      showNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the sensor.' }, 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const submitAssign = async (e: FormEvent<HTMLFormElement>) => {
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
      showNotice({
        variant: 'success',
        title: 'Sensor assigned',
        message: 'The sensor assignment was updated successfully.',
      });
    } catch (err: any) {
      setAssignError(err?.response?.data?.message || 'Failed to assign sensor.');
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
      showNotice({ variant: 'success', title: 'Sensor deleted', message: 'The sensor was deleted successfully.' });
    } catch {
      setDeleteError('Failed to delete sensor');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading sensors...</span>
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
            label: 'Sensors',
            value: totals.totalSensors,
            subtitle: 'Monitored devices across the fleet',
            icon: <Cpu className="h-6 w-6" />,
            tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300',
          },
          {
            label: 'Assigned',
            value: totals.assignedSensors,
            subtitle: 'Linked to a transformer',
            icon: <Link2 className="h-6 w-6" />,
            tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300',
          },
          {
            label: 'Telemetry',
            value: totals.telemetrySensors,
            subtitle: 'Sensors with recent readings',
            icon: <Activity className="h-6 w-6" />,
            tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/14 dark:text-violet-300',
          },
          {
            label: 'Types',
            value: totals.distinctTypes,
            subtitle: 'Unique sensor categories in use',
            icon: <Radio className="h-6 w-6" />,
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

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="enterprise-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Sensor Summary</p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">Operational overview</h3>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                ['Assigned sensors', totals.assignedSensors],
                ['Unassigned sensors', totals.unassignedSensors],
                ['Telemetry coverage', `${totals.totalSensors ? Math.round((totals.telemetrySensors / totals.totalSensors) * 100) : 0}%`],
                ['Current scope', activeFilterName],
              ].map(([label, value]) => (
                <div key={String(label)} className="enterprise-subtle-card flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="enterprise-card p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Type Mix</p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">Active categories</h3>
            </div>

            <div className="mt-4 space-y-3">
              {typeDistribution.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No sensor type data available yet.
                </div>
              ) : (
                typeDistribution.slice(0, 5).map((item) => {
                  const width = totals.totalSensors ? (item.count / totals.totalSensors) * 100 : 0;
                  return (
                    <div key={item.type}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatSensorType(item.type)}</span>
                        <span className={item.count === 0 ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}>
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${Math.max(width, item.count ? 8 : 0)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="enterprise-card p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Transformer Load</p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">Highest sensor density</h3>
            </div>

            <div className="mt-4 space-y-3">
              {transformerDistribution.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No transformer allocation data available.
                </div>
              ) : (
                transformerDistribution.slice(0, 4).map((item) => {
                  const width = totals.totalSensors ? (item.count / totals.totalSensors) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
                        <span className={item.name === 'Unassigned' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}>
                          {item.count} sensors
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-600" style={{ width: `${Math.max(width, item.count ? 8 : 0)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="enterprise-card overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Sensor Table</p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  Connected sensor inventory
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {isSupplierUser
                    ? 'Manage sensors and assignments for transformers visible to your organisation.'
                    : 'Manage device metadata, transformer links, and telemetry visibility.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void fetchTransformerOptions();
                    void fetchSensors();
                  }}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setTransformerFilter('');
                    setPage(1);
                  }}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                >
                  <Filter className="h-4 w-4" />
                  Reset
                </button>
                {canCreate && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Sensor
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

              <div className="enterprise-chip min-w-[240px] max-w-[320px] flex-1 px-2 py-1.5">
                <SearchableSelect
                  options={transformerFilterOptions}
                  value={typeof transformerFilter === 'number' ? transformerFilter : ALL_TRANSFORMERS_OPTION}
                  onChange={(value: number | string) => {
                    setTransformerFilter(value === ALL_TRANSFORMERS_OPTION ? '' : Number(value));
                    setPage(1);
                  }}
                  placeholder="Filter by transformer"
                  compact
                />
              </div>

              <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sensors, IDs, or transformers..."
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
                  <th className="px-3 py-2.5">Sensor</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Device ID</th>
                  <th className="px-3 py-2.5">DevEUI</th>
                  <th className="px-3 py-2.5">Transformer</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12">
                      <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No sensors found for the current filter.
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((sensor) => {
                    const transformerName =
                      transformerLookup.get(sensor.transformer?.id ?? sensor.transformerId ?? -1) ??
                      sensor.transformer?.name ??
                      'Unassigned';
                    const readingCount = sensor.sensor_reading?.length ?? 0;

                    return (
                      <tr key={sensor.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <Cpu className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{sensor.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                {readingCount > 0
                                  ? `${readingCount} reading${readingCount === 1 ? '' : 's'} available`
                                  : 'No telemetry recorded yet'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${getTypeTone(sensor.type)}`}>
                            <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                            {formatSensorType(sensor.type)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{sensor.deviceId || 'N/A'}</div>
                          <div className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">Updated {formatDateTime(sensor.updatedAt)}</div>
                        </td>
                        <td className="px-3 py-3 font-mono text-sm text-slate-500 dark:text-slate-300">{sensor.devEui || 'N/A'}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span className={`h-2 w-2 rounded-full ${transformerName === 'Unassigned' ? 'bg-slate-400 dark:bg-slate-500' : 'bg-emerald-500'}`} />
                              {transformerName}
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              {transformerName === 'Unassigned' ? 'Needs assignment' : 'Assignment active'}
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ActionMenu
                            placement="bottom-end"
                            onView={() => openView(sensor)}
                            onEdit={canUpdate ? () => openEdit(sensor) : undefined}
                            onDelete={canDelete ? () => openDelete(sensor) : undefined}
                            extras={
                              canUpdate
                                ? [{ label: 'Assign Transformer', onClick: () => openAssign(sensor), icon: <Link2 className="h-4 w-4" /> }]
                                : undefined
                            }
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
                Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} sensors
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                >
                  Previous
                </button>
                <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">{page}</div>
                <button
                  type="button"
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
      </section>

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
      <SensorDeleteModal open={showDelete} onClose={() => setShowDelete(false)} onConfirm={confirmDelete} sensor={active} deleting={deleting} error={deleteError} />
      <SensorAssignModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        onSubmit={submitAssign}
        sensor={assignTarget}
        transformers={transformers}
        transformerId={transformerInput}
        setTransformerId={setTransformerInput}
        assigning={assigning}
        error={assignError}
        isSupplierUser={isSupplierUser}
      />
    </div>
  );
}

function ModalErrorNotice({ error }: { error?: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
      {error}
    </div>
  );
}

function InfoStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SensorFormModal({
  open,
  onClose,
  onSubmit,
  deviceId,
  setDeviceId,
  devEui,
  setDevEui,
  name,
  setName,
  type,
  setType,
  transformerId,
  setTransformerId,
  transformers,
  saving,
  error,
  mode,
}: SensorFormModalProps) {
  const isEdit = mode === 'edit';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[90vh] max-w-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                {isEdit ? <Activity className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">{isEdit ? 'Edit Sensor' : 'Create Sensor'}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{isEdit ? 'Update device metadata' : 'Add a new monitored sensor'}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {isEdit ? 'Keep the assignment and identifier records current without leaving the page.' : 'Register the device, classify the type, and attach it to a transformer.'}
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
              <InfoStatCard label="Workflow" value={isEdit ? 'Edit in modal' : 'Create in modal'} />
              <InfoStatCard label="Visible Transformers" value={transformers.length.toLocaleString()} />
            </div>

            <ModalErrorNotice error={error} />

            <div className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Sensor Information</p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">Primary details</h4>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Sensor name *</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Activity className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter sensor name"
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Sensor type *</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                      <Radio className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="block w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                    >
                      <option value="">Select type</option>
                      {SENSOR_TYPES.map((sensorType) => (
                        <option key={sensorType} value={sensorType}>
                          {formatSensorType(sensorType)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Device ID *</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Cpu className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                    <input
                      type="text"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="Enter device ID"
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">DevEUI *</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Router className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                    <input
                      type="text"
                      value={devEui}
                      onChange={(e) => setDevEui(e.target.value)}
                      placeholder="Enter DevEUI"
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Assignment</p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">Linked transformer</h4>
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Transformer *</label>
                <SearchableSelect
                  options={transformers}
                  value={transformerId}
                  onChange={(value: number | string) => setTransformerId(typeof value === 'number' ? value : Number(value))}
                  placeholder="Select associated transformer"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Use the shared searchable selector to attach the sensor to the correct transformer record.
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
                {saving ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Sensor'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function SensorAssignModal({
  open,
  onClose,
  onSubmit,
  sensor,
  transformers,
  transformerId,
  setTransformerId,
  assigning,
  error,
  isSupplierUser,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  sensor: Sensor | null;
  transformers: TransformerOption[];
  transformerId: number | '';
  setTransformerId: (value: number | '') => void;
  assigning: boolean;
  error?: string | null;
  isSupplierUser: boolean;
}) {
  const currentAssignment =
    transformers.find((item) => item.id === (sensor?.transformer?.id ?? sensor?.transformerId))?.name ||
    sensor?.transformer?.name ||
    'Unassigned';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[88vh] max-w-[620px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Assign Sensor</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Move sensor to a transformer</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Reassign the device without leaving the operations view.</p>
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
              <InfoStatCard label="Sensor" value={sensor?.name || 'N/A'} />
              <InfoStatCard label="Current Assignment" value={currentAssignment} />
            </div>

            <ModalErrorNotice error={error} />

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Assignment Target</p>
              <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">Choose transformer</h4>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Transformer *</label>
                  <SearchableSelect
                    options={transformers}
                    value={transformerId}
                    onChange={(value: number | string) => setTransformerId(typeof value === 'number' ? value : Number(value))}
                    placeholder="Select organisation transformer"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoStatCard label="Device ID" value={sensor?.deviceId || 'N/A'} />
                  <InfoStatCard label="Last Updated" value={formatDateTime(sensor?.updatedAt)} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isSupplierUser
                    ? 'Only transformers visible to your organisation are listed here.'
                    : 'Select the transformer that should own this sensor.'}
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
                disabled={assigning}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {assigning ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function SensorViewModal({
  open,
  onClose,
  sensor,
  transformers,
}: {
  open: boolean;
  onClose: () => void;
  sensor: Sensor | null;
  transformers: TransformerOption[];
}) {
  if (!sensor) return null;

  const transformerName =
    transformers.find((item) => item.id === (sensor.transformer?.id ?? sensor.transformerId))?.name ||
    sensor.transformer?.name ||
    'Unassigned';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[88vh] max-w-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Sensor Details</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{sensor.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Centered modal view for fast operational context.</p>
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
            <div className="grid grid-cols-2 gap-3">
              <InfoStatCard label="Type" value={formatSensorType(sensor.type)} />
              <InfoStatCard label="Transformer" value={transformerName} />
              <InfoStatCard label="Device ID" value={sensor.deviceId || 'N/A'} />
              <InfoStatCard label="DevEUI" value={sensor.devEui || 'N/A'} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoStatCard label="Created" value={formatDateTime(sensor.createdAt)} />
              <InfoStatCard label="Updated" value={formatDateTime(sensor.updatedAt)} />
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Recent Readings</p>
            <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">Telemetry stream</h4>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              {sensor.sensor_reading && sensor.sensor_reading.length > 0 ? (
                <div className="max-h-72 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                      <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                      {sensor.sensor_reading.map((reading, index) => {
                        const timestamp = reading.updated_at || reading.created_at || reading.updatedAt || reading.createdAt;
                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateTime(timestamp)}</td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{getReadingSummary(sensor.type, reading)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No readings have been captured for this sensor yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SensorDeleteModal({
  open,
  onClose,
  onConfirm,
  sensor,
  deleting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sensor: Sensor | null;
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">!</div>
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete Sensor?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Are you sure you want to delete <span className="font-semibold text-slate-950 dark:text-slate-50">{sensor?.name || 'this sensor'}</span>? This action cannot be undone.
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

function SensorCreateModal(props: Omit<SensorFormModalProps, 'mode'>) {
  return <SensorFormModal {...props} mode="create" />;
}

function SensorEditModal(props: Omit<SensorFormModalProps, 'mode'>) {
  return <SensorFormModal {...props} mode="edit" />;
}
