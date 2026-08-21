import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext(null);
const AUTH_REFRESH_KEY = 'bt:last-auth-refresh';
const AUTH_REFRESH_MS = 20 * 60 * 1000;

const isDefinitiveAuthFailure = (error) => {
  const status = Number(error?.status || error?.response?.code || 0);
  return status === 401 || status === 403;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(pb.authStore.record || null);
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError] = useState(null);

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
        const lastRefresh = Number(localStorage.getItem(AUTH_REFRESH_KEY) || 0);
        const shouldRefresh = !lastRefresh || Date.now() - lastRefresh > AUTH_REFRESH_MS;

        if (shouldRefresh) {
          try {
            await pb.collection('users').authRefresh();
            localStorage.setItem(AUTH_REFRESH_KEY, String(Date.now()));
            setUser(pb.authStore.record);
            setIsAuthenticated(true);
          } catch (error) {
            // A 429/network/server error must never log the user out. Keep the
            // persisted token and let normal record requests continue.
            if (isDefinitiveAuthFailure(error)) {
              pb.authStore.clear();
              localStorage.removeItem(AUTH_REFRESH_KEY);
              setUser(null);
              setIsAuthenticated(false);
            } else {
              setUser(pb.authStore.record || null);
              setIsAuthenticated(Boolean(pb.authStore.isValid));
            }
          }
        } else {
          setUser(pb.authStore.record || null);
          setIsAuthenticated(Boolean(pb.authStore.isValid));
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (email, password) => {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await pb.collection('users').authWithPassword(email, password);
        localStorage.setItem(AUTH_REFRESH_KEY, String(Date.now()));
        setUser(pb.authStore.record);
        setIsAuthenticated(true);
        setAuthChecked(true);
        return;
      } catch (error) {
        lastError = error;
        const status = Number(error?.status || error?.response?.code || 0);
        if (status === 400 || status === 401 || status === 403 || status === 429) break;
        if (attempt === 0) await wait(700);
      }
    }
    throw lastError || new Error('No s’ha pogut iniciar sessió.');
  }, []);

  const signup = useCallback(async (email, password) => {
    await pb.collection('users').create({ email, password, passwordConfirm: password });
    await pb.collection('users').authWithPassword(email, password);
    localStorage.setItem(AUTH_REFRESH_KEY, String(Date.now()));
    setUser(pb.authStore.record);
    setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    localStorage.removeItem(AUTH_REFRESH_KEY);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAuthed: isAuthenticated, isLoadingAuth, isLoadingPublicSettings: false, authError, authChecked, login, signup, logout, navigateToLogin, checkUserAuth, checkAppState: checkUserAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
