import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Activity, MapPinned, ShieldCheck, Warehouse, Zap } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserAccess } from '../../hooks/useUserAccess';
import { useRealtimeUpdates } from '../../services/realtimeService';

interface DashboardStats {
  totalRegions: number;
  totalDepots: number;
  totalTransformers: number;
  activeTransformers: number;
  offlineTransformers: number;
  totalSensors: number;
  activeSensors: number;
  totalAlerts: number;
}

interface AlertItem {
  id: number;
  message?: string;
  severity?: string;
  transformerName?: string;
  createdAt?: string;
  timestamp?: string;
}

interface SensorUpdate {
  transformer_id: number;
  transformer_name: string;
  sensor_name: string;
  sensor_type: string;
  value: number | string;
  is_alert: boolean;
  timestamp: number;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="rounded-xl bg-brand-50 p-3 text-brand-600">{icon}</div>
    </div>
  </div>
);

export default function DashboardHome() {
  const { token, user, hasPermission } = useAuth();
  const { hasNationalAccess, hasRegionAccess, hasDepotAccess, loading: accessLoading } = useUserAccess();
  const { realtimeData } = useRealtimeUpdates(token);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';

  const [stats, setStats] = useState<DashboardStats>({
    totalRegions: 0,
    totalDepots: 0,
    totalTransformers: 0,
    activeTransformers: 0,
    offlineTransformers: 0,
    totalSensors: 0,
    activeSensors: 0,
    totalAlerts: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessLabel = useMemo(() => {
    if (isSupplierUser) return user?.supplierName || 'Supplier';
    if (hasNationalAccess()) return 'National';
    if (hasRegionAccess()) return 'Region';
    if (hasDepotAccess()) return 'Depot';
    return 'Limited';
  }, [hasDepotAccess, hasNationalAccess, hasRegionAccess, isSupplierUser, user?.supplierName]);

  const liveAlertCount = useMemo(
    () => realtimeData.filter((item: SensorUpdate) => item.is_alert).length,
    [realtimeData]
  );

  const latestRealtime = useMemo(() => {
    const sorted = [...realtimeData].sort((a: SensorUpdate, b: SensorUpdate) => b.timestamp - a.timestamp);
    return sorted.slice(0, 5);
  }, [realtimeData]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const normalizeList = (payload: unknown): any[] => {
      if (Array.isArray(payload)) return payload;
      const obj = payload as Record<string, unknown> | null;
      if (!obj) return [];
      for (const key of ['content', 'data', 'items', 'records']) {
        const value = obj[key];
        if (Array.isArray(value)) {
          return value;
        }
      }
      return [];
    };

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const [regionsRes, depotsRes, transformersRes, sensorsRes, alertsRes] = await Promise.all([
          hasPermission('regions.read')
            ? axios.get(`${API_BASE_URL}/api/v1/regions`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve({ data: [] }),
          hasPermission('depots.read')
            ? axios.get(`${API_BASE_URL}/api/v1/depots`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve({ data: [] }),
          axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/sensors`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const regions = normalizeList(regionsRes.data);
        const depots = normalizeList(depotsRes.data);
        const transformers = normalizeList(transformersRes.data);
        const sensors = normalizeList(sensorsRes.data);
        const alerts = normalizeList(alertsRes.data);

        const activeTransformers = transformers.filter((item) => item?.isActive === true || item?.active === true).length;
        const activeSensors = sensors.filter((item) => item?.isActive !== false && item?.is_active !== false).length;

        setStats({
          totalRegions: regions.length,
          totalDepots: depots.length,
          totalTransformers: transformers.length,
          activeTransformers,
          offlineTransformers: Math.max(transformers.length - activeTransformers, 0),
          totalSensors: sensors.length,
          activeSensors,
          totalAlerts: alerts.length,
        });

        setRecentAlerts(
          alerts
            .sort((a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime())
            .slice(0, 6)
        );
      } catch (fetchError) {
        console.error(fetchError);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [API_BASE_URL, hasPermission, token]);

  if (loading || accessLoading) {
    return <div className="p-4">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Transformer Monitoring</h2>
            <p className="mt-1 text-sm text-brand-100">
              Welcome {user?.first_name || user?.firstname || user?.username || 'User'}.
              Access scope: <span className="font-semibold text-white">{accessLabel}</span>
            </p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <ShieldCheck className="h-7 w-7" />
          </div>
        </div>
      </div>

      {liveAlertCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Live alert activity detected</p>
                <p className="text-sm text-amber-800">Sensor and controller events are active across the monitored network.</p>
              </div>
            </div>
            <div className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white">{liveAlertCount}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={isSupplierUser ? 'Organisation' : 'Regions'}
          value={isSupplierUser ? (user?.supplierCode ? 1 : 0) : stats.totalRegions}
          subtitle={isSupplierUser ? (user?.supplierName || 'Supplier-scoped portal') : 'Operational coverage'}
          icon={<MapPinned className="h-6 w-6" />}
        />
        <StatCard
          title={isSupplierUser ? 'Assigned Depots' : 'Depots'}
          value={stats.totalDepots}
          subtitle={isSupplierUser ? 'Transformer locations linked to this supplier' : 'Managed maintenance hubs'}
          icon={<Warehouse className="h-6 w-6" />}
        />
        <StatCard
          title="Transformers"
          value={stats.totalTransformers}
          subtitle={`${stats.activeTransformers} active, ${stats.offlineTransformers} inactive`}
          icon={<Zap className="h-6 w-6" />}
        />
        <StatCard
          title="Sensors"
          value={stats.totalSensors}
          subtitle={`${stats.activeSensors} active devices`}
          icon={<Activity className="h-6 w-6" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Latest Alerts</h3>
              <p className="text-sm text-gray-500">Most recent monitoring events</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">{stats.totalAlerts} total</span>
              {hasPermission('alerts.read') && (
                <Link
                  to="/alerts"
                  className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  View All
                </Link>
              )}
            </div>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              No alerts recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{alert.message || 'Monitoring alert'}</p>
                      <p className="mt-1 text-sm text-gray-500">{alert.transformerName || 'Transformer event'}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                      {alert.severity || 'INFO'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {alert.createdAt || alert.timestamp ? new Date(alert.createdAt || alert.timestamp || '').toLocaleString() : 'Unknown time'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Live Sensor Feed</h3>
            <p className="text-sm text-gray-500">Recent real-time updates from connected devices</p>
          </div>

          {latestRealtime.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              Waiting for live telemetry.
            </div>
          ) : (
            <div className="space-y-3">
              {latestRealtime.map((item: SensorUpdate, index: number) => (
                <div key={`${item.transformer_id}-${item.sensor_name}-${index}`} className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.transformer_name}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {item.sensor_name} - {item.sensor_type}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_alert ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {item.is_alert ? 'Alert' : 'Normal'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-brand-700">{String(item.value)}</span>
                    <span className="text-gray-400">{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
