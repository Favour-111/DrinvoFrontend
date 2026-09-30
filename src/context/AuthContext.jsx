import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/index.js';
import { api, session } from '../services/api.js';
import { stockSocket } from '../services/socket.js';
import { clearApiCache } from '../hooks/useApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: session.getToken() ? 'loading' : 'guest', data: null });
  const [notice, setNotice] = useState('');

  const apply = useCallback((data) => {
    const saved = session.getShopId();
    const shop = data.shops.find((s) => s.id === saved) || data.shops[0];
    session.setShopId(shop?.id ?? null);
    setState({ status: 'ready', data: { ...data, activeShopId: shop?.id ?? null } });
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await authService.me());
    } catch {
      session.clear();
      setState({ status: 'guest', data: null });
    }
  }, [apply]);

  useEffect(() => {
    if (session.getToken()) refresh();
  }, [refresh]);

  // Live stock updates: one connection for the active shop, reconnected on shop switch or sign-out.
  const activeShopId = state.data?.activeShopId;
  useEffect(() => {
    if (state.status === 'ready' && activeShopId) stockSocket.connect(activeShopId);
    else stockSocket.disconnect();
  }, [state.status, activeShopId]);

  useEffect(() => {
    const onUnauthorized = (e) => {
      // The REST path already clears the token; this also covers the WebSocket-pushed kick (e.g. staff access closing mid-session).
      session.clear();
      setNotice(e.detail || 'Please sign in again.');
      setState({ status: 'guest', data: null });
    };
    window.addEventListener('drinvo:unauthorized', onUnauthorized);
    return () => window.removeEventListener('drinvo:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const result = await authService.login(email, password);
      clearApiCache();
      session.setToken(result.token);
      setNotice('');
      apply(result);
      return result.user;
    },
    [apply]
  );

  const logout = useCallback(() => {
    // Capture the token before clearing it — session.clear() below runs synchronously and would
    // otherwise race the async request interceptor, sending this call with no Authorization header.
    const token = session.getToken();
    clearApiCache();
    session.clear();
    setState({ status: 'guest', data: null });
    if (token) api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }, []);

  const switchShop = useCallback((shopId) => {
    session.setShopId(shopId);
    setState((s) => ({ ...s, data: { ...s.data, activeShopId: shopId } }));
  }, []);

  const value = useMemo(() => {
    const d = state.data;
    return {
      status: state.status,
      notice,
      user: d?.user ?? null,
      business: d?.business ?? null,
      shops: d?.shops ?? [],
      shop: d?.shops.find((s) => s.id === d.activeShopId) ?? null,
      isAdmin: d?.user?.role === 'ADMIN',
      can: (permission) => Boolean(d?.permissions?.includes(permission)),
      login,
      logout,
      refresh,
      switchShop,
      updateUser: (user) => setState((s) => ({ ...s, data: { ...s.data, user: { ...s.data.user, ...user } } })),
      updateBusiness: (business) => setState((s) => ({ ...s, data: { ...s.data, business: { ...s.data.business, ...business } } })),
    };
  }, [state, notice, login, logout, refresh, switchShop]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
