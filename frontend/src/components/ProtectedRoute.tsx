import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  disallowSupplier?: boolean;
  allowedSupplierCodes?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission, disallowSupplier = false, allowedSupplierCodes }) => {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (disallowSupplier && isSupplierUser) {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    isSupplierUser &&
    allowedSupplierCodes &&
    allowedSupplierCodes.length > 0 &&
    !allowedSupplierCodes.map((code) => code.toLowerCase()).includes((user?.supplierCode || '').toLowerCase())
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
