import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@/data/client/dataSource';
import { useAuth } from './AuthProvider';

function portalFromPath(pathname: string): 'management' | 'tenant' | 'pm' | 'technician' | null {
  if (pathname.startsWith('/management')) return 'management';
  if (pathname.startsWith('/tenant')) return 'tenant';
  if (pathname.startsWith('/pm')) return 'pm';
  if (pathname.startsWith('/technician')) return 'technician';
  return null;
}

function AuthLoading() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50">
      <div className="w-8 h-8 border-4 border-copper-600 border-t-transparent rounded-full animate-spin" />
      {slow && (
        <div className="text-center space-y-2">
          <p className="text-sm text-stone-500">This is taking longer than usual…</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-copper-600 hover:text-copper-700 font-medium underline"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/login" state={{ from: location, portal: portalFromPath(location.pathname) }} replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Session['role'][]; children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/login" state={{ from: location, portal: portalFromPath(location.pathname) }} replace />;
  if (!roles.includes(session.role)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
