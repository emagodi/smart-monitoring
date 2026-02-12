import api from './api';

const getSensorsByTransformer = async (transformerId) => {
    const response = await api.get(`/api/v1/sensors/transformer/${transformerId}`);
    return response.data;
};

const getSensorById = async (id) => {
    const response = await api.get(`/api/v1/sensors/${id}`);
    return response.data;
};

const getUnassignedSensors = async () => {
    const response = await api.get('/api/v1/sensors/unassigned');
    return response.data;
};

const updateSensor = async (id, data) => {
    const response = await api.put(`/api/v1/sensors/${id}`, data);
    return response.data;
};

export default {
    getSensorsByTransformer,
    getSensorById,
    getUnassignedSensors,
    updateSensor
};
