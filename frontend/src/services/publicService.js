import api from './api';

export const publicService = {
  getExamInfo: (token) => api.get(`/public/submit/${token}`).then((r) => r.data),
  getSubjectRoster: (token, subjectId) => api.get(`/public/submit/${token}/subject/${subjectId}`).then((r) => r.data),
  submitResult: (token, subjectId, payload) => api.post(`/public/submit/${token}/subject/${subjectId}`, payload).then((r) => r.data),
};
