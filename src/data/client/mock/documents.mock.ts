import type { ProjectDocument, DocumentCategoryRecord } from '@/types';
import type { PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { storageMock } from './storage.mock';
import { simulate } from './latency';

function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const DEFAULT_CATEGORIES = [
  { key: 'contracts', name: 'عقود الإنشاء', nameEn: 'Construction Contracts' },
  { key: 'master_plan', name: 'المخطط الرئيسي', nameEn: 'Master Plan' },
  { key: 'construction_files', name: 'ملفات البناء', nameEn: 'Construction Files' },
  { key: 'permits', name: 'التراخيص', nameEn: 'Permits' },
  { key: 'reports', name: 'التقارير', nameEn: 'Reports' },
  { key: 'correspondence', name: 'المراسلات', nameEn: 'Correspondence' },
];

function getCategories(projectId: string): DocumentCategoryRecord[] {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return [];
  const defaults: DocumentCategoryRecord[] = DEFAULT_CATEGORIES.map((c) => {
    const override = project.documentCategoryNames?.[c.key];
    return {
      id: `${projectId}-${c.key}`, projectId, key: c.key,
      name: override?.name ?? c.name, nameEn: override?.nameEn ?? c.nameEn, isDefault: true,
    };
  });
  const customs: DocumentCategoryRecord[] = (project.customDocumentCategories ?? []).map((c) => ({
    id: c.id, projectId, key: c.id, name: c.name, nameEn: c.nameEn, isDefault: false,
  }));
  return [...defaults, ...customs];
}

function enrichDoc(doc: ProjectDocument & { category: string }, projectId: string): ProjectDocument {
  const cats = getCategories(projectId);
  const cat = cats.find((c) => c.id === doc.categoryId || c.key === doc.category) ?? cats[0];
  return { ...doc, categoryId: cat?.id ?? doc.category, categoryName: cat?.name ?? '', categoryNameEn: cat?.nameEn ?? '' };
}

export const documentsMock = {
  async list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<ProjectDocument>> {
    await simulate();
    const all = (db.projectDocuments[projectId] || []).map((d) => enrichDoc(d as any, projectId));
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? all.length;
    return { data: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  },

  async listCategories(projectId: string): Promise<DocumentCategoryRecord[]> {
    await simulate();
    return getCategories(projectId);
  },

  async upload(projectId: string, file: File, categoryId: string): Promise<ProjectDocument> {
    await simulate();
    const path = `project-documents/${projectId}/${categoryId}/${Date.now()}-${file.name}`;
    await storageMock.upload('project-documents', path, file);
    const cats = getCategories(projectId);
    const cat = cats.find((c) => c.id === categoryId) ?? cats[0];
    const doc: ProjectDocument = {
      id: genId('doc'), name: file.name, nameEn: file.name,
      type: file.name.split('.').pop() || 'pdf',
      uploadDate: new Date().toISOString().slice(0, 10),
      category: cat?.key as any, categoryId, categoryName: cat?.name ?? '', categoryNameEn: cat?.nameEn ?? '',
    };
    db.projectDocuments[projectId] = [...(db.projectDocuments[projectId] || []), doc as any];
    persist.projectDocuments();
    return doc;
  },

  async create(projectId: string, categoryId: string, doc: { name: string; nameEn: string; type: string; uploadDate: string }): Promise<ProjectDocument> {
    await simulate();
    const cats = getCategories(projectId);
    const cat = cats.find((c) => c.id === categoryId) ?? cats[0];
    const newDoc: ProjectDocument = {
      id: genId('doc'), ...doc,
      category: cat?.key as any, categoryId, categoryName: cat?.name ?? '', categoryNameEn: cat?.nameEn ?? '',
    };
    db.projectDocuments[projectId] = [...(db.projectDocuments[projectId] || []), newDoc as any];
    persist.projectDocuments();
    return newDoc;
  },

  async update(projectId: string, documentId: string, changes: Partial<Pick<ProjectDocument, 'name' | 'nameEn' | 'categoryId'>>): Promise<ProjectDocument> {
    await simulate();
    const list = db.projectDocuments[projectId] || [];
    const idx = list.findIndex((d) => d.id === documentId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Document ${documentId} not found` };
    list[idx] = { ...list[idx], ...changes };
    db.projectDocuments[projectId] = list;
    persist.projectDocuments();
    return enrichDoc(list[idx] as any, projectId);
  },

  async delete(projectId: string, documentId: string): Promise<void> {
    await simulate();
    db.projectDocuments[projectId] = (db.projectDocuments[projectId] || []).filter((d) => d.id !== documentId);
    persist.projectDocuments();
  },

  async renameCategory(projectId: string, categoryId: string, names: { name: string; nameEn: string }): Promise<void> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    // categoryId for defaults is `${projectId}-${key}`, extract the key
    const key = categoryId.replace(`${projectId}-`, '');
    db.projects[idx] = {
      ...db.projects[idx],
      documentCategoryNames: { ...(db.projects[idx].documentCategoryNames || {}), [key]: names },
    };
    persist.projects();
  },

  async addCategory(projectId: string, names: { name: string; nameEn: string }): Promise<DocumentCategoryRecord> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    const id = `custom_${Date.now()}`;
    const existing = db.projects[idx].customDocumentCategories || [];
    db.projects[idx] = { ...db.projects[idx], customDocumentCategories: [...existing, { id, name: names.name, nameEn: names.nameEn }] };
    persist.projects();
    return { id, projectId, key: id, name: names.name, nameEn: names.nameEn, isDefault: false };
  },

  async removeCategory(projectId: string, categoryId: string): Promise<void> {
    await simulate();
    const idx = db.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Project ${projectId} not found` };
    const existing = db.projects[idx].customDocumentCategories || [];
    db.projects[idx] = { ...db.projects[idx], customDocumentCategories: existing.filter((c) => c.id !== categoryId) };
    db.projectDocuments[projectId] = (db.projectDocuments[projectId] || []).filter((d) => (d as any).categoryId !== categoryId);
    persist.projects();
    persist.projectDocuments();
  },
};
