import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, remember?: boolean) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (updatedData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token') || sessionStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const expiryTimer = useRef<number | null>(null);

  const parseJwt = (t: string) => {
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  const scheduleExpiryLogout = (tkn: string | null) => {
    if (expiryTimer.current) {
      window.clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    if (!tkn) return;
    const payload = parseJwt(tkn);
    if (payload && payload.exp) {
      const now = Date.now();
      const expMs = payload.exp * 1000;
      const delay = Math.max(expMs - now - 5000, 0);
      expiryTimer.current = window.setTimeout(() => {
        logout();
      }, delay);
    }
  };

  const login = async (username: string, password: string, remember: boolean = true): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const tokenValue: string | null = data?.access_token || data?.access || data?.accessToken || data?.token || null;
        const refreshToken: string | null = data?.refresh_token || null;
        const storage = remember ? localStorage : sessionStorage;
        if (tokenValue) storage.setItem('token', tokenValue);
        if (refreshToken) storage.setItem('refresh_token', refreshToken);

        const userInfo: User = {
          id: data?.id ?? 0,
          username: data?.email ?? username,
          email: data?.email ?? '',
          first_name: data?.firstname ?? data?.first_name ?? '',
          last_name: data?.lastname ?? data?.last_name ?? '',
          phone: data?.phone ?? '',
        };
        storage.setItem('user', JSON.stringify(userInfo));

        setToken(tokenValue);
        setUser(userInfo);
        if (tokenValue) scheduleExpiryLogout(tokenValue);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    // Clear stored data
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch {}

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('refresh_token');

    setToken(null);
    setUser(null);
    if (expiryTimer.current) {
      window.clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  };

  const isAuthenticated = !!token;

  // Attach axios interceptors for auth and handle 401
  useEffect(() => {
    const reqId = axios.interceptors.request.use((config) => {
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });
    const resId = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error?.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.request.eject(reqId);
      axios.interceptors.response.eject(resId);
    };
  }, [token]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const mergedInit: RequestInit = { ...(init || {}) };
      const hdrs = new Headers(mergedInit.headers as HeadersInit | undefined);
      if (token && !hdrs.has('Authorization')) {
        hdrs.set('Authorization', `Bearer ${token}`);
      }
      mergedInit.headers = hdrs;
      const res = await originalFetch(input, mergedInit);
      if (res.status === 401 && token && !url.includes('/api/v1/auth/logout')) {
        logout();
      }
      return res;
    };
    window.fetch = wrappedFetch as any;
    return () => {
      window.fetch = originalFetch as any;
    };
  }, [token]);

  // Auto logout on expiry and sync across tabs
  useEffect(() => {
    scheduleExpiryLogout(token);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token' && e.newValue === null) {
        logout();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [token]);

  const updateUser = (updatedData: Partial<User>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedData };
      if (localStorage.getItem('user')) {
        localStorage.setItem('user', JSON.stringify(newUser));
      }
      if (sessionStorage.getItem('user')) {
        sessionStorage.setItem('user', JSON.stringify(newUser));
      }
      return newUser;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
