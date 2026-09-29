import type { User } from '@/types';
import type { CreateUserInput } from '@/data/client/dataSource';
import { db, persist } from './db';
import { authMock } from './auth.mock';
import { simulate } from './latency';

export const usersMock = {
  async list(): Promise<User[]> {
    await simulate();
    return [...db.users];
  },

  async create(input: CreateUserInput): Promise<User> {
    await simulate();
    const user: User = { ...input, id: `u-${Date.now()}` };
    db.users.push(user);
    persist.users();
    // Also register in auth so the new user can sign in
    authMock.createUser({
      email: input.email,
      password: input.password ?? '123456',
      name: input.name,
      role: 'management',
    });
    return user;
  },

  async provisionTenant(input: { email: string; fullName: string; role: string; tenantPropertyId?: string; tenantUnit?: string; leaseId?: string }): Promise<{ userId: string }> {
    await simulate();
    const userId = authMock.createUser({
      email: input.email,
      password: '123456',
      name: input.fullName,
      role: 'tenant',
      tenantPropertyId: input.tenantPropertyId,
      tenantUnit: input.tenantUnit,
    });
    if (input.leaseId) {
      const idx = db.fmUnits.findIndex((u) => u.id === input.leaseId);
      if (idx !== -1) { db.fmUnits[idx] = { ...db.fmUnits[idx], tenantId: userId }; persist.fmUnits(); }
    }
    return { userId };
  },
};
