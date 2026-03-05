import React from 'react';
import { useUserAccess } from '../hooks/useUserAccess';
import { useAuth } from '../context/AuthContext';

interface RequireAccessProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredLevel?: 'national' | 'region' | 'depot';
}

const RequireAccess: React.FC<RequireAccessProps> = ({ 
  children, 
  fallback = <div className="p-8 text-center text-red-500">Access denied: Insufficient privileges</div>,
  requiredLevel = 'national'
}) => {
  const { user } = useAuth();
  const { 
    hasNationalAccess, 
    hasRegionAccess, 
    hasDepotAccess, 
    loading 
  } = useUserAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading access control...</p>
      </div>
    );
  }

  if (!user) {
    return fallback;
  }

  // Check access level based on requirement
  let hasRequiredAccess = false;

  switch (requiredLevel) {
    case 'national':
      hasRequiredAccess = hasNationalAccess();
      break;
    case 'region':
      hasRequiredAccess = hasRegionAccess();
      break;
    case 'depot':
      hasRequiredAccess = hasDepotAccess();
      break;
    default:
      hasRequiredAccess = false;
  }

  if (hasRequiredAccess) {
    return <>{children}</>;
  }

  return fallback;
};

export default RequireAccess;