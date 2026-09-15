import api from './api';

export const settingsService = {
  get: () => api.get('/settings').then((r) => r.data),
  update: (payload) => api.put('/settings', payload).then((r) => r.data),
};

export const superAdminService = {
  listAdmins: () => api.get('/super-admin/admins').then((r) => r.data),
  createAdmin: (payload) => api.post('/super-admin/admins', payload).then((r) => r.data),
  updateAdmin: (id, payload) => api.put(`/super-admin/admins/${id}`, payload).then((r) => r.data),
  disableAdmin: (id) => api.put(`/super-admin/admins/${id}/disable`).then((r) => r.data),
  enableAdmin: (id) => api.put(`/super-admin/admins/${id}/enable`).then((r) => r.data),
  resetPassword: (id, newPassword) =>
    api.put(`/super-admin/admins/${id}/reset-password`, { newPassword }).then((r) => r.data),
};

export const dashboardService = {
  get: () => api.get('/dashboard').then((r) => r.data),
};

export const auditLogService = {
  list: (params) => api.get('/audit-logs', { params }).then((r) => r.data),
};
