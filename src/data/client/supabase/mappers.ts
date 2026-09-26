import type {
  Property, Request, TimelineEvent, Technician, User, Message, Preferences, Notification,
  Announcement, Project, ProjectUnit, UnitInstance, ProjectActivity,
  ActivityPhoto, ProjectDocument, DocumentCategoryRecord, ProjectRisk, IpcEntry, IpcAttachment,
  PropertyDocument, FmUnit,
} from '@/types';

export function mapProperty(r: any): Property {
  return {
    id: r.id, name: r.name, nameEn: r.name_en, location: r.location,
    units: r.units, occupied: r.occupied,
    openRequests: r.open_requests ?? 0, emergency: r.emergency ?? 0,
    accent: r.accent, unitLabels: r.unit_labels ?? [],
  };
}

export function mapTimelineEvent(r: any): TimelineEvent {
  return { id: r.id, status: r.status, label: r.label, time: r.created_at, actor: r.actor };
}

export function mapRequest(r: any, timeline: TimelineEvent[] = []): Request {
  return {
    id: r.id, propertyId: r.property_id, unit: r.unit,
    tenant: r.tenant_name, tenantEmail: r.tenant_email,
    type: r.type, category: r.category, description: r.description,
    status: r.status, priority: r.priority, date: r.created_at,
    photo: r.photo_url ?? undefined, technicianId: r.technician_id ?? undefined,
    timeline,
  };
}

export function mapTechnician(r: any): Technician {
  return { id: r.id, name: r.name, nameEn: r.name_en, specialty: r.specialty, resolved: r.resolved_count, sla: r.sla };
}

export function mapUser(r: any): User {
  return { id: r.id, name: r.full_name, email: r.email, role: r.role, properties: r.properties ?? [] };
}

export function mapMessage(r: any): Message {
  return { id: r.id, from: r.sender_role, text: r.text, textEn: r.text_en, time: r.created_at };
}

export function mapNotification(r: any): Notification {
  return {
    id: r.id, title: r.title, body: r.body, time: r.created_at, read: r.read,
    emergency: r.emergency, projectId: r.project_id ?? undefined,
  };
}

export function mapPreferences(r: any): Preferences {
  return {
    immediateEmergency: r.immediate_emergency, dailySummary: r.daily_summary, smsAlerts: r.sms_alerts,
    requestUpdates: r.request_updates, announcements: r.announcements, rentReminders: r.rent_reminders,
  };
}

export function mapAnnouncement(r: any): Announcement {
  return {
    id: r.id, title: r.title, titleEn: r.title_en, body: r.body, bodyEn: r.body_en,
    propertyId: r.property_id ?? 'all', createdAt: r.created_at, createdBy: r.created_by ?? '',
  };
}

export function mapFmUnit(r: any): FmUnit {
  return {
    id: r.id, propertyId: r.property_id, label: r.unit,
    status: r.status === 'occupied' ? 'occupied' : 'vacant',
    tenant: r.tenant_name || undefined, tenantEmail: r.tenant_email || undefined,
    rent: r.rent ? Number(r.rent) : undefined,
    leaseStart: r.term_start || undefined, leaseEnd: r.term_end || undefined,
  };
}

export function mapPropertyDocument(r: any): PropertyDocument {
  return { id: r.id, propertyId: r.property_id, name: r.name, nameEn: r.name_en ?? r.name, type: r.type, fileUrl: r.file_url ?? undefined, uploadDate: r.uploaded_at };
}

export function mapProject(r: any, unitTypes: ProjectUnit[] = [], unitInstances: UnitInstance[] = []): Project {
  return {
    id: r.id, name: r.name, nameEn: r.name_en, location: r.location, locationEn: r.location_en,
    totalUnits: r.total_units, unitTypes, unitInstances,
    startDate: r.start_date, endDate: r.end_date, totalDays: r.total_days,
    contractor: r.contractor, contractorEn: r.contractor_en, budget: Number(r.budget), status: r.status,
    description: r.description ?? undefined, descriptionEn: r.description_en ?? undefined,
    contractNumber: r.contract_number ?? undefined, consultant: r.consultant ?? undefined, consultantEn: r.consultant_en ?? undefined,
  };
}

