/**
 * Mock auth implementation — uses db.authUsers (persisted, mutable).
 */
import type { Session } from '@/data/client/dataSource';
import { db, persist } from './db';
import { simulate } from './latency';

const SESSION_KEY = 'mdrar_mock_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

type Listener = (session: Session | null) => void;
const listeners: Set<Listener> = new Set();

function notify(session: Session | null) {
  listeners.forEach((l) => l(session));
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export const authMock = {
  async getSession(): Promise<Session | null> {
    await simulate();
    return loadSession();
  },

  async signInWithPassword(email: string, password: string): Promise<Session> {
    await simulate();
    const user = db.authUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!user) throw { code: 'UNAUTHORIZED', message: 'Invalid email or password' };
    const session: Session = {
      userId: `mock-${user.email}`,
      email: user.email,
      role: user.role,
      managementRole: user.managementRole,
      name: user.name,
      tenantPropertyId: user.tenantPropertyId,
      tenantUnit: user.tenantUnit,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    saveSession(session);
    notify(session);
    return session;
  },

  async signOut(): Promise<void> {
    await simulate();
    saveSession(null);
    notify(null);
  },

  onAuthStateChange(cb: Listener): () => void {
    listeners.add(cb);
    queueMicrotask(() => cb(loadSession()));
    return () => listeners.delete(cb);
  },

  async updatePassword(newPassword: string): Promise<void> {
    await simulate();
    const session = loadSession();
    if (!session) throw { code: 'UNAUTHORIZED', message: 'Not signed in' };
    const user = db.authUsers.find((u) => u.email.toLowerCase() === session.email.toLowerCase());
    if (user) {
      user.password = newPassword;
      persist.authUsers();
    }
  },

  /** Create a new user account (or update password if email already exists). */
  createUser(input: { email: string; password: string; name: string; role: Session['role']; tenantPropertyId?: string; tenantUnit?: string }): string {
    const existing = db.authUsers.find((u) => u.email.toLowerCase() === input.email.toLowerCase());
    if (existing) return `mock-${existing.email}`;
    db.authUsers.push({ ...input });
    persist.authUsers();
    return `mock-${input.email}`;
  },
};
