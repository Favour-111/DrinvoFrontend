import { session } from './api.js';

const PATH = '/ws/stock';

let ws = null;
let currentShopId = null;
let reconnectTimer = null;
let attempt = 0;
const listeners = new Set();

function wsUrl(shopId) {
  const token = session.getToken();
  const apiBase = import.meta.env.VITE_API_URL;
  const qs = `token=${encodeURIComponent(token)}&shopId=${encodeURIComponent(shopId)}`;
  if (apiBase) {
    const u = new URL(apiBase);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${u.protocol}//${u.host}${PATH}?${qs}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${PATH}?${qs}`;
}

function scheduleReconnect(shopId) {
  clearTimeout(reconnectTimer);
  const delay = Math.min(1000 * 2 ** attempt, 15_000);
  attempt += 1;
  reconnectTimer = setTimeout(() => {
    if (currentShopId === shopId) open(shopId);
  }, delay);
}

function open(shopId) {
  if (!shopId || !session.getToken()) return;
  try {
    ws = new WebSocket(wsUrl(shopId));
  } catch {
    scheduleReconnect(shopId);
    return;
  }
  ws.onopen = () => {
    attempt = 0;
  };
  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === 'stock' && Array.isArray(msg.items)) {
      for (const fn of listeners) fn(msg.items);
    }
  };
  ws.onclose = () => {
    if (currentShopId === shopId) scheduleReconnect(shopId);
  };
  ws.onerror = () => ws?.close();
}

function closeSocket() {
  clearTimeout(reconnectTimer);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

/** Live stock updates for the active shop: a single shared connection, reconnected on shop switch. */
export const stockSocket = {
  connect(shopId) {
    if (!shopId || (shopId === currentShopId && ws && ws.readyState <= WebSocket.OPEN)) return;
    closeSocket();
    attempt = 0;
    currentShopId = shopId;
    open(shopId);
  },
  disconnect() {
    currentShopId = null;
    closeSocket();
  },
  /** Subscribes to incoming stock rows; returns an unsubscribe function. */
  onStock(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },
};
