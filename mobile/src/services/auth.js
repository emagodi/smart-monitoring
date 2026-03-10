import api from './api';
import * as SecureStore from 'expo-secure-store';

const login = async (email, password) => {
    try {
        // Auth service is at /api/v1/auth via gateway
        const response = await api.post('/api/v1/auth/authenticate', { email, password });
        if (response.data.access_token) {
            await SecureStore.setItemAsync('token', response.data.access_token);
            await SecureStore.setItemAsync('user', JSON.stringify(response.data.user || {}));
        }
        return response.data;
    } catch (error) {
        throw error;
    }
};

const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
};

const getToken = async () => {
    return await SecureStore.getItemAsync('token');
};

const getUser = async () => {
    const user = await SecureStore.getItemAsync('user');
    return user ? JSON.parse(user) : null;
};

export default {
    login,
    logout,
    getToken,
    getUser
};
