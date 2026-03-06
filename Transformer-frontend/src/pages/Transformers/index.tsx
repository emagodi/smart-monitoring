import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Modal } from '../../components/ui/modal';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, MapPin, Zap, Activity, Building2, X, ChevronRight, ArrowLeft, Loader2, Search, Camera as CameraIcon, Cpu, List as ListIcon, Image as ImageIcon } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

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

// For the creation modal dropdown
interface DepotOption { id: number; name: string }

type ViewMode = 'REGIONS' | 'DISTRICTS' | 'DEPOTS' | 'TRANSFORMERS' | 'SENSORS' | 'CAMERAS' | 'READINGS' | 'IMAGES';

export default function TransformersIndex() {
  const { token } = useAuth();
  
  // --- Navigation State ---
  const [viewMode, setViewMode] = useState<ViewMode>('REGIONS');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [selectedTransformer, setSelectedTransformer] = useState<Transformer | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  // --- Data State ---
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [images, setImages] = useState<CameraImage[]>([]);
  
  // --- Global Options (for modal) ---
  const [allDepotOptions, setAllDepotOptions] = useState<DepotOption[]>([]);

  // --- UI State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Pagination (shared state, reset on view change)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  // Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeTransformer, setActiveTransformer] = useState<Transformer | null>(null);
  
  // Form State
  const [nameInput, setNameInput] = useState('');
  const [capacityInput, setCapacityInput] = useState<number | ''>('');
  const [isActiveInput, setIsActiveInput] = useState<boolean>(true);
  const [depotInput, setDepotInput] = useState<number | ''>('');
  const [latInput, setLatInput] = useState<number | ''>('');
  const [lngInput, setLngInput] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  // --- Helpers ---

  const normalizeList = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    const obj = payload as Record<string, unknown>;
    const candidates = ['content', 'data', 'items', 'records', 'sensorReadings'];
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
      const res = await axios.get(`${API_BASE_URL}/api/v1/cameras/${cameraId}/images`, { headers });
      const list = normalizeList(res.data);
      setImages(list);
      setTotalElements(list.length);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch images');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  // Fetch all depots for the dropdown in Modal
  const fetchAllDepots = useCallback(async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/api/v1/depots`, { headers });
          const list = normalizeList(res.data);
          setAllDepotOptions(list.map((d: any) => ({ id: d.id, name: d.name })));
      } catch {
          setAllDepotOptions([]);
      }
  }, [API_BASE_URL, headers]);

  // --- Effects ---

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
    }
  }, [token, viewMode, selectedRegion, selectedDistrict, selectedDepot, selectedTransformer, selectedSensor, selectedCamera, page, fetchRegions, fetchDistricts, fetchDepots, fetchTransformers, fetchSensors, fetchCameras, fetchReadings, fetchImages]);

  useEffect(() => {
      if (token && showCreate) {
          fetchAllDepots();
      }
  }, [token, showCreate, fetchAllDepots]);

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
      } else if (mode === 'SENSORS') {
          setViewMode('SENSORS');
          setSelectedSensor(null);
      } else if (mode === 'CAMERAS') {
          setViewMode('CAMERAS');
          setSelectedCamera(null);
      }
  };

  // --- CRUD Handlers (Transformers) ---

  const openCreateModal = () => {
      setNameInput('');
      setCapacityInput('');
      setIsActiveInput(true);
      setLatInput('');
      setLngInput('');
      // Pre-fill depot if selected
      setDepotInput(selectedDepot ? selectedDepot.id : '');
      setFormError(null);
      setShowCreate(true);
  };

  const openEditModal = (t: Transformer) => {
      setActiveTransformer(t);
      setNameInput(t.name);
      setCapacityInput(t.capacity ?? '');
      setIsActiveInput(t.isActive ?? true);
      setDepotInput(t.depotId ?? (t.depot?.id) ?? '');
      setLatInput(t.lat ?? '');
      setLngInput(t.lng ?? '');
      setFormError(null);
      setShowEdit(true);
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

  const submitCreate = async () => {
      if (!nameInput.trim()) { setFormError('Name is required'); return; }
      if (!depotInput) { setFormError('Depot is required'); return; }
      
      try {
          setSaving(true);
          await axios.post(`${API_BASE_URL}/api/v1/transformers`, {
              name: nameInput,
              capacity: capacityInput ? Number(capacityInput) : undefined,
              isActive: isActiveInput,
              depotId: Number(depotInput),
              lat: latInput ? Number(latInput) : undefined,
              lng: lngInput ? Number(lngInput) : undefined
          }, { headers });
          setShowCreate(false);
          setNotice({ variant: 'success', title: 'Success', message: 'Transformer created' });
          if (selectedDepot && selectedDepot.id === Number(depotInput)) {
              fetchTransformers(selectedDepot.id);
          } else if (viewMode === 'TRANSFORMERS' && selectedDepot) {
              fetchTransformers(selectedDepot.id);
          }
      } catch {
          setFormError('Failed to create transformer');
      } finally {
          setSaving(false);
      }
  };

  const submitEdit = async () => {
      if (!activeTransformer) return;
      if (!nameInput.trim()) { setFormError('Name is required'); return; }
      if (!depotInput) { setFormError('Depot is required'); return; }

      try {
          setSaving(true);
          await axios.put(`${API_BASE_URL}/api/v1/transformers/${activeTransformer.id}`, {
              name: nameInput,
              capacity: capacityInput ? Number(capacityInput) : undefined,
              isActive: isActiveInput,
              depotId: Number(depotInput),
              lat: latInput ? Number(latInput) : undefined,
              lng: lngInput ? Number(lngInput) : undefined
          }, { headers });
          setShowEdit(false);
          setNotice({ variant: 'success', title: 'Success', message: 'Transformer updated' });
          if (selectedDepot) fetchTransformers(selectedDepot.id);
      } catch {
          setFormError('Failed to update transformer');
      } finally {
          setSaving(false);
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
                  <span className={`hover:text-brand-600 ${['SENSORS', 'CAMERAS'].includes(viewMode) ? 'font-bold text-brand-600' : ''}`}>
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
            <Button onClick={openCreateModal} icon={<Plus className="h-4 w-4" />}>
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
                                          Sensors ({t.sensors?.length || 0})
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <button 
                                          onClick={() => handleViewCameras(t)}
                                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                                      >
                                          <CameraIcon className="h-3 w-3 mr-1.5" />
                                          Cameras ({t.cameras?.length || 0})
                                      </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <ActionMenu
                                          placement="bottom-end"
                                          onView={() => openViewModal(t)}
                                          onEdit={() => openEditModal(t)}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {images.map((img) => (
                              <div key={img.id} className="relative group aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                  <img src={img.imageUrl} alt={`Camera capture ${img.id}`} className="w-full h-full object-cover" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2">
                                      {new Date(img.capturedAt).toLocaleString()}
                                  </div>
                              </div>
                          ))}
                      </div>
                      {images.length === 0 && (
                          <div className="text-center text-gray-500 py-12">No images found.</div>
                      )}
                  </div>
              )}
          </div>
      )}

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Transformer">
          <div className="space-y-4">
              {formError && <Alert variant="error" title="Error">{formError}</Alert>}
              
              <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" placeholder="Transformer Name" />
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700">Depot</label>
                  <SearchableSelect
                      options={allDepotOptions}
                      value={depotInput}
                      onChange={setDepotInput}
                      placeholder="Select Depot"
                      className="mt-1"
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Capacity (kVA)</label>
                      <input type="number" value={capacityInput} onChange={e => setCapacityInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" placeholder="e.g. 500" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select value={isActiveInput ? 'true' : 'false'} onChange={e => setIsActiveInput(e.target.value === 'true')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border">
                          <option value="true">Active</option>
                          <option value="false">Maintenance</option>
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Latitude</label>
                      <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Longitude</label>
                      <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" />
                  </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button onClick={submitCreate} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
              </div>
          </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Transformer">
          <div className="space-y-4">
              {formError && <Alert variant="error" title="Error">{formError}</Alert>}
              
              <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" />
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700">Depot</label>
                  <SearchableSelect
                      options={allDepotOptions}
                      value={depotInput}
                      onChange={setDepotInput}
                      placeholder="Select Depot"
                      className="mt-1"
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Capacity (kVA)</label>
                      <input type="number" value={capacityInput} onChange={e => setCapacityInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select value={isActiveInput ? 'true' : 'false'} onChange={e => setIsActiveInput(e.target.value === 'true')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border">
                          <option value="true">Active</option>
                          <option value="false">Maintenance</option>
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Latitude</label>
                      <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Longitude</label>
                      <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border" />
                  </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
                  <Button onClick={submitEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
          </div>
      </Modal>

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
    </div>
  );
}
