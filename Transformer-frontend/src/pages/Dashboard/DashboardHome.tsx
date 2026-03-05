import { useState, useEffect, Suspense, useMemo } from 'react';
import { ChevronDown, MapPinned, Warehouse, Zap, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserAccess } from '../../hooks/useUserAccess';
import axios from 'axios';
import { useRealtimeUpdates } from '../../services/realtimeService';

interface DashboardStats {
  total_regions: number;
  total_depots: number;
  total_transformers: number;
  total_sensors: number;
  active_sensors: number;
  active_transformers: number;
  inactive_transformers: number;
}

interface TransformerDetails {
  id: number;
  name: string;
  transformer_id: string;
  depot_name: string;
  region_name: string;
  capacity: number;
  is_active: boolean;
  installation_date: string;
  description: string;
  sensor_count: number;
  sensors: Array<{
    id: number;
    name: string;
    sensor_type: string;
    is_active: boolean;
    latest_reading?: {
      value: number;
      timestamp: string;
      is_alert: boolean;
    };
  }>;
}

interface TransformerStatus {
  id: number;
  name: string;
  transformer_id: string;
  depot_name: string;
  region_name: string;
  capacity: number;
  is_active: boolean;
  latest_readings: any[];
  sensor_count: number;
}

// Add interface for real-time sensor updates
interface SensorUpdate {
  type: string;
  sensor_id: number;
  sensor_name: string;
  sensor_type: string;
  transformer_id: number;
  transformer_name: string;
  depot_name: string;
  region_name: string;
  value: number | string;
  is_alert: boolean;
  timestamp: number;
}

