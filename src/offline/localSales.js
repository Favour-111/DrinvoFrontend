import { openStaffDB } from './db.js';

export async function getLocalSale(shopId, localId) {
  const db = await openStaffDB(shopId);
  return db.get('localSales', localId);
}

/** Newest first — for the staff sales-history screen, which renders straight from this cache. */
export async function listLocalSales(shopId) {
  const db = await openStaffDB(shopId);
  const rows = await db.getAll('localSales');
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
