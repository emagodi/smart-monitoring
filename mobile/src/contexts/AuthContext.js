import React, { createContext, useState, useEffect, useMemo } from 'react';
import authService from '../services/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // FORCED FALSE INITIALLY

  useEffect(() => {
    // Attempt to restore token in background, but don't block UI
    const bootstrapAsync = async () => {
      try {
        const token = await authService.getToken();
        if (token) {
           setUserToken(token);
        }
      } catch (e) {
        console.error('Error restoring token:', e);
      }
    };

    bootstrapAsync();
  }, []);

  const authContext = useMemo(
    () => ({
      signIn: async (email, password) => {
        try {
          const response = await authService.login(email, password);
          const token = response.access_token || response.accessToken;
          setUserToken(token);
        } catch (e) {
          console.error('Login failed:', e);
          throw e;
        }
      },
      signOut: async () => {
        try {
          await authService.logout();
          setUserToken(null);
        } catch (e) {
          console.error('Logout failed:', e);
        }
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