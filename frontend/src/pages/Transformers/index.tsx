import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';
import {
  Plus,
  MapPin,
  Zap,
  Activity,
  Building2,
  X,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Search,
  Cpu,
  List as ListIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Globe,
  Warehouse,
  ShieldCheck,
  RefreshCcw,
  Filter,
  Save,
} from 'lucide-react';

// --- Interfaces ---

interface Region {
  id: number;
  name: string;
  districts?: District[];
}

interface District {
  id: number;
  name: string;
  regionId?: number;
}

interface Depot {
  id: number;
  name: string;
  districtId?: number;
}

interface Transformer {
  id: number;
  name: string;
  type?: string;
  capacity?: number;
  isActive?: boolean;
  depotId?: number;
  depot?: { id: number; name: string };
  supplierCode?: string;
  supplierName?: string;
  lat?: number;
  lng?: number;
  sensors?: Sensor[];
  controllers?: Controller[];
}

interface Sensor {
  id: number;
  name: string;
  type: string;
  deviceId?: string;
  devEui?: string;
  transformerId?: number;
}

interface Reading {
  id: number;
  createdAt: string;
  updatedAt: string;
  attributes: Record<string, any>;
}

interface ControllerReading {
  id: number;
  controllerId: number;
  rawPayload: string;
  decodedPayload?: string;
  attributes: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Controller {
  id: number;
  deviceId: string;
  devEui: string;
  name: string;
  type: string;
  transformerId?: number;
  transformer?: { id: number; name: string };
}

type ViewMode = 'REGIONS' | 'DISTRICTS' | 'DEPOTS' | 'TRANSFORMERS' | 'SENSORS' | 'READINGS' | 'CONTROLLERS' | 'CONTROLLER_READINGS';
type TransformerTypeOption = 'GROUND_MOUNTED' | 'POLE_MOUNTED';

type OverviewCard = {
  label: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone: string;
  compactValue?: boolean;
};

export default function TransformersIndex() {
  const { token, hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';
  const canCreateTransformers = !isSupplierUser && hasPermission('transformers.create');
  const canUpdateTransformers = !isSupplierUser && hasPermission('transformers.update');
  const canDeleteTransformers = !isSupplierUser && hasPermission('transformers.delete');
  const canReadSensors = hasPermission('sensors.read');
  const canReadControllers = hasPermission('controllers.read');
  
  // --- Navigation State ---
  const [viewMode, setViewMode] = useState<ViewMode>('REGIONS');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [selectedTransformer, setSelectedTransformer] = useState<Transformer | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [selectedController, setSelectedController] = useState<Controller | null>(null);

  // --- Data State ---
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [supplierDepots, setSupplierDepots] = useState<Depot[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [controllerReadings, setControllerReadings] = useState<ControllerReading[]>([]);

  // Controller Filter State
  const [controllerStartDate, setControllerStartDate] = useState<Date | null>(null);
  const [controllerStartTime, setControllerStartTime] = useState<Date | null>(null);
  const [controllerEndDate, setControllerEndDate] = useState<Date | null>(null);
  const [controllerEndTime, setControllerEndTime] = useState<Date | null>(null);
  
  // --- Global Options (for modal) ---

  // --- UI State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Pagination (shared state, reset on view change)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  // Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeTransformer, setActiveTransformer] = useState<Transformer | null>(null);
  const [createDepotOptions, setCreateDepotOptions] = useState<Depot[]>([]);
  const [loadingCreateDepots, setLoadingCreateDepots] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNameInput, setCreateNameInput] = useState('');
  const [createCapacityInput, setCreateCapacityInput] = useState<number | ''>('');
  const [createTypeInput, setCreateTypeInput] = useState<TransformerTypeOption | ''>('');
  const [createIsActiveInput, setCreateIsActiveInput] = useState(true);
  const [createDepotInput, setCreateDepotInput] = useState<number | ''>('');
  const [createLatInput, setCreateLatInput] = useState<number | ''>('');
  const [createLngInput, setCreateLngInput] = useState<number | ''>('');
  
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  // --- Helpers ---

  const normalizeList = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    const obj = payload as Record<string, unknown>;
    const candidates = ['content', 'data', 'items', 'records', 'sensorReadings', 'readings', 'controllerReadings'];
    for (const key of candidates) {
      if (Array.isArray(obj?.[key])) return obj[key] as any[];
    }
    return [];
  };

  const extractTotal = (payload: unknown, listLength: number): number => {
      const obj = payload as any;
      if (typeof obj?.totalElements === 'number') return obj.totalElements;
      if (typeof obj?.total === 'number') return obj.total;
      return listLength; // fallback
  };

  const formatTransformerType = (type?: string | null) => {
    if (type === 'GROUND_MOUNTED') return 'GMT';
    if (type === 'POLE_MOUNTED') return 'PMT';
    return 'Unspecified';
  };

  // --- Data Fetching ---

  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions?page=${page-1}&size=${pageSize}`, { headers });
      const list = normalizeList(res.data);
      setRegions(list);
      setTotalElements(extractTotal(res.data, list.length));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch regions');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, page, pageSize]);

  const fetchSupplierHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      const [regionsRes, depotsRes, transformersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/regions`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers }),
      ]);

      const regionList = normalizeList(regionsRes.data) as Region[];
      const depotList = normalizeList(depotsRes.data) as Depot[];
      const transformerList = normalizeList(transformersRes.data) as Transformer[];
      const visibleDepotIds = new Set(
        transformerList
          .map((transformer) => transformer.depotId)
          .filter((depotId): depotId is number => typeof depotId === 'number')
      );
      const filteredDepots = depotList.filter((depot) => visibleDepotIds.has(depot.id));
      const visibleDistrictIds = new Set(
        filteredDepots
          .map((depot) => depot.districtId)
          .filter((districtId): districtId is number => typeof districtId === 'number')
      );
      const filteredRegions = regionList
        .map((region) => ({
          ...region,
          districts: (Array.isArray(region.districts) ? region.districts : []).filter((district) => visibleDistrictIds.has(district.id)),
        }))
        .filter((region) => (region.districts?.length ?? 0) > 0);

      setSupplierDepots(filteredDepots);
      setRegions(filteredRegions);
      setTotalElements(filteredRegions.length);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch supplier transformer hierarchy');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchDistricts = useCallback(async (regionId: number) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/districts/region/${regionId}`, { headers });
      const list = normalizeList(res.data);
      setDistricts(list);
      setTotalElements(list.length);
    } catch (err) {
        console.error(err);
      setError('Failed to fetch districts');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchDepots = useCallback(async (districtId: number) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots/district/${districtId}`, { headers });
      const list = normalizeList(res.data);
      setDepots(list);
      setTotalElements(list.length);
    } catch (err) {
        console.error(err);
      setError('Failed to fetch depots');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchTransformers = useCallback(async (depotId?: number | null) => {
    try {
      setLoading(true);
      const url = typeof depotId === 'number'
        ? `${API_BASE_URL}/api/v1/transformers/depot/${depotId}`
        : `${API_BASE_URL}/api/v1/transformers`;
      const res = await axios.get(url, { headers });
      const list = normalizeList(res.data);
      setTransformers(list);
      setTotalElements(list.length);
    } catch (err) {
        console.error(err);
      setError('Failed to fetch transformers');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchCreateDepotOptions = useCallback(async () => {
    try {
      setLoadingCreateDepots(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots`, { headers });
      const list = normalizeList(res.data) as Depot[];
      setCreateDepotOptions(
        list.map((depot) => ({
          id: depot.id,
          name: depot.name,
          districtId: depot.districtId,
        }))
      );
    } catch (err) {
      console.error(err);
      setCreateError('Failed to load depots.');
    } finally {
      setLoadingCreateDepots(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchSensors = useCallback(async (transformerId: number) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/sensors/transformer/${transformerId}`, { headers });
      const list = normalizeList(res.data);
      setSensors(list);
      setTotalElements(list.length);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch sensors');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchReadings = useCallback(async (sensorId: number) => {
    try {
      setLoading(true);
      // Fetch specific sensor to get readings
      const res = await axios.get(`${API_BASE_URL}/api/v1/sensors/${sensorId}`, { headers });
      // Assuming res.data.sensorReadings contains the list
      const list = normalizeList(res.data); // will check for sensorReadings key
      setReadings(list);
      setTotalElements(list.length);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch readings');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchControllers = useCallback(async (transformerId: number) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/controllers/transformer/${transformerId}`, { headers });
      const list = normalizeList(res.data);
      setControllers(list);
      setTotalElements(list.length);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch controllers');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchControllerReadings = useCallback(async (controllerId: number) => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/api/v1/controllers/${controllerId}/readings`;
      const params: any = {
        page: page - 1,
        size: pageSize
      };

      if (controllerStartDate && controllerStartTime && controllerEndDate && controllerEndTime) {
          url = `${API_BASE_URL}/api/v1/controllers/${controllerId}/readings/filter`;
          
          const formatDate = (date: any) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          };

          const formatTime = (date: any) => {
            const h = String(date.getHours()).padStart(2, '0');
            const m = String(date.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
          };

          const start = `${formatDate(controllerStartDate)}T${formatTime(controllerStartTime)}:00`;
          const end = `${formatDate(controllerEndDate)}T${formatTime(controllerEndTime)}:00`;
          
          params.start = new Date(start).toISOString();
          params.end = new Date(end).toISOString();
      }

      const res = await axios.get(url, { headers, params });
      const list = normalizeList(res.data);
      setControllerReadings(list);
      setTotalElements(extractTotal(res.data, list.length));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch controller readings');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, controllerStartDate, controllerStartTime, controllerEndDate, controllerEndTime, page, pageSize]);

  // --- Effects ---

  useEffect(() => {
    if (!token) return;
    setError(null);
    if (viewMode === 'REGIONS' && isSupplierUser) {
      fetchSupplierHierarchy();
    } else if (viewMode === 'REGIONS') {
      fetchRegions();
    } else if (viewMode === 'DISTRICTS' && selectedRegion && isSupplierUser) {
      const filtered = (selectedRegion.districts || []) as District[];
      setDistricts(filtered);
      setTotalElements(filtered.length);
    } else if (viewMode === 'DISTRICTS' && selectedRegion) {
      fetchDistricts(selectedRegion.id);
    } else if (viewMode === 'DEPOTS' && selectedDistrict && isSupplierUser) {
      const filtered = supplierDepots.filter((depot) => depot.districtId === selectedDistrict.id);
      setDepots(filtered);
      setTotalElements(filtered.length);
    } else if (viewMode === 'DEPOTS' && selectedDistrict) {
      fetchDepots(selectedDistrict.id);
    } else if (viewMode === 'TRANSFORMERS' && selectedDepot) {
      fetchTransformers(selectedDepot.id);
    } else if (viewMode === 'SENSORS' && selectedTransformer) {
      fetchSensors(selectedTransformer.id);
    } else if (viewMode === 'READINGS' && selectedSensor) {
      fetchReadings(selectedSensor.id);
    } else if (viewMode === 'CONTROLLERS' && selectedTransformer) {
      fetchControllers(selectedTransformer.id);
    } else if (viewMode === 'CONTROLLER_READINGS' && selectedController) {
      fetchControllerReadings(selectedController.id);
    }
  }, [token, viewMode, selectedRegion, selectedDistrict, selectedDepot, selectedTransformer, selectedSensor, selectedController, page, fetchRegions, fetchSupplierHierarchy, fetchDistricts, fetchDepots, fetchTransformers, fetchSensors, fetchReadings, fetchControllers, fetchControllerReadings, isSupplierUser]);

  useEffect(() => {
    if (isSupplierUser) {
      setViewMode('REGIONS');
      setSelectedRegion(null);
      setSelectedDistrict(null);
      setSelectedDepot(null);
    }
  }, [isSupplierUser]);

  useEffect(() => {
    if (!showCreate || !token || isSupplierUser || !hasPermission('depots.read')) return;
    void fetchCreateDepotOptions();
  }, [showCreate, token, isSupplierUser, hasPermission, fetchCreateDepotOptions]);

  // --- Event Handlers ---

  const handleRegionClick = (region: Region) => {
    setSelectedRegion(region);
    setViewMode('DISTRICTS');
    setPage(1);
    setSearch('');
  };

  const handleDistrictClick = (district: District) => {
    setSelectedDistrict(district);
    setViewMode('DEPOTS');
    setPage(1);
    setSearch('');
  };

  const handleDepotClick = (depot: Depot) => {
    setSelectedDepot(depot);
    setViewMode('TRANSFORMERS');
    setPage(1);
    setSearch('');
  };

  const handleViewSensors = (transformer: Transformer) => {
    setSelectedTransformer(transformer);
    setViewMode('SENSORS');
    setPage(1);
    setSearch('');
  };

  const handleViewReadings = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setViewMode('READINGS');
    setPage(1);
    setSearch('');
  };

  const handleViewControllers = (transformer: Transformer) => {
    setSelectedTransformer(transformer);
    setViewMode('CONTROLLERS');
    setPage(1);
    setSearch('');
  };

  const handleViewControllerReadings = (controller: Controller) => {
    setSelectedController(controller);
    setViewMode('CONTROLLER_READINGS');
    setPage(1);
    setSearch('');
    setControllerStartDate(null);
    setControllerStartTime(null);
    setControllerEndDate(null);
    setControllerEndTime(null);
  };

  const handleBack = () => {
    setPage(1);
    setSearch('');
    if (viewMode === 'READINGS') {
      setViewMode('SENSORS');
      setSelectedSensor(null);
    } else if (viewMode === 'SENSORS') {
      setViewMode('TRANSFORMERS');
      setSelectedTransformer(null);
    } else if (viewMode === 'CONTROLLERS') {
      setViewMode('TRANSFORMERS');
      setSelectedTransformer(null);
    } else if (viewMode === 'CONTROLLER_READINGS') {
      setViewMode('CONTROLLERS');
      setSelectedController(null);
    } else if (viewMode === 'TRANSFORMERS') {
      setViewMode('DEPOTS');
      setSelectedDepot(null);
    } else if (viewMode === 'DEPOTS') {
      setViewMode('DISTRICTS');
      setSelectedDistrict(null);
    } else if (viewMode === 'DISTRICTS') {
      setViewMode('REGIONS');
      setSelectedRegion(null);
    }
  };

  const navigateTo = (mode: ViewMode) => {
      setPage(1);
      setSearch('');
      if (mode === 'REGIONS') {
          setViewMode('REGIONS');
          setSelectedRegion(null);
          setSelectedDistrict(null);
          setSelectedDepot(null);
          setSelectedTransformer(null);
          setSelectedSensor(null);
      } else if (mode === 'DISTRICTS') {
          setViewMode('DISTRICTS');
          setSelectedDistrict(null);
          setSelectedDepot(null);
          setSelectedTransformer(null);
          setSelectedSensor(null);
      } else if (mode === 'DEPOTS') {
          setViewMode('DEPOTS');
          setSelectedDepot(null);
          setSelectedTransformer(null);
          setSelectedSensor(null);
      } else if (mode === 'TRANSFORMERS') {
          setViewMode('TRANSFORMERS');
          setSelectedTransformer(null);
          setSelectedSensor(null);
          setSelectedController(null);
      } else if (mode === 'SENSORS') {
          setViewMode('SENSORS');
          setSelectedSensor(null);
      } else if (mode === 'CONTROLLERS') {
          setViewMode('CONTROLLERS');
          setSelectedController(null);
      }
  };

  // --- CRUD Handlers (Transformers) ---

  const handleAddTransformer = () => {
      setCreateNameInput('');
      setCreateCapacityInput('');
      setCreateTypeInput('');
      setCreateIsActiveInput(true);
      setCreateDepotInput(selectedDepot?.id ?? '');
      setCreateLatInput('');
      setCreateLngInput('');
      setCreateError(null);
      setShowCreate(true);
  };

  const handleEditTransformer = (t: Transformer) => {
      navigate(`/transformers/${t.id}/edit`);
  };

  const openViewModal = (t: Transformer) => {
      setActiveTransformer(t);
      setShowView(true);
  };

  const handleCreateTransformer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createNameInput.trim()) {
      setCreateError('Name is required');
      return;
    }
    if (!isSupplierUser && !createDepotInput) {
      setCreateError('Depot is required');
      return;
    }

    try {
      setSavingCreate(true);
      setCreateError(null);
      await axios.post(
        `${API_BASE_URL}/api/v1/transformers/create`,
        {
          name: createNameInput.trim(),
          capacity: createCapacityInput === '' ? 0 : Number(createCapacityInput),
          type: createTypeInput || null,
          isActive: createIsActiveInput,
          depotId: isSupplierUser ? null : Number(createDepotInput),
          lat: createLatInput === '' ? 0 : Number(createLatInput),
          lng: createLngInput === '' ? 0 : Number(createLngInput),
        },
        { headers }
      );

      setShowCreate(false);
      setNotice({
        variant: 'success',
        title: 'Transformer created',
        message: 'The transformer was created successfully.',
      });

      if (viewMode === 'TRANSFORMERS' && selectedDepot && Number(createDepotInput) === selectedDepot.id) {
        await fetchTransformers(selectedDepot.id);
      }
    } catch (err: any) {
      console.error(err);
      setCreateError(err.response?.data?.message || 'Failed to create transformer');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleDelete = async (id: number) => {
      if (!confirm('Are you sure you want to delete this transformer?')) return;
      try {
          await axios.delete(`${API_BASE_URL}/api/v1/transformers/${id}`, { headers });
          setNotice({ variant: 'success', title: 'Success', message: 'Transformer deleted' });
          if (selectedDepot) fetchTransformers(selectedDepot.id);
      } catch {
          setNotice({ variant: 'error', title: 'Error', message: 'Failed to delete transformer' });
      }
  };

  // --- Render Helpers ---

  const filteredList = <T extends { name: string }>(list: T[]) => {
    if (!search.trim()) return list;
    return list.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  };

  const visibleRegions = useMemo(() => filteredList(regions), [regions, search]);
  const visibleDistricts = useMemo(() => filteredList(districts), [districts, search]);
  const visibleDepots = useMemo(() => filteredList(depots), [depots, search]);
  const visibleTransformers = useMemo(() => filteredList(transformers), [transformers, search]);
  const visibleSensors = useMemo(() => filteredList(sensors), [sensors, search]);
  const visibleControllers = useMemo(() => filteredList(controllers), [controllers, search]);

  const currentLevelLabel = useMemo(() => {
    switch (viewMode) {
      case 'REGIONS':
        return 'Regions';
      case 'DISTRICTS':
        return 'Districts';
      case 'DEPOTS':
        return 'Depots';
      case 'TRANSFORMERS':
        return 'Transformers';
      case 'SENSORS':
        return 'Sensors';
      case 'READINGS':
        return 'Sensor Readings';
      case 'CONTROLLERS':
        return 'Controllers';
      case 'CONTROLLER_READINGS':
        return 'Controller Readings';
      default:
        return 'Workspace';
    }
  }, [viewMode]);

  const searchEnabled = viewMode !== 'READINGS' && viewMode !== 'CONTROLLER_READINGS';
  const paginationEnabled = viewMode === 'REGIONS' || viewMode === 'CONTROLLER_READINGS';

  const currentItemCount = useMemo(() => {
    switch (viewMode) {
      case 'REGIONS':
        return visibleRegions.length;
      case 'DISTRICTS':
        return visibleDistricts.length;
      case 'DEPOTS':
        return visibleDepots.length;
      case 'TRANSFORMERS':
        return visibleTransformers.length;
      case 'SENSORS':
        return visibleSensors.length;
      case 'READINGS':
        return readings.length;
      case 'CONTROLLERS':
        return visibleControllers.length;
      case 'CONTROLLER_READINGS':
        return controllerReadings.length;
      default:
        return 0;
    }
  }, [
    viewMode,
    visibleRegions.length,
    visibleDistricts.length,
    visibleDepots.length,
    visibleTransformers.length,
    visibleSensors.length,
    readings.length,
    visibleControllers.length,
    controllerReadings.length,
  ]);

  const currentScopeTotal = paginationEnabled ? totalElements : currentItemCount;
  const controllerFilterActive = Boolean(
    controllerStartDate || controllerStartTime || controllerEndDate || controllerEndTime
  );
  const filterWindowReady = Boolean(
    controllerStartDate && controllerStartTime && controllerEndDate && controllerEndTime
  );

  const currentFocusLabel = useMemo(() => {
    if (viewMode === 'CONTROLLER_READINGS') return selectedController?.name || 'Controller';
    if (viewMode === 'READINGS') return selectedSensor?.name || 'Sensor';
    if (viewMode === 'SENSORS' || viewMode === 'CONTROLLERS') return selectedTransformer?.name || 'Transformer';
    if (viewMode === 'TRANSFORMERS') return selectedDepot?.name || 'Depot';
    if (viewMode === 'DEPOTS') return selectedDistrict?.name || 'District';
    if (viewMode === 'DISTRICTS') return selectedRegion?.name || 'Region';
    return isSupplierUser ? 'Supplier visible network' : 'National hierarchy';
  }, [
    viewMode,
    selectedController,
    selectedSensor,
    selectedTransformer,
    selectedDepot,
    selectedDistrict,
    selectedRegion,
    isSupplierUser,
  ]);

  const hierarchyDepth = useMemo(() => {
    if (viewMode === 'REGIONS') return 1;
    if (viewMode === 'DISTRICTS') return 2;
    if (viewMode === 'DEPOTS') return 3;
    if (viewMode === 'TRANSFORMERS') return 4;
    if (viewMode === 'SENSORS' || viewMode === 'CONTROLLERS') return 5;
    return 6;
  }, [viewMode]);

  const transformerStatusCounts = useMemo(
    () =>
      transformers.reduce(
        (acc, transformer) => {
          if (transformer.isActive) {
            acc.active += 1;
          } else {
            acc.maintenance += 1;
          }
          return acc;
        },
        { active: 0, maintenance: 0 }
      ),
    [transformers]
  );

  const operationsCard = useMemo<OverviewCard>(() => {
    if (viewMode === 'TRANSFORMERS') {
      return {
        label: 'Active Units',
        value: transformerStatusCounts.active.toLocaleString(),
        subtitle: `${transformerStatusCounts.maintenance.toLocaleString()} in maintenance`,
        icon: <ShieldCheck className="h-5 w-5" />,
        tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300',
      };
    }
    if (viewMode === 'SENSORS' || viewMode === 'READINGS') {
      return {
        label: 'Sensor Scope',
        value: sensors.length.toLocaleString(),
        subtitle: selectedTransformer ? `Attached to ${selectedTransformer.name}` : 'Current sensor scope',
        icon: <Cpu className="h-5 w-5" />,
        tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300',
      };
    }
    if (viewMode === 'CONTROLLERS' || viewMode === 'CONTROLLER_READINGS') {
      return {
        label: 'Controller Scope',
        value: controllers.length.toLocaleString(),
        subtitle: selectedTransformer ? `Attached to ${selectedTransformer.name}` : 'Current controller scope',
        icon: <Cpu className="h-5 w-5" />,
        tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/14 dark:text-indigo-300',
      };
    }
    return {
      label: 'Selection Focus',
      value: currentFocusLabel,
      subtitle: 'Active hierarchy anchor',
      icon: <Building2 className="h-5 w-5" />,
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300',
      compactValue: true,
    };
  }, [
    viewMode,
    transformerStatusCounts.active,
    transformerStatusCounts.maintenance,
    sensors.length,
    controllers.length,
    selectedTransformer,
    currentFocusLabel,
  ]);

  const overviewCards = useMemo<OverviewCard[]>(
    () => [
      {
        label: 'Current Level',
        value: currentLevelLabel,
        subtitle: 'Active workspace layer',
        icon: <Activity className="h-5 w-5" />,
        tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300',
        compactValue: true,
      },
      {
        label: 'Visible Records',
        value: currentItemCount.toLocaleString(),
        subtitle: `${currentScopeTotal.toLocaleString()} records in scope`,
        icon: <Globe className="h-5 w-5" />,
        tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/14 dark:text-sky-300',
      },
      {
        label: 'Hierarchy Depth',
        value: `${hierarchyDepth}/6`,
        subtitle: currentFocusLabel,
        icon: <Warehouse className="h-5 w-5" />,
        tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/14 dark:text-violet-300',
      },
      operationsCard,
    ],
    [currentLevelLabel, currentItemCount, currentScopeTotal, hierarchyDepth, currentFocusLabel, operationsCard]
  );

  const scopeSummary = [
    { label: 'Region', value: selectedRegion?.name ?? 'All regions' },
    { label: 'District', value: selectedDistrict?.name ?? 'All districts' },
    { label: 'Depot', value: selectedDepot?.name ?? 'All depots' },
    { label: 'Transformer', value: selectedTransformer?.name ?? 'Not selected' },
  ];

  const workspaceSummary = [
    {
      label: 'Sensors access',
      value: canReadSensors ? 'Enabled' : 'Restricted',
      tone: canReadSensors ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400',
    },
    {
      label: 'Controllers access',
      value: canReadControllers ? 'Enabled' : 'Restricted',
      tone: canReadControllers ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400',
    },
    {
      label: 'Filters',
      value: controllerFilterActive ? (filterWindowReady ? 'Time window applied' : 'Incomplete time window') : search || 'None',
      tone: controllerFilterActive || search ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400',
    },
  ];

  const tableTitle = useMemo(() => {
    switch (viewMode) {
      case 'REGIONS':
        return 'Regional transformer coverage';
      case 'DISTRICTS':
        return `District coverage for ${selectedRegion?.name ?? 'selected region'}`;
      case 'DEPOTS':
        return `Depot network in ${selectedDistrict?.name ?? 'selected district'}`;
      case 'TRANSFORMERS':
        return `Transformers at ${selectedDepot?.name ?? 'selected depot'}`;
      case 'SENSORS':
        return `Sensors attached to ${selectedTransformer?.name ?? 'selected transformer'}`;
      case 'READINGS':
        return `Sensor readings for ${selectedSensor?.name ?? 'selected sensor'}`;
      case 'CONTROLLERS':
        return `Controllers attached to ${selectedTransformer?.name ?? 'selected transformer'}`;
      case 'CONTROLLER_READINGS':
        return `Controller readings for ${selectedController?.name ?? 'selected controller'}`;
      default:
        return 'Transformer workspace';
    }
  }, [viewMode, selectedRegion, selectedDistrict, selectedDepot, selectedTransformer, selectedSensor, selectedController]);

  const tableDescription = useMemo(() => {
    if (viewMode === 'REGIONS') {
      return 'Step through the same hierarchy used in Regions,  table styling and contextual actions.';
    }
    if (viewMode === 'TRANSFORMERS') {
      return 'Review status, capacity, and downstream device access without leaving the current hierarchy context.';
    }
    if (viewMode === 'CONTROLLER_READINGS') {
      return 'Apply a time window and inspect decoded controller payloads in the same workspace.';
    }
    return `Showing ${currentLevelLabel.toLowerCase()} for the active hierarchy selection.`;
  }, [viewMode, currentLevelLabel]);

  const totalPages = Math.max(1, Math.ceil(currentScopeTotal / pageSize));
  const currentStart = currentScopeTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const currentEnd = Math.min(page * pageSize, currentScopeTotal);

  const clearControllerFilters = () => {
    setControllerStartDate(null);
    setControllerStartTime(null);
    setControllerEndDate(null);
    setControllerEndTime(null);
    setPage(1);
  };

  const resetWorkspaceFilters = () => {
    setSearch('');
    setPage(1);
    if (viewMode === 'CONTROLLER_READINGS') {
      clearControllerFilters();
    }
  };

  const refreshCurrentView = useCallback(() => {
    if (viewMode === 'REGIONS') {
      if (isSupplierUser) {
        void fetchSupplierHierarchy();
      } else {
        void fetchRegions();
      }
      return;
    }

    if (viewMode === 'DISTRICTS' && selectedRegion) {
      if (isSupplierUser) {
        const filtered = (selectedRegion.districts || []) as District[];
        setDistricts(filtered);
        setTotalElements(filtered.length);
      } else {
        void fetchDistricts(selectedRegion.id);
      }
      return;
    }

    if (viewMode === 'DEPOTS' && selectedDistrict) {
      if (isSupplierUser) {
        const filtered = supplierDepots.filter((depot) => depot.districtId === selectedDistrict.id);
        setDepots(filtered);
        setTotalElements(filtered.length);
      } else {
        void fetchDepots(selectedDistrict.id);
      }
      return;
    }

    if (viewMode === 'TRANSFORMERS' && selectedDepot) {
      void fetchTransformers(selectedDepot.id);
      return;
    }

    if (viewMode === 'SENSORS' && selectedTransformer) {
      void fetchSensors(selectedTransformer.id);
      return;
    }

    if (viewMode === 'READINGS' && selectedSensor) {
      void fetchReadings(selectedSensor.id);
      return;
    }

    if (viewMode === 'CONTROLLERS' && selectedTransformer) {
      void fetchControllers(selectedTransformer.id);
      return;
    }

    if (viewMode === 'CONTROLLER_READINGS' && selectedController) {
      void fetchControllerReadings(selectedController.id);
    }
  }, [
    viewMode,
    isSupplierUser,
    fetchSupplierHierarchy,
    fetchRegions,
    fetchDistricts,
    fetchDepots,
    fetchTransformers,
    fetchSensors,
    fetchReadings,
    fetchControllers,
    fetchControllerReadings,
    selectedRegion,
    selectedDistrict,
    selectedDepot,
    selectedTransformer,
    selectedSensor,
    selectedController,
    supplierDepots,
  ]);

  const renderEmptyState = (message: string, colSpan: number) => (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {message}
        </div>
      </td>
    </tr>
  );

  const renderBreadcrumbs = () => (
    <nav className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => navigateTo('REGIONS')}
        className={`enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium transition ${
          viewMode === 'REGIONS'
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300'
        }`}
      >
        Regions
      </button>
      {selectedRegion && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => navigateTo('DISTRICTS')}
            className={`enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'DISTRICTS'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300'
            }`}
          >
            {selectedRegion.name}
          </button>
        </>
      )}
      {selectedDistrict && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => navigateTo('DEPOTS')}
            className={`enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'DEPOTS'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300'
            }`}
          >
            {selectedDistrict.name}
          </button>
        </>
      )}
      {selectedDepot && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => navigateTo('TRANSFORMERS')}
            className={`enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium transition ${
              viewMode === 'TRANSFORMERS'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300'
            }`}
          >
            {selectedDepot.name}
          </button>
        </>
      )}
      {selectedTransformer && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            {selectedTransformer.name}
          </span>
        </>
      )}
      {selectedSensor && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => navigateTo('SENSORS')}
            className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
          >
            Sensors
          </button>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="enterprise-chip rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
            Readings
          </span>
        </>
      )}
      {selectedController && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => navigateTo('CONTROLLERS')}
            className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
          >
            Controllers
          </button>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="enterprise-chip rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
            Readings
          </span>
        </>
      )}
    </nav>
  );

  const renderPagination = () => {
    if (!paginationEnabled || currentScopeTotal === 0) return null;

    return (
      <div className="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{currentStart}</span> to{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{currentEnd}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{currentScopeTotal}</span> results
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition disabled:opacity-50 dark:text-slate-200"
          >
            Previous
          </button>
          <div className="enterprise-chip rounded-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            Page {page} of {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition disabled:opacity-50 dark:text-slate-200"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // --- Main Render ---

  if (loading) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading transformer workspace...</span>
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

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Transformer Shell
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-xl">
                Transformer workspace
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isSupplierUser
                  ? 'Browse the region, district, depot, and transformer hierarchy filtered to your organisation footprint.'
                  : 'Navigate the network hierarchy with the same enterprise shell used by the Regions workspace.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewMode !== 'REGIONS' && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={refreshCurrentView}
                className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              {(searchEnabled || controllerFilterActive) && (
                <button
                  type="button"
                  onClick={resetWorkspaceFilters}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                >
                  <Filter className="h-4 w-4" />
                  Reset view
                </button>
              )}
              {canCreateTransformers && (
                <button
                  type="button"
                  onClick={handleAddTransformer}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Transformer
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">{renderBreadcrumbs()}</div>

            <div className="flex flex-col gap-3 xl:min-w-[420px] xl:flex-row xl:items-center xl:justify-end">
              {paginationEnabled && (
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
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}

              <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{currentLevelLabel}</span>
                <span className="text-slate-400 dark:text-slate-500">Level {hierarchyDepth}</span>
              </div>

              {searchEnabled ? (
                <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Search ${currentLevelLabel.toLowerCase()}...`}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                </div>
              ) : (
                <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <Filter className="h-4 w-4 text-blue-500" />
                  <span>{controllerFilterActive ? (filterWindowReady ? 'Time window applied' : 'Waiting for full time window') : 'No time window set'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <div key={card.label} className="enterprise-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p
                  className={`mt-2 font-semibold tracking-tight text-slate-950 dark:text-slate-50 ${
                    card.compactValue ? 'text-lg md:text-xl' : 'text-3xl'
                  }`}
                >
                  {card.value}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.subtitle}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.tone}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Hierarchy Summary */}
          <div className="enterprise-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Hierarchy Summary
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Current selection path
                </h3>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Region</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedRegion ? selectedRegion.name : 'All regions'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">District</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDistrict ? selectedDistrict.name : 'All districts'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Depot</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDepot ? selectedDepot.name : 'All depots'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">Transformer</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedTransformer ? selectedTransformer.name : 'Not selected'}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Focus</p>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                {currentFocusLabel}
              </p>
            </div>
          </div>

          {/* Workspace State / Reading Filters */}
          {viewMode === 'CONTROLLER_READINGS' ? (
            <div className="enterprise-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Reading Filter
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Time window controls
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={clearControllerFilters}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                >
                  <Filter className="h-4 w-4" />
                  Clear
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">From</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <DatePicker
                        selected={controllerStartDate}
                        onChange={(date: Date | null) => {
                          setControllerStartDate(date);
                          setPage(1);
                        }}
                        dateFormat="MM/dd/yyyy"
                        placeholderText="Select date"
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                        portalId="root-portal"
                      />
                      <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="relative">
                      <DatePicker
                        selected={controllerStartTime}
                        onChange={(date: Date | null) => {
                          setControllerStartTime(date);
                          setPage(1);
                        }}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="h:mm aa"
                        placeholderText="--:-- --"
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                        portalId="root-portal"
                      />
                      <ClockIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">To</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <DatePicker
                        selected={controllerEndDate}
                        onChange={(date: Date | null) => {
                          setControllerEndDate(date);
                          setPage(1);
                        }}
                        dateFormat="MM/dd/yyyy"
                        placeholderText="Select date"
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                        portalId="root-portal"
                      />
                      <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="relative">
                      <DatePicker
                        selected={controllerEndTime}
                        onChange={(date: Date | null) => {
                          setControllerEndTime(date);
                          setPage(1);
                        }}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="h:mm aa"
                        placeholderText="--:-- --"
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
                        portalId="root-portal"
                      />
                      <ClockIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between px-1 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Window status</span>
                <span className={`font-semibold ${filterWindowReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {filterWindowReady ? 'Ready' : 'Incomplete'}
                </span>
              </div>
            </div>
          ) : (
            <div className="enterprise-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Workspace State
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Access and filter overview
                  </h3>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <Filter className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sensors access</p>
                  <p className={`mt-1 text-sm font-semibold ${canReadSensors ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {canReadSensors ? 'Enabled' : 'Restricted'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Controllers access</p>
                  <p className={`mt-1 text-sm font-semibold ${canReadControllers ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {canReadControllers ? 'Enabled' : 'Restricted'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Filters</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {controllerFilterActive ? (filterWindowReady ? 'Time window' : 'Incomplete') : search || 'None'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Current scope</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {currentScopeTotal.toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Visible records</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {currentItemCount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div 
                    className="h-full rounded-full bg-blue-600" 
                    style={{ width: `${Math.max(currentScopeTotal ? (currentItemCount / currentScopeTotal) * 100 : 0, currentItemCount > 0 ? 10 : 0)}%` }} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Workspace Area */}
        <div className="enterprise-card flex min-h-[600px] flex-col overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  {currentLevelLabel} Table
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  {tableTitle}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tableDescription}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span>{currentScopeTotal.toLocaleString()} in scope</span>
                </div>
                <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <ListIcon className="h-4 w-4 text-blue-500" />
                  <span>{currentItemCount.toLocaleString()} visible</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto p-4 pt-0">
            {viewMode === 'REGIONS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Region</th>
                    <th className="px-3 py-2.5">District Footprint</th>
                    <th className="px-3 py-2.5">Visibility</th>
                    <th className="px-3 py-2.5 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRegions.length === 0 ? (
                    renderEmptyState('No regions found for the current scope.', 4)
                  ) : (
                    visibleRegions.map((region) => (
                      <tr
                        key={region.id}
                        onClick={() => handleRegionClick(region)}
                        className="enterprise-subtle-card cursor-pointer"
                      >
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <MapPin className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{region.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                Region ID #{region.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                            {(region.districts?.length ?? 0).toLocaleString()} districts
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {isSupplierUser ? 'Supplier filtered view' : 'National view'}
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              Step into district coverage for this region.
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ChevronRight className="ml-auto h-5 w-5 text-slate-400" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'DISTRICTS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">District</th>
                    <th className="px-3 py-2.5">Region</th>
                    <th className="px-3 py-2.5">Hierarchy</th>
                    <th className="px-3 py-2.5 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDistricts.length === 0 ? (
                    renderEmptyState(`No districts found in ${selectedRegion?.name ?? 'this region'}.`, 4)
                  ) : (
                    visibleDistricts.map((district) => (
                      <tr
                        key={district.id}
                        onClick={() => handleDistrictClick(district)}
                        className="enterprise-subtle-card cursor-pointer"
                      >
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <MapPin className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{district.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                District ID #{district.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                            {selectedRegion?.name ?? 'Region view'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              Ready for depot navigation
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              Drill down to associated depot coverage.
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ChevronRight className="ml-auto h-5 w-5 text-slate-400" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'DEPOTS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Depot</th>
                    <th className="px-3 py-2.5">District</th>
                    <th className="px-3 py-2.5">Coverage</th>
                    <th className="px-3 py-2.5 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDepots.length === 0 ? (
                    renderEmptyState(`No depots found in ${selectedDistrict?.name ?? 'this district'}.`, 4)
                  ) : (
                    visibleDepots.map((depot) => (
                      <tr
                        key={depot.id}
                        onClick={() => handleDepotClick(depot)}
                        className="enterprise-subtle-card cursor-pointer"
                      >
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <Building2 className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{depot.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                Depot ID #{depot.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                            {selectedDistrict?.name ?? 'District view'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              Transformer-ready depot
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              Open this depot to inspect installed transformers.
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ChevronRight className="ml-auto h-5 w-5 text-slate-400" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'TRANSFORMERS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Transformer</th>
                    <th className="px-3 py-2.5">Capacity</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Devices</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransformers.length === 0 ? (
                    renderEmptyState(
                      isSupplierUser
                        ? 'No transformers are currently visible for your organisation.'
                        : `No transformers found in ${selectedDepot?.name ?? 'this depot'}.`,
                      6
                    )
                  ) : (
                    visibleTransformers.map((transformer) => (
                      <tr key={transformer.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                              <Zap className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{transformer.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                {selectedDepot?.name ?? transformer.depot?.name ?? 'No depot assigned'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-sm font-semibold ${
                              transformer.capacity ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {transformer.capacity ? `${transformer.capacity} kVA` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              formatTransformerType(transformer.type) === 'GMT'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                : formatTransformerType(transformer.type) === 'PMT'
                                  ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {formatTransformerType(transformer.type)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span className={`h-2 w-2 rounded-full ${transformer.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              {transformer.isActive ? 'Active' : 'Maintenance'}
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              {transformer.supplierName || transformer.supplierCode || 'No supplier metadata'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {canReadSensors ? (
                              <button
                                type="button"
                                onClick={() => handleViewSensors(transformer)}
                                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                              >
                                <Cpu className="h-3.5 w-3.5" />
                                Sensors
                                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                                  {transformer.sensors?.length || 0}
                                </span>
                              </button>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Sensors restricted
                              </span>
                            )}

                            {canReadControllers ? (
                              <button
                                type="button"
                                onClick={() => handleViewControllers(transformer)}
                                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                              >
                                <Cpu className="h-3.5 w-3.5" />
                                Controllers
                                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                                  {transformer.controllers?.length || 0}
                                </span>
                              </button>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Controllers restricted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ActionMenu
                            placement="bottom-end"
                            onView={() => openViewModal(transformer)}
                            onEdit={canUpdateTransformers ? () => handleEditTransformer(transformer) : undefined}
                            onDelete={canDeleteTransformers ? () => handleDelete(transformer.id) : undefined}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'SENSORS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Sensor</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Device ID</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSensors.length === 0 ? (
                    renderEmptyState(`No sensors found for ${selectedTransformer?.name ?? 'this transformer'}.`, 4)
                  ) : (
                    visibleSensors.map((sensor) => (
                      <tr key={sensor.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <Cpu className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{sensor.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                Sensor ID #{sensor.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">{sensor.type}</td>
                        <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {sensor.deviceId || sensor.devEui || '—'}
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewReadings(sensor)}
                            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            <ListIcon className="h-3.5 w-3.5" />
                            Readings
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'READINGS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">Decoded Metrics</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.length === 0 ? (
                    renderEmptyState('No readings found for the selected sensor.', 2)
                  ) : (
                    readings.map((reading) => (
                      <tr key={reading.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3 align-top">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                            <CalendarIcon className="h-4 w-4 text-blue-500" />
                            {new Date(reading.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3">
                          <AttributeGrid attributes={reading.attributes || {}} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'CONTROLLERS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Controller</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Device ID</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleControllers.length === 0 ? (
                    renderEmptyState(`No controllers found for ${selectedTransformer?.name ?? 'this transformer'}.`, 4)
                  ) : (
                    visibleControllers.map((controller) => (
                      <tr key={controller.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                              <Cpu className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{controller.name}</p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                Controller ID #{controller.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">{controller.type}</td>
                        <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {controller.deviceId || controller.devEui || '—'}
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewControllerReadings(controller)}
                            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                          >
                            <ListIcon className="h-3.5 w-3.5" />
                            Readings
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {viewMode === 'CONTROLLER_READINGS' && (
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">Decoded Metrics</th>
                  </tr>
                </thead>
                <tbody>
                  {controllerReadings.length === 0 ? (
                    renderEmptyState('No controller readings found for the selected time window.', 2)
                  ) : (
                    controllerReadings.map((reading) => (
                      <tr key={reading.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3 align-top">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                            <ClockIcon className="h-4 w-4 text-violet-500" />
                            {new Date(reading.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 min-w-[320px]">
                          <AttributeGrid attributes={reading.attributes || {}} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {renderPagination()}
        </div>
      </section>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        variant="center"
        showCloseButton={false}
        className="max-h-[90vh] max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        backdropBlur={true}
      >
        <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Transformer
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    Create transformer
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Add a transformer without leaving the hierarchy workspace.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateTransformer} className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
            {createError && <Alert variant="error" title="Error" message={createError} />}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Transformer Name
                </label>
                <input
                  type="text"
                  required
                  value={createNameInput}
                  onChange={(e) => setCreateNameInput(e.target.value)}
                  placeholder="e.g. TF-1234"
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {!isSupplierUser && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Depot
                  </label>
                  <div className="mt-2">
                    {loadingCreateDepots ? (
                      <div className="enterprise-chip flex items-center gap-2 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        Loading depots...
                      </div>
                    ) : (
                      <SearchableSelect
                        options={createDepotOptions}
                        value={createDepotInput}
                        onChange={setCreateDepotInput}
                        placeholder="Select depot..."
                      />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Capacity (kVA)
                </label>
                <input
                  type="number"
                  value={createCapacityInput}
                  onChange={(e) => setCreateCapacityInput(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 500"
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Transformer Type
                </label>
                <select
                  value={createTypeInput}
                  onChange={(e) => setCreateTypeInput((e.target.value as TransformerTypeOption | '') || '')}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Select type...</option>
                  <option value="GROUND_MOUNTED">GMT</option>
                  <option value="POLE_MOUNTED">PMT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={createLatInput}
                  onChange={(e) => setCreateLatInput(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. -1.2921"
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={createLngInput}
                  onChange={(e) => setCreateLngInput(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 36.8219"
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Status
                </label>
                <select
                  value={createIsActiveInput ? 'true' : 'false'}
                  onChange={(e) => setCreateIsActiveInput(e.target.value === 'true')}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCreate}
                className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingCreate ? 'Creating...' : 'Create Transformer'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={showView}
        onClose={() => setShowView(false)}
        variant="center"
        showCloseButton={false}
        className="max-h-[88vh] max-w-[640px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        backdropBlur={true}
      >
        {activeTransformer && (
          <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
            <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                      Transformer Details
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {activeTransformer.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Centered detail modal for quick operational context without leaving the hierarchy shell.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowView(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Status',
                    value: activeTransformer.isActive ? 'Active' : 'Maintenance',
                    tone: activeTransformer.isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300',
                  },
                  {
                    label: 'Capacity',
                    value: activeTransformer.capacity ? `${activeTransformer.capacity} kVA` : '—',
                    tone: 'text-slate-900 dark:text-slate-100',
                  },
                  {
                    label: 'Sensors',
                    value: String(activeTransformer.sensors?.length ?? 0),
                    tone: 'text-slate-900 dark:text-slate-100',
                  },
                  {
                    label: 'Controllers',
                    value: String(activeTransformer.controllers?.length ?? 0),
                    tone: 'text-slate-900 dark:text-slate-100',
                  },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
                    <p className={`mt-2 text-sm font-semibold ${metric.tone}`}>{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                    Hierarchy Mapping
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                    Asset placement
                  </h4>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    ['Region', selectedRegion?.name ?? '—'],
                    ['District', selectedDistrict?.name ?? '—'],
                    ['Depot', selectedDepot?.name ?? activeTransformer.depot?.name ?? '—'],
                    ['Transformer type', formatTransformerType(activeTransformer.type)],
                    [isSupplierUser ? 'Visible through' : 'Organisation', isSupplierUser ? (user?.supplierName ?? 'Supplier-linked assignment') : (activeTransformer.supplierName ?? '—')],
                    [
                      'Coordinates',
                      typeof activeTransformer.lat === 'number' && typeof activeTransformer.lng === 'number'
                        ? `${activeTransformer.lat}, ${activeTransformer.lng}`
                        : '—',
                    ],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowView(false)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AttributeGrid({ attributes }: { attributes: Record<string, any> }) {
  const entries = flattenAttributes(attributes);
  if (entries.length === 0) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">No decoded metrics</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={`rounded-xl border px-2.5 py-1.5 ${getAttributeChipTone(key, value)}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {formatAttributeKey(key)}
          </div>
          <div className={`mt-0.5 text-xs font-semibold ${getAttributeValueTone(key, value)}`}>
            {formatAttributeValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function flattenAttributes(input: Record<string, any>, prefix = ''): Array<[string, any]> {
  const entries: Array<[string, any]> = [];
  Object.entries(input || {}).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenAttributes(value as Record<string, any>, nextKey));
      return;
    }
    entries.push([nextKey, value]);
  });
  return entries;
}

function formatAttributeValue(value: any) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

function formatAttributeKey(key: string) {
  return key.replaceAll('.', ' ').replaceAll('_', ' ');
}

function getAttributeChipTone(key: string, value: any) {
  const normalizedKey = key.toLowerCase();
  const normalizedValue = typeof value === 'string' ? value.toLowerCase() : value;

  if (
    normalizedKey.includes('alarm') ||
    normalizedKey.includes('fault') ||
    normalizedKey.includes('error') ||
    normalizedKey.includes('alert') ||
    normalizedValue === 'alarm' ||
    normalizedValue === 'fault' ||
    normalizedValue === 'error'
  ) {
    return 'border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10';
  }

  if (typeof value === 'boolean') {
    return value
      ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10'
      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900';
  }

  if (normalizedKey.includes('mode_name') || normalizedKey.includes('hardware')) {
    return 'border-fuchsia-200 bg-fuchsia-50/80 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10';
  }

  if (normalizedKey.includes('mode')) {
    return 'border-violet-200 bg-violet-50/80 dark:border-violet-500/20 dark:bg-violet-500/10';
  }

  if (
    normalizedKey.includes('voltage') ||
    normalizedKey.includes('current') ||
    normalizedKey.includes('battery')
  ) {
    return 'border-blue-200 bg-blue-50/80 dark:border-blue-500/20 dark:bg-blue-500/10';
  }

  if (normalizedKey.includes('rssi') || normalizedKey.includes('snr')) {
    return 'border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10';
  }

  if (typeof value === 'number' && value === 0) {
    return 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900';
  }

  if (typeof value === 'number' && value > 0) {
    return 'border-cyan-200 bg-cyan-50/80 dark:border-cyan-500/20 dark:bg-cyan-500/10';
  }

  return 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950';
}

function getAttributeValueTone(key: string, value: any) {
  const normalizedKey = key.toLowerCase();
  const normalizedValue = typeof value === 'string' ? value.toLowerCase() : value;

  if (
    normalizedKey.includes('alarm') ||
    normalizedKey.includes('fault') ||
    normalizedKey.includes('error') ||
    normalizedKey.includes('alert') ||
    normalizedValue === 'alarm' ||
    normalizedValue === 'fault' ||
    normalizedValue === 'error'
  ) {
    return 'text-rose-700 dark:text-rose-300';
  }

  if (typeof value === 'boolean') {
    return value ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400';
  }

  if (normalizedKey.includes('mode_name') || normalizedKey.includes('hardware')) {
    return 'text-fuchsia-700 dark:text-fuchsia-300';
  }

  if (normalizedKey.includes('mode')) {
    return 'text-violet-700 dark:text-violet-300';
  }

  if (
    normalizedKey.includes('voltage') ||
    normalizedKey.includes('current') ||
    normalizedKey.includes('battery')
  ) {
    return typeof value === 'number' && value === 0
      ? 'text-slate-500 dark:text-slate-400'
      : 'text-blue-700 dark:text-blue-300';
  }

  if (normalizedKey.includes('rssi') || normalizedKey.includes('snr')) {
    return typeof value === 'number' && value === 0
      ? 'text-slate-500 dark:text-slate-400'
      : 'text-amber-700 dark:text-amber-300';
  }

  if (typeof value === 'number' && value === 0) {
    return 'text-slate-500 dark:text-slate-400';
  }

  if (typeof value === 'number' && value > 0) {
    return 'text-cyan-700 dark:text-cyan-300';
  }

  return 'text-slate-900 dark:text-slate-100';
}
