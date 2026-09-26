import type { Message } from '@/types';
import type { NewMessage } from '@/data/client/dataSource';
import { simulate } from './latency';

// Per-thread storage: threadId → Message[]
// threadId convention: tenant's userId (e.g. "mock-m.alotaibi@example.com")
const THREADS_KEY = 'mdrar_mock_message_threads';

function loadThreads(): Record<string, Message[]> {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Message[]>;
  } catch { /* ignore */ }
  // Seed: put the default welcome message in a generic thread
  return {
    'mock-m.alotaibi@example.com': [
      { id: 'm1', from: 'manager', text: 'مرحباً بك، كيف يمكننا مساعدتك اليوم؟', textEn: 'Welcome, how can we help you today?', time: '10:32' },
      { id: 'm2', from: 'tenant', text: 'أرغب بالاستفسار عن موعد الصيانة القادمة.', textEn: 'I would like to ask about the next maintenance appointment.', time: '10:34' },
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
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const message: Message = { ...msg, id: `m-${Date.now()}`, time };
    threads[threadId].push(message);
    saveThreads(threads);
    return message;
  },

  // Management-only: list all threads with their last message
  async listThreads(): Promise<{ threadId: string; messages: Message[] }[]> {
    await simulate();
    const threads = loadThreads();
    return Object.entries(threads)
      .filter(([, msgs]) => msgs.length > 0)
      .map(([threadId, messages]) => ({ threadId, messages }));
  },
};
