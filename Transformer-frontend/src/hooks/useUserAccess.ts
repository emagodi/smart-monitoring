import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
  id: number;
  user: number;
  region: number | null;
  depot: number | null;
  is_national_level: boolean;
  is_region_level: boolean;
  is_depot_level: boolean;
  region_name?: string;
  depot_name?: string;
}

export const useUserAccess = () => {
  const { token } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserProfile(null);
    setLoading(false);
    setError(null);
  }, [token]);

  const canAccessRegion = (_regionId: number) => {
    return true;
  };

  const canAccessDepot = (_depotId: number) => {
    return true;
  };

  const canAccessTransformer = (_transformerId: number) => {
    return true;
  };

  const hasNationalAccess = () => {
    return true;
  };

  const hasRegionAccess = () => {
    return true;
  };

  const hasDepotAccess = () => {
    return true;
  };

  return {
    userProfile,
    loading,
    error,
    canAccessRegion,
    canAccessDepot,
    canAccessTransformer,
    hasNationalAccess,
    hasRegionAccess,
    hasDepotAccess
  };
};
