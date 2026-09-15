import api from './api';

export const classService = {
  list: (params) => api.get('/classes', { params }).then((r) => r.data),
  get: (id) => api.get(`/classes/${id}`).then((r) => r.data),
  create: (payload) => api.post('/classes', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/classes/${id}`, payload).then((r) => r.data),
  archive: (id) => api.put(`/classes/${id}/archive`).then((r) => r.data),
  addSubject: (id, payload) => api.post(`/classes/${id}/subjects`, payload).then((r) => r.data),
  updateSubject: (id, subjectId, payload) => api.put(`/classes/${id}/subjects/${subjectId}`, payload).then((r) => r.data),
  getStudents: (id) => api.get(`/classes/${id}/students`).then((r) => r.data),
  delete: (id) => api.delete(`/classes/${id}`).then((r) => r.data),
};