export function mapUnitType(r: any): ProjectUnit {
  return {
    id: r.id, type: r.type, typeEn: r.type_en, size: Number(r.size), bedrooms: r.bedrooms, unitCount: r.unit_count,
    image: r.image_url ?? '', floorPlan: r.floor_plan_url ?? '', model3d: r.model_3d_url ?? '', brochure: r.brochure_url ?? '',
    category: r.category ?? undefined,
  };
}

export function mapUnitInstance(r: any): UnitInstance {
  return {
    id: r.id, modelId: r.model_id, label: r.label, labelEn: r.label_en, floor: r.floor, status: r.status,
    floorPlan: r.floor_plan_url ?? '', model3d: r.model_3d_url ?? '', brochure: r.brochure_url ?? '',
    price: r.price != null ? Number(r.price) : undefined, space: r.space != null ? Number(r.space) : undefined,
    attachmentName: r.attachment_name ?? undefined, floorLevel: r.floor_level ?? undefined, townhouseType: r.townhouse_type ?? undefined,
  };
}

export function mapActivityPhoto(r: any): ActivityPhoto {
  return { id: r.id, dataUrl: r.file_url, uploadDate: r.uploaded_at, fileType: r.file_type, fileName: r.file_name ?? undefined };
}

export function mapActivity(r: any, photos: ActivityPhoto[] = []): ProjectActivity {
  return {
    id: r.id, activityId: r.activity_code, name: r.name, nameEn: r.name_en, phase: r.phase,
    startDay: r.start_day, endDay: r.end_day, duration: r.duration,
    percentComplete: r.percent_complete, actualProgress: r.actual_progress ?? undefined, status: r.status,
    team: r.team, teamEn: r.team_en, description: r.description, descriptionEn: r.description_en,
    actualCost: Number(r.actual_cost), plannedCost: Number(r.planned_cost), changeOrderAmount: Number(r.change_order_amount ?? 0),
    startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
    actualStartDate: r.actual_start_date ?? undefined, actualEndDate: r.actual_end_date ?? undefined,
    photos,
  };
}

export function mapDocumentCategory(r: any): DocumentCategoryRecord {
  return { id: r.id, projectId: r.project_id, key: r.key, name: r.name, nameEn: r.name_en, isDefault: r.is_default };
}

export function mapProjectDocument(r: any, category: DocumentCategoryRecord): ProjectDocument {
  return {
    id: r.id, name: r.name, nameEn: r.name_en, type: r.type, uploadDate: r.uploaded_at,
    category: category.key as any,
    categoryId: r.category_id, categoryName: category.name, categoryNameEn: category.nameEn,
  };
}

export function mapRisk(r: any, photos: ActivityPhoto[] = []): ProjectRisk {
  return {
    id: r.id, name: r.name, nameEn: r.name_en, dateRaised: r.date_raised,
    responsible: r.responsible, responsibleEn: r.responsible_en,
    description: r.description, descriptionEn: r.description_en,
    deadline: r.deadline ?? '', reason: r.reason, reasonEn: r.reason_en, photos, result: r.result,
  };
}

export function mapIpcAttachment(r: any): IpcAttachment {
  return { id: r.id, fileName: r.file_name, fileType: r.file_type, uploadDate: r.uploaded_at };
}

export function mapIpc(r: any, attachments: IpcAttachment[] = []): IpcEntry {
  return {
    id: r.id, projectId: r.project_id, direction: r.direction, source: r.source ?? undefined,
    partyName: r.party_name ?? undefined, partyNameEn: r.party_name_en ?? undefined,
    reference: r.reference ?? undefined, activityId: r.activity_id ?? undefined,
    amount: Number(r.amount), description: r.description, descriptionEn: r.description_en ?? undefined,
    status: r.status, dateLogged: r.date_logged, attachments,
  };
}

export function throwIfError(error: { message: string; code?: string } | null): void {
  if (error) throw { code: 'UNKNOWN', message: error.message };
}
