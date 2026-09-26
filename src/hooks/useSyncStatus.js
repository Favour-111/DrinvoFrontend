import { useCallback, useEffect, useState } from 'react';
import { getSyncStatus, subscribeSync, syncNow, startSyncLoop } from '../offline/syncManager.js';

/** Live counts of queued/failed local sales for the active shop, plus a manual retry trigger. */
export function useSyncStatus(shopId) {
  const [status, setStatus] = useState({ pending: 0, syncing: 0, failed: 0, sales: [] });

  const refresh = useCallback(() => {
    if (!shopId) return;
    getSyncStatus(shopId).then(setStatus).catch(() => {});
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return undefined;
    refresh();
    const unsubscribe = subscribeSync(shopId, refresh);
    const stopLoop = startSyncLoop(shopId);
    return () => {
      unsubscribe();
      stopLoop();
    };
  }, [shopId, refresh]);

  return { ...status, retry: () => syncNow(shopId) };
}
