import test from 'node:test';
import assert from 'node:assert/strict';
import { formValuesFromSaved, marginsFor, packagingSummary, receivingSummary, resolveMiniature } from '../src/utils/miniature.js';
import { breakdownStock, costFor, describeStock, summarizeMiniature } from '../src/utils/units.js';

const base = { bottlesPerPack: 12, packsPerCarton: 12 };

test('packaging summary: 12 x 12 = 144 bottles per carton, and invalid input is flagged', () => {
  assert.deepEqual(packagingSummary(base), { bottlesPerPack: 12, packsPerCarton: 12, bottlesPerCarton: 144, valid: true });
  assert.equal(packagingSummary({ bottlesPerPack: 0, packsPerCarton: 12 }).valid, false);
  assert.equal(packagingSummary({ bottlesPerPack: 1.5, packsPerCarton: 12 }).valid, false);
  assert.equal(packagingSummary({ bottlesPerPack: '', packsPerCarton: '' }).bottlesPerCarton, 0);
});

test('pack price of N1,000 gives a N12,000 carton and a N83.33 equivalent bottle', () => {
  const r = resolveMiniature({ ...base, packPrice: 1000 });
  assert.deepEqual(r.price, { bottle: 83.33, pack: 1000, carton: 12000 });
});

test('a typed bottle price is kept independently of the pack price', () => {
  const r = resolveMiniature({ ...base, bottlePrice: 100, packPrice: 1000 });
  assert.deepEqual(r.price, { bottle: 100, pack: 1000, carton: 12000 });
});

test('bottle price alone fills pack and carton; a typed carton discount is never overwritten', () => {
  assert.deepEqual(resolveMiniature({ ...base, bottlePrice: 100 }).price, { bottle: 100, pack: 1200, carton: 14400 });
  assert.deepEqual(resolveMiniature({ ...base, bottlePrice: 100, packPrice: 1100, cartonPrice: 12000 }).price, { bottle: 100, pack: 1100, carton: 12000 });
});

test('costs: derived from the bottle cost, but a real supplier carton price is kept as typed', () => {
  assert.deepEqual(resolveMiniature({ ...base, bottleCost: 62.5 }).cost, { bottle: 62.5, pack: 750, carton: 9000 });
  const r = resolveMiniature({ ...base, bottleCost: 62.5, cartonCost: 8800 });
  assert.equal(r.cost.carton, 8800);
  assert.equal(r.cost.pack, 750);
  // only a carton price is known: the bottle cost is worked back from it
  const c = resolveMiniature({ ...base, cartonCost: 9000 });
  assert.deepEqual(c.cost, { bottle: 62.5, pack: 750, carton: 9000 });
});

test('margins per level', () => {
  const r = resolveMiniature({ ...base, bottlePrice: 100, packPrice: 1000, cartonPrice: 12000, bottleCost: 62.5 });
  assert.deepEqual(marginsFor(r), { bottle: 37.5, pack: 250, carton: 3000 });
  assert.deepEqual(marginsFor(resolveMiniature({ ...base, bottlePrice: 100 })), { bottle: null, pack: null, carton: null });
});

test('packaging is configurable: 10 bottles per pack, 6 packs per carton', () => {
  const r = resolveMiniature({ bottlesPerPack: 10, packsPerCarton: 6, bottlePrice: 50 });
  assert.equal(r.bottlesPerCarton, 60);
  assert.deepEqual(r.price, { bottle: 50, pack: 500, carton: 3000 });
});

test('editing: values that equal the calculation come back blank (automatic), real overrides stay', () => {
  const saved = { bottlesPerPack: 12, bottlesPerCarton: 144, sellingPrice: 100, costPrice: 62.5, unitPrices: { pack: 1200, carton: 12000 }, unitCosts: { pack: 750, carton: 9000 } };
  const f = formValuesFromSaved(saved);
  assert.equal(f.packsPerCarton, 12);
  assert.equal(f.bottlePrice, 100);
  assert.equal(f.packPrice, ''); // 100 x 12
  assert.equal(f.cartonPrice, 12000); // not 1200 x 12, so it is a real override
  assert.equal(f.packCost, '');
  assert.equal(f.cartonCost, ''); // 750 x 12
  // and resolving the form values reproduces what was saved
  assert.deepEqual(resolveMiniature({ ...base, ...f }).price, { bottle: 100, pack: 1200, carton: 12000 });
});

test('editing: a bottle price that is just pack / 12 comes back blank', () => {
  const f = formValuesFromSaved({ bottlesPerPack: 12, bottlesPerCarton: 144, sellingPrice: 83.33, costPrice: 0, unitPrices: { pack: 1000, carton: 12000 } });
  assert.equal(f.bottlePrice, '');
  assert.equal(f.packPrice, 1000);
  assert.equal(f.cartonPrice, '');
});

test('receiving 5 cartons at N9,000: 60 packs, 720 bottles, N45,000 (cost not multiplied twice)', () => {
  const r = receivingSummary({ unit: 'carton', quantity: 5, costPerUnit: 9000, ...base });
  assert.deepEqual(r, { cartons: 5, packs: 60, bottles: 720, totalCost: 45000, costPerBottle: 62.5 });
  assert.deepEqual(receivingSummary({ unit: 'pack', quantity: 4, costPerUnit: 750, ...base }), { cartons: 0, packs: 4, bottles: 48, totalCost: 3000, costPerBottle: 62.5 });
  assert.equal(receivingSummary({ unit: 'bottle', quantity: 10, costPerUnit: 70, ...base }).totalCost, 700);
  assert.equal(receivingSummary({ unit: 'carton', quantity: 0, costPerUnit: 9000, ...base }).bottles, 0);
});

test('stock text helpers match the server: 686 bottles = 4 cartons + 9 packs + 2 bottles', () => {
  const v = { packagingType: 'MINIATURE', unitConversions: { pack: 12, carton: 144, crate: 0 }, costPrice: 62.5, unitCosts: {}, quantity: 686 };
  assert.deepEqual(breakdownStock(v), { carton: 4, pack: 9, bottle: 2 });
  assert.equal(describeStock(v), '4 cartons + 9 packs + 2 bottles');
  assert.equal(costFor(v, 'carton'), 9000);
  const std = { unitConversions: { pack: 6, carton: 24 }, quantity: 50 };
  assert.equal(describeStock(std), '2 cartons + 2 bottles');
});

test('miniature stock summary counts only miniatures', () => {
  const mini = { variantId: 'm', packagingType: 'MINIATURE', unitConversions: { pack: 12, carton: 144 }, quantity: 686, status: 'in', inventoryValue: 100 };
  const std = { variantId: 's', unitConversions: { carton: 24 }, quantity: 48, status: 'low', inventoryValue: 50 };
  assert.deepEqual(summarizeMiniature([mini, std]), { variantCount: 1, totalBottles: 686, cartons: 4, packs: 9, looseBottles: 2, lowStock: 0, outOfStock: 0, inventoryValue: 100 });
});
