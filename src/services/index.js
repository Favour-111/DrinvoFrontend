import { api, get, patch, post } from './api.js';

const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'all'));

export const authService = {
  login: (email, password) => post('/auth/login', { email, password }),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),
  changePassword: (body) => post('/auth/change-password', body),
  updateMe: (body) => patch('/users/me', body),
  signup: (body) => post('/auth/signup', body),
  invitationInfo: (token) => get(`/invite/${token}`),
};

export const productService = {
  list: (params) => get('/products', clean(params)),
  categories: () => get('/products/categories'),
  get: (id) => get(`/products/${id}`),
  create: (body) => post('/products', body),
  update: (id, body) => patch(`/products/${id}`, body),
  archive: (id) => post(`/products/${id}/archive`),
  restore: (id) => post(`/products/${id}/restore`),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/uploads', form).then((r) => r.data);
  },
};

export const inventoryService = {
  list: (params) => get('/inventory', clean(params)),
  get: (variantId) => get(`/inventory/${variantId}`),
  movements: (params) => get('/inventory/movements', clean(params)),
  restock: (body) => post('/inventory/restock', body),
  adjust: (body) => post('/inventory/adjustments', body),
  purchases: (params) => get('/purchases', clean(params)),
};

export const salesService = {
  list: (params) => get('/sales', clean(params)),
  get: (id) => get(`/sales/${id}`),
  create: (body) => post('/sales', body),
  processReturn: (id, body) => post(`/sales/${id}/return`, body),
  refund: (id, body) => post(`/sales/${id}/refund`, body),
  void: (id, body) => post(`/sales/${id}/void`, body),
};

export const supplierService = {
  list: (params) => get('/suppliers', clean(params)),
  get: (id) => get(`/suppliers/${id}`),
  create: (body) => post('/suppliers', body),
  update: (id, body) => patch(`/suppliers/${id}`, body),
};

export const customerService = {
  list: (params) => get('/customers', clean(params)),
  get: (id) => get(`/customers/${id}`),
  create: (body) => post('/customers', body),
  update: (id, body) => patch(`/customers/${id}`, body),
  summary: () => get('/credit/summary'),
  recordPayment: (body) => post('/credit/payments', body),
};

export const reportService = {
  dashboard: (params) => get('/reports/dashboard', clean(params)),
  summary: (params) => get('/reports/summary', clean(params)),
  stockMovements: (params) => get('/reports/stock-movements', clean(params)),
  me: () => get('/reports/me'),
};

export const staffService = {
  list: () => get('/staff'),
  get: (id) => get(`/staff/${id}`),
  create: (body) => post('/staff', body),
  update: (id, body) => patch(`/staff/${id}`, body),
  deactivate: (id) => post(`/staff/${id}/deactivate`),
  activate: (id) => post(`/staff/${id}/activate`),
  resetPassword: (id, password) => post(`/staff/${id}/reset-password`, { password }),
  listInvitations: () => get('/staff/invitations'),
  createInvitation: (body) => post('/staff/invitations', body),
  revokeInvitation: (id) => post(`/staff/invitations/${id}/revoke`),
};

export const settingsService = {
  business: () => get('/businesses/current'),
  updateBusiness: (body) => patch('/businesses/current', body),
  shops: () => get('/shops'),
  createShop: (body) => post('/shops', body),
  updateShop: (id, body) => patch(`/shops/${id}`, body),
};

export const auditService = {
  list: (params) => get('/audit', clean(params)),
};
