import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

describe('mock auth', () => {
  it('signs in with valid credentials', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    const session = await authMock.signInWithPassword('khalid@mdrar.sa', 'password');
    expect(session.role).toBe('management');
    expect(session.managementRole).toBe('super_admin');
    expect(session.email).toBe('khalid@mdrar.sa');
  });

  it('rejects invalid credentials', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    await expect(authMock.signInWithPassword('khalid@mdrar.sa', 'wrong')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('signs in tenant and resolves property/unit', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    const session = await authMock.signInWithPassword('m.alotaibi@example.com', 'password');
    expect(session.role).toBe('tenant');
    expect(session.tenantPropertyId).toBe('jazly');
    expect(session.tenantUnit).toBe('A-204');
  });

  it('persists session and restores on getSession', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    await authMock.signInWithPassword('sarah@mdrar.sa', 'password');
    const session = await authMock.getSession();
    expect(session?.email).toBe('sarah@mdrar.sa');
  });

  it('clears session on signOut', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    await authMock.signInWithPassword('khalid@mdrar.sa', 'password');
    await authMock.signOut();
    const session = await authMock.getSession();
    expect(session).toBeNull();
  });

  it('notifies listeners on auth state change', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    const calls: (Awaited<ReturnType<typeof authMock.getSession>>)[] = [];
    const unsub = authMock.onAuthStateChange((s) => calls.push(s));
    await authMock.signInWithPassword('pm@mdrar.sa', 'password');
    await authMock.signOut();
    unsub();
    // initial call + signIn + signOut = 3
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[calls.length - 1]).toBeNull();
  });

  it('signs in pm_manager role', async () => {
    const { authMock } = await import('@/data/client/mock/auth.mock');
    const session = await authMock.signInWithPassword('pm@mdrar.sa', 'password');
    expect(session.role).toBe('pm_manager');
  });
});
