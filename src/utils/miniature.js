/**
 * Pricing and packaging maths for miniature drinks (bottle / pack / carton). Pure functions, so the
 * product form, its live summary and the tests all share one set of rules.
 *
 * Stock is always kept in bottles. A pack holds `bottlesPerPack` bottles and a carton holds
 * `packsPerCarton` packs, so one carton = bottlesPerPack x packsPerCarton bottles.
 *
 * Prices and costs for the three levels are independent: anything the admin leaves blank is filled in
 * from what they did enter, but anything they type is kept exactly (e.g. a discounted carton price).
 */
const num = (x) => {
  const v = Number(x);
  return Number.isFinite(v) && v > 0 ? v : 0;
};
const whole = (x) => {
  const v = Number(x);
  return Number.isInteger(v) && v >= 1 ? v : 0;
};
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const close = (a, b) => Math.abs(a - b) < 0.011;

export function packagingSummary({ bottlesPerPack, packsPerCarton }) {
  const bpp = whole(bottlesPerPack);
  const ppc = whole(packsPerCarton);
  return { bottlesPerPack: bpp, packsPerCarton: ppc, bottlesPerCarton: bpp * ppc, valid: bpp > 0 && ppc > 0 };
}

/**
 * Fills the blanks for one row of three amounts (bottle, pack, carton).
 * Whatever was typed wins; a missing amount is derived from the nearest typed one.
 */
function fillRow({ bottle, pack, carton }, bpp, ppc, round) {
  const b = num(bottle);
  const p = num(pack);
  const c = num(carton);
  const bpc = bpp * ppc;
  if (!bpp || !ppc) return { bottle: b, pack: p, carton: c };
  return {
    bottle: round(b || (p ? p / bpp : c ? c / bpc : 0)),
    pack: r2(p || (b ? b * bpp : c ? c / ppc : 0)),
    carton: r2(c || (p ? p * ppc : b ? b * bpc : 0)),
  };
}

/** Everything that will be saved for one miniature size, from the raw (possibly partly blank) form values. */
export function resolveMiniature(f) {
  const { bottlesPerPack: bpp, packsPerCarton: ppc, bottlesPerCarton } = packagingSummary(f);
  const price = fillRow({ bottle: f.bottlePrice, pack: f.packPrice, carton: f.cartonPrice }, bpp, ppc, r2);
  const cost = fillRow({ bottle: f.bottleCost, pack: f.packCost, carton: f.cartonCost }, bpp, ppc, r4);
  return { bottlesPerPack: bpp, packsPerCarton: ppc, bottlesPerCarton, price, cost };
}

/** Margin per level (selling - cost), null where either side is unknown. */
export function marginsFor({ price, cost }) {
  return Object.fromEntries(['bottle', 'pack', 'carton'].map((u) => [u, price[u] && cost[u] ? r2(price[u] - cost[u]) : null]));
}

/**
 * Turns saved values back into form values, leaving a field blank ("automatic") when it simply equals
 * what would be calculated, so editing the bottle price later still flows through to pack and carton.
 */
export function formValuesFromSaved({ bottlesPerPack, bottlesPerCarton, sellingPrice, costPrice, unitPrices = {}, unitCosts = {} }) {
  const bpp = whole(bottlesPerPack);
  const ppc = bpp && bottlesPerCarton % bpp === 0 ? bottlesPerCarton / bpp : 0;
  const row = (bottleSaved, packSaved, cartonSaved, round) => {
    const bottle = num(bottleSaved);
    let pack = num(packSaved);
    let carton = num(cartonSaved);
    let shownBottle = bottle;
    if (bpp && ppc) {
      if (pack && bottle && close(pack, r2(bottle * bpp))) pack = 0;
      else if (bottle && pack && close(bottle, round(pack / bpp))) shownBottle = 0;
      const effectivePack = pack || r2(bottle * bpp);
      if (carton && effectivePack && close(carton, r2(effectivePack * ppc))) carton = 0;
    }
    return { bottle: shownBottle || '', pack: pack || '', carton: carton || '' };
  };
  const price = row(sellingPrice, unitPrices.pack, unitPrices.carton, r2);
  const cost = row(costPrice, unitCosts.pack, unitCosts.carton, r4);
  return {
    bottlesPerPack: bpp || '',
    packsPerCarton: ppc || '',
    bottlePrice: price.bottle,
    packPrice: price.pack,
    cartonPrice: price.carton,
    bottleCost: cost.bottle,
    packCost: cost.pack,
    cartonCost: cost.carton,
  };
}

/** What a purchase adds to stock: the unit, quantity and cost entered, versus the bottles received. */
export function receivingSummary({ unit, quantity, costPerUnit, bottlesPerPack, packsPerCarton }) {
  const bpp = whole(bottlesPerPack);
  const ppc = whole(packsPerCarton);
  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  const bottlesPerUnit = unit === 'carton' ? bpp * ppc : unit === 'pack' ? bpp : 1;
  const bottles = q * bottlesPerUnit;
  return {
    cartons: unit === 'carton' ? q : 0,
    packs: unit === 'carton' ? q * ppc : unit === 'pack' ? q : 0,
    bottles,
    // Total cost is quantity x cost per purchase unit; the unit's bottle count is NOT applied again
    totalCost: r2(q * (Number(costPerUnit) || 0)),
    costPerBottle: bottles ? r4((q * (Number(costPerUnit) || 0)) / bottles) : 0,
  };
}
