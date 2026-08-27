import React, { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, Link, useLocation } from 'react-router-dom';
import PageNotFound from './PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import NutritionDaily from './components/NutritionDaily';
import ProgressVisualFixes from './components/ProgressVisualFixes';

const ADMIN_EMAIL = 'albertdot91@gmail.com';
const HomePage = lazy(() => import('./pages/HomePage')); const LoginPage = lazy(() => import('./pages/LoginPage')); const TrainPage = lazy(() => import('./pages/TrainPage')); const GuidedRapidWorkout = lazy(() => import('./pages/GuidedRapidWorkout')); const MaintenancePage = lazy(() => import('./pages/MaintenancePage')); const ProgressPage = lazy(() => import('./pages/ProgressPage')); const ProfilePage = lazy(() => import('./pages/ProfilePage')); const AiPage = lazy(() => import('./pages/AiPageAuto')); const SettingsPage = lazy(() => import('./pages/SettingsPage')); const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage')); const Register = lazy(() => import('./pages/Register')); const ForgotPassword = lazy(() => import('./pages/ForgotPassword')); const ResetPassword = lazy(() => import('./pages/ResetPassword')); const OAuthCallback = lazy(() => import('./pages/OAuthCallback')); const AdminAccessPage = lazy(() => import('./pages/AdminAccessPage')); const AdminUsersProgressPage = lazy(() => import('./pages/AdminUsersProgressPage'));

function RouteFallback(){return <div className="fixed inset-0 flex items-center justify-center bg-slate-50" role="status" aria-live="polite"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"/><p className="mt-3 text-sm font-semibold text-slate-500">Carregant…</p></div></div>}

function AdminProgressEye(){
  const { user } = useAuth();
  const location = useLocation();
  if (location.pathname !== '/progres' || String(user?.email || '').toLowerCase() !== ADMIN_EMAIL) return null;
  return <Link to="/admin/progres-usuaris" title="Veure activitat dels usuaris" aria-label="Veure activitat dels usuaris" className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-xl text-white shadow-lg ring-2 ring-white hover:scale-105">👁️</Link>;
}

const AuthenticatedApp=()=>{const {user,isLoadingAuth,isLoadingPublicSettings,authError,navigateToLogin}=useAuth();if(isLoadingPublicSettings||isLoadingAuth)return <RouteFallback/>;if(authError){if(authError.type==='user_not_registered')return <UserNotRegisteredError/>;if(authError.type==='auth_required'){navigateToLogin();return null;}}return <Suspense fallback={<RouteFallback/>}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/oauth/callback" element={<OAuthCallback/>}/><Route path="/admin/accessos" element={<AdminAccessPage/>}/><Route path="/admin/progres-usuaris" element={<AdminUsersProgressPage/>}/><Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace/>}/> }><Route path="/" element={<HomePage/>}/><Route path="/entrena/manteniment" element={<MaintenancePage/>}/><Route path="/entrena/rapid" element={<GuidedRapidWorkout/>}/><Route path="/entrena/:type" element={<TrainPage/>}/><Route path="/progres" element={<ProgressPage/>}/><Route path="/perfil" element={<ProfilePage/>}/><Route path="/ia" element={<AiPage/>}/><Route path="/activitats" element={<ActivitiesPage/>}/><Route path="/configuracio" element={<SettingsPage/>}/></Route><Route path="*" element={<PageNotFound/>}/></Routes></Suspense>};
function App(){return <AuthProvider><QueryClientProvider client={queryClientInstance}><Router><ScrollToTop/><AuthenticatedApp/><AdminProgressEye/><NutritionDaily/><ProgressVisualFixes/></Router><Toaster/></QueryClientProvider></AuthProvider>}
export default App;
