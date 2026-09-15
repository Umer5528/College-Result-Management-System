import api from './api';

export const resultService = {
  get: (examinationId) => api.get(`/results/${examinationId}`).then((r) => r.data),
  finalize: (examinationId) => api.post(`/results/${examinationId}/finalize`).then((r) => r.data),
  reopen: (examinationId) => api.put(`/results/${examinationId}/reopen`).then((r) => r.data),
  delete: (examinationId) => api.delete(`/results/${examinationId}`).then((r) => r.data),
  setDecision: (examinationId, studentId, decision) =>
    api.put(`/results/${examinationId}/students/${studentId}/decision`, { decision }).then((r) => r.data),
};

export const submissionService = {
  get: (examinationId, subjectId) => api.get(`/submissions/${examinationId}/${subjectId}`).then((r) => r.data),
  update: (examinationId, subjectId, payload) => api.put(`/submissions/${examinationId}/${subjectId}`, payload).then((r) => r.data),
};

export const reportService = {
  examExcelUrl: (examinationId) => `/reports/${examinationId}/excel`,
  examPdfUrl: (examinationId) => `/reports/${examinationId}/pdf`,
  overall: (payload) => api.post('/reports/overall', payload).then((r) => r.data),
  overallExcel: (payload) => api.post('/reports/overall/excel', payload, { responseType: 'blob' }),
  overallPdf: (payload) => api.post('/reports/overall/pdf', payload, { responseType: 'blob' }),
};
