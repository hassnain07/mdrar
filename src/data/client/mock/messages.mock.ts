import type { Message } from '@/types';
import type { NewMessage } from '@/data/client/dataSource';
import { db } from './db';
import { notificationsMock } from './notifications.mock';
import { simulate } from './latency';

// Per-thread storage: threadId → Message[]
// threadId convention: tenant's userId (e.g. "mock-m.alotaibi@example.com")
const THREADS_KEY = 'mdrar_mock_message_threads';

function loadThreads(): Record<string, Message[]> {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Message[]>;
  } catch { /* ignore */ }
  return {
    'mock-m.alotaibi@example.com': [
      { id: 'm1', from: 'manager', text: 'مرحباً بك، كيف يمكننا مساعدتك اليوم؟', textEn: 'Welcome, how can we help you today?', time: new Date(Date.now() - 3600_000).toISOString(), read: true },
      { id: 'm2', from: 'tenant', text: 'أرغب بالاستفسار عن موعد الصيانة القادمة.', textEn: 'I would like to ask about the next maintenance appointment.', time: new Date(Date.now() - 3540_000).toISOString(), read: false },
    ],
  };
}

function saveThreads(threads: Record<string, Message[]>) {
  try { localStorage.setItem(THREADS_KEY, JSON.stringify(threads)); } catch { /* ignore */ }
}

export const messagesMock = {
  async list(threadId: string): Promise<Message[]> {
    await simulate();
    const threads = loadThreads();
    return [...(threads[threadId] ?? [])];
  },

  async send(threadId: string, msg: NewMessage): Promise<Message> {
    await simulate();
    const threads = loadThreads();
    if (!threads[threadId]) threads[threadId] = [];
    const message: Message = { ...msg, id: `m-${Date.now()}`, time: new Date().toISOString(), read: msg.from === 'manager' };
    threads[threadId].push(message);
    saveThreads(threads);

    if (msg.from === 'tenant') {
      void notificationsMock.push({ title: 'رسالة جديدة', body: (msg.textEn || msg.text).slice(0, 60) });
    } else {
      const email = threadId.replace(/^mock-/, '');
      void notificationsMock.pushForTenant(email, { title: 'رد جديد من الإدارة', body: (msg.text || msg.textEn).slice(0, 60) });
    }

    return message;
  },

  async markThreadRead(threadId: string): Promise<void> {
    await simulate();
    const threads = loadThreads();
    if (threads[threadId]) {
      threads[threadId] = threads[threadId].map((m) =>
        m.from === 'tenant' ? { ...m, read: true } : m,
      );
      saveThreads(threads);
    }
  },

  async listThreads(): Promise<{ threadId: string; messages: Message[]; participant?: { name: string; role: string; unit?: string; propertyName?: string }; lastMessageAt?: string }[]> {
    await simulate();
    const threads = loadThreads();
    return Object.entries(threads)
      .filter(([, msgs]) => msgs.length > 0)
      .map(([threadId, messages]) => {
        const email = threadId.replace(/^mock-/, '');
        const user = db.authUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
        const property = user?.tenantPropertyId
          ? db.properties.find((p) => p.id === user.tenantPropertyId)
          : undefined;
        return {
          threadId,
          messages,
          participant: user
            ? { name: user.name, role: user.role, unit: user.tenantUnit, propertyName: property?.nameEn }
            : undefined,
          lastMessageAt: messages[messages.length - 1]?.time,
        };
      })
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  },
};
