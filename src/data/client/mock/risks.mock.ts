import type { ProjectRisk, ActivityPhoto } from '@/types';
import type { ProjectRiskInput, PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { storageMock } from './storage.mock';
import { simulate } from './latency';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export const risksMock = {
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<ProjectRisk>> {
    await simulate();
    const all = db.projectRisks[projectId] || [];
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? all.length;
    return { data: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  },

  async create(projectId: string, risk: ProjectRiskInput): Promise<ProjectRisk> {
    await simulate();
    const newRisk: ProjectRisk = { ...risk, id: genId('risk') };
    db.projectRisks[projectId] = [...(db.projectRisks[projectId] || []), newRisk];
    persist.projectRisks();
    return newRisk;
  },

  async update(projectId: string, riskId: string, changes: Partial<ProjectRisk>): Promise<ProjectRisk> {
    await simulate();
    const list = db.projectRisks[projectId] || [];
    const idx = list.findIndex((r) => r.id === riskId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Risk ${riskId} not found` };
    list[idx] = { ...list[idx], ...changes };
    db.projectRisks[projectId] = list;
    persist.projectRisks();
    return list[idx];
  },

  async delete(projectId: string, riskId: string): Promise<void> {
    await simulate();
    db.projectRisks[projectId] = (db.projectRisks[projectId] || []).filter((r) => r.id !== riskId);
    persist.projectRisks();
  },

  async addPhoto(projectId: string, riskId: string, file: File): Promise<ActivityPhoto> {
    await simulate();
    const path = `risk-photos/${projectId}/${riskId}/${Date.now()}-${file.name}`;
    const { url } = await storageMock.upload('risk-photos', path, file);
    const photo: ActivityPhoto = {
      id: genId('photo'),
      dataUrl: url,
      uploadDate: new Date().toISOString().slice(0, 10),
      fileType: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('video/') ? 'video' : 'other',
      fileName: file.name,
    };
    const list = db.projectRisks[projectId] || [];
    const idx = list.findIndex((r) => r.id === riskId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], photos: [...(list[idx].photos || []), photo] };
      db.projectRisks[projectId] = list;
      persist.projectRisks();
    }
    return photo;
  },
};
