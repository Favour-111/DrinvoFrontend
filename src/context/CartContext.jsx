import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { conversionFor, priceFor } from '../utils/units.js';

/** The price actually charged for a line: the staff-entered price if one was set, else the catalog price. */
export const linePrice = (line) => line.priceOverride ?? priceFor(line.product, line.unit);

const CartContext = createContext(null);
const KEY = 'drinvo.cart';
// partAmount / partWith: what the customer pays now on a part payment
const EMPTY = { lines: [], paymentMethod: 'CASH', customer: null, partAmount: '', partWith: 'CASH' };

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

  const update = useCallback((key, patch) => {
    setCart((c) => ({ ...c, lines: c.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }, []);

  const remove = useCallback((key) => setCart((c) => ({ ...c, lines: c.lines.filter((l) => l.key !== key) })), []);
  const clear = useCallback(() => setCart(EMPTY), []);
  const setPart = useCallback((patch) => setCart((c) => ({ ...c, ...patch })), []);
  const setPayment = useCallback((paymentMethod) => setCart((c) => ({ ...c, paymentMethod })), []);
  const setCustomer = useCallback((customer) => setCart((c) => ({ ...c, customer })), []);

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
    return {
      ...cart,
      total: cart.lines.reduce((s, l) => s + l.quantity * linePrice(l), 0),
      count: cart.lines.reduce((s, l) => s + l.quantity, 0),
      shortages,
      add,
      update,
      remove,
      clear,
      setPayment,
      setCustomer,
      setPart,
      syncProducts,
    };
  }, [cart, add, update, remove, clear, setPayment, setCustomer, setPart, syncProducts]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
