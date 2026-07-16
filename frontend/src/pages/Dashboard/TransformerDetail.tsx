import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserAccess } from '../../hooks/useUserAccess';
import axios from 'axios';
import DashboardLayout from '../../layout/DashboardLayout';
import { Activity, AlertTriangle, Thermometer, Gauge, Zap, Droplets } from 'lucide-react';

interface Sensor {
  id: number;
  name: string;
  sensor_id: string;
  sensor_type: string;
  description: string;
  is_active: boolean;
  latest_reading: {
    value: number;
    timestamp: string;
    is_alert: boolean;
  } | null;
  readings_count: number;
}

interface TransformerDetail {
  id: number;
  name: string;
  transformer_id: string;
  depot_name: string;
  region_name: string;
  capacity: number;
  installation_date: string;
  description: string;
  is_active: boolean;
  sensor_count: number;
  sensors: Sensor[];
  recent_readings: {
    sensor_name: string;
    sensor_type: string;
    value: number;
    timestamp: string;
    is_alert: boolean;
  }[];
}

const TransformerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { hasNationalAccess, hasRegionAccess, hasDepotAccess, loading: accessLoading } = useUserAccess();
  const [transformer, setTransformer] = useState<TransformerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  
  useEffect(() => {
    const fetchTransformerDetail = async () => {
      try {
        setLoading(true);

        const response = await axios.get(`${API_BASE_URL}/dashboard/transformer_detail/${id}/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        setTransformer(response.data);
      } catch (err: any) {
        if (err.response?.status === 403) {
          setError('Access denied: You do not have permission to view this transformer');
        } else {
          setError('Failed to fetch transformer details');
        }
        console.error('Error fetching transformer details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token && id) {
      fetchTransformerDetail();
    }
  }, [token, id, refreshTrigger]);

  // Set up auto-refresh every 30 seconds to simulate real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading || accessLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading transformer details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500">{error}</p>
          {error.includes('Access denied') && (
            <button
              className="mt-4 px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
              onClick={() => navigate('/')}
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (!transformer) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Transformer not found</p>
        </div>
      </DashboardLayout>
    );
  }

  // Group recent readings by sensor type
  const groupedReadings: Record<string, any[]> = {};
  transformer.recent_readings.forEach(reading => {
    if (!groupedReadings[reading.sensor_type]) {
      groupedReadings[reading.sensor_type] = [];
    }
    groupedReadings[reading.sensor_type].push(reading);
  });

  // Get sensor icon based on type
  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temperature': return <Thermometer className="w-5 h-5" />;
      case 'oil_level': return <Droplets className="w-5 h-5" />;
      case 'pressure': return <Gauge className="w-5 h-5" />;
      case 'current': return <Zap className="w-5 h-5" />;
      case 'voltage': return <Activity className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  // Get alert count
  const alertCount = transformer.sensors.filter(sensor =>
    sensor.latest_reading && sensor.latest_reading.is_alert
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Transformer Header */}
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">{transformer.name}</h1>
              <p className="text-gray-600">ID: {transformer.transformer_id}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${transformer.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {transformer.is_active ? 'Active' : 'Inactive'}
              </span>
              {alertCount > 0 && (
                <span className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-full flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {alertCount} Alert{alertCount > 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-600">Location</p>
              <p className="font-medium">{transformer.depot_name}, {transformer.region_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Capacity</p>
              <p className="font-medium">{transformer.capacity} MVA</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Installation Date</p>
              <p className="font-medium">{transformer.installation_date ? new Date(transformer.installation_date).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Sensor Status Grid */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Sensor Status</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {transformer.sensors.map(sensor => (
              <div key={sensor.id} className={`p-4 border rounded-lg ${sensor.latest_reading?.is_alert ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getSensorIcon(sensor.sensor_type)}
                    <h3 className="ml-2 font-medium text-gray-800">{sensor.name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${sensor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {sensor.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-2">
                  <p className="text-sm text-gray-600 capitalize">{sensor.sensor_type ? sensor.sensor_type.replace('_', ' ') : 'N/A'}</p>
                  <p className="text-sm text-gray-600">Readings: {sensor.readings_count || 0}</p>
                </div>

                {sensor.latest_reading ? (
                  <div className={`mt-2 p-2 rounded ${sensor.latest_reading.is_alert ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800'}`}>
                    <div className="flex justify-between">
                      <span className="text-sm">Value: <span className="font-semibold">{sensor.latest_reading.value}</span></span>
                      <span className="text-xs">{new Date(sensor.latest_reading.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {sensor.latest_reading.is_alert && (
                      <div className="flex items-center mt-1 text-xs font-bold">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        ALERT
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 p-2 text-sm text-gray-600">
                    No readings available
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Charts */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Object.entries(groupedReadings).map(([sensorType, readings]) => (
            <div key={sensorType} className="p-6 bg-white rounded-lg shadow">
              <div className="flex items-center mb-4">
                {getSensorIcon(sensorType)}
                <h3 className="ml-2 text-lg font-semibold text-gray-800 capitalize">{sensorType.replace('_', ' ')} Readings</h3>
              </div>
              <div className="h-64 bg-gray-50 rounded flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gray-500 mb-2">Real-time {sensorType.replace('_', ' ')} chart</div>
                  <div className="text-sm text-gray-400">
                    {readings.length > 0
                      ? `${readings.length} recent readings`
                      : 'No data available'}
                  </div>
                </div>
              </div>
              {readings.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                  <div className="flex justify-between">
                    <span>Last reading:</span>
                    <span className="font-medium">{readings[0].value} {sensorType === 'temperature' ? '°C' : sensorType === 'voltage' ? 'V' : sensorType === 'current' ? 'A' : ''}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Time:</span>
                    <span>{new Date(readings[0].timestamp).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransformerDetail;