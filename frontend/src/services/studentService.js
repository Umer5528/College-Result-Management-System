import api from './api';

export const studentService = {
  list: (params) => api.get('/students', { params }).then((r) => r.data),
  search: (q) => api.get('/students/search', { params: { q } }).then((r) => r.data),
  get: (id) => api.get(`/students/${id}`).then((r) => r.data),
  create: (payload) => api.post('/students', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/students/${id}`, payload).then((r) => r.data),
  strikeOff: (id, { subjectId, reason }) => api.put(`/students/${id}/strike-off`, { subjectId, reason }).then((r) => r.data),
  restore: (id) => api.put(`/students/${id}/restore`).then((r) => r.data),
  archive: (id) => api.put(`/students/${id}/archive`).then((r) => r.data),
  history: (id) => api.get(`/students/${id}/history`).then((r) => r.data),
  bulkImport: (formData) =>
    api.post('/students/bulk-import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  bulkImportText: (payload) => api.post('/students/bulk-import-text', payload).then((r) => r.data),
  bulkImportTextPreview: (payload) => api.post('/students/bulk-import-text/preview', payload).then((r) => r.data),
  delete: (id) => api.delete(`/students/${id}`).then((r) => r.data),
  exportUrl: (classId) => `/students/export${classId ? `?classId=${classId}` : ''}`,
};
