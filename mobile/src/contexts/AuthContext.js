import React, { createContext, useState, useEffect, useMemo } from 'react';
import authService from '../services/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token;
      try {
        token = await authService.getToken();
      } catch (e) {
        // Restoring token failed
      }
      setUserToken(token);
      setIsLoading(false);
    };

    bootstrapAsync();
  }, []);

  const authContext = useMemo(
    () => ({
      signIn: async (email, password) => {
        const response = await authService.login(email, password);
        // Ensure we extract the token correctly based on API response
        // authService.login returns response.data
        const token = response.access_token || response.accessToken;
        setUserToken(token);
      },
      signOut: async () => {
        await authService.logout();
        setUserToken(null);
      },
      userToken,
      isLoading,
    }),
    [userToken, isLoading]
  );

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};
