/**
 * Mock auth implementation.
 *
 * Seed users (all use password "password"):
 *   khalid@mdrar.sa      — super_admin  (management + pm_manager)
 *   sarah@mdrar.sa       — facility_manager (management)
 *   salem@mdrar.sa       — technician (management)
 *   owner@mdrar.sa       — owner (management)
 *   m.alotaibi@example.com — tenant (unit A-204, Jazly Plaza)
 *   sarah.j@example.com  — tenant (unit B-110, Wahat Qurtuba)
 */
import type { Session } from '@/data/client/dataSource';
import { simulate } from './latency';

const SESSION_KEY = 'mdrar_mock_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: Session['role'];
  managementRole?: Session['managementRole'];
  tenantPropertyId?: string;
  tenantUnit?: string;
}

const SEED_USERS: SeedUser[] = [
  { email: 'khalid@mdrar.sa',          password: 'password', name: 'خالد الشهري',       role: 'management', managementRole: 'super_admin' },
  { email: 'sarah@mdrar.sa',           password: 'password', name: 'Sarah Miller',       role: 'management', managementRole: 'facility_manager' },
  { email: 'salem@mdrar.sa',           password: 'password', name: 'سالم القحطاني',      role: 'technician', managementRole: 'technician' },
  { email: 'fahad@mdrar.sa',           password: 'password', name: 'فهد العتيبي',        role: 'technician', managementRole: 'technician' },
  { email: 'owner@mdrar.sa',           password: 'password', name: 'عبدالرحمن الراجحي', role: 'management', managementRole: 'owner' },
  { email: 'pm@mdrar.sa',              password: 'password', name: 'PM Manager',         role: 'pm_manager' },
  { email: 'm.alotaibi@example.com',   password: 'password', name: 'محمد العتيبي',       role: 'tenant', tenantPropertyId: 'jazly', tenantUnit: 'A-204' },
  { email: 'sarah.j@example.com',      password: 'password', name: 'Sarah Johnson',      role: 'tenant', tenantPropertyId: 'qurtuba', tenantUnit: 'B-110' },
];

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
    const user = SEED_USERS.find(
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
    // Immediately fire with current session
    cb(loadSession());
    return () => listeners.delete(cb);
  },
};
