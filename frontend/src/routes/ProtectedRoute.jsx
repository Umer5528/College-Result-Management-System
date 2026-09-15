import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from '../components/ui/Loading.jsx';

export default function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const { isAuthenticated, isSuperAdmin, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <PageLoader label="Restoring your session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
