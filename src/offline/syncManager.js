import { openStaffDB } from './db.js';
import { applyInventoryUpdates } from './catalogSync.js';
import { post } from '../services/api.js';

/*
 * Owns all synchronization between the local sale queue and the server.
 * Nothing outside this file talks to IndexedDB's syncQueue/localSales stores
 * or calls POST /sync/sales — components go through the hooks in
 * hooks/offline.js, which subscribe here for live status.
 */

const MAX_BACKOFF_MS = 5 * 60_000;
const backoffMs = (attempts) => Math.min(30_000 * 2 ** attempts, MAX_BACKOFF_MS);

const listeners = new Map(); // shopId -> Set<fn>
const syncing = new Set(); // shopIds currently mid-sync, to avoid overlapping runs

function notify(shopId) {
  for (const fn of listeners.get(shopId) || []) fn();
}

export function subscribeSync(shopId, fn) {
  if (!listeners.has(shopId)) listeners.set(shopId, new Set());
  listeners.get(shopId).add(fn);
  return () => listeners.get(shopId)?.delete(fn);
}

export async function getSyncStatus(shopId) {
  const db = await openStaffDB(shopId);
  const [queue, sales] = await Promise.all([db.getAll('syncQueue'), db.getAll('localSales')]);
  return {
    pending: queue.filter((q) => q.status === 'PENDING').length,
    syncing: queue.filter((q) => q.status === 'SYNCING').length,
    failed: sales.filter((s) => s.syncStatus === 'FAILED').length,
    sales,
  };
}

/** Queues a sale for sync and immediately tries to send it (no-op if offline). */
export async function enqueueSale(shopId, localSale, payload) {
  const db = await openStaffDB(shopId);
  const now = new Date().toISOString();
  await db.put('localSales', localSale);
  await db.put('syncQueue', {
    id: localSale.localId,
    type: 'CREATE_SALE',
    payload,
    status: 'PENDING',
    attempts: 0,
    createdAt: now,
    lastAttemptAt: null,
    nextAttemptAt: now,
    error: null,
  });
  notify(shopId);
  syncNow(shopId); // fire and forget — the UI never waits on this
}

/** Sends every due queue entry for this shop. Safe to call often; it no-ops when there's nothing to do. */
export async function syncNow(shopId) {
  if (!shopId || syncing.has(shopId) || !navigator.onLine) return;
  const db = await openStaffDB(shopId);
  const all = await db.getAllFromIndex('syncQueue', 'status', 'PENDING');
  const due = all.filter((q) => !q.nextAttemptAt || q.nextAttemptAt <= new Date().toISOString());
  if (!due.length) return;

  syncing.add(shopId);
  try {
    const tx = db.transaction('syncQueue', 'readwrite');
    for (const q of due) await tx.store.put({ ...q, status: 'SYNCING' });
    await tx.done;
    await markLocalSales(db, due.map((q) => q.id), 'SYNCING');
    notify(shopId);

    let response;
    try {
      response = await post('/sync/sales', { sales: due.map((q) => q.payload) });
    } catch (err) {
      // Network/server failure: the whole batch stays queued, retried with backoff.
      const retryTx = db.transaction('syncQueue', 'readwrite');
      const now = new Date().toISOString();
      for (const q of due) {
        const attempts = q.attempts + 1;
        await retryTx.store.put({
          ...q,
          status: 'PENDING',
          attempts,
          lastAttemptAt: now,
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
          error: err.message,
        });
      }
      await retryTx.done;
      await markLocalSales(db, due.map((q) => q.id), 'PENDING');
      notify(shopId);
      return;
    }

    const successIds = new Set();
    for (const s of response.successful || []) {
      successIds.add(s.clientTransactionId);
      const sale = await db.get('localSales', s.clientTransactionId);
      if (sale) {
        await db.put('localSales', { ...sale, syncStatus: 'SYNCED', receiptNumber: s.receiptNumber, serverSaleId: s.serverTransactionId, error: null });
      }
      await db.delete('syncQueue', s.clientTransactionId);
      await applyInventoryUpdates(shopId, s.inventoryUpdates);
    }
    for (const f of response.failed || []) {
      successIds.add(f.id);
      const sale = await db.get('localSales', f.id);
      if (sale) await db.put('localSales', { ...sale, syncStatus: 'FAILED', error: f.reason });
      // Terminal: a business rejection (e.g. insufficient stock) won't succeed on retry, so it
      // comes out of the active queue but stays visible in sales history for staff/admin to review.
      await db.delete('syncQueue', f.id);
    }
    // Anything we sent but the server didn't mention (shouldn't normally happen) goes back to pending.
    const missing = due.filter((q) => !successIds.has(q.id));
    if (missing.length) {
      const missTx = db.transaction('syncQueue', 'readwrite');
      for (const q of missing) await missTx.store.put({ ...q, status: 'PENDING' });
      await missTx.done;
    }
    notify(shopId);
  } finally {
    syncing.delete(shopId);
  }
}

async function markLocalSales(db, localIds, syncStatus) {
  const tx = db.transaction('localSales', 'readwrite');
  for (const id of localIds) {
    const sale = await tx.store.get(id);
    if (sale) await tx.store.put({ ...sale, syncStatus });
  }
  await tx.done;
}

let heartbeat = null;
/** Starts background retry checks + online/offline listeners for one shop. Call once per session. */
export function startSyncLoop(shopId) {
  syncNow(shopId);
  const onOnline = () => syncNow(shopId);
  window.addEventListener('online', onOnline);
  clearInterval(heartbeat);
  heartbeat = setInterval(() => syncNow(shopId), 20_000);
  return () => {
    window.removeEventListener('online', onOnline);
    clearInterval(heartbeat);
    heartbeat = null;
  };
}
