import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from '../../components/ui/modal';

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

interface SiteTransformer extends Transformer {
  regionName: string;
  districtName: string;
  depotName: string;
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
  const { token, user } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';
  const [items, setItems] = useState<Transformer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SiteTransformer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const normalizeList = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const value = obj?.[key] as unknown;
      if (Array.isArray(value)) return value as T[];
    }
    return [];
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [transformersRes, regionsRes, depotsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/regions`, { headers }),
          axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }),
        ]);
        setItems(normalizeList<Transformer>(transformersRes.data));
        setRegions(normalizeList<Region>(regionsRes.data));
        setDepots(normalizeList<Depot>(depotsRes.data));
      } catch {
        setError('Failed to load sites');
      } finally {
        setLoading(false);
      }
    };
    if (token) run();
  }, [token, API_BASE_URL, headers]);

  const visibleSites = useMemo<SiteTransformer[]>(() => {
    const depotById = new Map<number, Depot>();
    depots.forEach((depot) => depotById.set(depot.id, depot));

    const districtById = new Map<number, District>();
    const regionByDistrictId = new Map<number, string>();
    regions.forEach((region) => {
      (region.districts || []).forEach((district) => {
        districtById.set(district.id, district);
        regionByDistrictId.set(district.id, region.name);
      });
    });

    return items.map((transformer) => {
      const depot = typeof transformer.depotId === 'number' ? depotById.get(transformer.depotId) : undefined;
      const district = depot?.districtId ? districtById.get(depot.districtId) : undefined;
      return {
        ...transformer,
        depotName: depot?.name || transformer.depot?.name || 'Unassigned Depot',
        districtName: district?.name || 'Unassigned District',
        regionName: district?.id ? (regionByDistrictId.get(district.id) || 'Unassigned Region') : 'Unassigned Region',
      };
    });
  }, [depots, items, regions]);

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleSites;
    return visibleSites.filter((site) =>
      `${site.name} ${site.regionName} ${site.districtName} ${site.depotName}`.toLowerCase().includes(query)
    );
  }, [search, visibleSites]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / pageSize));
  const paginatedSites = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSites.slice(start, start + pageSize);
  }, [filteredSites, page]);

  const mapSites = filteredSites.filter((site) => typeof site.lat === 'number' && typeof site.lng === 'number');

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openDetails = async (site?: SiteTransformer) => {
    const activeSite = site ?? selected;
    if (!activeSite) return;

    setSelected(activeSite);
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const res = await axios.get(`${API_BASE_URL}/api/v1/sensors/transformer/${activeSite.id}`, { headers });
      const list = normalizeList<any>(res.data);
      const parsed: Sensor[] = list.map((sensor: any) => {
        const readings = Array.isArray(sensor.sensor_reading) ? sensor.sensor_reading : [];
        const last = readings.length > 0 ? readings[readings.length - 1] : null;
        let latest: Sensor['latest_reading'] = null;
        if (last) {
          const type = sensor.type;
          const timestamp = last.updated_at || last.created_at;
          let value: any;
          if (type === 'temperature') value = last.temperature ?? last.value ?? last.temp;
          else if (type === 'oil_level') value = last.oil_level ?? last.level ?? last.value;
          else if (type === 'pressure') value = last.pressure ?? last.value;
          else if (type === 'current') value = last.current ?? last.value;
          else if (type === 'voltage') value = last.voltage ?? last.value;
          else if (type === 'humidity') value = last.humidity ?? last.value;
          else if (type === 'contact') value = last.contact ?? last.value;
          else if (type === 'motion') value = last.motion ?? last.value;
          else if (type === 'video') value = (last.active ?? last.value) ? 1 : 0;
          else value = last.value;
          latest = (typeof value === 'number' || typeof value === 'string')
            ? { value: Number(value), timestamp: new Date(timestamp || new Date()).toISOString(), is_alert: false }
            : null;
        }
        return {
          id: sensor.id,
          name: sensor.name ?? '',
          sensor_id: String(sensor.id),
          sensor_type: sensor.type ?? '',
          description: '',
          is_active: true,
          latest_reading: latest,
        };
      });
      setSensors(parsed);
      setShowDetails(true);
    } catch {
      setDetailsError('Failed to load sensors');
      setSensors([]);
      setShowDetails(true);
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading site map...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Sites</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isSupplierUser
              ? `Showing only sites linked to ${user?.supplierName || 'your organisation'} controllers and sensors.`
              : 'Showing transformer locations across the monitored network.'}
          </p>
        </div>
        <div className="w-full max-w-md">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transformer, region, district, or depot"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
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
          {mapSites.map((site) => (
            <CircleMarker
              key={site.id}
              center={[site.lat as number, site.lng as number]}
              radius={6}
              color={site.isActive ? '#22c55e' : '#ef4444'}
              fillColor={site.isActive ? '#22c55e' : '#ef4444'}
              fillOpacity={0.85}
              eventHandlers={{ click: () => setSelected(site) }}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-medium">{site.name}</div>
                  <div>Region: {site.regionName}</div>
                  <div>District: {site.districtName}</div>
                  <div>Depot: {site.depotName}</div>
                  <div>Capacity: {typeof site.capacity === 'number' ? site.capacity : '-'}</div>
                  <div>Status: {site.isActive ? 'Active' : 'Inactive'}</div>
                  {isSupplierUser ? <div>Organisation: {user?.supplierName || 'Supplier'}</div> : null}
                  <div className="pt-2">
                    <button
                      onClick={() => openDetails(site)}
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      View details
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Visible Sites</h3>
            <p className="text-xs text-gray-500">
              {filteredSites.length} site{filteredSites.length === 1 ? '' : 's'} in view
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Transformer</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Region</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">District</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Depot</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedSites.map((site) => (
                <tr
                  key={site.id}
                  className={`transition hover:bg-gray-50 ${selected?.id === site.id ? 'bg-brand-50/40' : ''}`}
                  onClick={() => setSelected(site)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{site.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{site.regionName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{site.districtName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{site.depotName}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${site.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {site.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetails(site);
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      View sensors
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedSites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    No sites match the current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <div>
            Showing {(page - 1) * pageSize + (paginatedSites.length === 0 ? 0 : 1)} to {(page - 1) * pageSize + paginatedSites.length} of {filteredSites.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs font-medium text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
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
              <div className="text-sm font-medium text-gray-900">{typeof selected.capacity === 'number' ? selected.capacity : '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Region</div>
              <div className="text-sm font-medium text-gray-900">{selected.regionName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">District</div>
              <div className="text-sm font-medium text-gray-900">{selected.districtName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Depot</div>
              <div className="text-sm font-medium text-gray-900">{selected.depotName}</div>
            </div>
            {isSupplierUser ? (
              <div>
                <div className="text-xs text-gray-500">Organisation</div>
                <div className="text-sm font-medium text-gray-900">{user?.supplierName || 'Supplier'}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm font-medium text-gray-900">{selected.isActive ? 'Active' : 'Inactive'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Latitude</div>
              <div className="text-sm font-medium text-gray-900">{selected.lat ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Longitude</div>
              <div className="text-sm font-medium text-gray-900">{selected.lng ?? '-'}</div>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => openDetails(selected)}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              View details
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} className="max-w-3xl w-full p-6" backdropBlur={false}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-black dark:text-white">
              {selected?.name ?? '-'} • {selected?.regionName ?? '-'} / {selected?.districtName ?? '-'} / {selected?.depotName ?? '-'}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400" />
          </div>
          {detailsLoading ? (
            <div className="p-4">Loading sensors...</div>
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
                    {sensors.map((sensor) => (
                      <tr key={sensor.id} className="border-t border-gray-200 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900 dark:text-white">{sensor.name}</div>
                          <div className="text-xs text-gray-500">{sensor.sensor_id}</div>
                        </td>
                        <td className="px-4 py-2">{sensor.sensor_type}</td>
                        <td className="px-4 py-2">
                          {sensor.latest_reading ? `${sensor.latest_reading.value} @ ${new Date(sensor.latest_reading.timestamp).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sensor.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                            {sensor.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button onClick={() => setShowDetails(false)} className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
