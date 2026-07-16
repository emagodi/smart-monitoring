import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/alert/Alert';
import Button from '../../components/ui/button/Button';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

interface Controller {
  id: number;
  deviceId: string;
  devEui: string;
  name: string;
  type: string;
  transformerId?: number;
}

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

export default function EditController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';
  
  const [controller, setController] = useState<Controller | null>(null);
  const [transformers, setTransformers] = useState<TransformerOption[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [transformerInput, setTransformerInput] = useState<number | ''>('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch transformers
      const tRes = await axios.get<any>(`${API_BASE_URL}/api/v1/transformers/assignment-options`, { headers });
      const tArr = normalizeList(tRes.data);
      setTransformers(
        tArr
          .map((t) => ({ id: t.id, name: t.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      // Fetch controller details
      try {
        const cRes = await axios.get<any>(`${API_BASE_URL}/api/v1/controllers/${id}`, { headers });
        const data = cRes.data.data || cRes.data;
        setController(data);
        setNameInput(data.name || '');
        setTransformerInput(data.transformerId ?? '');
      } catch (err) {
        // Fallback: fetch all and find
        const allRes = await axios.get<any>(`${API_BASE_URL}/api/v1/controllers`, { headers });
        const list = normalizeList(allRes.data);
        const found = list.find((c: any) => c.id === Number(id));
        if (found) {
          setController(found);
          setNameInput(found.name || '');
          setTransformerInput(found.transformerId ?? '');
        } else {
            throw new Error('Controller not found');
        }
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load controller details.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, id]);

  useEffect(() => {
    if (token && id) {
      fetchData();
    }
  }, [token, id, fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!controller) return;

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        deviceId: controller.deviceId,
        devEui: controller.devEui,
        type: controller.type,
        name: nameInput,
        transformerId: transformerInput === '' ? null : transformerInput
      };

      await axios.put(`${API_BASE_URL}/api/v1/controllers/${controller.id}`, payload, { headers });
      
      navigate('/new-controllers');
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to update controller');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  if (error || !controller) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">{error || 'Controller not found'}</p>
        <Button onClick={() => navigate('/new-controllers')}>Back to List</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/new-controllers')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Controller</h2>
           <p className="text-sm text-gray-500">Update details for {controller.deviceId}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {formError && (
            <Alert variant="error" title="Error" message={formError} />
            )}

            <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Controller Name
                </label>
                <input
                type="text"
                required
                className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter a descriptive name"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Assign to Transformer
                </label>
                <div className="relative">
                <SearchableSelect 
                    options={transformers} 
                    value={transformerInput} 
                    onChange={(v) => setTransformerInput(v)} 
                    placeholder="Select Transformer..." 
                />
                </div>
                <div className="mt-2 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-blue-900/10 p-3 rounded border border-gray-100 dark:border-blue-800">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                    {isSupplierUser ? 'Select any transformer in the assignment catalogue to link this controller.' : 'Select a transformer to link this controller.'}
                    <span className="font-semibold text-gray-700 dark:text-gray-300 ml-1">Leave empty to keep unassigned.</span>
                </span>
                </div>
            </div>
            </div>

            <div className="pt-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => navigate('/new-controllers')} type="button">
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
