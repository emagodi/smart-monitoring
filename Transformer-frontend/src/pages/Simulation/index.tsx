import React, { useState, useEffect } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import Select from '../../components/form/Select';
import FileInput from '../../components/form/input/FileInput';
import Button from '../../components/ui/button/Button';
import { SearchableSelect } from '../../components/ui/select/SearchableSelect';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ComponentCard from '../../components/common/ComponentCard';

const SimulationPage = () => {
  const { token } = useAuth();
  const [di1, setDi1] = useState<string>("false");
  const [di2, setDi2] = useState<string>("false");
  const [transformerId, setTransformerId] = useState<number | string>("");
  const [file, setFile] = useState<File | null>(null);
  const [transformers, setTransformers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch transformers on mount
  useEffect(() => {
    const fetchTransformers = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/v1/transformers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rawData = response.data as any;
        const list = Array.isArray(rawData) ? rawData : (rawData.content || []);
        setTransformers(list.map((t: any) => ({ id: t.id, name: t.name })));
        
        // Pre-select "New Parliament" if found
        const newParliament = list.find((t: any) => t.name.toLowerCase().includes("parliament"));
        if (newParliament) {
            setTransformerId(newParliament.id);
        }
      } catch (error) {
        console.error("Failed to fetch transformers", error);
      }
    };
    fetchTransformers();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    formData.append('di1', di1);
    formData.append('di2', di2);
    if (file) {
      formData.append('file', file);
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/v1/simulation`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage({ type: 'success', text: "Simulation executed successfully. Alert logic triggered." });
    } catch (error: any) {
      console.error("Simulation failed", error);
      setMessage({ type: 'error', text: error.response?.data?.message || "Simulation failed." });
    } finally {
      setLoading(false);
    }
  };

  const booleanOptions = [
    { value: "true", label: "True" },
    { value: "false", label: "False" },
  ];

  return (
    <div>
      <PageBreadcrumb pageTitle="Simulation" />
      
      <div className="flex justify-center">
        <div className="flex flex-col gap-9 w-full max-w-2xl">
          <ComponentCard title="Simulation Controls">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Select Transformer
                  </label>
                  <div className="relative z-20 bg-transparent dark:bg-form-input">
                    <SearchableSelect
                        options={transformers}
                        value={transformerId}
                        onChange={(val) => setTransformerId(val)}
                        placeholder="Select Transformer"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    DI1 (Digital Input 1)
                  </label>
                  <div className="relative z-20 bg-transparent dark:bg-form-input">
                    <Select
                      options={booleanOptions}
                      defaultValue="false"
                      onChange={setDi1}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    DI2 (Digital Input 2)
                  </label>
                  <div className="relative z-20 bg-transparent dark:bg-form-input">
                    <Select
                      options={booleanOptions}
                      defaultValue="false"
                      onChange={setDi2}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Upload Camera Image (Optional)
                  </label>
                  <FileInput onChange={handleFileChange} />
                  <p className="mt-2 text-sm text-gray-500">
                    Upload an image to simulate camera capture (e.g., person climbing).
                  </p>
                </div>

                {message && (
                  <div className={`p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  isLoading={loading}
                  className="w-full"
                >
                  Run Simulation
                </Button>
              </div>
            </form>
          </ComponentCard>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;
