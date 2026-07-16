import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  disallowSupplier?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission, disallowSupplier = false }) => {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (disallowSupplier && isSupplierUser) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
