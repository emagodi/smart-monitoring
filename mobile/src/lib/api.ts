import Constants from 'expo-constants';

import { storage } from './storage';

const DEFAULT_URL = String((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || 'http://154.73.80.22');

type Session = { token: string | null; refresh: string | null };

let baseUrl = DEFAULT_URL;
let session: Session = { token: null, refresh: null };
let onSignedOut: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const api = {
  defaultUrl: DEFAULT_URL,
  get baseUrl() {
    return baseUrl;
  },
  setBaseUrl(url: string) {
    baseUrl = (url || DEFAULT_URL).trim().replace(/\/+$/, '');
  },
  setSession(s: Session) {
    session = s;
  },
  onSignedOut(fn: () => void) {
    onSignedOut = fn;
  },
  get: <T>(path: string, query?: Record<string, string | number | boolean | null | undefined>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | null | undefined>) => request<T>('POST', path, body ?? {}, query),
};

function qs(query?: Record<string, string | number | boolean | null | undefined>) {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | null | undefined>, retried = false): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}${qs(query)}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the TIAS server. Check your data connection.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && session.token && !retried && !path.startsWith('/api/v1/auth/')) {
    if (await refreshToken()) return request<T>(method, path, body, query, true);
    onSignedOut?.();
    throw new ApiError(401, 'Your session has ended. Please sign in again.');
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
  return data as T;
}

function errorMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const m = d.message || d.error_description || d.detail || d.error;
    if (typeof m === 'string' && m.trim() && !/^(Forbidden|Bad Request|Internal Server Error|Not Found)$/i.test(m)) return m;
  } else if (typeof data === 'string' && data.trim() && data.length < 200 && !data.trim().startsWith('<')) {
    return data;
  }
  if (status === 403) return 'You do not have permission to do this.';
  if (status === 404) return 'Not found. It may have been removed.';
  if (status === 409) return 'This was already updated by someone else. Refresh and try again.';
  if (status >= 500) return 'The server had a problem. Try again in a moment.';
  return 'Something went wrong. Please try again.';
}

/** Swap the refresh token for a new access token (one attempt shared by all calls that got 401). */
async function refreshToken(): Promise<boolean> {
  if (!session.refresh) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: session.refresh }),
        });
        if (!res.ok) return false;
        const d = (await res.json()) as { access_token?: string; refresh_token?: string };
        if (!d.access_token) return false;
        session = { token: d.access_token, refresh: d.refresh_token || session.refresh };
        await storage.set('tias.token', session.token);
        await storage.set('tias.refresh', session.refresh);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export const errorText = (e: unknown, fallback = 'Something went wrong.') => (e instanceof Error && e.message ? e.message : fallback);
