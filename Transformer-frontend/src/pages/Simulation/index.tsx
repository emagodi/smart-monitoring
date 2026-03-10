import React, { useState, useEffect } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import Button from '../../components/ui/button/Button';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ComponentCard from '../../components/common/ComponentCard';
import Input from '../../components/form/input/InputField';

interface Transformer {
  id: number;
  name: string;
}

interface SimController {
  id: number;
  name: string;
  devEui: string;
  deviceId: string;
  type: string;
  transformerId: number;
}

interface SimCamera {
  id: number;
  name: string;
  ipAddress: string;
  transformerId: number;
}

const SimulationPage = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'run' | 'controller' | 'camera'>('run');
  
  // Run State
  const [di1, setDi1] = useState<boolean>(false);
  const [di2, setDi2] = useState<boolean>(false);
  const [transformerId, setTransformerId] = useState<number | string>("");
  const [cameraId, setCameraId] = useState<number | string>("");
  const [availableCameras, setAvailableCameras] = useState<SimCamera[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Config State
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [simControllers, setSimControllers] = useState<SimController[]>([]);
  const [simCameras, setSimCameras] = useState<SimCamera[]>([]);
  
  // Forms
  const [newController, setNewController] = useState({ name: '', devEui: '', deviceId: '', type: 'IO_CONTROLLER', transformerId: '' });
  const [newCamera, setNewCamera] = useState({ name: '', topic: '', model: '', ipAddress: '', macAddress: '', wifiSsid: '', transformerId: '' });

  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  // Fetch Data
  useEffect(() => {
    fetchTransformers();
    // Always fetch config data so we can filter cameras for the dropdown
    fetchConfigData();
  }, [token, activeTab]);

  // Update available cameras when transformer changes
  useEffect(() => {
    if (transformerId) {
        const filtered = simCameras.filter(c => c.transformerId === Number(transformerId));
        setAvailableCameras(filtered);
    } else {
        setAvailableCameras([]);
    }
  }, [transformerId, simCameras]);

  const fetchTransformers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/v1/transformers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rawData = response.data as any;
      const list = Array.isArray(rawData) ? rawData : (rawData.content || []);
      // Map to correct format for SearchableSelect: { id, name }
      setTransformers(list.map((t: any) => ({ id: t.id, name: t.name })));
    } catch (error) {
      console.error("Failed to fetch transformers", error);
    }
  };

  const fetchConfigData = async () => {
    try {
      const [ctrlRes, camRes] = await Promise.all([
        axios.get<SimController[]>(`${API_BASE}/api/v1/simulation/controllers`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get<SimCamera[]>(`${API_BASE}/api/v1/simulation/cameras`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setSimControllers(ctrlRes.data);
      setSimCameras(camRes.data);
    } catch (error) {
      console.error("Failed to fetch simulation config", error);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!transformerId) {
        setMessage({ type: 'error', text: "Please select a transformer." });
        setLoading(false);
        return;
    }

    const formData = new FormData();
    formData.append('transformerId', String(transformerId));
    if (cameraId) {
        formData.append('cameraId', String(cameraId));
    }
    formData.append('di1', String(di1));
    formData.append('di2', String(di2));
    if (file) {
      formData.append('image', file);
    }

    try {
      await axios.post(`${API_BASE}/api/v1/simulation/run`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage({ type: 'success', text: "Simulation executed successfully. Data injected." });
    } catch (error: any) {
      console.error("Simulation failed", error);
      setMessage({ type: 'error', text: error.response?.data?.message || "Simulation failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateController = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newController.transformerId) {
        setMessage({ type: 'error', text: "Please select a transformer." });
        return;
    }
    try {
      await axios.post(`${API_BASE}/api/v1/simulation/controllers`, {
        ...newController,
        transformerId: Number(newController.transformerId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewController({ name: '', devEui: '', deviceId: '', type: 'IO_CONTROLLER', transformerId: '' });
      fetchConfigData();
      setMessage({ type: 'success', text: "Simulation Controller created successfully." });
    } catch (error: any) {
      console.error("Failed to create controller", error);
      setMessage({ type: 'error', text: error.response?.data?.message || "Failed to create controller. Check if EUI is unique." });
    }
  };

  const handleCreateCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamera.transformerId) {
        setMessage({ type: 'error', text: "Please select a transformer." });
        return;
    }
    try {
      await axios.post(`${API_BASE}/api/v1/simulation/cameras`, {
        ...newCamera,
        transformerId: Number(newCamera.transformerId)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewCamera({ name: '', topic: '', model: '', ipAddress: '', macAddress: '', wifiSsid: '', transformerId: '' });
      fetchConfigData();
      setMessage({ type: 'success', text: "Simulation Camera created successfully." });
    } catch (error: any) {
      console.error("Failed to create camera", error);
      setMessage({ type: 'error', text: error.response?.data?.message || "Failed to create camera. Check if IP/MAC is unique." });
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Simulation" />
      
      {/* Tabs */}
      <div className="mb-6 flex gap-4 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`pb-2 px-4 ${activeTab === 'run' ? 'border-b-2 border-brand-500 text-brand-500' : 'text-gray-500'}`}
          onClick={() => setActiveTab('run')}
        >
          Run Simulation
        </button>
        <button
          className={`pb-2 px-4 ${activeTab === 'controller' ? 'border-b-2 border-brand-500 text-brand-500' : 'text-gray-500'}`}
          onClick={() => setActiveTab('controller')}
        >
          Add Controller
        </button>
        <button
          className={`pb-2 px-4 ${activeTab === 'camera' ? 'border-b-2 border-brand-500 text-brand-500' : 'text-gray-500'}`}
          onClick={() => setActiveTab('camera')}
        >
          Add Camera
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {activeTab === 'run' && (
        <div className="flex justify-center">
          <div className="flex flex-col gap-9 w-full max-w-2xl">
            <ComponentCard title="Simulation Controls">
              <form onSubmit={handleRunSimulation}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2.5 block text-black dark:text-white">
                      Select Transformer
                    </label>
                    <SearchableSelect
                      options={transformers}
                      onChange={(val) => setTransformerId(val)}
                      value={transformerId}
                      placeholder="Select Transformer"
                    />
                  </div>

                  {transformerId && (
                      <div>
                        <label className="mb-2.5 block text-black dark:text-white">
                          Select Camera (Optional)
                        </label>
                        <SearchableSelect
                          options={availableCameras.map(c => ({ id: c.id, name: c.name }))}
                          onChange={(val) => setCameraId(val)}
                          value={cameraId}
                          placeholder={availableCameras.length > 0 ? "Select Camera" : "No cameras found for this transformer"}
                        />
                      </div>
                  )}

                  <div className="flex gap-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={di1} 
                        onChange={e => setDi1(e.target.checked)}
                        className="w-5 h-5 text-brand-500"
                      />
                      <span className="text-black dark:text-white">DI1 (Motion)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={di2} 
                        onChange={e => setDi2(e.target.checked)}
                        className="w-5 h-5 text-brand-500"
                      />
                      <span className="text-black dark:text-white">DI2 (Contact)</span>
                    </label>
                  </div>

                  <div>
                    <label className="mb-2.5 block text-black dark:text-white">
                      Upload Camera Image (Optional)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-brand-500 active:border-brand-500 disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-brand-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Upload an image to simulate camera capture (e.g., person climbing).
                    </p>
                  </div>

                  <Button size="md" variant="primary" type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Running...' : 'Run Simulation'}
                  </Button>
                </div>
              </form>
            </ComponentCard>
          </div>
        </div>
      )}

      {activeTab === 'controller' && (
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <ComponentCard title="Add Simulation Controller">
              <form onSubmit={handleCreateController} className="space-y-4">
                <div className="space-y-1">
                  <label className="mb-2.5 block text-black dark:text-white">Controller Name</label>
                  <Input
                    placeholder="e.g. Sim Controller 1"
                    value={newController.name}
                    onChange={e => setNewController({...newController, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="mb-2.5 block text-black dark:text-white">Dev EUI (Unique)</label>
                  <Input
                    placeholder="e.g. SIM00000001"
                    value={newController.devEui}
                    onChange={e => setNewController({...newController, devEui: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="mb-2.5 block text-black dark:text-white">Device ID</label>
                  <Input
                    placeholder="e.g. SIM00000001"
                    value={newController.deviceId}
                    onChange={e => setNewController({...newController, deviceId: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="mb-2.5 block text-black dark:text-white">Type</label>
                  <div className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 py-3 px-5 font-medium outline-none transition focus:border-brand-500 active:border-brand-500 disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-brand-500">
                      IO_CONTROLLER
                  </div>
                </div>
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">Transformer</label>
                  <SearchableSelect
                    options={transformers}
                    onChange={(val) => setNewController({...newController, transformerId: val})}
                    value={newController.transformerId}
                    placeholder="Select Transformer"
                  />
                </div>
                <Button size="md" variant="primary" type="submit" className="w-full">Save Controller</Button>
              </form>
              
              <div className="mt-6">
                <h4 className="font-semibold mb-2">Existing Controllers</h4>
                <div className="max-h-60 overflow-y-auto border rounded p-2">
                  {simControllers.map((c: any) => (
                    <div key={c.id} className="p-2 border-b last:border-0 flex flex-col">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-gray-500">DevEUI: {c.devEui}</span>
                      <span className="text-xs text-gray-500">DeviceID: {c.deviceId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ComponentCard>
          </div>
        </div>
      )}

      {activeTab === 'camera' && (
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <ComponentCard title="Add Simulation Camera">
              <form onSubmit={handleCreateCamera} className="space-y-4">
                <div className="space-y-1">
                  <label className="mb-2.5 block text-black dark:text-white">Camera Name</label>
                  <Input
                    placeholder="e.g. Main Gate Camera"
                    value={newCamera.name}
                    onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="mb-2.5 block text-black dark:text-white">MQTT Topic</label>
                    <Input
                      placeholder="e.g. cameras/gate/events"
                      value={newCamera.topic}
                      onChange={e => setNewCamera({...newCamera, topic: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="mb-2.5 block text-black dark:text-white">Model</label>
                    <Input
                      placeholder="e.g. Hikvision X1"
                      value={newCamera.model}
                      onChange={e => setNewCamera({...newCamera, model: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="mb-2.5 block text-black dark:text-white">IP Address</label>
                    <Input
                      placeholder="e.g. 192.168.1.100"
                      value={newCamera.ipAddress}
                      onChange={e => setNewCamera({...newCamera, ipAddress: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="mb-2.5 block text-black dark:text-white">MAC Address</label>
                    <Input
                      placeholder="AA:BB:CC:DD:EE:FF"
                      value={newCamera.macAddress}
                      onChange={e => setNewCamera({...newCamera, macAddress: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="mb-2.5 block text-black dark:text-white">WiFi SSID (Optional)</label>
                  <Input
                    placeholder="Office_WiFi"
                    value={newCamera.wifiSsid}
                    onChange={e => setNewCamera({...newCamera, wifiSsid: e.target.value})}
                  />
                </div>

                <div>
                  <label className="mb-2.5 block text-black dark:text-white">Assign to Transformer</label>
                  <SearchableSelect
                    options={transformers}
                    onChange={(val) => setNewCamera({...newCamera, transformerId: val})}
                    value={newCamera.transformerId}
                    placeholder="Select Transformer..."
                  />
                </div>
                <Button size="md" variant="primary" type="submit" className="w-full">Save Camera</Button>
              </form>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">Existing Cameras</h4>
                <div className="max-h-60 overflow-y-auto border rounded p-2">
                  {simCameras.map(c => (
                    <div key={c.id} className="p-2 border-b last:border-0">
                      {c.name} ({c.ipAddress})
                    </div>
                  ))}
                </div>
              </div>
            </ComponentCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationPage;
