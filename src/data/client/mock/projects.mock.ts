import type { Project, ProjectUnit, UnitInstance } from '@/types';
import type { CreateProjectInput, ProjectUnitInput, UnitInstanceInput, PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { simulate } from './latency';
import { activityDefs } from '@/data/pmMockData';
import type { ProjectActivity } from '@/types';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export const projectsMock = {
  async list(params?: PaginationParams): Promise<PaginatedResult<Project>> {
    await simulate();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? db.projects.length;
    const start = (page - 1) * pageSize;
    return { data: db.projects.slice(start, start + pageSize), total: db.projects.length };
  },

  async get(id: string): Promise<Project> {
    await simulate();
    const p = db.projects.find((x) => x.id === id);
    if (!p) throw { code: 'NOT_FOUND', message: `Project ${id} not found` };
    return { ...p };
  },

  async create(input: CreateProjectInput): Promise<Project> {
    await simulate();
    const id = genId('proj');
    const project: Project = {
      ...input,
      id,
      unitTypes: (input.unitTypes || []).map((u) => ({ ...u, id: genId('unit') })),
      unitInstances: [],
    };
    db.projects.push(project);
    // Seed default activities
    const today = new Date().toISOString().slice(0, 10);
    const activities: ProjectActivity[] = activityDefs.map((a) => ({
      id: a.id,
      activityId: a.activityId,
      name: a.name,
      nameEn: a.nameEn,
      phase: a.phase,
      startDay: a.startDay,
      endDay: a.startDay + a.duration,
      duration: a.duration,
      percentComplete: a.phase === 'milestone' ? 100 : 0,
      status: a.phase === 'milestone' ? 'completed' : 'not_started',
      team: 'فريق المقاول الرئيسي',
      teamEn: 'Main Contractor Team',
      description: '',
      descriptionEn: '',
      actualCost: 0,
      plannedCost: 0,
    }));
    db.projectActivities[id] = activities;
    db.projectDocuments[id] = [
      { id: genId('doc'), name: 'عقد الإنشاء', nameEn: 'Construction Contract', type: 'pdf', uploadDate: today, categoryId: 'contracts', categoryName: 'عقود', categoryNameEn: 'Contracts' },
      { id: genId('doc'), name: 'الخطة الرئيسية', nameEn: 'Master Plan', type: 'pdf', uploadDate: today, categoryId: 'master_plan', categoryName: 'خطط', categoryNameEn: 'Plans' },
    ];
    db.projectRisks[id] = [];
    db.projectIpcEntries[id] = [];
    persist.projects();
    persist.projectActivities();
    persist.projectDocuments();
    persist.projectRisks();
    persist.projectIpcEntries();
    return { ...project };
  },

  async update(id: string, changes: Partial<Project>): Promise<Project> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${id} not found` };
    db.projects[idx] = { ...db.projects[idx], ...changes };
    persist.projects();
    return { ...db.projects[idx] };
  },

  async addUnit(projectId: string, unit: ProjectUnitInput): Promise<ProjectUnit> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    const newUnit: ProjectUnit = { ...unit, id: genId('unit') };
    db.projects[idx] = { ...db.projects[idx], unitTypes: [...db.projects[idx].unitTypes, newUnit] };
    persist.projects();
    return newUnit;
  },

  async updateUnit(projectId: string, unitId: string, changes: Partial<ProjectUnit>): Promise<ProjectUnit> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    const unitIdx = db.projects[idx].unitTypes.findIndex((u) => u.id === unitId);
    if (unitIdx === -1) throw { code: 'NOT_FOUND', message: `Unit ${unitId} not found` };
    const updated = { ...db.projects[idx].unitTypes[unitIdx], ...changes };
    db.projects[idx].unitTypes[unitIdx] = updated;
    persist.projects();
    return updated;
  },

  async deleteUnit(projectId: string, unitId: string): Promise<void> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    db.projects[idx] = { ...db.projects[idx], unitTypes: db.projects[idx].unitTypes.filter((u) => u.id !== unitId) };
    persist.projects();
  },

  async addUnitInstance(projectId: string, unit: UnitInstanceInput): Promise<UnitInstance> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    const newUnit: UnitInstance = { ...unit, id: genId('ui') };
    db.projects[idx] = { ...db.projects[idx], unitInstances: [...(db.projects[idx].unitInstances || []), newUnit] };
    persist.projects();
    return newUnit;
  },

  async updateUnitInstance(projectId: string, unitId: string, changes: Partial<UnitInstance>): Promise<UnitInstance> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    const instances = db.projects[idx].unitInstances || [];
    const uIdx = instances.findIndex((u) => u.id === unitId);
    if (uIdx === -1) throw { code: 'NOT_FOUND', message: `Unit instance ${unitId} not found` };
    instances[uIdx] = { ...instances[uIdx], ...changes };
    db.projects[idx] = { ...db.projects[idx], unitInstances: instances };
    persist.projects();
    return instances[uIdx];
  },

  async deleteUnitInstance(projectId: string, unitId: string): Promise<void> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    db.projects[idx] = { ...db.projects[idx], unitInstances: (db.projects[idx].unitInstances || []).filter((u) => u.id !== unitId) };
    persist.projects();
  },
};
