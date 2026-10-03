import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { conversionFor, minimumFor, priceFor } from '../utils/units.js';

/** The catalog (default) price for a line. */
export const lineListPrice = (line) => priceFor(line.product, line.unit);
/** The price actually charged for a line: the staff-entered price if one was set (can be above or below the default), else the catalog price. */
export const linePrice = (line) => (line.priceOverride != null ? line.priceOverride : lineListPrice(line));
/** How much was knocked off the default price — 0 if the line is at or above it (never negative). */
export const lineDiscount = (line) => Math.max(0, lineListPrice(line) - linePrice(line));
/** Whether the line's price is below the product's minimum selling price for this unit. */
export const lineBelowMinimum = (line) => {
  const min = minimumFor(line.product, line.unit);
  return min > 0 && linePrice(line) < min;
};

const CartContext = createContext(null);
const KEY = 'drinvo.cart';
// partAmount / partWith: what the customer pays now on a part payment
// backdatedAt: set when logging a past sale (e.g. migrating paper records); null means "now"
const EMPTY = { lines: [], paymentMethod: 'CASH', customer: null, partAmount: '', partWith: 'CASH', backdatedAt: null };

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(KEY)) };
  } catch {
    return EMPTY;
  }
}

/**
 * The staff member's current sale. Lines keep a snapshot of the product so the
 * cart renders instantly; prices and stock are re-checked by the server.
 */
export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart]);

  const add = useCallback((product) => {
    setCart((c) => {
      const i = c.lines.findIndex((l) => l.product.variantId === product.variantId && l.unit === 'bottle');
      if (i >= 0) {
        const lines = c.lines.slice();
        lines[i] = { ...lines[i], quantity: lines[i].quantity + 1 };
        return { ...c, lines };
      }
      return { ...c, lines: [...c.lines, { key: `${product.variantId}-${Date.now()}`, product, unit: 'bottle', quantity: 1 }] };
    });
  }, []);

  /** Adds a line with a specific unit/quantity/price already set — used to hand an on-demand
   * purchase straight into the cart instead of the default "+1 bottle at list price" of add(). */
  const addLine = useCallback((product, { unit = 'bottle', quantity = 1, priceOverride } = {}) => {
    setCart((c) => ({ ...c, lines: [...c.lines, { key: `${product.variantId}-${Date.now()}`, product, unit, quantity, priceOverride }] }));
  }, []);

  const update = useCallback((key, patch) => {
    setCart((c) => ({ ...c, lines: c.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }, []);

  const remove = useCallback((key) => setCart((c) => ({ ...c, lines: c.lines.filter((l) => l.key !== key) })), []);
  const clear = useCallback(() => setCart(EMPTY), []);
  const setPart = useCallback((patch) => setCart((c) => ({ ...c, ...patch })), []);
  const setPayment = useCallback((paymentMethod) => setCart((c) => ({ ...c, paymentMethod })), []);
  const setCustomer = useCallback((customer) => setCart((c) => ({ ...c, customer })), []);
  const setBackdatedAt = useCallback((backdatedAt) => setCart((c) => ({ ...c, backdatedAt })), []);

  /** Refreshes product snapshots (stock, prices) from the latest product list. */
  const syncProducts = useCallback((products) => {
    const byId = new Map(products.map((p) => [p.variantId, p]));
    setCart((c) => ({ ...c, lines: c.lines.filter((l) => byId.has(l.product.variantId)).map((l) => ({ ...l, product: byId.get(l.product.variantId) })) }));
  }, []);

  const value = useMemo(() => {
    const need = new Map();
    for (const l of cart.lines) {
      need.set(l.product.variantId, (need.get(l.product.variantId) || 0) + l.quantity * conversionFor(l.product, l.unit));
    }
    const shortages = new Map();
    for (const l of cart.lines) {
      const n = need.get(l.product.variantId);
      if (n > l.product.quantity) shortages.set(l.product.variantId, { need: n, available: l.product.quantity });
    }
    const priceErrors = new Map();
    for (const l of cart.lines) {
      if (lineBelowMinimum(l)) priceErrors.set(l.key, { min: minimumFor(l.product, l.unit) });
    }
    return {
      ...cart,
      total: cart.lines.reduce((s, l) => s + l.quantity * linePrice(l), 0),
      totalDiscount: cart.lines.reduce((s, l) => s + l.quantity * lineDiscount(l), 0),
      count: cart.lines.reduce((s, l) => s + l.quantity, 0),
      shortages,
      priceErrors,
      add,
      addLine,
      update,
      remove,
      clear,
      setPayment,
      setCustomer,
      setPart,
      setBackdatedAt,
      syncProducts,
    };
  }, [cart, add, addLine, update, remove, clear, setPayment, setCustomer, setPart, setBackdatedAt, syncProducts]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
