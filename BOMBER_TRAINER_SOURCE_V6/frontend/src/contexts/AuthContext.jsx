// Compat: some BOMBER pages import useAuth from '@/contexts/AuthContext'.
// The single real auth provider now lives in '@/lib/AuthContext' (PocketBase).
// Re-export it here so both import paths share the same context instance.
export { useAuth, AuthProvider } from '@/lib/AuthContext';
export { default } from '@/lib/AuthContext';
