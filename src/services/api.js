import axios from 'axios';

const TOKEN_KEY = 'drinvo.token';
const SHOP_KEY = 'drinvo.shop';

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (private mode) */
    }
  },
};

export const session = {
  getToken: () => storage.get(TOKEN_KEY),
  setToken: (t) => storage.set(TOKEN_KEY, t),
  getShopId: () => storage.get(SHOP_KEY),
  setShopId: (id) => storage.set(SHOP_KEY, id),
  clear: () => {
    storage.set(TOKEN_KEY, null);
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const shopId = session.getShopId();
  if (shopId) config.headers['X-Shop-Id'] = shopId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const res = error.response;
    const normalized = new Error(
      res?.data?.message || (error.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Can’t reach the server. Check your connection and try again.')
    );
    normalized.status = res?.status ?? 0;
    normalized.fields = res?.data?.fields;
    normalized.details = res?.data?.details;
    if (res?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      session.clear();
      window.dispatchEvent(new CustomEvent('drinvo:unauthorized', { detail: normalized.message }));
    }
    return Promise.reject(normalized);
  }
);

/** Unwraps response data. */
export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
