import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import {
  Activity,
  Gauge,
  Globe,
  Map as MapIcon,
  MapPinned,
  Search,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "../../components/ui/modal";

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

const pageSize = 10;

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
};

const formatCoordinate = (value?: number) => (typeof value === "number" ? value.toFixed(4) : "No coordinate");

const formatSensorReading = (sensor: Sensor) => {
  if (!sensor.latest_reading) return "No reading received";
  const numericValue = Number(sensor.latest_reading.value);
  const valueLabel = Number.isFinite(numericValue) ? numericValue.toLocaleString() : "Unavailable";
  const timeLabel = new Date(sensor.latest_reading.timestamp).toLocaleString();
  return `${valueLabel} @ ${timeLabel}`;
};

export default function SiteIndex() {
  const { token, user } = useAuth();
  const initialLoadTokenRef = useRef<string | null>(null);
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  useEffect(() => {
    if (!token) {
      initialLoadTokenRef.current = null;
      return;
    }

    if (initialLoadTokenRef.current === token) return;
    initialLoadTokenRef.current = token;

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
        setError("Failed to load sites");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [API_BASE_URL, headers, token]);

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
      const depot = typeof transformer.depotId === "number" ? depotById.get(transformer.depotId) : undefined;
      const district = depot?.districtId ? districtById.get(depot.districtId) : undefined;
      return {
        ...transformer,
        depotName: depot?.name || transformer.depot?.name || "Unassigned Depot",
        districtName: district?.name || "Unassigned District",
        regionName: district?.id ? regionByDistrictId.get(district.id) || "Unassigned Region" : "Unassigned Region",
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

  const mapSites = useMemo(
    () => filteredSites.filter((site) => typeof site.lat === "number" && typeof site.lng === "number"),
    [filteredSites]
  );

  const siteStats = useMemo(() => {
    const active = filteredSites.filter((site) => site.isActive).length;
    const mapped = filteredSites.filter((site) => typeof site.lat === "number" && typeof site.lng === "number").length;
    const regionalCoverage = new Set(filteredSites.map((site) => site.regionName).filter(Boolean)).size;
    return {
      total: filteredSites.length,
      active,
      inactive: Math.max(filteredSites.length - active, 0),
      mapped,
      unmapped: Math.max(filteredSites.length - mapped, 0),
      regions: regionalCoverage,
    };
  }, [filteredSites]);

  const topRegions = useMemo(() => {
    const regionCounts = new Map<string, number>();
    filteredSites.forEach((site) => {
      regionCounts.set(site.regionName, (regionCounts.get(site.regionName) || 0) + 1);
    });

    return Array.from(regionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [filteredSites]);

  const sensorStats = useMemo(() => {
    const activeSensors = sensors.filter((sensor) => sensor.is_active).length;
    const reportingSensors = sensors.filter((sensor) => sensor.latest_reading).length;
    const alertingSensors = sensors.filter((sensor) => sensor.latest_reading?.is_alert).length;
    return {
      total: sensors.length,
      active: activeSensors,
      reporting: reportingSensors,
      alerts: alertingSensors,
    };
  }, [sensors]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (filteredSites.length === 0) {
      setSelected(null);
      return;
    }

    if (!selected || !filteredSites.some((site) => site.id === selected.id)) {
      setSelected(filteredSites[0]);
    }
  }, [filteredSites, selected]);

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
        let latest: Sensor["latest_reading"] = null;

        if (last) {
          const type = sensor.type;
          const timestamp = last.updated_at || last.created_at;
          let value: unknown;
          if (type === "temperature") value = last.temperature ?? last.value ?? last.temp;
          else if (type === "oil_level") value = last.oil_level ?? last.level ?? last.value;
          else if (type === "pressure") value = last.pressure ?? last.value;
          else if (type === "current") value = last.current ?? last.value;
          else if (type === "voltage") value = last.voltage ?? last.value;
          else if (type === "humidity") value = last.humidity ?? last.value;
          else if (type === "contact") value = last.contact ?? last.value;
          else if (type === "motion") value = last.motion ?? last.value;
          else if (type === "video") value = (last.active ?? last.value) ? 1 : 0;
          else value = last.value;

          latest =
            typeof value === "number" || typeof value === "string"
              ? {
                  value: Number(value),
                  timestamp: new Date(timestamp || new Date()).toISOString(),
                  is_alert: false,
                }
              : null;
        }

        return {
          id: sensor.id,
          name: sensor.name ?? "",
          sensor_id: String(sensor.id),
          sensor_type: sensor.type ?? "",
          description: "",
          is_active: sensor.is_active ?? true,
          latest_reading: latest,
        };
      });

      setSensors(parsed);
      setShowDetails(true);
    } catch {
      setDetailsError("Failed to load sensors");
      setSensors([]);
      setShowDetails(true);
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
        Loading site map...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-16 text-center text-sm text-red-700 shadow-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Site Operations</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 md:text-2xl">Transformer location command center</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isSupplierUser
                ? `Showing only sites linked to ${user?.supplierName || "your organisation"} controllers and sensors.`
                : "Review location coverage, inspect mapped transformers, and open site-level sensor detail without leaving the enterprise shell."}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row xl:max-w-xl">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transformer, region, district, or depot"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Visible sites</span>
              <span className="mt-1 block font-semibold text-slate-900">{filteredSites.length.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SiteMetricCard
          label="Sites in view"
          value={siteStats.total}
          helper="Current filtered transformer estate"
          icon={<Waypoints className="h-5 w-5" />}
          tone="slate"
        />
        <SiteMetricCard
          label="Active assets"
          value={siteStats.active}
          helper={`${siteStats.inactive} inactive asset${siteStats.inactive === 1 ? "" : "s"}`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <SiteMetricCard
          label="Mapped coverage"
          value={siteStats.mapped}
          helper={`${siteStats.unmapped} without coordinates`}
          icon={<MapPinned className="h-5 w-5" />}
          tone="blue"
        />
        <SiteMetricCard
          label="Regions represented"
          value={siteStats.regions}
          helper="Distinct operating regions in the result set"
          icon={<Globe className="h-5 w-5" />}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 px-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Network Map</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 md:text-base">Geographic transformer footprint</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Circle markers keep existing location logic and highlight the current filtered map coverage.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Map points</span>
                <span className="mt-1 block font-semibold text-slate-900">{mapSites.length.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200">
              <MapContainer center={[-19.015, 29.154]} zoom={6} scrollWheelZoom style={{ height: 460, width: "100%" }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapSites.map((site) => (
                  <CircleMarker
                    key={site.id}
                    center={[site.lat as number, site.lng as number]}
                    radius={6}
                    color={site.isActive ? "#16a34a" : "#dc2626"}
                    fillColor={site.isActive ? "#22c55e" : "#ef4444"}
                    fillOpacity={0.85}
                    eventHandlers={{ click: () => setSelected(site) }}
                  >
                    <Popup>
                      <div className="space-y-1.5">
                        <div className="font-semibold text-slate-900">{site.name}</div>
                        <div className="text-sm text-slate-600">Region: {site.regionName}</div>
                        <div className="text-sm text-slate-600">District: {site.districtName}</div>
                        <div className="text-sm text-slate-600">Depot: {site.depotName}</div>
                        <div className="text-sm text-slate-600">
                          Capacity: {typeof site.capacity === "number" ? `${site.capacity.toLocaleString()} kVA` : "Unavailable"}
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-sm text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${site.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                          {site.isActive ? "Active" : "Inactive"}
                        </div>
                        {isSupplierUser ? <div className="text-sm text-slate-600">Organisation: {user?.supplierName || "Supplier"}</div> : null}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => void openDetails(site)}
                            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            View sensors
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Site Directory</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 md:text-base">Premium table shell for network sites</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a row to update the summary rail or open the centered sensor detail modal.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selection</span>
                <span className="mt-1 block font-semibold text-slate-900">{selected?.name || "No site selected"}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Transformer</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Location</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Capacity</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {paginatedSites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">
                        No sites match the current filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedSites.map((site) => (
                      <tr
                        key={site.id}
                        onClick={() => setSelected(site)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          selected?.id === site.id ? "bg-blue-50/60" : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{site.name}</div>
                          <div className="mt-1 text-xs text-slate-500">#{site.id}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <div>{site.regionName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {site.districtName} • {site.depotName}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {typeof site.capacity === "number" ? `${site.capacity.toLocaleString()} kVA` : "Unavailable"}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className="inline-flex items-center gap-2 text-slate-700">
                            <span className={`h-2 w-2 rounded-full ${site.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                            {site.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openDetails(site);
                            }}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            View sensors
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200/80 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {paginatedSites.length === 0 ? 0 : (page - 1) * pageSize + 1} to {(page - 1) * pageSize + paginatedSites.length} of{" "}
                  {filteredSites.length} site entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">{page}</div>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Summary Rail</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 md:text-base">Selected site focus</h3>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <MapIcon className="h-5 w-5" />
              </div>
            </div>

            {selected ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{selected.name}</p>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${selected.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                    {selected.isActive ? "Active asset" : "Inactive asset"}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <RailValue label="Region" value={selected.regionName} />
                  <RailValue label="District" value={selected.districtName} />
                  <RailValue label="Depot" value={selected.depotName} />
                  <RailValue
                    label="Capacity"
                    value={typeof selected.capacity === "number" ? `${selected.capacity.toLocaleString()} kVA` : "Unavailable"}
                  />
                  <RailValue
                    label="Coordinates"
                    value={`${formatCoordinate(selected.lat)}, ${formatCoordinate(selected.lng)}`}
                  />
                  {isSupplierUser ? <RailValue label="Organisation" value={user?.supplierName || "Supplier"} /> : null}
                </div>

                <button
                  type="button"
                  onClick={() => void openDetails(selected)}
                  className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Open centered sensor detail
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                Choose a site from the directory or map to populate the summary rail.
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Coverage Summary</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 md:text-base">Regional concentration</h3>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {topRegions.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  No regional breakdown is available for the current filter.
                </div>
              ) : (
                topRegions.map(([regionName, count]) => {
                  const width = siteStats.total ? Math.max((count / siteStats.total) * 100, 8) : 0;
                  return (
                    <div key={regionName}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900">{regionName}</span>
                        <span className="text-slate-500">{count.toLocaleString()} sites</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Network Posture</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 md:text-base">Map and visibility summary</h3>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <Gauge className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <SummaryRow label="Mapped locations" value={`${siteStats.mapped} / ${siteStats.total}`} />
              <SummaryRow label="Inactive assets" value={siteStats.inactive} tone={siteStats.inactive > 0 ? "warning" : "neutral"} />
              <SummaryRow label="Unmapped assets" value={siteStats.unmapped} tone={siteStats.unmapped > 0 ? "warning" : "neutral"} />
              <SummaryRow label="Supplier scope" value={isSupplierUser ? user?.supplierName || "Supplier-linked view" : "System-wide visibility"} />
            </div>
          </div>
        </div>
      </section>

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        variant="center"
        showCloseButton={false}
        className="max-h-[88vh] max-w-[920px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl"
        backdropBlur={true}
      >
        <div className="flex max-h-[88vh] min-h-0 flex-col bg-white">
          <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Site Detail</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{selected?.name ?? "Transformer site"}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selected ? `${selected.regionName} / ${selected.districtName} / ${selected.depotName}` : "Centered detail modal for asset context and sensors."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/70 px-6 py-6">
            {detailsLoading ? (
              <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
                Loading sensors...
              </div>
            ) : detailsError ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-6 py-16 text-center text-sm text-red-700">
                {detailsError}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <SiteMetricCard
                    label="Sensors"
                    value={sensorStats.total}
                    helper="Assigned to this transformer"
                    icon={<Waypoints className="h-5 w-5" />}
                    tone="slate"
                  />
                  <SiteMetricCard
                    label="Active sensors"
                    value={sensorStats.active}
                    helper="Currently enabled"
                    icon={<ShieldCheck className="h-5 w-5" />}
                    tone="emerald"
                  />
                  <SiteMetricCard
                    label="Reporting now"
                    value={sensorStats.reporting}
                    helper="With a latest reading"
                    icon={<Activity className="h-5 w-5" />}
                    tone="blue"
                  />
                  <SiteMetricCard
                    label="Alerting"
                    value={sensorStats.alerts}
                    helper="Latest reading flagged"
                    icon={<ShieldAlert className="h-5 w-5" />}
                    tone="amber"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Asset Context</p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <ModalField label="Transformer" value={selected?.name || "Unavailable"} />
                      <ModalField
                        label="Status"
                        value={selected?.isActive ? "Active" : "Inactive"}
                        accent={selected?.isActive ? "success" : "danger"}
                      />
                      <ModalField label="Region" value={selected?.regionName || "Unavailable"} />
                      <ModalField label="District" value={selected?.districtName || "Unavailable"} />
                      <ModalField label="Depot" value={selected?.depotName || "Unavailable"} />
                      <ModalField
                        label="Capacity"
                        value={typeof selected?.capacity === "number" ? `${selected.capacity.toLocaleString()} kVA` : "Unavailable"}
                      />
                      <ModalField label="Latitude" value={formatCoordinate(selected?.lat)} />
                      <ModalField label="Longitude" value={formatCoordinate(selected?.lng)} />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sensor Estate</p>
                    {sensors.length === 0 ? (
                      <div className="mt-4 rounded-[20px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
                        No sensors found for this transformer.
                      </div>
                    ) : (
                      <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-slate-50/90">
                              <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sensor</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Type</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Latest reading</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {sensors.map((sensor) => (
                                <tr key={sensor.id}>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-900">{sensor.name || "Unnamed sensor"}</div>
                                    <div className="mt-1 text-xs text-slate-500">{sensor.sensor_id}</div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{sensor.sensor_type || "Unknown"}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{formatSensorReading(sensor)}</td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className="inline-flex items-center gap-2 text-slate-700">
                                      <span className={`h-2 w-2 rounded-full ${sensor.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                                      {sensor.is_active ? "Active" : "Inactive"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SiteMetricCard({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
  tone: "slate" | "emerald" | "blue" | "amber";
}) {
  const toneMap: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value.toLocaleString()}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneMap[tone]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function RailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${tone === "warning" ? "text-amber-600" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function ModalField({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "success" | "danger";
}) {
  const toneClass =
    accent === "success" ? "text-emerald-600" : accent === "danger" ? "text-red-600" : "text-slate-900";

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
