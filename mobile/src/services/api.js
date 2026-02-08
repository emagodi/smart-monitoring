import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import config from '../config';

const api = axios.create({
    baseURL: config.API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    async (config) => {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            // Handle token expiration - maybe redirect to login
            await SecureStore.deleteItemAsync('token');
        }
        return Promise.reject(error);
    }
);

export default api;
