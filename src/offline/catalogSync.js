import { openStaffDB, setMeta } from './db.js';
import { productService } from '../services/index.js';

/** Reads every cached product for this shop (instant — no network). */
export async function getLocalProducts(shopId) {
  const db = await openStaffDB(shopId);
  return db.getAll('products');
}

/**
 * Refreshes the local catalog from the server. Cheap enough for a full
 * replace each time (a shop's catalog is tens to a few hundred rows, not
 * thousands), which also naturally drops archived/deleted variants —
 * anything the server no longer lists just isn't written back.
 */
export async function refreshCatalog(shopId) {
  const { items } = await productService.list();
  const db = await openStaffDB(shopId);
  const tx = db.transaction('products', 'readwrite');
  await tx.store.clear();
  await Promise.all(items.map((p) => tx.store.put(p)));
  await tx.done;
  await setMeta(shopId, 'lastCatalogSync', Date.now());
  return items;
}

/** Applies the authoritative post-sale quantities the server returns after a sync. */
export async function applyInventoryUpdates(shopId, updates) {
  if (!updates?.length) return;
  const db = await openStaffDB(shopId);
  const tx = db.transaction('products', 'readwrite');
  for (const u of updates) {
    const row = await tx.store.get(u.productVariantId);
    if (row) {
      row.quantity = u.quantity;
      row.status = u.quantity <= 0 ? 'out' : row.lowStockThreshold && u.quantity <= row.lowStockThreshold ? 'low' : 'in';
      await tx.store.put(row);
    }
  }
  await tx.done;
}

/** Merges live WebSocket stock pushes into the local cache, so it stays fresh while online. */
export async function patchLocalProducts(shopId, rows) {
  if (!rows?.length) return;
  const db = await openStaffDB(shopId);
  const tx = db.transaction('products', 'readwrite');
  for (const row of rows) {
    const existing = await tx.store.get(row.variantId);
    await tx.store.put({ ...existing, ...row });
  }
  await tx.done;
}

/** Optimistic local stock deduction so the UI reflects a sale before the server confirms it. */
export async function deductLocalStock(shopId, lines) {
  const db = await openStaffDB(shopId);
  const tx = db.transaction('products', 'readwrite');
  for (const line of lines) {
    const row = await tx.store.get(line.variantId);
    if (row) {
      row.quantity = Math.max(0, row.quantity - line.baseQuantity);
      row.status = row.quantity <= 0 ? 'out' : row.lowStockThreshold && row.quantity <= row.lowStockThreshold ? 'low' : 'in';
      await tx.store.put(row);
    }
  }
  await tx.done;
}
