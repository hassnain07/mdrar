import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@/data/client/dataSource';
import { dataSource } from '@/data/client/index';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    // 10s safety timeout — if auth hangs for any reason, fail safe to "no session"
    // so the user sees the login page instead of an infinite spinner.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10_000);

    dataSource.auth.getSession()
      .then((s) => { if (mounted) { setSession(s); setLoading(false); clearTimeout(timeout); } })
      .catch(() => { if (mounted) { setLoading(false); clearTimeout(timeout); } });

    const unsubscribe = dataSource.auth.onAuthStateChange((s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => { mounted = false; clearTimeout(timeout); unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string): Promise<Session> => {
    queryClient.clear();
    const s = await dataSource.auth.signInWithPassword(email, password);
    setSession(s);
    setLoading(false);
    return s;
  };

  const signOut = async () => {
    await dataSource.auth.signOut();
    queryClient.clear();
    setSession(null);
  };

  const updatePassword = async (newPassword: string) => {
    await dataSource.auth.updatePassword(newPassword);
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
