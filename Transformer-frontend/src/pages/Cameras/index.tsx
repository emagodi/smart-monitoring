import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Button from '../../components/ui/button/Button';
import { Search, Loader2, Camera as CameraIcon, Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Camera {
  id: number;
  name: string;
  topic: string;
  transformerId?: number;
  model?: string;
  wifiSsid?: string;
  macAddress?: string;
  ipAddress?: string;
  status: string;
}

interface Transformer {
  id: number;
  name: string;
}

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

export default function CamerasIndex() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Camera[]>([]);
  const [transformers, setTransformers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [camerasRes, transformersRes] = await Promise.all([
        axios.get<any>(`${API_BASE_URL}/api/v1/cameras`, { headers }),
        axios.get<any>(`${API_BASE_URL}/api/v1/transformers`, { headers })
      ]);

      const cameraList = Array.isArray(camerasRes.data) ? camerasRes.data : (camerasRes.data.data || []);
      setItems(cameraList);

      const transformerList = normalizeList(transformersRes.data);
      const tMap: Record<number, string> = {};
      transformerList.forEach((t: any) => {
        tMap[t.id] = t.name;
      });
      setTransformers(tMap);

    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch data. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this camera?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/cameras/${id}`, { headers });
      setItems(items.filter(c => c.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete camera');
    }
  };

  const filtered = items.filter((c) => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.model && c.model.toLowerCase().includes(search.toLowerCase())) ||
    (c.ipAddress && c.ipAddress.includes(search))
  );

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CameraIcon className="w-8 h-8 text-blue-500" />
            Cameras
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your surveillance cameras</p>
        </div>
        <Button onClick={() => navigate('/cameras/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Camera
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">IP / MAC</th>
                <th className="px-6 py-4">Topic</th>
                <th className="px-6 py-4">Transformer</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {paginatedItems.map((camera) => (
                <tr key={camera.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {camera.name}
                  </td>
                  <td className="px-6 py-4">
                    {camera.model || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {camera.ipAddress && <span className="font-mono">{camera.ipAddress}</span>}
                      {camera.macAddress && <span className="text-gray-400">{camera.macAddress}</span>}
                      {!camera.ipAddress && !camera.macAddress && '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {camera.topic}
                  </td>
                  <td className="px-6 py-4">
                    {camera.transformerId ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {transformers[camera.transformerId] || `ID: ${camera.transformerId}`}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${camera.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${camera.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {camera.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/cameras/${camera.id}/edit`)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(camera.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No cameras found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                    ${currentPage === page 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
