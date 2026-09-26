import { useCallback, useEffect, useRef, useState } from 'react';
import { session } from '../services/api.js';

/*
 * Stale-while-revalidate cache. Revisiting a page shows the last data at once
 * while fresh data loads in the background. Keyed by the loader's source,
 * its dependencies and the active shop; cleared on sign-in/sign-out.
 */
const cache = new Map();
const MAX_ENTRIES = 80;

export function clearApiCache() {
  cache.clear();
}

function keyFor(fn, deps) {
  try {
    return `${session.getShopId()}|${fn.toString()}|${JSON.stringify(deps)}`;
  } catch {
    return null;
  }
}

/**
 * Loads data from an async function and reloads when `deps` change.
 * Keeps the previous data while reloading so filters don't flash a skeleton.
 */
export function useApi(fn, deps = [], { enabled = true, cache: useCache = true } = {}) {
  const key = useCache ? keyFor(fn, deps) : null;
  const [state, setState] = useState(() => {
    const hit = key && cache.get(key);
    return { data: hit ?? null, loading: enabled, error: null };
  });
  const callId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++callId.current;
    const hit = key && cache.get(key);
    setState((s) => ({ data: hit ?? s.data, loading: true, error: null }));
    try {
      const data = await load();
      if (key) {
        cache.delete(key);
        cache.set(key, data);
        if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
      }
      if (id === callId.current) setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, loading: false, error }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    if (enabled) reload();
  }, [reload, enabled]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);

  return { ...state, reload, setData };
}

export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
