import api from './api';

const getAllCameras = async () => {
    const response = await api.get('/api/v1/cameras');
    return response.data;
};

const getCameraById = async (id) => {
    const response = await api.get(`/api/v1/cameras/${id}`);
    return response.data;
};

const getByTransformerId = async (transformerId) => {
    const response = await api.get(`/api/v1/cameras/transformer/${transformerId}`);
    return response.data;
};

const registerCamera = async (data) => {
    const response = await api.post('/api/v1/cameras/register', data);
    return response.data;
};

const updateCamera = async (id, data) => {
    const response = await api.put(`/api/v1/cameras/${id}`, data);
    return response.data;
};

const deleteCamera = async (id) => {
    const response = await api.delete(`/api/v1/cameras/${id}`);
    return response.data;
};

export default {
    getAllCameras,
    getCameraById,
    getByTransformerId,
    registerCamera,
    updateCamera,
    deleteCamera
};
