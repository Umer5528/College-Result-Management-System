import api from './api';

export const examinationService = {
  list: (params) => api.get('/examinations', { params }).then((r) => r.data),
  get: (id) => api.get(`/examinations/${id}`).then((r) => r.data),
  create: (payload) => api.post('/examinations', payload).then((r) => r.data),
  createFromPrevious: (id, payload) => api.post(`/examinations/${id}/create-from-previous`, payload).then((r) => r.data),
  update: (id, payload) => api.put(`/examinations/${id}`, payload).then((r) => r.data),
  generateLink: (id, expiresAt) => api.post(`/examinations/${id}/generate-link`, { expiresAt }).then((r) => r.data),
  disableLink: (id) => api.put(`/examinations/${id}/disable-link`).then((r) => r.data),
  progress: (id) => api.get(`/examinations/${id}/progress`).then((r) => r.data),
  delete: (id) => api.delete(`/examinations/${id}`).then((r) => r.data),
  bulkPreview: (payload) => api.post('/examinations/bulk-preview', payload).then((r) => r.data),
  bulkCreate: (payload) => api.post('/examinations/bulk', payload).then((r) => r.data),
};
