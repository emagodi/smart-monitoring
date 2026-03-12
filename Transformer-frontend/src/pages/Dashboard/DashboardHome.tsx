import { useState, useEffect, useMemo } from 'react';
import { 
  MapPinned, Warehouse, Zap, AlertTriangle, ShieldCheck, DoorOpen, Activity, Lock, Brain, 
  TrendingUp, BarChart2, Clock, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserAccess } from '../../hooks/useUserAccess';
import axios from 'axios';
import { useRealtimeUpdates } from '../../services/realtimeService';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';

interface AiInsights {
  totalAlerts: number;
  intruderCount: number;
  climbingCount: number;
  doorOpenCount: number;
  fireCount: number;
  anomalyScore: number;
  systemHealth: string;
  prediction: string;
}

interface DashboardStats {
  total_regions: number;
  total_depots: number;
  total_transformers: number;
  total_sensors: number;
  active_sensors: number;
  active_transformers: number;
  inactive_transformers: number;
}

interface RecentAlert {
  id: number;
  imageUrl: string;
  detectedClass: string;
  message: string;
  transformerName: string;
  createdAt: string;
  di1?: boolean;
  di2?: boolean;
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
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false);
  const [imagePreviewError, setImagePreviewError] = useState(false);

  // Add state for real-time data
  const { realtimeData } = useRealtimeUpdates(token);
  const [transformerSensors, setTransformerSensors] = useState<Record<number, SensorUpdate[]>>({});

  // Use port 8080 for API calls to go through Gateway
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  
  // Mock historical data for advanced charts (since backend only has snapshot)
  const historicalData = useMemo(() => {
    const data = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const day of days) {
      data.push({
        name: day,
        alerts: Math.floor(Math.random() * 15) + 2,
        anomalies: Math.floor(Math.random() * 5),
        efficiency: 85 + Math.floor(Math.random() * 10),
      });
    }
    return data;
  }, []);

  const anomalyHistory = useMemo(() => {
    const data = [];
    for (let i = 0; i < 24; i++) {
      data.push({
        time: `${i}:00`,
        score: Math.floor(Math.random() * 30) + (i > 18 ? 40 : 5), // Spike at night
      });
    }
    return data;
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
        const normalizeList = (payload: unknown): unknown[] => {
          if (Array.isArray(payload)) return payload;
          const obj = isRecord(payload) ? payload : {};
          for (const k of ['data', 'content', 'items', 'records']) {
            const v = obj?.[k] as unknown;
            if (Array.isArray(v)) return v;
          }
          return [];
        };
        const getBoolean = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

        const [regionsRes, depotsRes, transformersRes, sensorsRes, aiRes, alertsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/regions`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/depots`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/transformers`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/sensors`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/simulation/insights`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/v1/simulation/alerts/latest`, { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);
        
        if (aiRes.data && typeof aiRes.data === 'object') {
          setAiInsights(aiRes.data as AiInsights);
        }

        const alertsList = normalizeList(alertsRes.data);
        setRecentAlerts(alertsList as RecentAlert[]);

        const regionsList = normalizeList(regionsRes.data);
        const depotsList = normalizeList(depotsRes.data);
        const baseList = normalizeList(transformersRes.data);
        const sensorsList = normalizeList(sensorsRes.data);

        setStats({
          total_regions: regionsList.length,
          total_depots: depotsList.length,
          total_transformers: baseList.length,
          total_sensors: sensorsList.length,
          active_sensors: sensorsList.filter((s) => {
            if (!isRecord(s)) return true;
            const isActive = s['is_active'] ?? s['isActive'];
            return getBoolean(isActive, true);
          }).length,
          active_transformers: baseList.filter((x) => {
            if (!isRecord(x)) return false;
            return getBoolean(x['isActive'], false);
          }).length,
          inactive_transformers: baseList.filter((x) => {
            if (!isRecord(x)) return true;
            return !getBoolean(x['isActive'], false);
          }).length,
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
  }, [token, API_BASE_URL]);

  // Process real-time updates
  useEffect(() => {
    if (realtimeData.length > 0) {
      const groupedByTransformer: Record<number, SensorUpdate[]> = {};

      realtimeData.forEach(update => {
        if (!groupedByTransformer[update.transformer_id]) {
          groupedByTransformer[update.transformer_id] = [];
        }
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
    }
  }, [realtimeData]);

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
            <ShieldCheck className="h-6 w-6 text-white" />
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-brand-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-brand-900"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-md">
              <MapPinned className="h-5 w-5 text-white" />
            </div>
            <div className="ml-4">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.total_regions || 0}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Regions</span>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-light-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-blue-light-900"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-light-400 to-blue-light-600 shadow-md">
              <Warehouse className="h-5 w-5 text-white" />
            </div>
            <div className="ml-4">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.total_depots || 0}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Depots</span>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-success-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-success-900"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-success-400 to-success-600 shadow-md">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="ml-4">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.total_transformers || 0}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Transformers</span>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl ring-1 ring-inset ring-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 dark:ring-gray-700">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-orange-100 opacity-20 transition-all duration-500 group-hover:scale-110 dark:bg-orange-900"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-md">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="ml-4">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.active_sensors || 0}
              </h4>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Sensors</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights & Charts Dashboard */}
      {aiInsights && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 1. Security Threat Overview (Pie Chart) */}
            <div className="col-span-1 lg:col-span-2 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    AI Security Insights
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Real-time threat detection based on simulation data</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  aiInsights.systemHealth === 'CRITICAL RISK' ? 'bg-red-50 text-red-700 border-red-200' :
                  aiInsights.systemHealth === 'MODERATE RISK' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                  'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {aiInsights.systemHealth}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Intruders', value: aiInsights.intruderCount, color: '#EF4444' },
                          { name: 'Climbing', value: aiInsights.climbingCount, color: '#F59E0B' },
                          { name: 'Door Open', value: aiInsights.doorOpenCount, color: '#3B82F6' },
                          { name: 'Fire', value: aiInsights.fireCount, color: '#DC2626' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Intruders', value: aiInsights.intruderCount, color: '#EF4444' },
                          { name: 'Climbing', value: aiInsights.climbingCount, color: '#F59E0B' },
                          { name: 'Door Open', value: aiInsights.doorOpenCount, color: '#3B82F6' },
                          { name: 'Fire', value: aiInsights.fireCount, color: '#DC2626' },
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium text-red-900 dark:text-red-200">Intruders</span>
                    </div>
                    <span className="text-2xl font-bold text-red-700 dark:text-red-100">{aiInsights.intruderCount}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPinned className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-900 dark:text-orange-200">Climbing</span>
                    </div>
                    <span className="text-2xl font-bold text-orange-700 dark:text-orange-100">{aiInsights.climbingCount}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <DoorOpen className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Door Open</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-700 dark:text-blue-100">{aiInsights.doorOpenCount}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Total Alerts</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-700 dark:text-gray-100">{aiInsights.totalAlerts}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Predictive Analytics Card */}
            <div className="col-span-1 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Predictive Analytics</h3>
                  <p className="text-xs text-indigo-200">Next 24 Hours Forecast</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-medium text-indigo-100">Anomaly Score</span>
                  <span className="text-3xl font-bold">{aiInsights.anomalyScore}%</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ${
                      aiInsights.anomalyScore > 70 ? 'bg-red-400' : 
                      aiInsights.anomalyScore > 40 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${aiInsights.anomalyScore}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-200 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Security Recommendation</h4>
                    <p className="text-xs text-indigo-100 leading-relaxed">
                      {aiInsights.prediction}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. New Advanced Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Alert Trends */}
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-blue-500" />
                        Weekly Alert Trends
                    </h3>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">Last 7 Days</div>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={historicalData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                            <RechartsTooltip 
                                contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                cursor={{fill: '#F3F4F6'}}
                            />
                            <Bar dataKey="alerts" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Anomaly Timeline */}
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                        24h Anomaly Timeline
                    </h3>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">Real-time</div>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={anomalyHistory}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} interval={3} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                            <RechartsTooltip 
                                contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            />
                            <Area type="monotone" dataKey="score" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>

          {/* 4. Recent AI Alerts List */}
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Recent AI Alerts
                </h3>
                <span className="text-sm text-gray-500">Latest 10 detections</span>
             </div>
             
             {recentAlerts.length > 0 ? (
                 <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                     <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                         <thead className="bg-gray-50 dark:bg-gray-800/50">
                             <tr>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transformer</th>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detection</th>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence/Message</th>
                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Evidence</th>
                             </tr>
                         </thead>
                         <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                             {recentAlerts.map((alert) => (
                                 <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                         <div className="flex items-center gap-2">
                                             <Clock className="w-4 h-4" />
                                             {new Date(alert.createdAt).toLocaleString()}
                                         </div>
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                         {alert.transformerName}
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${alert.detectedClass?.toLowerCase().includes('climbing') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                                              alert.detectedClass?.toLowerCase().includes('intruder') ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                                              alert.detectedClass?.toLowerCase().includes('door') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' :
                                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {alert.detectedClass || 'Unknown'}
                                         </span>
                                     </td>
                                     <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                         {alert.message}
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                         {alert.imageUrl ? (
                                             <button 
                                               onClick={() => {
                                                setImagePreviewError(false);
                                                setImagePreviewLoading(true);
                                                setSelectedImage(`${API_BASE_URL}/api/v1/simulation/uploads/${encodeURI(alert.imageUrl)}`);
                                               }}
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                             >
                                                 View Image
                                             </button>
                                         ) : (
                                             <span className="text-gray-400">No Image</span>
                                         )}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             ) : (
                 <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                     <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                     <p>No alerts generated yet.</p>
                     <p className="text-xs mt-1">Run a simulation with Vision AI to generate alerts.</p>
                 </div>
             )}
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setSelectedImage(null)}
        >
            <div 
                className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
                {imagePreviewLoading && (
                    <div className="flex items-center justify-center p-10 text-sm text-gray-600 dark:text-gray-300">
                        Loading image...
                    </div>
                )}
                {imagePreviewError && (
                    <div className="p-6 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-200">
                        Failed to load evidence image.
                        <div className="mt-2 break-all text-xs text-gray-700 dark:text-gray-300">{selectedImage}</div>
                    </div>
                )}
                <img 
                    src={selectedImage} 
                    alt="Alert Evidence" 
                    className={`h-full w-full object-contain max-h-[85vh] ${imagePreviewLoading ? 'hidden' : ''}`} 
                    onLoad={() => {
                        setImagePreviewLoading(false);
                        setImagePreviewError(false);
                    }}
                    onError={() => {
                        setImagePreviewLoading(false);
                        setImagePreviewError(true);
                    }}
                />
            </div>
        </div>
      )}
    </div>
  );
}
