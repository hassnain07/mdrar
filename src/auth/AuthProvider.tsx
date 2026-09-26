import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@/data/client/dataSource';
import { dataSource } from '@/data/client/index';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Track whether signIn() already set the session so the concurrent
  // onAuthStateChange callback doesn't trigger a redundant profile fetch.
  const signingIn = useRef(false);

  useEffect(() => {
    dataSource.auth.getSession().then((s) => {
      setSession(s);
      setLoading(false);
    }).catch(() => setLoading(false));

    const unsubscribe = dataSource.auth.onAuthStateChange((s) => {
      // If signIn() is in progress it already has the session — skip.
      if (signingIn.current) return;
      setSession(s);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<Session> => {
    signingIn.current = true;
    try {
      const s = await dataSource.auth.signInWithPassword(email, password);
      setSession(s);
      setLoading(false);
      return s;
    } finally {
      // Small delay so the onAuthStateChange event (which fires right after
      // signInWithPassword resolves) sees the flag still set and skips.
      setTimeout(() => { signingIn.current = false; }, 500);
    }
  };

  const signOut = async () => {
    await dataSource.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
