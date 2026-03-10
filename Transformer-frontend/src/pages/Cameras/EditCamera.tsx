import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
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

export default function EditCamera() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    status: 'active'
  });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  useEffect(() => {
    if (!token || !id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch transformers
        const tRes = await axios.get<any>(`${API_BASE_URL}/api/v1/transformers`, { headers });
        const tList = normalizeList(tRes.data);
        setTransformers(tList.map((t: any) => ({ id: t.id, name: t.name })));

        // Fetch camera
        const res = await axios.get<any>(`${API_BASE_URL}/api/v1/cameras/${id}`, { headers });
        const data = res.data.data || res.data;
        
        setFormData({
          name: data.name || '',
          topic: data.topic || '',
          transformerId: data.transformerId || '',
          model: data.model || '',
          wifiSsid: data.wifiSsid || '',
          macAddress: data.macAddress || '',
          ipAddress: data.ipAddress || '',
          status: data.status || 'active'
        });
      } catch (err) {
        console.error(err);
        setError('Failed to fetch camera details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token, API_BASE_URL, headers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
        ...formData,
        transformerId: formData.transformerId === '' ? null : formData.transformerId
    };

    try {
      await axios.put(
        `${API_BASE_URL}/api/v1/cameras/${id}`, 
        payload,
        { headers }
      );
      navigate('/cameras');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update camera');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

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
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Camera</h2>
           <p className="text-sm text-gray-500">Update camera details</p>
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
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                WiFi SSID
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm focus:border-brand-500 focus:ring-brand-500 py-2.5 px-3"
                value={formData.wifiSsid}
                onChange={(e) => setFormData({...formData, wifiSsid: e.target.value})}
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
            <Button type="submit" disabled={saving} className="min-w-[140px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
