import type { Notification } from '@/types';
import { db, persist } from './db';
import { simulate } from './latency';

function makeNotif(n: Omit<Notification, 'id' | 'time' | 'read'>): Notification {
  const time = new Date().toISOString();
  return { ...n, id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time, read: false };
}

export const notificationsMock = {
  /** List management (global) notifications */
  async list(): Promise<Notification[]> {
    await simulate();
    return [...db.notifications].reverse();
  },

  async markAllRead(): Promise<void> {
    await simulate();
    db.notifications = db.notifications.map((n) => ({ ...n, read: true }));
    persist.notifications();
  },

  /** Push to management (global) bucket */
  async push(n: Omit<Notification, 'id' | 'time' | 'read'>): Promise<void> {
    db.notifications.push(makeNotif(n));
    persist.notifications();
  },

  /** List notifications for a specific tenant (by email) */
  async listForTenant(tenantEmail: string): Promise<Notification[]> {
    await simulate();
    const bucket = db.tenantNotifications[tenantEmail] ?? [];
    return [...bucket].reverse();
  },

  /** Mark all read for a specific tenant */
  async markAllReadForTenant(tenantEmail: string): Promise<void> {
    await simulate();
    if (db.tenantNotifications[tenantEmail]) {
      db.tenantNotifications[tenantEmail] = db.tenantNotifications[tenantEmail].map((n) => ({ ...n, read: true }));
      persist.tenantNotifications();
    }
  },

  /** Push a notification to a specific tenant's bucket */
  async pushForTenant(tenantEmail: string, n: Omit<Notification, 'id' | 'time' | 'read'>): Promise<void> {
    if (!db.tenantNotifications[tenantEmail]) db.tenantNotifications[tenantEmail] = [];
    db.tenantNotifications[tenantEmail].push(makeNotif(n));
    persist.tenantNotifications();
  },
};
