import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, MapPin, Zap, Activity, Building2, X, ChevronRight, ArrowLeft, Loader2, Search, Camera as CameraIcon, Cpu, List as ListIcon, Image as ImageIcon, Eye as EyeIcon, ChevronLeft as ChevronLeftIcon, Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-react';

// --- Interfaces ---

interface Region {
  id: number;
  name: string;
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
  capacity?: number;
  isActive?: boolean;
  depotId?: number;
  depot?: { id: number; name: string };
  lat?: number;
  lng?: number;
  sensors?: Sensor[];
  cameras?: Camera[];
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
  di1: boolean;
  di2: boolean;
  battery: number;
  rssi: number;
  snr: number;
  createdAt: string;
  updatedAt: string;
}

interface Camera {
  id: number;
  name: string;
  topic?: string;
  model?: string;
  status?: string;
  transformerId?: number;
}

interface CameraImage {
  id: number;
  imageUrl: string;
  capturedAt: string;
  cameraMacAddress?: string;
  cameraModel?: string;
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

type ViewMode = 'REGIONS' | 'DISTRICTS' | 'DEPOTS' | 'TRANSFORMERS' | 'SENSORS' | 'CAMERAS' | 'READINGS' | 'IMAGES' | 'CONTROLLERS' | 'CONTROLLER_READINGS';

export default function TransformersIndex() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  // --- Navigation State ---
  const [viewMode, setViewMode] = useState<ViewMode>('REGIONS');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [selectedTransformer, setSelectedTransformer] = useState<Transformer | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedController, setSelectedController] = useState<Controller | null>(null);

  // --- Data State ---
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [controllerReadings, setControllerReadings] = useState<ControllerReading[]>([]);
  const [images, setImages] = useState<CameraImage[]>([]);

  // Image Filter & Pagination State
  const [imageStartDate, setImageStartDate] = useState<Date | null>(null);
  const [imageStartTime, setImageStartTime] = useState<Date | null>(null);
  const [imageEndDate, setImageEndDate] = useState<Date | null>(null);
  const [imageEndTime, setImageEndTime] = useState<Date | null>(null);

  // Controller Filter State
  const [controllerStartDate, setControllerStartDate] = useState<Date | null>(null);
  const [controllerStartTime, setControllerStartTime] = useState<Date | null>(null);
  const [controllerEndDate, setControllerEndDate] = useState<Date | null>(null);
  const [controllerEndTime, setControllerEndTime] = useState<Date | null>(null);
  const [imagePage, setImagePage] = useState(1);
  const [imagePageSize] = useState(10);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
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
  const [showView, setShowView] = useState(false);
  const [activeTransformer, setActiveTransformer] = useState<Transformer | null>(null);
  
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

  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (API_BASE_URL && !url.startsWith(API_BASE_URL)) {
        return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
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

  const fetchTransformers = useCallback(async (depotId: number) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/transformers/depot/${depotId}`, { headers });
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

  const fetchCameras = useCallback(async (transformerId: number) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/v1/cameras/transformer/${transformerId}`, { headers });
      const list = normalizeList(res.data);
      setCameras(list);
      setTotalElements(list.length);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch cameras');
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

  const fetchImages = useCallback(async (cameraId: number) => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/api/v1/cameras/${cameraId}/images`;
      const params: any = {};
      
      if (imageStartDate && imageEndDate) {
          url = `${API_BASE_URL}/api/v1/cameras/${cameraId}/images/filter`;
          
          const formatDate = (date: any) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          };

          const formatTime = (date: any) => {
            if (!date) return "00:00"; // Default to midnight if time not selected
            const h = String(date.getHours()).padStart(2, '0');
            const m = String(date.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
          };

          const start = `${formatDate(imageStartDate)}T${formatTime(imageStartTime)}:00`;
          const end = `${formatDate(imageEndDate)}T${formatTime(imageEndTime)}:59`; // End at last second of minute if time provided
          
          params.start = new Date(start).toISOString();
          params.end = new Date(end).toISOString();
      }

      const res = await axios.get(url, { headers, params });
      const list = normalizeList(res.data);
      setImages(list);
      setTotalElements(list.length);
      setImagePage(1); // Reset to first page on new fetch
    } catch (err) {
      console.error(err);
      setError('Failed to fetch images');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, imageStartDate, imageStartTime, imageEndDate, imageEndTime]);

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
    if (transformers.length > 0) {
      console.log('Transformers loaded:', transformers);
      transformers.forEach(t => {
        console.log(`Transformer ${t.id} cameras:`, t.cameras);
      });
    }
  }, [transformers]);


  useEffect(() => {
    if (!token) return;
    setError(null);
    if (viewMode === 'REGIONS') {
      fetchRegions();
    } else if (viewMode === 'DISTRICTS' && selectedRegion) {
      fetchDistricts(selectedRegion.id);
    } else if (viewMode === 'DEPOTS' && selectedDistrict) {
      fetchDepots(selectedDistrict.id);
    } else if (viewMode === 'TRANSFORMERS' && selectedDepot) {
      fetchTransformers(selectedDepot.id);
    } else if (viewMode === 'SENSORS' && selectedTransformer) {
      fetchSensors(selectedTransformer.id);
    } else if (viewMode === 'CAMERAS' && selectedTransformer) {
      fetchCameras(selectedTransformer.id);
    } else if (viewMode === 'READINGS' && selectedSensor) {
      fetchReadings(selectedSensor.id);
    } else if (viewMode === 'IMAGES' && selectedCamera) {
      fetchImages(selectedCamera.id);
    } else if (viewMode === 'CONTROLLERS' && selectedTransformer) {
      fetchControllers(selectedTransformer.id);
    } else if (viewMode === 'CONTROLLER_READINGS' && selectedController) {
      fetchControllerReadings(selectedController.id);
    }
  }, [token, viewMode, selectedRegion, selectedDistrict, selectedDepot, selectedTransformer, selectedSensor, selectedCamera, selectedController, page, fetchRegions, fetchDistricts, fetchDepots, fetchTransformers, fetchSensors, fetchCameras, fetchReadings, fetchImages, fetchControllers, fetchControllerReadings]);

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

  const handleViewCameras = (transformer: Transformer) => {
    setSelectedTransformer(transformer);
    setViewMode('CAMERAS');
    setPage(1);
    setSearch('');
  };

  const handleViewReadings = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setViewMode('READINGS');
    setPage(1);
    setSearch('');
  };

  const handleViewImages = (camera: Camera) => {
    setSelectedCamera(camera);
    setViewMode('IMAGES');
    setPage(1);
    setSearch('');
    setImageStartDate(null);
    setImageStartTime(null);
    setImageEndDate(null);
    setImageEndTime(null);
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
    if (viewMode === 'IMAGES') {
      setViewMode('CAMERAS');
      setSelectedCamera(null);
    } else if (viewMode === 'READINGS') {
      setViewMode('SENSORS');
      setSelectedSensor(null);
    } else if (viewMode === 'CAMERAS') {
      setViewMode('TRANSFORMERS');
      setSelectedTransformer(null);
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
          setSelectedCamera(null);
      } else if (mode === 'DISTRICTS') {
          setViewMode('DISTRICTS');
          setSelectedDistrict(null);
          setSelectedDepot(null);
          setSelectedTransformer(null);
          setSelectedSensor(null);
          setSelectedCamera(null);
      } else if (mode === 'DEPOTS') {
          setViewMode('DEPOTS');
          setSelectedDepot(null);
          setSelectedTransformer(null);
          setSelectedSensor(null);
          setSelectedCamera(null);
      } else if (mode === 'TRANSFORMERS') {
          setViewMode('TRANSFORMERS');
          setSelectedTransformer(null);
          setSelectedSensor(null);
          setSelectedCamera(null);
          setSelectedController(null);
      } else if (mode === 'SENSORS') {
          setViewMode('SENSORS');
          setSelectedSensor(null);
      } else if (mode === 'CAMERAS') {
          setViewMode('CAMERAS');
          setSelectedCamera(null);
      } else if (mode === 'CONTROLLERS') {
          setViewMode('CONTROLLERS');
          setSelectedController(null);
      }
  };

  // --- CRUD Handlers (Transformers) ---

  const handleAddTransformer = () => {
      navigate('/transformers/new');
  };

  const handleEditTransformer = (t: Transformer) => {
      navigate(`/transformers/${t.id}/edit`);
  };

  const openViewModal = (t: Transformer) => {
      setActiveTransformer(t);
      setShowView(true);
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

  const renderBreadcrumbs = () => (
      <nav className="flex items-center text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap">
          <button onClick={() => navigateTo('REGIONS')} className={`hover:text-brand-600 ${viewMode === 'REGIONS' ? 'font-bold text-brand-600' : ''}`}>
              Regions
          </button>
          {selectedRegion && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <button onClick={() => navigateTo('DISTRICTS')} className={`hover:text-brand-600 ${viewMode === 'DISTRICTS' ? 'font-bold text-brand-600' : ''}`}>
                      {selectedRegion.name}
                  </button>
              </>
          )}
          {selectedDistrict && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <button onClick={() => navigateTo('DEPOTS')} className={`hover:text-brand-600 ${viewMode === 'DEPOTS' ? 'font-bold text-brand-600' : ''}`}>
                      {selectedDistrict.name}
                  </button>
              </>
          )}
          {selectedDepot && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <button onClick={() => navigateTo('TRANSFORMERS')} className={`hover:text-brand-600 ${viewMode === 'TRANSFORMERS' ? 'font-bold text-brand-600' : ''}`}>
                      {selectedDepot.name}
                  </button>
              </>
          )}
          {selectedTransformer && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className={`hover:text-brand-600 ${['SENSORS', 'CAMERAS', 'CONTROLLERS'].includes(viewMode) ? 'font-bold text-brand-600' : ''}`}>
                      {selectedTransformer.name}
                  </span>
              </>
          )}
          {viewMode === 'SENSORS' && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className="font-bold text-brand-600">Sensors</span>
              </>
          )}
          {viewMode === 'CAMERAS' && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className="font-bold text-brand-600">Cameras</span>
              </>
          )}
          {viewMode === 'CONTROLLERS' && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className="font-bold text-brand-600">Controllers</span>
              </>
          )}
          {selectedSensor && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <button onClick={() => navigateTo('SENSORS')} className="hover:text-brand-600">Sensors</button>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className="font-bold text-brand-600">Readings</span>
              </>
          )}
          {selectedCamera && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <button onClick={() => navigateTo('CAMERAS')} className="hover:text-brand-600">Cameras</button>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className="font-bold text-brand-600">Images</span>
              </>
          )}
          {selectedController && (
              <>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <button onClick={() => navigateTo('CONTROLLERS')} className="hover:text-brand-600">Controllers</button>
                  <ChevronRight className="h-4 w-4 mx-2" />
                  <span className="font-bold text-brand-600">Readings</span>
              </>
          )}
      </nav>
  );

  const filteredList = <T extends { name: string }>(list: T[]) => {
      if (!search) return list;
      return list.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  };

  // --- Main Render ---

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title}>{notice.message}</Alert>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transformers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage electrical infrastructure hierarchy</p>
        </div>
        {viewMode === 'TRANSFORMERS' && (
            <Button onClick={handleAddTransformer} icon={<Plus className="h-4 w-4" />}>
                Add Transformer
            </Button>
        )}
      </div>

      {/* Navigation & Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {renderBreadcrumbs()}
              
              <div className="relative max-w-xs w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                      type="text"
                      placeholder={`Search ${viewMode.toLowerCase()}...`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                  />
              </div>
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
      ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
              {/* REGIONS VIEW */}
              {viewMode === 'REGIONS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(regions).map((r) => (
                              <tr key={r.id} onClick={() => handleRegionClick(r)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{r.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      <ChevronRight className="h-5 w-5 text-gray-400 inline-block" />
                                  </td>
                              </tr>
                          ))}
                          {regions.length === 0 && (
                              <tr><td colSpan={2} className="px-6 py-12 text-center text-gray-500">No regions found.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* DISTRICTS VIEW */}
              {viewMode === 'DISTRICTS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">District Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(districts).map((d) => (
                              <tr key={d.id} onClick={() => handleDistrictClick(d)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{d.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      <ChevronRight className="h-5 w-5 text-gray-400 inline-block" />
                                  </td>
                              </tr>
                          ))}
                          {districts.length === 0 && (
                              <tr><td colSpan={2} className="px-6 py-12 text-center text-gray-500">No districts found in {selectedRegion?.name}.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* DEPOTS VIEW */}
              {viewMode === 'DEPOTS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depot Name</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(depots).map((d) => (
                              <tr key={d.id} onClick={() => handleDepotClick(d)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{d.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      <ChevronRight className="h-5 w-5 text-gray-400 inline-block" />
                                  </td>
                              </tr>
                          ))}
                          {depots.length === 0 && (
                              <tr><td colSpan={2} className="px-6 py-12 text-center text-gray-500">No depots found in {selectedDistrict?.name}.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* TRANSFORMERS VIEW */}
              {viewMode === 'TRANSFORMERS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transformer</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sensors</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cameras</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Controllers</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(transformers).map((t) => (
                              <tr key={t.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <Zap className="h-5 w-5 text-yellow-500 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{t.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {t.capacity ? `${t.capacity} kVA` : '—'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                          {t.isActive ? 'Active' : 'Maintenance'}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <button 
                                          onClick={() => handleViewSensors(t)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                      >
                                          <Cpu className="h-3 w-3 mr-1.5" />
                                          Sensors
                                          <span className="ml-1.5 bg-white bg-opacity-20 py-0.5 px-1.5 rounded-full text-[10px] font-semibold">
                                              {t.sensors?.length || 0}
                                          </span>
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <button 
                                          onClick={() => handleViewCameras(t)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                                      >
                                          <CameraIcon className="h-3 w-3 mr-1.5" />
                                          Cameras
                                          <span className="ml-1.5 bg-white bg-opacity-20 py-0.5 px-1.5 rounded-full text-[10px] font-semibold">
                                              {t.cameras?.length || 0}
                                          </span>
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <button 
                                          onClick={() => handleViewControllers(t)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                                      >
                                          <Cpu className="h-3 w-3 mr-1.5" />
                                          Controllers
                                          <span className="ml-1.5 bg-white bg-opacity-20 py-0.5 px-1.5 rounded-full text-[10px] font-semibold">
                                              {t.controllers?.length || 0}
                                          </span>
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <ActionMenu
                                          placement="bottom-end"
                                          onView={() => openViewModal(t)}
                                          onEdit={() => handleEditTransformer(t)}
                                          onDelete={() => handleDelete(t.id)}
                                      />
                                  </td>
                              </tr>
                          ))}
                          {transformers.length === 0 && (
                              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No transformers found in {selectedDepot?.name}.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* SENSORS VIEW */}
              {viewMode === 'SENSORS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sensor Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(sensors).map((s) => (
                              <tr key={s.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <Cpu className="h-5 w-5 text-gray-400 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{s.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.type}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.deviceId || s.devEui || '-'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <Button variant="secondary" size="sm" onClick={() => handleViewReadings(s)} icon={<ListIcon className="h-4 w-4" />}>
                                          Readings
                                      </Button>
                                  </td>
                              </tr>
                          ))}
                          {sensors.length === 0 && (
                              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No sensors found for {selectedTransformer?.name}.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* CAMERAS VIEW */}
              {viewMode === 'CAMERAS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Camera Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(cameras).map((c) => (
                              <tr key={c.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <CameraIcon className="h-5 w-5 text-gray-400 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{c.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.model || '-'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                          {c.status || 'Unknown'}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <Button variant="secondary" size="sm" onClick={() => handleViewImages(c)} icon={<ImageIcon className="h-4 w-4" />}>
                                          Images
                                      </Button>
                                  </td>
                              </tr>
                          ))}
                          {cameras.length === 0 && (
                              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No cameras found for {selectedTransformer?.name}.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* READINGS VIEW */}
              {viewMode === 'READINGS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Values</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {readings.map((r) => (
                              <tr key={r.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {new Date(r.createdAt).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-500">
                                      <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-100 overflow-x-auto whitespace-pre-wrap">
                                          {JSON.stringify(r.attributes || {}, null, 2)}
                                      </pre>
                                  </td>
                              </tr>
                          ))}
                          {readings.length === 0 && (
                              <tr><td colSpan={2} className="px-6 py-12 text-center text-gray-500">No readings found.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* IMAGES VIEW */}
              {viewMode === 'IMAGES' && (
                  <div className="p-6">
                      <div className="flex flex-col gap-4 mb-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Images for {selectedCamera?.name}</h2>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => { 
                                    setImageStartDate(null); 
                                    setImageStartTime(null); 
                                    setImageEndDate(null); 
                                    setImageEndTime(null); 
                                }}
                                className="text-xs"
                            >
                                Clear Filters
                            </Button>
                          </div>
                          
                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* From Section */}
                                  <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                                      <div className="flex items-center gap-2 mb-2">
                                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">From</label>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Date</label>
                                              <div className="relative">
                                                  <DatePicker
                                                selected={imageStartDate}
                                                onChange={(date: Date | null) => setImageStartDate(date)}
                                                dateFormat="MM/dd/yyyy"
                                                placeholderText="Select Date"
                                                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs py-1.5 pl-8 pr-2"
                                            />
                                                  <CalendarIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Time</label>
                                              <div className="relative">
                                                  <DatePicker
                                                selected={imageStartTime}
                                                onChange={(date: Date | null) => setImageStartTime(date)}
                                                showTimeSelect
                                                showTimeSelectOnly
                                                      timeIntervals={15}
                                                      timeCaption="Time"
                                                      dateFormat="h:mm aa"
                                                      placeholderText="--:-- --"
                                                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs py-1.5 pl-8 pr-2"
                                                  />
                                                  <ClockIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  {/* To Section */}
                                  <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                                      <div className="flex items-center gap-2 mb-2">
                                          <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">To</label>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Date</label>
                                              <div className="relative">
                                                  <DatePicker
                                                selected={imageEndDate}
                                                onChange={(date: Date | null) => setImageEndDate(date)}
                                                dateFormat="MM/dd/yyyy"
                                                placeholderText="Select Date"
                                                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs py-1.5 pl-8 pr-2"
                                            />
                                                  <CalendarIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Time</label>
                                              <div className="relative">
                                                  <DatePicker
                                                      selected={imageEndTime}
                                                      onChange={(date) => setImageEndTime(date)}
                                                      showTimeSelect
                                                      showTimeSelectOnly
                                                      timeIntervals={15}
                                                      timeCaption="Time"
                                                      dateFormat="h:mm aa"
                                                      placeholderText="--:-- --"
                                                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs py-1.5 pl-8 pr-2"
                                                  />
                                                  <ClockIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                          <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Captured At</th>
                                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                  {images.slice((imagePage - 1) * imagePageSize, imagePage * imagePageSize).map((img) => (
                                      <tr key={img.id} className="hover:bg-gray-50">
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                              #{img.id}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                              {new Date(img.capturedAt).toLocaleString()}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                              <Button 
                                                  size="sm" 
                                                  onClick={() => {
                                                      setPreviewImageUrl(getImageUrl(img.imageUrl));
                                                      setShowImagePreview(true);
                                                  }}
                                                  icon={<EyeIcon className="h-4 w-4" />}
                                              >
                                                  View
                                              </Button>
                                          </td>
                                      </tr>
                                  ))}
                                  {images.length === 0 && (
                                      <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500">No images found.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>

                      {/* Pagination Controls */}
                      {images.length > 0 && (
                          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                              <div className="flex flex-1 justify-between sm:hidden">
                                  <Button 
                                      onClick={() => setImagePage(p => Math.max(1, p - 1))} 
                                      disabled={imagePage === 1}
                                      variant="outline"
                                  >
                                      Previous
                                  </Button>
                                  <Button 
                                      onClick={() => setImagePage(p => Math.min(Math.ceil(images.length / imagePageSize), p + 1))} 
                                      disabled={imagePage >= Math.ceil(images.length / imagePageSize)}
                                      variant="outline"
                                  >
                                      Next
                                  </Button>
                              </div>
                              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                  <div>
                                      <p className="text-sm text-gray-700">
                                          Showing <span className="font-medium">{(imagePage - 1) * imagePageSize + 1}</span> to <span className="font-medium">{Math.min(imagePage * imagePageSize, images.length)}</span> of <span className="font-medium">{images.length}</span> results
                                      </p>
                                  </div>
                                  <div>
                                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                          <button
                                              onClick={() => setImagePage(p => Math.max(1, p - 1))}
                                              disabled={imagePage === 1}
                                              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                          >
                                              <span className="sr-only">Previous</span>
                                              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                                          </button>
                                          <button
                                              onClick={() => setImagePage(p => Math.min(Math.ceil(images.length / imagePageSize), p + 1))}
                                              disabled={imagePage >= Math.ceil(images.length / imagePageSize)}
                                              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                          >
                                              <span className="sr-only">Next</span>
                                              <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                          </button>
                                      </nav>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </div>
      )}





              {/* CONTROLLERS VIEW */}
              {viewMode === 'CONTROLLERS' && (
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Controller Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredList(controllers).map((c) => (
                              <tr key={c.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <Cpu className="h-5 w-5 text-gray-400 mr-3" />
                                          <div className="text-sm font-medium text-gray-900">{c.name}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.type}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.deviceId || c.devEui || '-'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <Button variant="secondary" size="sm" onClick={() => handleViewControllerReadings(c)} icon={<ListIcon className="h-4 w-4" />}>
                                          Readings
                                      </Button>
                                  </td>
                              </tr>
                          ))}
                          {controllers.length === 0 && (
                              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No controllers found for {selectedTransformer?.name}.</td></tr>
                          )}
                      </tbody>
                  </table>
              )}

              {/* CONTROLLER READINGS VIEW */}
              {viewMode === 'CONTROLLER_READINGS' && (
                  <div className="p-6">
                      <div className="flex flex-col gap-4 mb-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Readings for {selectedController?.name}</h2>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => { 
                                    setControllerStartDate(null); 
                                    setControllerStartTime(null); 
                                    setControllerEndDate(null); 
                                    setControllerEndTime(null); 
                                }}
                                className="text-xs"
                            >
                                Clear Filters
                            </Button>
                          </div>
                          
                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* From Section */}
                                  <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                                      <div className="flex items-center gap-2 mb-2">
                                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">From</label>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Date</label>
                                              <div className="relative">
                                                  <DatePicker
                                                selected={controllerStartDate}
                                                onChange={(date: Date | null) => setControllerStartDate(date)}
                                                dateFormat="MM/dd/yyyy"
                                                placeholderText="Select Date"
                                                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs py-1.5 pl-8 pr-2"
                                            />
                                                  <CalendarIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Time</label>
                                              <div className="relative">
                                                  <DatePicker
                                                selected={controllerStartTime}
                                                onChange={(date: Date | null) => setControllerStartTime(date)}
                                                showTimeSelect
                                                showTimeSelectOnly
                                                      timeIntervals={15}
                                                      timeCaption="Time"
                                                      dateFormat="h:mm aa"
                                                      placeholderText="--:-- --"
                                                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs py-1.5 pl-8 pr-2"
                                                  />
                                                  <ClockIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  {/* To Section */}
                                  <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                                      <div className="flex items-center gap-2 mb-2">
                                          <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">To</label>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Date</label>
                                              <div className="relative">
                                                  <DatePicker
                                                selected={controllerEndDate}
                                                onChange={(date: Date | null) => setControllerEndDate(date)}
                                                dateFormat="MM/dd/yyyy"
                                                placeholderText="Select Date"
                                                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs py-1.5 pl-8 pr-2"
                                            />
                                                  <CalendarIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Time</label>
                                              <div className="relative">
                                                  <DatePicker
                                                      selected={controllerEndTime}
                                                      onChange={(date) => setControllerEndTime(date)}
                                                      showTimeSelect
                                                      showTimeSelectOnly
                                                      timeIntervals={15}
                                                      timeCaption="Time"
                                                      dateFormat="h:mm aa"
                                                      placeholderText="--:-- --"
                                                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs py-1.5 pl-8 pr-2"
                                                  />
                                                  <ClockIcon className="absolute left-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Pagination Info & Page Size Selector (Top) */}
                      <div className="flex items-center justify-between mb-4 px-1">
                          <p className="text-sm text-gray-700">
                              Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, totalElements)}</span> of <span className="font-medium">{totalElements}</span> results
                          </p>
                          <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Rows per page:</span>
                              <select
                                  value={pageSize}
                                  onChange={(e) => {
                                      setPageSize(Number(e.target.value));
                                      setPage(1);
                                  }}
                                  className="block rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 cursor-pointer"
                              >
                                  <option value={10}>10</option>
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                              </select>
                          </div>
                      </div>

                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg shadow-sm">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DI1</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DI2</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Battery</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSSI</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SNR</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raw Payload</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                              {controllerReadings.map((r) => (
                                  <tr key={r.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {new Date(r.createdAt).toLocaleString()}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{r.di1 ? 'True' : 'False'}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{r.di2 ? 'True' : 'False'}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{r.battery}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{r.rssi}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500">{r.snr}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={r.rawPayload}>{r.rawPayload}</td>
                                  </tr>
                              ))}
                              {controllerReadings.length === 0 && (
                                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No readings found.</td></tr>
                              )}
                          </tbody>
                      </table>
                      
                      {/* Pagination Controls */}
                      {controllerReadings.length > 0 && (
                          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                              <div className="flex flex-1 justify-between sm:hidden">
                                  <Button 
                                      onClick={() => setPage(p => Math.max(1, p - 1))} 
                                      disabled={page === 1}
                                      variant="outline"
                                  >
                                      Previous
                                  </Button>
                                  <Button 
                                      onClick={() => setPage(p => Math.min(Math.ceil(totalElements / pageSize), p + 1))} 
                                      disabled={page >= Math.ceil(totalElements / pageSize)}
                                      variant="outline"
                                  >
                                      Next
                                  </Button>
                              </div>
                              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-end">
                                  <div>
                                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                          <button
                                              onClick={() => setPage(p => Math.max(1, p - 1))}
                                              disabled={page === 1}
                                              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                          >
                                              <span className="sr-only">Previous</span>
                                              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                                          </button>
                                          
                                          {(() => {
                                              const totalPages = Math.ceil(totalElements / pageSize);
                                              const pageNumbers = [];
                                              const maxVisible = 7;

                                              if (totalPages <= maxVisible) {
                                                  for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
                                              } else {
                                                  if (page <= 4) {
                                                      for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                                                      pageNumbers.push('...');
                                                      pageNumbers.push(totalPages);
                                                  } else if (page >= totalPages - 3) {
                                                      pageNumbers.push(1);
                                                      pageNumbers.push('...');
                                                      for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
                                                  } else {
                                                      pageNumbers.push(1);
                                                      pageNumbers.push('...');
                                                      pageNumbers.push(page - 1);
                                                      pageNumbers.push(page);
                                                      pageNumbers.push(page + 1);
                                                      pageNumbers.push('...');
                                                      pageNumbers.push(totalPages);
                                                  }
                                              }

                                              return pageNumbers.map((p, idx) => (
                                                  <button
                                                      key={idx}
                                                      onClick={() => typeof p === 'number' && setPage(p)}
                                                      disabled={p === '...'}
                                                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                                          p === page
                                                              ? 'z-10 bg-purple-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600'
                                                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                                      } ${p === '...' ? 'cursor-default' : ''}`}
                                                  >
                                                      {p}
                                                  </button>
                                              ));
                                          })()}

                                          <button
                                              onClick={() => setPage(p => Math.min(Math.ceil(totalElements / pageSize), p + 1))}
                                              disabled={page >= Math.ceil(totalElements / pageSize)}
                                              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                          >
                                              <span className="sr-only">Next</span>
                                              <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                          </button>
                                      </nav>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              )}

      {/* VIEW MODAL */}
      <Modal isOpen={showView} onClose={() => setShowView(false)} title="Transformer Details">
          {activeTransformer && (
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase">Name</label>
                          <p className="mt-1 text-sm text-gray-900 font-medium">{activeTransformer.name}</p>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase">Status</label>
                          <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activeTransformer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {activeTransformer.isActive ? 'Active' : 'Maintenance'}
                          </span>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase">Capacity</label>
                          <p className="mt-1 text-sm text-gray-900">{activeTransformer.capacity ? `${activeTransformer.capacity} kVA` : '—'}</p>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase">Depot</label>
                          <p className="mt-1 text-sm text-gray-900">{activeTransformer.depot?.name ?? '—'}</p>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase">Coordinates</label>
                          <p className="mt-1 text-sm text-gray-900">
                              {activeTransformer.lat && activeTransformer.lng ? `${activeTransformer.lat}, ${activeTransformer.lng}` : '—'}
                          </p>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                      <Button variant="outline" onClick={() => setShowView(false)}>Close</Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* IMAGE PREVIEW MODAL */}
      <Modal isOpen={showImagePreview} onClose={() => setShowImagePreview(false)} title="Image Preview" className="max-w-4xl w-full">
          <div className="flex justify-center bg-black rounded-lg overflow-hidden">
              {previewImageUrl && (
                  <img 
                      src={previewImageUrl} 
                      alt="Preview" 
                      className="max-h-[80vh] w-auto object-contain" 
                  />
              )}
          </div>
          <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowImagePreview(false)}>Close</Button>
          </div>
      </Modal>
    </div>
  );
}
