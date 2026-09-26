import type { FmUnit, PropertyDocument } from '@/types';
import { db, persist } from './db';
import { storageMock } from './storage.mock';
import { simulate } from './latency';
import { genId } from '@/lib/helpers';

export const leasesMock = {
  async list(propertyId?: string): Promise<FmUnit[]> {
    await simulate();
    const units = propertyId ? db.fmUnits.filter((u) => u.propertyId === propertyId) : db.fmUnits;
    return units;
  },
  async create(input: { propertyId: string; label: string; status: 'occupied' | 'vacant'; tenant?: string; tenantEmail?: string; rent?: number; leaseStart?: string; leaseEnd?: string }): Promise<FmUnit> {
    await simulate();
    const unit: FmUnit = { id: genId('fmu'), ...input };
    db.fmUnits.push(unit);
    persist.fmUnits();
    return unit;
  },
  async update(id: string, changes: Partial<FmUnit>): Promise<FmUnit> {
    await simulate();
    const idx = db.fmUnits.findIndex((u) => u.id === id);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Unit ${id} not found` };
    db.fmUnits[idx] = { ...db.fmUnits[idx], ...changes };
    persist.fmUnits();
    return db.fmUnits[idx];
  },
  async delete(id: string): Promise<void> {
    await simulate();
    db.fmUnits = db.fmUnits.filter((u) => u.id !== id);
    persist.fmUnits();
  },
};

export const propertyDocumentsMock = {
  async list(propertyId: string): Promise<PropertyDocument[]> {
    await simulate();
    return db.fmDocuments.filter((d) => d.propertyId === propertyId).map((d) => ({
      id: d.id, propertyId: d.propertyId, name: d.name, nameEn: d.name,
      type: d.type, fileUrl: d.fileUrl, uploadDate: d.uploadDate,
    }));
  },
  async upload(propertyId: string, file: File): Promise<PropertyDocument> {
    await simulate();
    const path = `fm-documents/${propertyId}/${Date.now()}-${file.name}`;
    const { url } = await storageMock.upload('property-documents', path, file);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'other';
    const doc = {
      id: genId('fmd'), propertyId, name: file.name, type: ext,
      uploadDate: new Date().toISOString().slice(0, 10), fileUrl: url,
    };
    db.fmDocuments.push(doc);
    persist.fmDocuments();
    return { ...doc, nameEn: doc.name };
  },
  async delete(_propertyId: string, documentId: string): Promise<void> {
    await simulate();
    db.fmDocuments = db.fmDocuments.filter((d) => d.id !== documentId);
    persist.fmDocuments();
  },
};
