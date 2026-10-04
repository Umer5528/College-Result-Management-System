import api from './api';

export const globalSubjectService = {
  list: (params) => api.get('/global-subjects', { params }).then((res) => res.data),
  get: (id) => api.get(`/global-subjects/${id}`).then((res) => res.data),
  create: (payload) => api.post('/global-subjects', payload).then((res) => res.data),
  update: (id, payload) => api.put(`/global-subjects/${id}`, payload).then((res) => res.data),
  delete: (id) => api.delete(`/global-subjects/${id}`).then((res) => res.data),
  migrate: () => api.post('/global-subjects/migrate').then((res) => res.data),
};
