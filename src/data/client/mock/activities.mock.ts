import type { ProjectActivity, ActivityPhoto } from '@/types';
import type { ProjectActivityInput, PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { storageMock } from './storage.mock';
import { simulate } from './latency';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export const activitiesMock = {
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<ProjectActivity>> {
    await simulate();
    const all = db.projectActivities[projectId] || [];
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? all.length;
    return { data: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  },

  async create(projectId: string, activity: ProjectActivityInput): Promise<ProjectActivity> {
    await simulate();
    const newActivity: ProjectActivity = { ...activity, id: genId('act') };
    db.projectActivities[projectId] = [...(db.projectActivities[projectId] || []), newActivity];
    persist.projectActivities();
    return newActivity;
  },

  async update(projectId: string, activityId: string, changes: Partial<ProjectActivity>): Promise<ProjectActivity> {
    await simulate();
    const list = db.projectActivities[projectId] || [];
    const idx = list.findIndex((a) => a.id === activityId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Activity ${activityId} not found` };
    list[idx] = { ...list[idx], ...changes };
    db.projectActivities[projectId] = list;
    persist.projectActivities();
    return list[idx];
  },

  async delete(projectId: string, activityId: string): Promise<void> {
    await simulate();
    db.projectActivities[projectId] = (db.projectActivities[projectId] || []).filter((a) => a.id !== activityId);
    persist.projectActivities();
  },

  async addPhoto(projectId: string, activityId: string, file: File): Promise<ActivityPhoto> {
    await simulate();
    const path = `activity-photos/${projectId}/${activityId}/${Date.now()}-${file.name}`;
    const { url } = await storageMock.upload('activity-photos', path, file);
    const photo: ActivityPhoto = {
      id: genId('photo'),
      dataUrl: url,
      uploadDate: new Date().toISOString().slice(0, 10),
      fileType: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('video/') ? 'video' : 'other',
      fileName: file.name,
    };
    const list = db.projectActivities[projectId] || [];
    const idx = list.findIndex((a) => a.id === activityId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], photos: [...(list[idx].photos || []), photo] };
      db.projectActivities[projectId] = list;
      persist.projectActivities();
    }
    return photo;
  },
};
