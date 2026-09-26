import { openDB } from 'idb';

/*
 * The staff app's local database. MongoDB is always the source of truth —
 * this is a fast cache of the catalog plus a durable queue of sales made
 * while offline or on a slow connection, so a sale is never lost and staff
 * never has to wait on the network to see "Sale completed".
 *
 * Scoped per shop (db name includes shopId) so switching shops never shows
 * stale stock or lets a queued sale sync against the wrong shop.
 */
const VERSION = 1;
const opened = new Map();

export function dbNameFor(shopId) {
  return `drinvo-offline-${shopId}`;
}

export function openStaffDB(shopId) {
  if (!shopId) throw new Error('openStaffDB requires a shopId');
  if (opened.has(shopId)) return opened.get(shopId);
  const promise = openDB(dbNameFor(shopId), VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'variantId' });
      if (!db.objectStoreNames.contains('localSales')) {
        const sales = db.createObjectStore('localSales', { keyPath: 'localId' });
        sales.createIndex('status', 'status');
        sales.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queue = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queue.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  opened.set(shopId, promise);
  return promise;
}

/** Closes and forgets a shop's DB handle (used on sign-out so a new session opens fresh). */
export function closeStaffDB(shopId) {
  const promise = opened.get(shopId);
  if (!promise) return;
  opened.delete(shopId);
  promise.then((db) => db.close()).catch(() => {});
}

export async function getMeta(shopId, key) {
  const db = await openStaffDB(shopId);
  const row = await db.get('meta', key);
  return row?.value;
}

export async function setMeta(shopId, key, value) {
  const db = await openStaffDB(shopId);
  await db.put('meta', { key, value });
}
