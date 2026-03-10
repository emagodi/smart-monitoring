import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from '../../components/ui/modal';
import 'leaflet/dist/leaflet.css';

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

interface Sensor {
  id: number;
  name: string;
  sensor_id: string;
  sensor_type: string;
  description?: string;
  is_active: boolean;
  latest_reading?: {
    value: number;
    timestamp: string;
    is_alert: boolean;
  } | null;
}

export default function SiteIndex() {
  const { token } = useAuth();
  const [items, setItems] = useState<Transformer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transformer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [regionName, setRegionName] = useState<string>('');
  const [districtName, setDistrictName] = useState<string>('');
  const [depotName, setDepotName] = useState<string>('');

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

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers });
        setItems(normalizeList(res.data));
      } catch {
        setError('Failed to load transformers');
      } finally {
        setLoading(false);
      }
    };
    if (token) run();
  }, [token, API_BASE_URL, headers]);

  const withCoords = items.filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');

  const openDetails = async () => {
    if (!selected) return;
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const res = await axios.get(`${API_BASE_URL}/api/v1/sensors/transformer/${selected.id}`, { headers });
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      const parsed: Sensor[] = (list as any[]).map((s: any) => {
        const readings = Array.isArray(s.sensor_reading) ? s.sensor_reading : [];
        const last = readings.length > 0 ? readings[readings.length - 1] : null;
        let latest: Sensor['latest_reading'] = null;
        if (last) {
          const t = s.type;
          const ts = last.updated_at || last.created_at;
          let val: any;
          if (t === 'temperature') val = last.temperature ?? last.value ?? last.temp;
          else if (t === 'oil_level') val = last.oil_level ?? last.level ?? last.value;
          else if (t === 'pressure') val = last.pressure ?? last.value;
          else if (t === 'current') val = last.current ?? last.value;
          else if (t === 'voltage') val = last.voltage ?? last.value;
          else if (t === 'humidity') val = last.humidity ?? last.value;
          else if (t === 'contact') val = last.contact ?? last.value;
          else if (t === 'motion') val = last.motion ?? last.value;
          else if (t === 'video') val = (last.active ?? last.value) ? 1 : 0;
          else val = last.value;
          latest = (typeof val === 'number' || typeof val === 'string') ? { value: Number(val), timestamp: new Date(ts || new Date()).toISOString(), is_alert: false } : null;
        }
        return {
          id: s.id,
          name: s.name ?? '',
          sensor_id: String(s.id),
          sensor_type: s.type ?? '',
          description: '',
          is_active: true,
          latest_reading: latest,
        };
      });
      setSensors(parsed);
      if (selected.depotId) {
        try {
          const dep = await axios.get(`${API_BASE_URL}/api/v1/depots/${selected.depotId}`, { headers });
          const obj = dep.data as any;
          const dn = obj?.district?.name ?? obj?.district_name ?? '';
          const rn = obj?.district?.region?.name ?? obj?.region_name ?? '';
          const dpn = obj?.name ?? selected.depot?.name ?? '';
          if (dn) setDistrictName(dn);
          if (rn) setRegionName(rn);
          if (dpn) setDepotName(dpn);
        } catch {
        }
      }
      setShowDetails(true);
    } catch {
      setDetailsError('Failed to load sensors');
      setSensors([]);
      setShowDetails(true);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    const fetchDistrictByDepot = async () => {
      if (!selected || !selected.depotId || districtName) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/depots/${selected.depotId}`, { headers });
        const obj = res.data as Record<string, unknown>;
        const dn = typeof (obj as any).district_name === 'string'
          ? ((obj as any).district_name as string)
          : (typeof (obj as any).district?.name === 'string' ? ((obj as any).district.name as string) : '');
        if (dn) setDistrictName(dn);
        const dpn = typeof obj?.['name'] === 'string' ? (obj['name'] as string) : depotName;
        if (dpn && !depotName) setDepotName(dpn);
      } catch {
        /* silent */
      }
    };
    fetchDistrictByDepot();
  }, [selected, districtName, depotName, API_BASE_URL, headers]);

  if (loading) return <div className="p-4">Loading site map...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Site Map</h2>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <MapContainer
          center={[-19.015, 29.154]}
          zoom={6}
          scrollWheelZoom
          style={{ height: 500, width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {withCoords.map((t) => (
            <CircleMarker
              key={t.id}
              center={[t.lat as number, t.lng as number]}
              radius={6}
              color={t.isActive ? '#22c55e' : '#ef4444'}
              fillColor={t.isActive ? '#22c55e' : '#ef4444'}
              fillOpacity={0.85}
              eventHandlers={{ click: () => setSelected(t) }}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-medium">{t.name}</div>
                  <div>Capacity: {typeof t.capacity === 'number' ? t.capacity : '—'}</div>
                  <div>Status: {t.isActive ? 'Active' : 'Inactive'}</div>
                  <div>Lat/Lng: {t.lat}, {t.lng}</div>
                  <div className="pt-2">
                    <button onClick={openDetails} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">View details</button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {selected && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-gray-500">Name</div>
              <div className="text-sm font-medium text-gray-900">{selected.name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Capacity</div>
              <div className="text-sm font-medium text-gray-900">{typeof selected.capacity === 'number' ? selected.capacity : '—'}</div>
            </div>
           {/*  <div>
              <div className="text-xs text-gray-500">Region</div>
              <div className="text-sm font-medium text-gray-900">{regionName || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">District</div>
              <div className="text-sm font-medium text-gray-900">{districtName || '—'}</div>
            </div> */}
            <div>
              <div className="text-xs text-gray-500">Depot</div>
              <div className="text-sm font-medium text-gray-900">{depotName || selected.depot?.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm font-medium text-gray-900">{selected.isActive ? 'Active' : 'Inactive'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Latitude</div>
              <div className="text-sm font-medium text-gray-900">{selected.lat}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Longitude</div>
              <div className="text-sm font-medium text-gray-900">{selected.lng}</div>
            </div>
          </div>
          <div className="mt-4">
            <button onClick={openDetails} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">View details</button>
          </div>
        </div>
      )}

      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} className="max-w-3xl w-full p-6" backdropBlur={false}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-black dark:text-white">{selected?.name ?? '—'} • {depotName || selected?.depot?.name || '—'}</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400"></div>
          </div>
          {detailsLoading ? (
            <div className="p-4">Loading sensors…</div>
          ) : detailsError ? (
            <div className="p-4 text-red-600">{detailsError}</div>
          ) : sensors.length === 0 ? (
            <div className="p-4">No sensors found.</div>
          ) : (
            <div className="rounded-xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
              <div className="max-w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Sensor</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Type</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Latest</th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensors.map((s) => (
                      <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.sensor_id}</div>
                        </td>
                        <td className="px-4 py-2">{s.sensor_type}</td>
                        <td className="px-4 py-2">{s.latest_reading ? `${s.latest_reading.value} @ ${new Date(s.latest_reading.timestamp).toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button onClick={() => setShowDetails(false)} className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
