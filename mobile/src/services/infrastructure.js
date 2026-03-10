import api from './api';

// Region Services
const getAllRegions = async (page = 0, size = 10, search = '') => {
    let url = `/api/v1/regions?page=${page}&size=${size}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get(url);
    return response.data;
};

const createRegion = async (data) => {
    const response = await api.post('/api/v1/regions/create', data);
    return response.data;
};

const updateRegion = async (id, data) => {
    const response = await api.put(`/api/v1/regions/${id}`, data);
    return response.data;
};

const deleteRegion = async (id) => {
    const response = await api.delete(`/api/v1/regions/${id}`);
    return response.data;
};

// District Services
const getAllDistricts = async (page = 0, size = 10, search = '') => {
    let url = `/api/v1/districts?page=${page}&size=${size}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get(url);
    return response.data;
};

const getDistrictsByRegion = async (regionId) => {
    const response = await api.get(`/api/v1/districts/region/${regionId}`);
    return response.data;
};

const createDistrict = async (data) => {
    const response = await api.post('/api/v1/districts/create', data);
    return response.data;
};

const updateDistrict = async (id, data) => {
    const response = await api.put(`/api/v1/districts/${id}`, data);
    return response.data;
};

const deleteDistrict = async (id) => {
    const response = await api.delete(`/api/v1/districts/${id}`);
    return response.data;
};

// Depot Services
const getAllDepots = async (page = 0, size = 10, search = '') => {
    let url = `/api/v1/depots?page=${page}&size=${size}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await api.get(url);
    return response.data;
};

const getDepotsByDistrict = async (districtId) => {
    const response = await api.get(`/api/v1/depots/district/${districtId}`);
    return response.data;
};

const createDepot = async (data) => {
    const response = await api.post('/api/v1/depots/create', data);
    return response.data;
};

const updateDepot = async (id, data) => {
    const response = await api.put(`/api/v1/depots/${id}`, data);
    return response.data;
};

const deleteDepot = async (id) => {
    const response = await api.delete(`/api/v1/depots/${id}`);
    return response.data;
};

export default {
    getAllRegions,
    createRegion,
    updateRegion,
    deleteRegion,
    getAllDistricts,
    getDistrictsByRegion,
    createDistrict,
    updateDistrict,
    deleteDistrict,
    getAllDepots,
    getDepotsByDistrict,
    createDepot,
    updateDepot,
    deleteDepot
};
