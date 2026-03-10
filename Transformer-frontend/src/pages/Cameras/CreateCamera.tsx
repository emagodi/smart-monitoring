import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Button from '../../components/ui/button/Button';
import Alert from '../../components/ui/alert/Alert';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

interface TransformerOption { id: number; name: string }

const normalizeList = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  const obj = payload as Record<string, unknown>;
  const candidates = ['data', 'content', 'items', 'records'];
  for (const key of candidates) {
    const v = obj?.[key] as unknown;
    if (Array.isArray(v)) return v;
  }
  return [];
};

export default function CreateCamera() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transformers, setTransformers] = useState<TransformerOption[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    topic: '',
    transformerId: '' as number | '',
    model: '',
    wifiSsid: '',
    macAddress: '',
    ipAddress: '',
  });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  useEffect(() => {
    if (!token) return;
    const fetchTransformers = async () => {
      try {
        const res = await axios.get<any>(`${API_BASE_URL}/api/v1/transformers`, { headers });
        const list = normalizeList(res.data);
        setTransformers(list.map((t: any) => ({ id: t.id, name: t.name })));
      } catch (err) {
        console.error('Failed to fetch transformers', err);
      }
    };
    fetchTransformers();
  }, [token, API_BASE_URL, headers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
        ...formData,
        transformerId: formData.transformerId === '' ? null : formData.transformerId
    };

    try {
      await axios.post(
        `${API_BASE_URL}/api/v1/cameras/register`, 
        payload,
        { headers }
      );
      navigate('/cameras');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to create camera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/cameras')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Camera</h2>
           <p className="text-sm text-gray-500">Register a new surveillance camera</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <Alert variant="error" title="Error" message={error} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Camera Name
              </label>
              <input
                type="text"
                required
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Main Gate Camera"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                MQTT Topic
              </label>
              <input
                type="text"
                required
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.topic}
                onChange={(e) => setFormData({...formData, topic: e.target.value})}
                placeholder="e.g. cameras/gate/events"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Model
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                placeholder="e.g. Hikvision X1"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                IP Address
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.ipAddress}
                onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                placeholder="192.168.1.100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                MAC Address
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.macAddress}
                onChange={(e) => setFormData({...formData, macAddress: e.target.value})}
                placeholder="AA:BB:CC:DD:EE:FF"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                WiFi SSID (Optional)
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.wifiSsid}
                onChange={(e) => setFormData({...formData, wifiSsid: e.target.value})}
                placeholder="Office_WiFi"
              />
            </div>

            <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Assign to Transformer
                </label>
                <div className="relative">
                <SearchableSelect 
                    options={transformers} 
                    value={formData.transformerId} 
                    onChange={(v) => setFormData({...formData, transformerId: v})} 
                    placeholder="Select Transformer..." 
                />
                </div>
            </div>
          </div>

          <div className="pt-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => navigate('/cameras')} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[140px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Camera
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
