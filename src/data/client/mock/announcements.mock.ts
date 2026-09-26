import type { Announcement } from '@/types';
import type { CreateAnnouncementInput } from '@/data/client/dataSource';
import { db, persist } from './db';
import { simulate } from './latency';

let counter = db.announcements.length + 1;

export const announcementsMock = {
  async list(propertyId?: string): Promise<Announcement[]> {
    await simulate();
    const data = [...db.announcements].reverse();
    if (!propertyId) return data;
    return data.filter((a) => a.propertyId === 'all' || a.propertyId === propertyId);
  },

  async create(input: CreateAnnouncementInput): Promise<Announcement> {
    await simulate();
    const ann: Announcement = { ...input, id: `ann-${counter++}`, createdAt: new Date().toISOString() };
    db.announcements.push(ann);
    persist.announcements();
    return ann;
  },

  async delete(id: string): Promise<void> {
    await simulate();
    db.announcements = db.announcements.filter((a) => a.id !== id);
    persist.announcements();
  },
};
