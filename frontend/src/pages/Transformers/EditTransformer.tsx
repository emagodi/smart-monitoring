import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Alert from '../../components/ui/alert/Alert';
import Button from '../../components/ui/button/Button';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';

interface DepotOption { id: number; name: string }
type TransformerTypeOption = 'GROUND_MOUNTED' | 'POLE_MOUNTED';

export default function EditTransformer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, hasPermission } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';
  
  const [depots, setDepots] = useState<DepotOption[]>([]);
  const [loadingDepots, setLoadingDepots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [nameInput, setNameInput] = useState('');
  const [capacityInput, setCapacityInput] = useState<number | ''>('');
  const [typeInput, setTypeInput] = useState<TransformerTypeOption | ''>('');
  const [isActiveInput, setIsActiveInput] = useState<boolean>(true);
  const [depotInput, setDepotInput] = useState<number | ''>('');
  const [latInput, setLatInput] = useState<number | ''>('');
  const [lngInput, setLngInput] = useState<number | ''>('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const normalizeList = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    const obj = payload as Record<string, unknown>;
    const candidates = ['content', 'data', 'items', 'records'];
    for (const key of candidates) {
      if (Array.isArray(obj?.[key])) return obj[key] as any[];
    }
    return [];
  };

  const fetchDepots = useCallback(async () => {
    try {
      setLoadingDepots(true);
      const res = await axios.get<any>(`${API_BASE_URL}/api/v1/depots`, { headers });
      const list = normalizeList(res.data);
      setDepots(list.map((d: any) => ({ id: d.id, name: d.name })));
    } catch (err) {
      console.error(err);
      setError('Failed to load depots.');
    } finally {
      setLoadingDepots(false);
    }
  }, [API_BASE_URL, headers]);

  const fetchTransformer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try direct GET
      try {
        const res = await axios.get<any>(`${API_BASE_URL}/api/v1/transformers/${id}`, { headers });
        const data = res.data.data || res.data;
        populateForm(data);
      } catch (err) {
        // Fallback: Fetch all transformers
        console.warn("Direct GET failed, trying list fallback...");
        const listRes = await axios.get<any>(`${API_BASE_URL}/api/v1/transformers`, { headers });
        const list = normalizeList(listRes.data);
        const found = list.find((t: any) => t.id === Number(id));
        if (found) {
            populateForm(found);
        } else {
            throw new Error('Transformer not found');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load transformer details.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers, id]);

  const populateForm = (data: any) => {
      setNameInput(data.name || '');
      setCapacityInput(data.capacity ?? '');
      setTypeInput((data.type as TransformerTypeOption | undefined) ?? '');
      setIsActiveInput(data.isActive ?? true);
      setDepotInput(data.depotId ?? (data.depot?.id) ?? '');
      setLatInput(data.lat ?? '');
      setLngInput(data.lng ?? '');
  };

  useEffect(() => {
    if (token && id) {
      const load = async () => {
        if (!isSupplierUser && hasPermission('depots.read')) {
          await fetchDepots();
        }
        await fetchTransformer();
      };
      load();
    }
  }, [token, id, fetchDepots, fetchTransformer, hasPermission, isSupplierUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) { setError('Name is required'); return; }
    if (!isSupplierUser && !depotInput) { setError('Depot is required'); return; }

    try {
      setSaving(true);
      setError(null);
      
      const payload = {
        name: nameInput,
        capacity: capacityInput ? Number(capacityInput) : undefined,
        type: typeInput || null,
        isActive: isActiveInput,
        depotId: isSupplierUser ? null : Number(depotInput),
        lat: latInput ? Number(latInput) : undefined,
        lng: lngInput ? Number(lngInput) : undefined
      };

      await axios.put(`${API_BASE_URL}/api/v1/transformers/${id}`, payload, { headers });
      
      navigate('/transformers');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update transformer');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
      );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/transformers')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Transformer</h2>
           <p className="text-sm text-gray-500">Update transformer details</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <Alert variant="error" title="Error" message={error} />
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Transformer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. TF-1234"
                />
              </div>

              {/* Depot */}
              {!isSupplierUser && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Depot <span className="text-red-500">*</span>
                </label>
                {loadingDepots ? (
                   <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading depots...</div>
                ) : (
                  <SearchableSelect 
                      options={depots} 
                      value={depotInput} 
                      onChange={(v) => setDepotInput(v)} 
                      placeholder="Select Depot..." 
                  />
                )}
              </div>
              )}

              {/* Capacity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Capacity (kVA)
                </label>
                <input
                  type="number"
                  className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Transformer Type
                </label>
                <select
                  value={typeInput}
                  onChange={(e) => setTypeInput((e.target.value as TransformerTypeOption | '') || '')}
                  className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="GROUND_MOUNTED">GMT</option>
                  <option value="POLE_MOUNTED">PMT</option>
                </select>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. -1.2921"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 36.8219"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                 <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Status
                 </label>
                 <select
                    value={isActiveInput ? 'true' : 'false'}
                    onChange={(e) => setIsActiveInput(e.target.value === 'true')}
                    className="block w-full rounded-lg border-gray-300 bg-white focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 transition-all"
                 >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                 </select>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
              <Button variant="secondary" onClick={() => navigate('/transformers')} type="button">
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
