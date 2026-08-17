import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(pb.authStore.record || null);
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError] = useState(null);

  // Keep React state in sync with the PocketBase auth store (login/logout/OAuth).
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.record || null);
      setIsAuthenticated(pb.authStore.isValid);
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      if (pb.authStore.isValid) {
        // Validate the persisted token against the server rather than trusting it blindly.
        await pb.collection('users').authRefresh();
        setUser(pb.authStore.record);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      pb.authStore.clear();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (email, password) => {
    await pb.collection('users').authWithPassword(email, password);
    setUser(pb.authStore.record);
    setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  const signup = useCallback(async (email, password) => {
    // Direct signup (no OTP): create the auth record then authenticate.
    await pb.collection('users').create({ email, password, passwordConfirm: password });
    await pb.collection('users').authWithPassword(email, password);
    setUser(pb.authStore.record);
    setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAuthed: isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        authChecked,
        login,
        signup,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
