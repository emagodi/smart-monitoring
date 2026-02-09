import api from './api';

const getSensorsByTransformer = async (transformerId) => {
    const response = await api.get(`/api/v1/sensors/transformer/${transformerId}`);
    return response.data;
};

const getSensorById = async (id) => {
    const response = await api.get(`/api/v1/sensors/${id}`);
    return response.data;
};

export default {
    getSensorsByTransformer,
    getSensorById
};
