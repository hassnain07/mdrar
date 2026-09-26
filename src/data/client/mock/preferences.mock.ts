import type { Preferences } from '@/types';
import { db, persist } from './db';
import { simulate } from './latency';

export const preferencesMock = {
  async get(): Promise<Preferences> {
    await simulate();
    return { ...db.preferences };
  },

  async update(changes: Partial<Preferences>): Promise<Preferences> {
    await simulate();
    db.preferences = { ...db.preferences, ...changes };
    persist.preferences();
    return { ...db.preferences };
  },
};
