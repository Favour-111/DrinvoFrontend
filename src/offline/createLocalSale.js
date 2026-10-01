import { enqueueSale } from './syncManager.js';
import { deductLocalStock } from './catalogSync.js';
import { conversionFor, priceFor } from '../utils/units.js';
import { lineDiscount, linePrice } from '../context/CartContext.jsx';

const localId = () => `LOCAL-${crypto.randomUUID()}`;

/**
 * The heart of the offline-first flow: writes the sale to IndexedDB and deducts local stock
 * *synchronously with the UI update*, then hands off to the sync manager in the background.
 * Never awaits the network — the caller can show "Sale completed" the instant this resolves.
 */
export async function createLocalSale({ shop, business, staff, cart, isPart, partPaid }) {
  const id = localId();
  const now = new Date().toISOString();
  const backdatedAt = cart.backdatedAt || null;

  const lines = cart.lines.map((l) => ({
    variantId: l.product.variantId,
    name: l.product.name,
    unit: l.unit,
    quantity: l.quantity,
    baseQuantity: l.quantity * conversionFor(l.product, l.unit),
    listPrice: priceFor(l.product, l.unit),
    discount: lineDiscount(l),
    unitPrice: linePrice(l),
    lineTotal: l.quantity * linePrice(l),
    ...(l.priceOverride != null ? { price: l.priceOverride } : {}),
  }));
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discount * l.quantity, 0);
  const amountPaid = isPart ? partPaid : cart.paymentMethod === 'CREDIT' ? 0 : total;

  const payload = {
    clientTransactionId: id,
    items: lines.map((l) => ({ variantId: l.variantId, unit: l.unit, quantity: l.quantity, ...(l.price != null ? { price: l.price } : {}) })),
    paymentMethod: cart.paymentMethod,
    ...(cart.customer?.id ? { customerId: cart.customer.id } : { customer: { name: cart.customer.name, phone: cart.customer.phone } }),
    ...(isPart ? { amountPaid: partPaid, paidWith: cart.partWith } : {}),
    ...(backdatedAt ? { backdatedAt } : {}),
  };

  // Denormalized so every screen that already knows how to render a server sale (Receipt,
  // SaleComplete, MySales) can render this one identically, with no offline-specific branching.
  const localSale = {
    localId: id,
    id,
    receiptNumber: `INV-${id}`,
    serverSaleId: null,
    syncStatus: 'PENDING',
    error: null,
    status: 'COMPLETED',
    shopId: shop.id,
    items: lines.map((l, i) => ({ id: `${id}-${i}`, variantId: l.variantId, variantName: l.name, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, listPrice: l.listPrice, discount: l.discount, lineTotal: l.lineTotal })),
    total,
    totalDiscount,
    paymentMethod: cart.paymentMethod,
    paidWith: isPart ? cart.partWith : null,
    amountPaid,
    balanceAtSale: cart.paymentMethod === 'CREDIT' ? total : isPart ? Math.max(0, total - partPaid) : 0,
    returnedAmount: 0,
    refundedAmount: 0,
    netTotal: total,
    customer: cart.customer ? { id: cart.customer.id ?? null, name: cart.customer.name, phone: cart.customer.phone } : null,
    staff: { id: staff.id, name: staff.name },
    business: { name: business?.name },
    shop: { name: shop?.name, address: shop?.address },
    createdAt: backdatedAt || now,
  };

  await deductLocalStock(shop.id, lines);
  await enqueueSale(shop.id, localSale, payload);
  return localSale;
}
