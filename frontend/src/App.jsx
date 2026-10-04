import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage.jsx';
import SubmitResultPage from './pages/public/SubmitResultPage.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import ClassesPage from './pages/classes/ClassesPage.jsx';
import ClassDetailPage from './pages/classes/ClassDetailPage.jsx';
import StudentsPage from './pages/students/StudentsPage.jsx';
import StudentProfilePage from './pages/students/StudentProfilePage.jsx';
import ExaminationsPage from './pages/examinations/ExaminationsPage.jsx';
import ExaminationDetailPage from './pages/examinations/ExaminationDetailPage.jsx';
import EditSubmissionPage from './pages/examinations/EditSubmissionPage.jsx';
import SubmissionMonitoringPage from './pages/examinations/SubmissionMonitoringPage.jsx';
import ResultsPage from './pages/results/ResultsPage.jsx';
import ResultDetailPage from './pages/results/ResultDetailPage.jsx';
import OverallReportsPage from './pages/reports/OverallReportsPage.jsx';
import AnalyticsPage from './pages/analytics/AnalyticsPage.jsx';
import AdminManagementPage from './pages/admin/AdminManagementPage.jsx';
import AuditLogsPage from './pages/audit/AuditLogsPage.jsx';
import GlobalSubjectManagementPage from './pages/admin/GlobalSubjectManagementPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/submit-result/:token" element={<SubmitResultPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/classes/:id" element={<ClassDetailPage />} />
        <Route path="/subjects" element={<GlobalSubjectManagementPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentProfilePage />} />
        <Route path="/examinations" element={<ExaminationsPage />} />
        <Route path="/examinations/monitoring" element={<SubmissionMonitoringPage />} />
        <Route path="/examinations/:id" element={<ExaminationDetailPage />} />
        <Route path="/examinations/:id/subjects/:subjectId/edit" element={<EditSubmissionPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:examinationId" element={<ResultDetailPage />} />
        <Route path="/reports/exam" element={<ResultsPage />} />
        <Route path="/reports/overall" element={<OverallReportsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route
          path="/admin-management"
          element={
            <ProtectedRoute requireSuperAdmin>
              <AdminManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute requireSuperAdmin>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
