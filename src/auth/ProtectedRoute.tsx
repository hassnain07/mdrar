import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Session } from '@/data/client/dataSource';
import { useAuth } from './AuthProvider';

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-8 h-8 border-4 border-copper-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Session['role'][]; children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!roles.includes(session.role)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
