import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { errorText } from './api';

/**
 * Loads data when the screen opens or regains focus, on pull-to-refresh, and every `intervalMs` while the
 * screen is visible and the app is in the foreground. Keeps the last good data if a refresh fails.
 */
export function useData<T>(load: () => Promise<T>, deps: unknown[], intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const focused = useRef(false);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(load, deps);

  const run = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      const id = ++seq.current;
      if (mode === 'refresh') setRefreshing(true);
      try {
        const d = await loader();
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (id !== seq.current) return;
        setError(errorText(e));
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loader]
  );

  useEffect(() => {
    setLoading(true);
    void run('initial');
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      if (focused.current) void run('silent');
      focused.current = true;
      if (!intervalMs) return undefined;
      const t = setInterval(() => {
        if (AppState.currentState === 'active') void run('silent');
      }, intervalMs);
      return () => clearInterval(t);
    }, [run, intervalMs])
  );

  return { data, setData, error, loading, refreshing, reload: () => run('refresh'), silentReload: () => run('silent') };
}
