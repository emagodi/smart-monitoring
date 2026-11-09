import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from './api';
import { unregisterPush } from './push';
import { storage } from './storage';
import type { Depot, User } from './types';

type AuthState = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
  isPartner: boolean;
  depotName: (id?: number | null) => string | null;
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};

type LoginResponse = {
  id?: number;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  userType?: string;
  region?: string;
  district?: string;
  depot?: string;
  depot_id?: number | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  roles?: string[];
  permissions?: string[];
  access_token?: string;
  refresh_token?: string;
};

const ADMIN = ['ADMIN', 'ADMINISTRATOR', 'SUPERADMIN', 'SUPER_ADMIN'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [depots, setDepots] = useState<Record<number, string>>({});
  const [serverUrl, setServer] = useState(api.defaultUrl);

  const clear = useCallback(async () => {
    api.setSession({ token: null, refresh: null });
    await Promise.all([storage.set('tias.token', null), storage.set('tias.refresh', null), storage.set('tias.user', null)]);
    setUser(null);
  }, []);

  // Restore the last session on start.
  useEffect(() => {
    api.onSignedOut(() => void clear());
    (async () => {
      const [url, token, refresh, raw] = await Promise.all([
        storage.get('tias.server'),
        storage.get('tias.token'),
        storage.get('tias.refresh'),
        storage.get('tias.user'),
      ]);
      if (url) {
        api.setBaseUrl(url);
        setServer(api.baseUrl);
      }
      if (token && raw) {
        try {
          api.setSession({ token, refresh });
          setUser(JSON.parse(raw) as User);
        } catch {
          await clear();
        }
      }
      setReady(true);
    })();
  }, [clear]);

  // Depot names for list rows (ids come from the transformer registry).
  useEffect(() => {
    if (!user) return;
    api
      .get<Depot[] | { content: Depot[] }>('/api/v1/depots')
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.content ?? [];
        setDepots(Object.fromEntries(list.map((x) => [x.id, x.name])));
      })
      .catch(() => undefined);
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const d = await api.post<LoginResponse>('/api/v1/auth/authenticate', { email: email.trim(), password });
    if (!d?.access_token) throw new Error('Sign-in failed. Check your e-mail and password.');
    const u: User = {
      id: d.id ?? 0,
      email: d.email ?? email.trim(),
      firstName: d.firstname ?? '',
      lastName: d.lastname ?? '',
      phone: d.phone,
      userType: d.userType,
      region: d.region,
      district: d.district,
      depot: d.depot,
      depotId: d.depot_id ?? null,
      supplierCode: d.supplier_code || null,
      supplierName: d.supplier_name || null,
      roles: d.roles ?? [],
      permissions: d.permissions ?? [],
    };
    api.setSession({ token: d.access_token, refresh: d.refresh_token ?? null });
    await Promise.all([
      storage.set('tias.token', d.access_token),
      storage.set('tias.refresh', d.refresh_token ?? null),
      storage.set('tias.user', JSON.stringify(u)),
    ]);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => undefined);
    api.post('/api/v1/auth/logout').catch(() => undefined);
    await clear();
  }, [clear]);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.roles.some((r) => ADMIN.includes(String(r).toUpperCase().replace(/^ROLE[_-]/, '')))) return true;
      const p = permission.toLowerCase();
      return user.permissions.some((x) => String(x).toLowerCase() === p);
    },
    [user]
  );

  const setServerUrl = useCallback(async (url: string) => {
    api.setBaseUrl(url);
    setServer(api.baseUrl);
    await storage.set('tias.server', api.baseUrl === api.defaultUrl ? null : api.baseUrl);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      signIn,
      signOut,
      can,
      isPartner: !!user?.supplierCode,
      depotName: (id) => (id != null ? depots[id] ?? null : null),
      serverUrl,
      setServerUrl,
    }),
    [ready, user, signIn, signOut, can, depots, serverUrl, setServerUrl]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
