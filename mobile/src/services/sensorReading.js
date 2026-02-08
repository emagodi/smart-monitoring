import api from './api';

const createReading = async (readingData) => {
    const response = await api.post('/transformer/api/v1/sensor-readings/create', readingData);
    return response.data;
};

export default {
    createReading
};