export default function DashboardHome() {
  const { token, user } = useAuth();
  const { hasNationalAccess, hasRegionAccess, hasDepotAccess, loading: accessLoading } = useUserAccess();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transformers, setTransformers] = useState<TransformerStatus[]>([]);
  const [baseTransformers, setBaseTransformers] = useState<{ id: number; name: string; capacity?: number; isActive?: boolean; depotId?: number; depot?: { id: number; name: string; district?: { id: number; name: string; region?: { id: number; name: string } } } }[]>([]);
  const [districts, setDistricts] = useState<{ id: number; name: string; regionId?: number; region?: { id: number; name: string } }[]>([]);
  const [depots, setDepots] = useState<{ id: number; name: string; districtId?: number; district?: { id: number; name: string; region?: { id: number; name: string } } }[]>([]);
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([]);
  const [sensors, setSensors] = useState<{ id: number; name: string; type: string; transformerId?: number; sensor_reading?: any[] }[]>([]);
  const [selectedTransformer, setSelectedTransformer] = useState<TransformerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add state for real-time data
  const { realtimeData, isConnected, connectionError } = useRealtimeUpdates(token);
  const [transformerSensors, setTransformerSensors] = useState<Record<number, SensorUpdate[]>>({});

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  
  const hierarchy = useMemo(() => {
    const regions: Record<string, Record<string, Record<string, TransformerStatus[]>>> = {};
    const depotMap = new Map<number, { id: number; name: string; districtId?: number; district?: { id: number; name: string; region?: { id: number; name: string } } }>();
    depots.forEach(d => { if (typeof d.id === 'number') depotMap.set(d.id, d); });
    const districtMap = new Map<number, { id: number; name: string; regionId?: number; region?: { id: number; name: string } }>();
    districts.forEach(d => { if (typeof d.id === 'number') districtMap.set(d.id, d); });
    const baseById = new Map<number, { id: number; name: string; depotId?: number; depot?: { id: number; name: string; district?: { id: number; name: string; region?: { id: number; name: string } } } }>();
    baseTransformers.forEach(b => { if (typeof b.id === 'number') baseById.set(b.id, b); });
    transformers.forEach((t) => {
      const base = baseById.get(t.id);
      const depotId = base?.depot?.id ?? base?.depotId;
      const depotInfo = typeof depotId === 'number' ? depotMap.get(depotId) : undefined;
      const distId = depotInfo?.district?.id ?? depotInfo?.districtId;
      const distInfo = typeof distId === 'number' ? districtMap.get(distId) : undefined;
      const region = distInfo?.region?.name ?? t.region_name ?? 'Unknown Region';
      const district = distInfo?.name ?? 'Unknown District';
      const depot = depotInfo?.name ?? t.depot_name ?? 'Unknown Depot';
      if (!regions[region]) regions[region] = {};
      if (!regions[region][district]) regions[region][district] = {};
      if (!regions[region][district][depot]) regions[region][district][depot] = [];
      regions[region][district][depot].push(t);
    });
    return regions;
  }, [transformers, baseTransformers, depots, districts]);

  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>({});
  const [openDistricts, setOpenDistricts] = useState<Record<string, boolean>>({});
  const [openDepots, setOpenDepots] = useState<Record<string, boolean>>({});

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const normalizeList = (payload: unknown): any[] => {
          if (Array.isArray(payload)) return payload as any[];
          const obj = payload as Record<string, unknown>;
          for (const k of ['data', 'content', 'items', 'records']) {
            const v = obj?.[k] as unknown;
            if (Array.isArray(v)) return v as any[];
          }
          return [];
        };

        const [regionsRes, distsRes, depotsRes, transformersRes, sensorsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/regions`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/districts`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/depots`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/sensors`, { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);

        const regionsList = normalizeList(regionsRes.data) as { id: number; name: string }[];
        const districtsList = normalizeList(distsRes.data) as { id: number; name: string; regionId?: number; region?: { id: number; name: string } }[];
        const depotsList = normalizeList(depotsRes.data) as { id: number; name: string; districtId?: number; district?: { id: number; name: string; region?: { id: number; name: string } } }[];
        const baseList = normalizeList(transformersRes.data) as { id: number; name: string; capacity?: number; isActive?: boolean; depotId?: number; depot?: { id: number; name: string; district?: { id: number; name: string; region?: { id: number; name: string } } } }[];
        const sensorsListRaw = normalizeList(sensorsRes.data);
        const sensorsList = sensorsListRaw.map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          transformerId: s.transformerId ?? s.transformer_id,
          sensor_reading: Array.isArray(s.sensor_reading) ? s.sensor_reading : [],
        }));

        setRegions(regionsList);
        setDistricts(districtsList);
        setDepots(depotsList);
        setBaseTransformers(baseList);
        setSensors(sensorsList);

        const sensorsByTransformer = new Map<number, { id: number }[]>();
        sensorsList.forEach(s => {
          const tid = s.transformer?.id ?? s.transformerId;
          if (typeof tid === 'number') {
            const arr = sensorsByTransformer.get(tid) || [];
            arr.push({ id: s.id });
            sensorsByTransformer.set(tid, arr);
          }
        });

        const districtById = new Map<number, { id: number; name: string; regionId?: number; region?: { id: number; name: string } }>();
        districtsList.forEach(d => districtById.set(d.id, d));
        const depotById = new Map<number, { id: number; name: string; districtId?: number; district?: { id: number; name: string; region?: { id: number; name: string } } }>();
        depotsList.forEach(d => depotById.set(d.id, d));
        const regionById = new Map<number, { id: number; name: string }>();
        regionsList.forEach(r => regionById.set(r.id, r));

        const statusList: TransformerStatus[] = baseList.map(b => {
          const depotId = b.depot?.id ?? b.depotId;
          const depot = typeof depotId === 'number' ? depotById.get(depotId) : undefined;
          const distId = depot?.district?.id ?? depot?.districtId;
          const dist = typeof distId === 'number' ? districtById.get(distId!) : undefined;
          const region = dist?.region?.name ?? (dist?.regionId ? regionById.get(dist.regionId)?.name : undefined) ?? 'Unknown Region';
          const depotName = depot?.name ?? b.depot?.name ?? 'Unknown Depot';
          const sensorCount = sensorsByTransformer.get(b.id)?.length || 0;
          return {
            id: b.id,
            name: b.name,
            transformer_id: String(b.id),
            depot_name: depotName,
            region_name: region,
            capacity: typeof b.capacity === 'number' ? b.capacity : 0,
            is_active: !!b.isActive,
            latest_readings: [],
            sensor_count: sensorCount,
          };
        });

        setTransformers(statusList);

        setStats({
          total_regions: regionsList.length,
          total_depots: depotsList.length,
          total_transformers: baseList.length,
          total_sensors: sensorsList.length,
          active_sensors: sensorsList.filter((s: any) => (s.is_active ?? s.isActive ?? true)).length,
          active_transformers: baseList.filter(x => !!x.isActive).length,
          inactive_transformers: baseList.filter(x => !x.isActive).length,
        });
      } catch (err) {
        setError('Failed to fetch dashboard data');
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  

  // Process real-time updates
  useEffect(() => {
    if (realtimeData.length > 0) {
      // Group sensor updates by transformer
      const groupedByTransformer: Record<number, SensorUpdate[]> = {};

      realtimeData.forEach(update => {
        if (!groupedByTransformer[update.transformer_id]) {
          groupedByTransformer[update.transformer_id] = [];
        }
        // Replace or add the sensor update
        const existingIndex = groupedByTransformer[update.transformer_id].findIndex(
          item => item.sensor_id === update.sensor_id
        );

        if (existingIndex !== -1) {
          groupedByTransformer[update.transformer_id][existingIndex] = update;
        } else {
          groupedByTransformer[update.transformer_id].push(update);
        }
      });

      setTransformerSensors(groupedByTransformer);

      // Update selected transformer if it matches the updated transformer
      if (selectedTransformer && groupedByTransformer[selectedTransformer.id]) {
        const updatedSensors = selectedTransformer.sensors.map(sensor => {
          const realTimeUpdate = groupedByTransformer[selectedTransformer.id].find(
            update => update.sensor_id === sensor.id
          );

          if (realTimeUpdate) {
            return {
              ...sensor,
              latest_reading: {
                value: Number(realTimeUpdate.value),
                timestamp: new Date(realTimeUpdate.timestamp).toISOString(),
                is_alert: realTimeUpdate.is_alert
              }
            };
          }
          return sensor;
        });

        setSelectedTransformer({
          ...selectedTransformer,
          sensors: updatedSensors
        });
      }
    }
  }, [realtimeData]);

  const handleTransformerSelect = async (transformerId: number, regionName?: string, depotName?: string, districtName?: string) => {
    const base = baseTransformers.find(x => x.id === transformerId);
    const depotId = base?.depot?.id ?? base?.depotId;
    const depot = typeof depotId === 'number' ? depots.find(d => d.id === depotId) : undefined;
    const distId = depot?.district?.id ?? depot?.districtId;
    const dist = typeof distId === 'number' ? districts.find(d => d.id === distId) : undefined;
    const region = dist?.region?.name ?? (dist?.regionId ? regions.find(r => r.id === dist.regionId)?.name : undefined) ?? 'Unknown Region';
    const getLatestReading = (s: { type: string; sensor_reading?: any[] }) => {
      const readings = s.sensor_reading || [];
      const last = readings.length > 0 ? readings[readings.length - 1] : null;
      if (!last) return null;
      const ts = last.updated_at || last.created_at || new Date().toISOString();
      const t = s.type;
      let val: number | string | undefined = undefined;
      if (t === 'temperature') val = last.temperature ?? last.value ?? last.temp;
      else if (t === 'oil_level') val = last.oil_level ?? last.level ?? last.value;
      else if (t === 'pressure') val = last.pressure ?? last.value;
      else if (t === 'current') val = last.current ?? last.value;
      else if (t === 'voltage') val = last.voltage ?? last.value;
      else if (t === 'humidity') val = last.humidity ?? last.value;
      else if (t === 'contact') {
        const v = (last.contact ?? last.value);
        val = typeof v === 'string' ? (v.toLowerCase() === 'closed' ? 1 : 0) : (v ? 1 : 0);
      } else if (t === 'motion') {
        const v = (last.motion ?? last.value);
        val = typeof v === 'string' ? (v.toLowerCase() === 'detected' ? 1 : 0) : (v ? 1 : 0);
      } else if (t === 'video') {
        const v = last.active ?? last.value;
        val = v ? 1 : 0;
      } else {
        val = last.value;
      }
      return typeof val === 'number' || typeof val === 'string'
        ? { value: typeof val === 'number' ? val : Number(val), timestamp: new Date(ts).toISOString(), is_alert: false }
        : null;
    };

    const sensorList = sensors.filter(s => s.transformerId === transformerId).map(s => ({
      id: s.id,
      name: s.name,
      sensor_type: s.type,
      is_active: true,
      latest_reading: getLatestReading(s),
    }));
    setSelectedTransformer({
      id: transformerId,
      name: base?.name || String(transformerId),
      transformer_id: String(transformerId),
      depot_name: depot?.name ?? base?.depot?.name ?? 'Unknown Depot',
      region_name: region,
      capacity: typeof base?.capacity === 'number' ? base.capacity! : 0,
      installation_date: '',
      description: '',
      is_active: !!base?.isActive,
      sensor_count: sensorList.length,
      sensors: sensorList,
      recent_readings: [],
    });
    if (regionName) {
      setOpenRegions(prev => ({ ...prev, [regionName]: true }));
    }
    if (regionName && districtName) {
      setOpenDistricts(prev => ({ ...prev, [`${regionName}::${districtName}`]: true }));
    }
    if (regionName && depotName) {
      setOpenDepots(prev => ({ ...prev, [`${regionName}::${districtName}::${depotName}`]: true }));
    }
  };

  // Determine what level of access the user has for display purposes
  const userAccessLevel = () => {
    if (hasNationalAccess()) return 'National Level';
    if (hasRegionAccess()) return 'Region Level';
    if (hasDepotAccess()) return 'Depot Level';
    return 'Limited Access';
  };

  if (loading || accessLoading) {
    return <div className="p-4">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-400 to-brand-600 px-4 pb-3 pt-4 shadow-lg dark:from-brand-500 dark:to-brand-700 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {(() => {
                const hour = new Date().getHours();
                const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
                return `${greeting}, ${user?.first_name || user?.username}! 👋`;
              })()}
            </h2>
            <p className="mt-1 text-brand-100">
              Your access level: <span className="font-semibold text-white">{userAccessLevel()}</span>
            </p>
          </div>
          <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
            <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Global Alerts Banner */}
      {Object.values(transformerSensors).flat().some(u => u.is_alert) && (
        <div className="rounded-xl border border-yellow-200 ring-1 ring-inset ring-yellow-200/60 bg-gradient-to-r from-yellow-50 to-orange-100 px-4 py-3 shadow-md dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Active alerts detected across transformers</span>
            </div>
            <span className="text-xs text-orange-700 dark:text-orange-300">
              {Object.values(transformerSensors).reduce((acc, arr) => acc + arr.filter(a => a.is_alert).length, 0)} total
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards - conditionally render based on access level */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {hasNationalAccess() && (
          <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-brand-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-brand-900"></div>
            <div className="relative z-10 flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-md">
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7ZM12 15C9.23858 15 7 17.2386 7 20H17C17 17.2386 14.7614 15 12 15Z" />
                </svg>
              </div>
              <div className="ml-4">
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                  {stats?.total_regions || 0}
                </h4>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Regions</span>
              </div>
            </div>
            <div className="mt-4 h-1 w-full bg-gradient-to-r from-brand-100 to-brand-300 rounded-full dark:from-brand-800 dark:to-brand-600"></div>
          </div>
        )}

        {(hasNationalAccess() || hasRegionAccess()) && (
          <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-light-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-blue-light-900"></div>
            <div className="relative z-10 flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-light-400 to-blue-light-600 shadow-md">
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7ZM12 15C9.23858 15 7 17.2386 7 20H17C17 17.2386 14.7614 15 12 15Z" />
                </svg>
              </div>
              <div className="ml-4">
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                  {stats?.total_depots || 0}
                </h4>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Depots</span>
              </div>
            </div>
            <div className="mt-4 h-1 w-full bg-gradient-to-r from-blue-light-100 to-blue-light-300 rounded-full dark:from-blue-light-800 dark:to-blue-light-600"></div>
          </div>
        )}

        <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-success-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-success-900"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-success-400 to-success-600 shadow-md">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 3H1v18h12V3zm0 16H3V5h10v14zM23 3h-8v2h8v14h-8v2h8V3z"/>
              </svg>
            </div>
            <div className="ml-4">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.total_transformers || 0}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Transformers</span>
            </div>
          </div>
          <div className="mt-4 h-1 w-full bg-gradient-to-r from-success-100 to-success-300 rounded-full dark:from-success-800 dark:to-success-600"></div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-orange-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-orange-900"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-md">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7ZM12 15C9.23858 15 7 17.2386 7 20H17C17 17.2386 14.7614 15 12 15Z" />
              </svg>
            </div>
            <div className="ml-4">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.active_sensors || 0}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Sensors</span>
            </div>
          </div>
          <div className="mt-4 h-1 w-full bg-gradient-to-r from-orange-100 to-orange-300 rounded-full dark:from-orange-800 dark:to-orange-600"></div>
        </div>
      </div>

      {/* Main Dashboard Content - Hierarchy Visualization with Interactive Transformer Details */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left Side: Hierarchy Tree - conditionally render based on access level */}
        {true && (
          <div className="lg:w-1/3 xl:w-1/4 rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 shadow-lg backdrop-blur-sm border border-slate-200/60 ring-1 ring-inset ring-slate-200 dark:from-gray-900/40 dark:to-gray-800/40 dark:border-gray-700/60 dark:ring-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monitored Transformers</h3>
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} `}></div>
                <span className="text-sm text-brand-600 dark:text-brand-400">Live</span>
              </div>
            </div>
            <div className="h-[70vh] overflow-y-auto scrollbar-white rounded-xl border border-slate-300/50 ring-1 ring-inset ring-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 backdrop-blur-sm dark:border-gray-700/50 dark:ring-gray-700 dark:from-gray-900/50 dark:to-gray-800/50">
              {Object.entries(hierarchy).map(([region, distMap]) => (
                <details key={region} className="mb-3 group" open={!!openRegions[region]}>
                    <summary onClick={(e) => { e.preventDefault(); setOpenRegions(prev => ({ ...prev, [region]: !prev[region] })); }} className="flex items-center justify-between cursor-pointer rounded-lg px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <MapPinned className="w-4 h-4" />
                      <span className="font-medium">{region}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-2 pl-4 border-l-2 border-blue-100 dark:border-blue-900/40">
                    {Object.entries(distMap).map(([district, depMap]) => (
                      <details key={district} className="mb-2 group" open={!!openDistricts[`${region}::${district}`]}>
                        <summary onClick={(e) => { e.preventDefault(); setOpenDistricts(prev => ({ ...prev, [`${region}::${district}`]: !prev[`${region}::${district}`] })); }} className="flex items-center justify-between cursor-pointer rounded-md px-3 py-2 bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100 transition dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{district}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className="mt-2 pl-4 border-l-2 border-violet-100 dark:border-violet-900/40">
                          {Object.entries(depMap).map(([depot, list]) => (
                            <details key={depot} className="mb-2 group" open={!!openDepots[`${region}::${district}::${depot}`]}>
                              <summary onClick={(e) => { e.preventDefault(); setOpenDepots(prev => ({ ...prev, [`${region}::${district}::${depot}`]: !prev[`${region}::${district}::${depot}`] })); }} className="flex items-center justify-between cursor-pointer rounded-md px-3 py-2 bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800">
                                <div className="flex items-center gap-2">
                                  <Warehouse className="w-4 h-4" />
                                  <span className="font-medium">{depot}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                </div>
                              </summary>
                              <ul className="mt-2 space-y-2">
                                {list.map((t) => {
                                  const realTimeSensors = transformerSensors[t.id] || [];
                                  const alertCount = realTimeSensors.filter(sensor => sensor.is_alert).length;

                                  return (
                                    <li key={t.id} className={`flex items-center justify-between rounded-lg px-3 py-2 shadow-sm hover:shadow-md border transition
                                      ${selectedTransformer?.id === t.id
                                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                                        : 'bg-slate-50 border-slate-300/60 ring-1 ring-inset ring-slate-200 dark:border-gray-700/60 dark:ring-gray-700 dark:bg-gray-800'}
                                    `}>
                                      <button className="text-left flex-1" onClick={() => handleTransformerSelect(t.id, region, depot, district)}>
                                        <div className="flex items-center gap-2">
                                          <Zap className={`w-4 h-4 ${t.is_active ? 'text-success' : 'text-danger'}`} />
                                          <span className="text-xs font-medium text-gray-900 dark:text-white">{t.name}</span>
                                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.is_active ? 'bg-success bg-opacity-10 text-success dark:bg-opacity-20' : 'bg-danger bg-opacity-10 text-danger dark:bg-opacity-20'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                                          {alertCount > 0 && (
                                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-danger bg-opacity-10 text-danger dark:bg-opacity-20">
                                              {alertCount} Alert{alertCount > 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">ID: {t.transformer_id} • {t.capacity} MVA • {t.sensor_count} sensors</div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
              {false && Object.entries(groupedTransformers).map(([region, depots]) => (
                <details key={region} className="mb-3 group" open={!!openRegions[region]}>
                <summary onClick={(e) => { e.preventDefault(); setOpenRegions(prev => ({ ...prev, [region]: !prev[region] })); }} className="flex items-center justify-between cursor-pointer rounded-lg px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <MapPinned className="w-4 h-4" />
                      <span className="font-medium">{region}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-2 pl-4 border-l-2 border-blue-100 dark:border-blue-900/40">
                    {Object.entries(depots).map(([depot, list]) => (
                      <details key={depot} className="mb-2 group" open={!!openDepots[`${region}::${depot}`]}>
                        <summary onClick={(e) => { e.preventDefault(); setOpenDepots(prev => ({ ...prev, [`${region}::${depot}`]: !prev[`${region}::${depot}`] })); }} className="flex items-center justify-between cursor-pointer rounded-md px-3 py-2 bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800">
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4" />
                            <span className="font-medium">{depot}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {list.map((t) => {
                            // Get real-time sensor data for this transformer
                            const realTimeSensors = transformerSensors[t.id] || [];
                            const alertCount = realTimeSensors.filter(sensor => sensor.is_alert).length;

                            return (
                              <li key={t.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-white shadow-sm hover:shadow-md border border-gray-200/60 dark:border-gray-700/60 dark:bg-gray-800 transition">
                                <button className="text-left flex-1" onClick={() => handleTransformerSelect(t.id, region, depot)}>
                                  <div className="flex items-center gap-2">
                                    <Zap className={`w-4 h-4 ${t.is_active ? 'text-success' : 'text-danger'}`} />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</span>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.is_active ? 'bg-success bg-opacity-10 text-success dark:bg-opacity-20' : 'bg-danger bg-opacity-10 text-danger dark:bg-opacity-20'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                                    {alertCount > 0 && (
                                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-danger bg-opacity-10 text-danger dark:bg-opacity-20">
                                        {alertCount} Alert{alertCount > 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">ID: {t.transformer_id} • {t.capacity} MVA • {t.sensor_count} sensors</div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
              {Object.keys(hierarchy).length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">No transformers available</div>
              )}
            </div>
          </div>
        )}

        {/* Right Side: Selected Transformer Details */}
        <div className={`lg:w-2/3 xl:w-3/4`}>
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 shadow-lg backdrop-blur-sm border border-slate-200/60 ring-1 ring-inset ring-slate-200 dark:from-gray-900/40 dark:to-gray-800/40 dark:border-gray-700/60 dark:ring-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transformer Details</h3>
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white p-3 backdrop-blur-sm dark:from-gray-900/50 dark:to-gray-800/50">
              {selectedTransformer ? (
                <div className="space-y-3">
                  {/* Header Card */}
                  <div className="p-3 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md backdrop-blur-sm dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-lg text-gray-900 dark:text-white">{selectedTransformer.name}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">ID: {selectedTransformer.transformer_id} • Depot: {selectedTransformer.depot_name}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        selectedTransformer.is_active
                          ? 'bg-gradient-to-r from-success-400 to-success-600 text-white shadow-md'
                          : 'bg-gradient-to-r from-danger-400 to-danger-600 text-white shadow-md'
                      }`}>
                        {selectedTransformer.is_active ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="p-3 bg-gradient-to-br from-brand-100 to-brand-300 rounded-xl shadow-md backdrop-blur-sm dark:from-brand-900/30 dark:to-brand-800/30 border border-brand-300/40 dark:border-brand-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide">Capacity</p>
                          <p className="text-xl font-bold font-mono tracking-tight text-brand-800 dark:text-brand-200 mt-1">{selectedTransformer.capacity} MVA</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 3H1v18h12V3zm0 16H3V5h10v14zM23 3h-8v2h8v14h-8v2h8V3z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 bg-brand-200/50 rounded-full dark:bg-brand-700/50">
                        <div className="h-full bg-brand-500 rounded-full" style={{width: '85%'}}></div>
                      </div>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-blue-light-100 to-blue-light-300 rounded-xl shadow-md backdrop-blur-sm dark:from-blue-light-900/30 dark:to-blue-light-800/30 border border-blue-light-300/40 dark:border-blue-light-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-light-600 dark:text-blue-light-400 uppercase tracking-wide">Sensors</p>
                          <p className="text-xl font-bold font-mono tracking-tight text-blue-light-800 dark:text-blue-light-200 mt-1">{selectedTransformer.sensor_count}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-light-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-light-600 dark:text-blue-light-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7ZM12 15C9.23858 15 7 17.2386 7 20H17C17 17.2386 14.7614 15 12 15Z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-blue-light-600 dark:text-blue-light-400">
                        {selectedTransformer.sensors?.filter(s => s.is_active).length || 0} active
                      </div>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-success-100 to-success-300 rounded-xl shadow-md backdrop-blur-sm dark:from-success-900/30 dark:to-success-800/30 border border-success-300/40 dark:border-success-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-success-600 dark:text-success-400 uppercase tracking-wide">Uptime</p>
                          <p className="text-xl font-bold font-mono tracking-tight text-success-800 dark:text-success-200 mt-1">98.7%</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-success-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-success-600 dark:text-success-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-success-600 dark:text-success-400">
                        Last 30 days
                      </div>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-300 rounded-xl shadow-md backdrop-blur-sm dark:from-orange-900/30 dark:to-orange-800/30 border border-orange-300/40 dark:border-orange-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">Alerts</p>
                          <p className="text-xl font-bold font-mono tracking-tight text-orange-800 dark:text-orange-200 mt-1">
                            {selectedTransformer.sensors?.filter(s => s.latest_reading?.is_alert).length || 0}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm-1-14h2v6h-2V8zm0 8h2v2h-2v-2z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                        Active warnings
                      </div>
                    </div>
                  </div>

                  {/* Sensor Readings Grid */}
                  {selectedTransformer.sensors && selectedTransformer.sensors.length > 0 && (
                    <div className="p-3 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md backdrop-blur-sm dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sensor Dashboard</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {selectedTransformer.sensors.map((sensor, index) => {
                          // Get real-time data for this sensor
                          const realTimeSensor = transformerSensors[selectedTransformer.id]?.find(
                            s => s.sensor_id === sensor.id
                          );

                          // Use real-time data if available, otherwise fall back to stored data
                          const displayReading = realTimeSensor ? {
                            value: Number(realTimeSensor.value),
                            timestamp: new Date(realTimeSensor.timestamp).toISOString(),
                            is_alert: realTimeSensor.is_alert
                          } : sensor.latest_reading;

                          return (
                            <div key={index} className="p-2 bg-gradient-to-br from-gray-50 to-white rounded-lg shadow-sm backdrop-blur-sm dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200/50 dark:border-gray-700/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="capitalize font-medium text-gray-800 dark:text-gray-200 text-sm">{sensor.name.replace('_', ' ')}</span>
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                                  sensor.is_active
                                    ? 'bg-success bg-opacity-10 text-success dark:bg-opacity-20'
                                    : 'bg-danger bg-opacity-10 text-danger dark:bg-opacity-20'
                                }`}>
                                  {sensor.is_active ? 'Active' : 'Inactive'}
                                  {realTimeSensor && (
                                    <span className="ml-1 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                  )}
                                </span>
                              </div>
                              <div className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">
                                <span className="inline-flex items-center rounded-full px-1 py-0.5 bg-gray-200/40 dark:bg-gray-700/40">
                                  {sensor.sensor_type}
                                </span>
                              </div>

                              {displayReading ? (
                                <div>
                                  <div className="flex items-end justify-between mb-1">
                                    <span className={`text-lg font-bold ${
                                      displayReading.is_alert
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-green-600 dark:text-green-400'
                                    }`}>
                                      <span className="font-mono tracking-tight">{displayReading.value}</span>
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {sensor.sensor_type === 'temperature' && '°C'}
                                      {sensor.sensor_type === 'oil_level' && '%'}
                                      {sensor.sensor_type === 'pressure' && 'PSI'}
                                      {sensor.sensor_type === 'current' && 'A'}
                                      {sensor.sensor_type === 'voltage' && 'V'}
                                      {sensor.sensor_type === 'humidity' && '%'}
                                      {sensor.sensor_type === 'contact' && (displayReading.value ? 'CLOSED' : 'OPEN')}
                                      {sensor.sensor_type === 'motion' && (displayReading.value ? 'DETECTED' : 'CLEAR')}
                                      {sensor.sensor_type === 'video' && 'ACTIVE'}
                                    </span>
                                  </div>

                                  <div className="mt-2 bg-gray-200/50 rounded-full h-1 dark:bg-gray-700/50">
                                    <div className={`h-full rounded-full ${
                                      displayReading.is_alert ? 'bg-red-500' : 'bg-green-500'
                                    }`} style={{width: `${Math.min(displayReading.value / (sensor.sensor_type === 'temperature' ? 100 : sensor.sensor_type === 'voltage' ? 500 : sensor.sensor_type === 'oil_level' ? 100 : 100) * 100, 100)}%`}}></div>
                                  </div>

                                  <div className="mt-1 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                                    <span>
                                      {realTimeSensor
                                        ? `Live: ${new Date(realTimeSensor.timestamp).toLocaleTimeString()}`
                                        : displayReading?.timestamp
                                          ? new Date(displayReading.timestamp).toLocaleTimeString()
                                          : 'No timestamp'}
                                    </span>
                                    {displayReading.is_alert && (
                                      <span className="text-red-500 font-medium text-xs">⚠️ Alert</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-2">
                                  <span className="text-gray-400 dark:text-gray-500 text-xs">No data available</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Installation Details */}
                  <div className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg backdrop-blur-sm dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Installation Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Installation Date</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">
                          {new Date(selectedTransformer.installation_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Description</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">
                          {selectedTransformer.description || 'No description available'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Select a transformer from the hierarchy to view detailed information and real-time statistics here.</p>
                  <div className="mt-4 space-y-4">
                    <div className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg backdrop-blur-sm dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-lg text-gray-900 dark:text-white">Transformer Name</h4>
                      <span className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-success-400 to-success-600 text-white shadow-md">
                        Active
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Depot:</span> [Depot Name]
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl shadow-sm dark:from-brand-900/30 dark:to-brand-800/30 border border-brand-200/50 dark:border-brand-700/50">
                        <p className="text-xs font-medium text-brand-600 dark:text-brand-400">Capacity</p>
                        <p className="text-2xl font-bold text-brand-800 dark:text-brand-200">[Capacity] MVA</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-light-50 to-blue-light-100 rounded-xl shadow-sm dark:from-blue-light-900/30 dark:to-blue-light-800/30 border border-blue-light-200/50 dark:border-blue-light-700/50">
                        <p className="text-xs font-medium text-blue-light-600 dark:text-blue-light-400">Sensors</p>
                        <p className="text-2xl font-bold text-blue-light-800 dark:text-blue-light-200">[Sensor Count]</p>
                      </div>
                    </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-black dark:text-white">Recent Sensor Readings</h4>
                        <div className="mt-2 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Temperature</span>
                            <span className="text-black dark:text-white">[Value] °C</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Oil Level</span>
                            <span className="text-black dark:text-white">[Value] %</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Pressure</span>
                            <span className="text-black dark:text-white">[Value] PSI</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
