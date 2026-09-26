import type { RequestStatus, RequestType, Language, IpcEntry, IpcDirection, IpcSource } from '@/types';

export function statusColor(status: RequestStatus): string {
  switch (status) {
    case 'submitted': return 'bg-stone-100 text-stone-700 border-stone-300';
    case 'acknowledged': return 'bg-slateblue-100 text-slateblue-700 border-slateblue-200';
    case 'in_progress': return 'bg-warning-100 text-warning-700 border-warning-200';
    case 'resolved': return 'bg-success-100 text-success-700 border-success-200';
  }
}

export function typeColor(type: RequestType): string {
  switch (type) {
    case 'preventive': return 'bg-slateblue-100 text-slateblue-700 border-slateblue-200';
    case 'corrective': return 'bg-copper-100 text-copper-700 border-copper-200';
    case 'emergency': return 'bg-danger-100 text-danger-700 border-danger-200';
  }
}

export function priorityColor(priority: 'normal' | 'high' | 'critical'): string {
  switch (priority) {
    case 'normal': return 'bg-stone-100 text-stone-600 border-stone-300';
    case 'high': return 'bg-warning-100 text-warning-700 border-warning-200';
    case 'critical': return 'bg-danger-100 text-danger-700 border-danger-200';
  }
}

export function formatSar(amount: number, lang: Language): string {
  const formatted = amount.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US');
  return lang === 'ar' ? `${formatted} ر.س` : `SAR ${formatted}`;
}

export function propertyName(propertyId: string, properties: { id: string; name: string; nameEn: string }[], lang: Language): string {
  const p = properties.find((p) => p.id === propertyId);
  if (!p) return propertyId;
  return lang === 'ar' ? p.name : p.nameEn;
}

export function technicianName(techId: string | undefined, technicians: { id: string; name: string; nameEn: string }[], lang: Language): string {
  if (!techId) return '';
  const t = technicians.find((t) => t.id === techId);
  if (!t) return techId;
  return lang === 'ar' ? t.name : t.nameEn;
}

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type IpcCategory = 'incoming_contractor' | 'incoming_consultant' | 'outgoing';

export function getIpcEntriesForProject(
  entries: IpcEntry[],
  category: IpcCategory
): IpcEntry[] {
  return entries.filter((e) => {
    if (category === 'outgoing') return e.direction === 'outgoing';
    if (category === 'incoming_contractor') return e.direction === 'incoming' && e.source === 'contractor';
    if (category === 'incoming_consultant') return e.direction === 'incoming' && e.source === 'consultant';
    return false;
  });
}

export function getRecentIpcEntries(
  allEntries: Record<string, IpcEntry[]>,
  category: IpcCategory,
  limit = 2
): IpcEntry[] {
  const collected: IpcEntry[] = [];
  for (const projectId of Object.keys(allEntries)) {
    collected.push(...getIpcEntriesForProject(allEntries[projectId], category));
  }
  return collected
    .sort((a, b) => b.dateLogged.localeCompare(a.dateLogged))
    .slice(0, limit);
}

export function getRecentIpcEntriesByProject(
  entries: IpcEntry[],
  category: IpcCategory,
  limit = 2
): IpcEntry[] {
  return getIpcEntriesForProject(entries, category)
    .sort((a, b) => b.dateLogged.localeCompare(a.dateLogged))
    .slice(0, limit);
}
