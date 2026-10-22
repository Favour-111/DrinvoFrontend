/** Unit helpers. Must match server/src/utils/units.js. */
export const UNITS = ['bottle', 'pack', 'carton', 'crate'];
export const UNIT_LABEL = { bottle: 'Bottle', pack: 'Pack', carton: 'Carton', crate: 'Crate' };

export const conversionFor = (v, unit) => (unit === 'bottle' ? 1 : Number(v?.unitConversions?.[unit]) || 0);
export const availableUnits = (v) => UNITS.filter((u) => conversionFor(v, u) > 0);
export const bigUnit = (v) => ['carton', 'crate', 'pack'].find((u) => conversionFor(v, u) > 0) || 'bottle';

export function priceFor(v, unit) {
  const c = conversionFor(v, unit);
  if (!c) return 0;
  if (unit === 'bottle') return v.sellingPrice;
  const own = Number(v.unitPrices?.[unit]);
  return own > 0 ? own : v.sellingPrice * c;
}

/** Lowest allowed selling price for one `unit`, scaled the same way as priceFor. 0 means no floor. */
export function minimumFor(v, unit) {
  const c = conversionFor(v, unit);
  if (!c) return 0;
  return (Number(v?.minimumSellingPrice) || 0) * c;
}

const plural = (n, w) => `${Math.round(n).toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
export const unitQty = (qty, unit) => plural(qty, unit);

/** True for products set up as miniatures (stock rows and products both carry the flag). */
export const isMiniature = (v) => v?.packagingType === 'MINIATURE' || v?.isMiniature === true;

/** Purchase cost for one `unit`: the saved pack/carton cost if set, else bottle cost x bottles in the unit. */
export function costFor(v, unit) {
  const c = conversionFor(v, unit);
  if (!c) return 0;
  if (unit === 'bottle') return Number(v.costPrice) || 0;
  const own = Number(v.unitCosts?.[unit]);
  return own > 0 ? own : Math.round((Number(v.costPrice) || 0) * c * 100) / 100;
}

/** { carton, pack, bottle } whole units for a bottle count: cartons first, then packs, then loose bottles. */
export function breakdownStock(v, bottles = v?.quantity ?? 0) {
  let rest = Math.max(0, Math.floor(bottles));
  const out = { carton: 0, pack: 0, bottle: 0 };
  for (const u of ['carton', 'pack']) {
    const c = conversionFor(v, u);
    if (!c) continue;
    out[u] = Math.floor(rest / c);
    rest -= out[u] * c;
  }
  out.bottle = rest;
  return out;
}

/** "5 cartons + 12 bottles"; miniatures list every level: "4 cartons + 9 packs + 2 bottles". */
export function describeStock(v, bottles = v?.quantity ?? 0) {
  if (isMiniature(v)) {
    const b = breakdownStock(v, bottles);
    const parts = ['carton', 'pack', 'bottle'].filter((u) => b[u] > 0).map((u) => plural(b[u], u));
    return parts.length ? parts.join(' + ') : plural(0, 'bottle');
  }
  const u = bigUnit(v);
  if (u === 'bottle' || bottles === 0) return plural(bottles, 'bottle');
  const c = conversionFor(v, u);
  const q = Math.floor(bottles / c);
  const r = bottles % c;
  if (q === 0) return plural(r, 'bottle');
  return plural(q, u) + (r ? ` + ${plural(r, 'bottle')}` : '');
}

/** Whole units plus leftover bottles, e.g. { whole: 5, rest: 12 } */
export function equivalent(v, unit, bottles = v.quantity) {
  const c = conversionFor(v, unit);
  if (!c) return null;
  return { whole: Math.floor(bottles / c), rest: bottles % c };
}

/** Replaces matching rows (by variantId) with live updates from the stock socket; leaves the rest untouched. */
export function mergeStockRows(rows, updates) {
  if (!rows?.length || !updates?.length) return rows;
  const byId = new Map(updates.map((u) => [u.variantId, u]));
  let changed = false;
  const next = rows.map((r) => {
    const u = byId.get(r.variantId);
    if (!u) return r;
    changed = true;
    return { ...r, ...u };
  });
  return changed ? next : rows;
}

/** Miniature-only stock totals (a subset of the overall totals, never added on top of them). */
export function summarizeMiniature(rows) {
  const mini = rows.filter((r) => isMiniature(r) && r.status !== 'archived');
  return {
    variantCount: mini.length,
    totalBottles: mini.reduce((s, r) => s + r.quantity, 0),
    cartons: mini.reduce((s, r) => s + breakdownStock(r).carton, 0),
    packs: mini.reduce((s, r) => s + breakdownStock(r).pack, 0),
    looseBottles: mini.reduce((s, r) => s + breakdownStock(r).bottle, 0),
    lowStock: mini.filter((r) => r.status === 'low').length,
    outOfStock: mini.filter((r) => r.status === 'out').length,
    inventoryValue: Math.round(mini.reduce((s, r) => s + (r.inventoryValue || 0), 0) * 100) / 100,
  };
}

/** Recomputes the inventory summary card totals from a full (unfiltered) row set. */
export function summarizeStock(rows) {
  const live = rows.filter((r) => r.status !== 'archived');
  return {
    variantCount: live.length,
    productCount: new Set(live.map((r) => r.productId)).size,
    totalBottles: live.reduce((s, r) => s + r.quantity, 0),
    lowStock: live.filter((r) => r.status === 'low').length,
    outOfStock: live.filter((r) => r.status === 'out').length,
    inventoryValue: Math.round(live.reduce((s, r) => s + r.inventoryValue, 0) * 100) / 100,
    miniature: summarizeMiniature(live),
  };
}

export const STOCK_STATUS = {
  in: { tone: 'ok', label: 'In stock' },
  low: { tone: 'warn', label: 'Low stock' },
  out: { tone: 'bad', label: 'Out of stock' },
  archived: { tone: 'neutral', label: 'Archived' },
};
