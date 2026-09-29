import type {
  Property, Request, RequestStatus, Technician, User, Message, Preferences,
  Notification, Project, ProjectActivity, ProjectDocument, ProjectRisk,
  IpcEntry, ActivityPhoto, DocumentCategory, CustomDocumentCategory, ProjectUnit, UnitInstance,
  IpcAttachment, TimelineEvent, ActivityPhase, ActivityStatus,
  UnitCategory, FloorLevel, TownhouseType, IpcStatus, IpcDirection, IpcSource,
  RiskResult, ManagementRole, ProjectStatus, Announcement, PropertyDocument, DocumentCategoryRecord,
} from '@/types';

export interface DataSourceError {
  code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'NETWORK' | 'VALIDATION' | 'UNKNOWN';
  message: string;
}

export interface Session {
  userId: string;
  email: string;
  role: 'tenant' | 'management' | 'pm_manager' | 'pm_viewer' | 'technician';
  managementRole?: ManagementRole;
  name: string;
  /** For tenant sessions — which property/unit they belong to */
  tenantPropertyId?: string;
  tenantUnit?: string;
  /** For technician sessions — technicians.id (NOT profiles.id) */
  technicianId?: string;
  expiresAt: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ---- Input types (omit server-generated fields) ----

export type CreateRequestInput = Omit<Request, 'id' | 'timeline'>;
export type CreateUserInput = Omit<User, 'id'> & { propertyIds?: string[]; password?: string };
export type NewMessage = Omit<Message, 'id' | 'time' | 'read'>;
export type CreateProjectInput = Omit<Project, 'id' | 'unitTypes' | 'unitInstances' | 'documentCategoryNames' | 'customDocumentCategories'> & {
  unitTypes?: Omit<ProjectUnit, 'id'>[];
};
export type ProjectActivityInput = Omit<ProjectActivity, 'id'>;
export type ProjectUnitInput = Omit<ProjectUnit, 'id'>;
export type UnitInstanceInput = Omit<UnitInstance, 'id'>;
export type ProjectRiskInput = Omit<ProjectRisk, 'id'>;
export type IpcEntryInput = Omit<IpcEntry, 'id' | 'attachments'>;
export type CreateAnnouncementInput = Omit<Announcement, 'id' | 'createdAt'>;
export type LeaseInput = Omit<PropertyDocument, 'id' | 'uploadDate'> & {
  propertyId: string;
  unit: string;
  tenantName: string;
  tenantEmail?: string;
  termStart: string;
  termEnd: string;
  rent: number;
  deposit: number;
  rentStatus: 'paid' | 'due';
  status: 'occupied' | 'vacant';
  tenantId?: string;
};

// ---- The interface ----

export interface DataSource {
  auth: {
    getSession(): Promise<Session | null>;
    signInWithPassword(email: string, password: string): Promise<Session>;
    signOut(): Promise<void>;
    onAuthStateChange(cb: (session: Session | null) => void): () => void;
    updatePassword(newPassword: string): Promise<void>;
  };
  properties: {
    list(params?: PaginationParams): Promise<PaginatedResult<Property>>;
    get(id: string): Promise<Property>;
    create(input: Omit<Property, 'id' | 'openRequests' | 'emergency'>): Promise<Property>;
  };
  requests: {
    list(filters?: { propertyId?: string; status?: RequestStatus; tenantId?: string; technicianId?: string }, params?: PaginationParams): Promise<PaginatedResult<Request>>;
    get(id: string): Promise<Request>;
    create(input: CreateRequestInput): Promise<Request>;
    update(id: string, changes: Partial<Request>): Promise<Request>;
    addTimelineEvent(id: string, event: Omit<TimelineEvent, 'id'>): Promise<Request>;
  };
  technicians: {
    list(): Promise<Technician[]>;
  };
  users: {
    list(): Promise<User[]>;
    create(input: CreateUserInput): Promise<User>;
    provisionTenant(input: { email: string; fullName: string; role: string; tenantPropertyId?: string; tenantUnit?: string; leaseId?: string }): Promise<{ userId: string }>;
  };
  messages: {
    list(threadId: string): Promise<Message[]>;
    send(threadId: string, msg: NewMessage): Promise<Message>;
    markThreadRead(threadId: string): Promise<void>;
    listThreads(): Promise<{ threadId: string; messages: Message[]; participant?: { name: string; role: string; unit?: string; propertyName?: string }; lastMessageAt?: string }[]>;
  };
  notifications: {
    list(): Promise<Notification[]>;
    markAllRead(): Promise<void>;
    push(n: Omit<Notification, 'id' | 'time' | 'read'>): Promise<void>;
    listForTenant(tenantEmail: string): Promise<Notification[]>;
    markAllReadForTenant(tenantEmail: string): Promise<void>;
    pushForTenant(tenantEmail: string, n: Omit<Notification, 'id' | 'time' | 'read'>): Promise<void>;
  };
  preferences: {
    get(): Promise<Preferences>;
    update(changes: Partial<Preferences>): Promise<Preferences>;
  };
  leases: {
    list(propertyId?: string): Promise<import('@/types').FmUnit[]>;
    create(input: { propertyId: string; label: string; status: 'occupied' | 'vacant'; tenant?: string; tenantEmail?: string; rent?: number; leaseStart?: string; leaseEnd?: string }): Promise<import('@/types').FmUnit>;
    update(id: string, changes: Partial<import('@/types').FmUnit>): Promise<import('@/types').FmUnit>;
    delete(id: string): Promise<void>;
  };
  propertyDocuments: {
    list(propertyId: string): Promise<PropertyDocument[]>;
    upload(propertyId: string, file: File): Promise<PropertyDocument>;
    delete(propertyId: string, documentId: string): Promise<void>;
  };
  projects: {
    list(params?: PaginationParams): Promise<PaginatedResult<Project>>;
    get(id: string): Promise<Project>;
    create(input: CreateProjectInput): Promise<Project>;
    update(id: string, changes: Partial<Project>): Promise<Project>;
    addUnit(projectId: string, unit: ProjectUnitInput): Promise<ProjectUnit>;
    updateUnit(projectId: string, unitId: string, changes: Partial<ProjectUnit>): Promise<ProjectUnit>;
    deleteUnit(projectId: string, unitId: string): Promise<void>;
    addUnitInstance(projectId: string, unit: UnitInstanceInput): Promise<UnitInstance>;
    updateUnitInstance(projectId: string, unitId: string, changes: Partial<UnitInstance>): Promise<UnitInstance>;
    deleteUnitInstance(projectId: string, unitId: string): Promise<void>;
  };
  activities: {
    list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<ProjectActivity>>;
    create(projectId: string, activity: ProjectActivityInput): Promise<ProjectActivity>;
    update(projectId: string, activityId: string, changes: Partial<ProjectActivity>): Promise<ProjectActivity>;
    delete(projectId: string, activityId: string): Promise<void>;
    addPhoto(projectId: string, activityId: string, file: File): Promise<ActivityPhoto>;
  };
  documents: {
    list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<ProjectDocument>>;
    listCategories(projectId: string): Promise<DocumentCategoryRecord[]>;
    upload(projectId: string, file: File, categoryId: string): Promise<ProjectDocument>;
    create(projectId: string, categoryId: string, doc: { name: string; nameEn: string; type: string; uploadDate: string }): Promise<ProjectDocument>;
    update(projectId: string, documentId: string, changes: Partial<Pick<ProjectDocument, 'name' | 'nameEn' | 'categoryId'>>): Promise<ProjectDocument>;
    delete(projectId: string, documentId: string): Promise<void>;
    renameCategory(projectId: string, categoryId: string, names: { name: string; nameEn: string }): Promise<void>;
    addCategory(projectId: string, names: { name: string; nameEn: string }): Promise<DocumentCategoryRecord>;
    removeCategory(projectId: string, categoryId: string): Promise<void>;
  };
  risks: {
    list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<ProjectRisk>>;
    create(projectId: string, risk: ProjectRiskInput): Promise<ProjectRisk>;
    update(projectId: string, riskId: string, changes: Partial<ProjectRisk>): Promise<ProjectRisk>;
    delete(projectId: string, riskId: string): Promise<void>;
    addPhoto(projectId: string, riskId: string, file: File): Promise<ActivityPhoto>;
  };
  ipc: {
    list(projectId: string, params?: PaginationParams): Promise<PaginatedResult<IpcEntry>>;
    create(projectId: string, entry: IpcEntryInput): Promise<IpcEntry>;
    update(projectId: string, entryId: string, changes: Partial<IpcEntry>): Promise<IpcEntry>;
    delete(projectId: string, entryId: string): Promise<void>;
    addAttachment(projectId: string, entryId: string, file: File): Promise<IpcAttachment>;
  };
  announcements: {
    list(propertyId?: string): Promise<Announcement[]>;
    create(input: CreateAnnouncementInput): Promise<Announcement>;
    delete(id: string): Promise<void>;
  };
  storage: {
    upload(bucket: string, path: string, file: File): Promise<{ url: string; path: string }>;
    remove(bucket: string, path: string): Promise<void>;
  };
}
