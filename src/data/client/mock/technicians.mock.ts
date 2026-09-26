import type { Technician } from '@/types';
import { db } from './db';
import { simulate } from './latency';

export const techniciansMock = {
  async list(): Promise<Technician[]> {
    await simulate();
    return [...db.technicians];
  },
};
