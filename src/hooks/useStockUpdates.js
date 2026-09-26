import { useEffect, useRef } from 'react';
import { stockSocket } from '../services/socket.js';

/** Calls `handler(rows)` whenever live stock updates arrive for the active shop. */
export function useStockUpdates(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => stockSocket.onStock((rows) => ref.current(rows)), []);
}
