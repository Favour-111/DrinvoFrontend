import { useCallback, useEffect, useState } from 'react';
import { getLocalProducts, refreshCatalog } from '../offline/catalogSync.js';

/**
 * The staff product catalog, served from IndexedDB first so it renders instantly (even offline
 * or on a cold cache from a prior session), then reconciled with the server in the background.
 * Search/filtering happens against `items` in the caller — no network round trip per keystroke.
 */
export function useLocalProducts(shopId) {
  const [items, setItems] = useState(null); // null = nothing cached yet
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!shopId) return;
    try {
      const rows = await refreshCatalog(shopId);
      setItems(rows);
      setError(null);
    } catch (err) {
      // Offline or the request failed: keep showing whatever's already cached.
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    let alive = true;
    setLoading(true);
    getLocalProducts(shopId)
      .then((rows) => {
        if (!alive) return;
        if (rows.length) {
          setItems(rows);
          setLoading(false);
        }
      })
      .finally(() => {
        if (alive) reload(); // always reconcile with the server in the background
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  return { items, error, loading: loading && !items, reload, setItems };
}
