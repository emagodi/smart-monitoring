import api from './api';

const getAllTransformers = async () => {
    const response = await api.get('/api/v1/transformers');
    return response.data;
};

const getTransformersByDepot = async (depotId) => {
    const response = await api.get(`/api/v1/transformers/depot/${depotId}`);
    return response.data;
};

const updateTransformer = async (id, data) => {
    const response = await api.put(`/api/v1/transformers/${id}`, data);
    return response.data;
};

const getTransformerById = async (id) => {
    const response = await api.get(`/api/v1/transformers/${id}`);
    return response.data;
};

export default {
    getAllTransformers,
    getTransformersByDepot,
    updateTransformer,
    getTransformerById
};
