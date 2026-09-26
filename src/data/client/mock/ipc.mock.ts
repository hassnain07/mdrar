import type { IpcEntry, IpcAttachment } from '@/types';
import type { IpcEntryInput, PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { storageMock } from './storage.mock';
import { simulate } from './latency';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export const ipcMock = {
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<IpcEntry>> {
    await simulate();
    const all = db.projectIpcEntries[projectId] || [];
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? all.length;
    return { data: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  },

  async create(projectId: string, entry: IpcEntryInput): Promise<IpcEntry> {
    await simulate();
    const newEntry: IpcEntry = { ...entry, id: genId('ipc'), attachments: [] };
    db.projectIpcEntries[projectId] = [...(db.projectIpcEntries[projectId] || []), newEntry];
    persist.projectIpcEntries();
    return newEntry;
  },

  async update(projectId: string, entryId: string, changes: Partial<IpcEntry>): Promise<IpcEntry> {
    await simulate();
    const list = db.projectIpcEntries[projectId] || [];
    const idx = list.findIndex((e) => e.id === entryId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `IPC entry ${entryId} not found` };
    list[idx] = { ...list[idx], ...changes };
    db.projectIpcEntries[projectId] = list;
    persist.projectIpcEntries();
    return list[idx];
  },

  async delete(projectId: string, entryId: string): Promise<void> {
    await simulate();
    db.projectIpcEntries[projectId] = (db.projectIpcEntries[projectId] || []).filter((e) => e.id !== entryId);
    persist.projectIpcEntries();
  },

  async addAttachment(projectId: string, entryId: string, file: File): Promise<IpcAttachment> {
    await simulate();
    const path = `ipc-attachments/${projectId}/${entryId}/${Date.now()}-${file.name}`;
    await storageMock.upload('ipc-attachments', path, file);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const fileType: IpcAttachment['fileType'] =
      ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'image' :
      ext === 'pdf' ? 'pdf' :
      ['mp4','mov','avi','mkv'].includes(ext) ? 'video' : 'other';
    const attachment: IpcAttachment = {
      id: genId('att'),
      fileName: file.name,
      fileType,
      uploadDate: new Date().toISOString().slice(0, 10),
    };
    const list = db.projectIpcEntries[projectId] || [];
    const idx = list.findIndex((e) => e.id === entryId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], attachments: [...list[idx].attachments, attachment] };
      db.projectIpcEntries[projectId] = list;
      persist.projectIpcEntries();
    }
    return attachment;
  },
};
