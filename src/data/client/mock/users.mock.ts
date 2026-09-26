import type { User } from '@/types';
import type { CreateUserInput } from '@/data/client/dataSource';
import { db, persist } from './db';
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
    return user;
  },
};
