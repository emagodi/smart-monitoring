import api from './api';

const getAllSensors = async (page = 0, size = 1000) => {
    const response = await api.get(`/api/v1/sensors?page=${page}&size=${size}`);
    return response.data;
};

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

const getReadingsBySensor = async (id, startDate = null, endDate = null) => {
    let url = `/api/v1/sensor-readings/sensor/${id}`;
    if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await api.get(url);
    return response.data;
};

export default {
    getAllSensors,
    getSensorsByTransformer,
    getSensorById,
    getUnassignedSensors,
    updateSensor,
    getReadingsBySensor
};
