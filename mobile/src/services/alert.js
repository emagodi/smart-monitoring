import api from './api';

const getAllAlerts = async () => {
    const response = await api.get('/transformer/api/v1/alerts');
    return response.data;
};

const getAlertsBySensor = async (sensorId) => {
    const response = await api.get(`/transformer/api/v1/alerts/sensor/${sensorId}`);
    return response.data;
};

export default {
    getAllAlerts,
    getAlertsBySensor
};
