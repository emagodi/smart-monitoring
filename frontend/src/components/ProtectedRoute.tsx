import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useScope, type Scope } from '../lib/scope';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  disallowSupplier?: boolean;
  allowedSupplierCodes?: string[];
  /** Scopes allowed on this page (default: all). Others are sent to their dashboard. */
  scopes?: Scope[];
  /** For depot users: allowed with any of these instead of `permission`. */
  depotAnyOf?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission, disallowSupplier = false, allowedSupplierCodes, scopes, depotAnyOf }) => {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const { scope } = useScope();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (scopes && !scopes.includes(scope)) {
    return <Navigate to="/dashboard" replace />;
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

  if (scope === 'DEPOT' && depotAnyOf) {
    if (!depotAnyOf.some((p) => hasPermission(p))) return <Navigate to="/forbidden" replace />;
    return <>{children}</>;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
