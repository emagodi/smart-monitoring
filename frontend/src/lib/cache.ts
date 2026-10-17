import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

/**
 * Small stale-while-revalidate cache for GET requests.
 *
 * - A page that was visited before renders instantly from memory, then refreshes in the background.
 * - Identical requests made at the same time (two widgets asking for the same list) share one call.
 * - Entries live for the browser session only and are keyed by URL and the signed-in token.
 */
type Entry = { data: unknown; at: number; promise?: Promise<unknown> };

const store = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

const keyOf = (url: string, token?: string | null) => `${token ? token.slice(-16) : "anon"}|${url}`;

const notify = (key: string) => listeners.get(key)?.forEach((fn) => fn());

export function cachedGet<T>(url: string, token?: string | null, maxAgeMs = 30_000, force = false): Promise<T> {
  const key = keyOf(url, token);
  const hit = store.get(key);
  if (hit?.promise) return hit.promise as Promise<T>;
  if (!force && hit && Date.now() - hit.at < maxAgeMs) return Promise.resolve(hit.data as T);
  const load = async () => {
    try {
      const res = (await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })) as { data: unknown };
      store.set(key, { data: res.data, at: Date.now() });
      notify(key);
      return res.data as T;
    } catch (err) {
      if (hit && hit.data !== undefined) store.set(key, { data: hit.data, at: hit.at });
      else store.delete(key);
      throw err;
    }
  };
  const promise: Promise<T> = load();
  store.set(key, { data: hit?.data, at: hit?.at ?? 0, promise });
  return promise as Promise<T>;
}

export const peekCache = <T,>(url: string, token?: string | null) => store.get(keyOf(url, token))?.data as T | undefined;

/** Forget cached responses whose URL contains the fragment (call after a create / update / delete). */
export function invalidateCache(fragment: string) {
  for (const key of Array.from(store.keys())) {
    if (key.includes(fragment)) store.delete(key);
  }
}

export type CachedState<T> = {
  data: T | undefined;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * React hook over cachedGet. Pass url = null to wait (lazy loading): nothing is fetched until a URL is given.
 */
export function useCachedGet<T>(url: string | null, token?: string | null, opts?: { maxAgeMs?: number; errorText?: string; refreshMs?: number }): CachedState<T> {
  const maxAgeMs = opts?.maxAgeMs ?? 30_000;
  const errorText = opts?.errorText ?? "Could not load this data.";
  const [data, setData] = useState<T | undefined>(() => (url ? peekCache<T>(url, token) : undefined));
  const [loading, setLoading] = useState<boolean>(() => Boolean(url) && peekCache(url ?? "", token) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (force: boolean) => {
      if (!url) return;
      const cached = peekCache<T>(url, token);
      if (cached !== undefined) {
        setData(cached);
        setLoading(false);
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const fresh = await cachedGet<T>(url, token, force ? 0 : maxAgeMs, force);
        if (!alive.current) return;
        setData(fresh);
        setError(null);
      } catch {
        if (alive.current) setError(errorText);
      } finally {
        if (alive.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [errorText, maxAgeMs, token, url]
  );

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const key = keyOf(url, token);
    const fn = () => {
      const v = store.get(key);
      if (v && !v.promise && alive.current) setData(v.data as T);
    };
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(fn);
    void run(false);
    return () => {
      listeners.get(key)?.delete(fn);
    };
  }, [run, token, url]);

  useEffect(() => {
    if (!url || !opts?.refreshMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void run(true);
    }, opts.refreshMs);
    return () => window.clearInterval(id);
  }, [opts?.refreshMs, run, url]);

  const reload = useCallback(() => run(true), [run]);
  return { data, loading, refreshing, error, reload };
}

/** True once the element has scrolled near the viewport. Use it to defer heavy sections. */
export function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}
