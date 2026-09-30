export type Language = 'ar' | 'en';
export type Role = 'tenant' | 'management' | null;
export type RequestType = 'preventive' | 'corrective' | 'emergency';
export type RequestStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'resolved';
export type Category = 'ac' | 'plumbing' | 'electrical' | 'common';
export type ManagementRole = 'super_admin' | 'facility_manager' | 'technician' | 'owner' | 'pm_manager';

export type Suite = 'hub' | 'fm' | 'pm';
export type ProjectStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed';
export type ActivityStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'risk';
export type ActivityPhase = 'milestone' | 'mobilization' | 'engineering' | 'procurement' | 'construction' | 'finishing' | 'testing';

export type UnitCategory = 'villa' | 'floor' | 'townhouse';
export type TownhouseType = 'A' | 'B';
export type FloorLevel = 'ground' | '1' | '2';

export interface ProjectUnit {
  id: string;
  type: string;
  typeEn: string;
  size: number;
  bedrooms: number;
  unitCount: number;
  image: string;
  floorPlan: string;
  model3d: string;
  brochure: string;
  category?: UnitCategory;
}

export interface UnitInstance {
  id: string;
  modelId: string;
  label: string;
  labelEn: string;
  floor: number;
  status: 'available' | 'reserved' | 'sold';
  floorPlan: string;
  model3d: string;
  brochure: string;
  price?: number;
  space?: number;
  attachmentName?: string;
  floorLevel?: FloorLevel;
  townhouseType?: TownhouseType;
}

export interface Project {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  locationEn: string;
  totalUnits: number;
  unitTypes: ProjectUnit[];
  unitInstances: UnitInstance[];
  startDate: string;
  endDate: string;
  totalDays: number;
  contractor: string;
  contractorEn: string;
  budget: number;
  status: ProjectStatus;
  description?: string;
  descriptionEn?: string;
  contractNumber?: string;
  consultant?: string;
  consultantEn?: string;
  documentCategoryNames?: Partial<Record<DocumentCategory, { name: string; nameEn: string }>>;
  customDocumentCategories?: CustomDocumentCategory[];
}

export interface ActivityPhoto {
  id: string;
  dataUrl: string;
  uploadDate: string;
  fileType?: 'image' | 'pdf' | 'video' | 'other';
  fileName?: string;
}

export interface ProjectActivity {
  id: string;
  activityId: string;
  name: string;
  nameEn: string;
  phase: ActivityPhase;
  startDay: number;
  endDay: number;
  duration: number;
  percentComplete: number;
  actualProgress?: number;
  status: ActivityStatus;
  team: string;
  teamEn: string;
  description: string;
  descriptionEn: string;
  actualCost: number;
  plannedCost: number;
  changeOrderAmount?: number;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  photos?: ActivityPhoto[];
}

export type DocumentCategory = 'contracts' | 'master_plan' | 'construction_files' | 'permits' | 'reports' | 'correspondence' | (string & {});

export const documentCategories: DocumentCategory[] = ['contracts', 'master_plan', 'construction_files', 'permits', 'reports', 'correspondence'];

export interface CustomDocumentCategory {
  id: string;
  name: string;
  nameEn: string;
}

export interface DocumentCategoryRecord {
  id: string;
  projectId: string;
  key: string;
  name: string;
  nameEn: string;
  isDefault: boolean;
}

export interface ProjectDocument {
  id: string;
  name: string;
  nameEn: string;
  type: string;
  uploadDate: string;
  category?: DocumentCategory;
  categoryId: string;
  categoryName: string;
  categoryNameEn: string;
  url?: string;
}

export interface ProjectRisk {
  id: string;
  name: string;
  nameEn: string;
  dateRaised: string;
  responsible: string;
  responsibleEn: string;
  description: string;
  descriptionEn: string;
  deadline: string;
  reason: string;
  reasonEn: string;
  photos?: ActivityPhoto[];
  result?: RiskResult;
}

export type RiskResult = 'pending' | 'in_progress' | 'resolved' | 'delayed';

export type IpcStatus = 'in_progress' | 'delayed' | 'completed';
export type IpcDirection = 'incoming' | 'outgoing';
export type IpcSource = 'contractor' | 'consultant';

export interface IpcAttachment {
  id: string;
  fileName: string;
  fileType: 'image' | 'pdf' | 'video' | 'other';
  uploadDate: string;
  url?: string;
}

export interface IpcEntry {
  id: string;
  projectId: string;
  direction: IpcDirection;
  source?: IpcSource;
  partyName?: string;
  partyNameEn?: string;
  reference?: string;
  activityId?: string;
  amount: number;
  description: string;
  descriptionEn?: string;
  status: IpcStatus;
  dateLogged: string;
  attachments: IpcAttachment[];
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  emergency?: boolean;
  projectId?: string;
}

export interface TimelineEvent {
  id: string;
  status: RequestStatus;
  label: string;
  time: string;
  actor: string;
}

export interface Request {
  id: string;
  propertyId: string;
  unit: string;
  tenant: string;
  tenantEmail: string;
  tenantId?: string;
  type: RequestType;
  category: Category;
  description: string;
  status: RequestStatus;
  priority: 'normal' | 'high' | 'critical';
  date: string;
  photo?: string;
  technicianId?: string;
  timeline: TimelineEvent[];
}

export interface Property {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  units: number;
  occupied: number;
  openRequests: number;
  emergency: number;
  accent: string;
  unitLabels?: string[];
}

export interface Technician {
  id: string;
  name: string;
  nameEn: string;
  specialty: string;
  resolved: number;
  sla: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: ManagementRole;
  properties: string[];
}

export interface Lease {
  unit: string;
  property: string;
  term: string;
  rent: number;
  deposit: number;
  rentStatus: 'paid' | 'due';
}

export interface FmUnit {
  id: string;
  propertyId: string;
  label: string;
  status: 'occupied' | 'vacant';
  tenant?: string;
  tenantEmail?: string;
  tenantId?: string;
  rent?: number;
  leaseStart?: string;
  leaseEnd?: string;
}

export interface FmDocument {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  uploadDate: string;
  fileUrl?: string;
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  name: string;
  nameEn: string;
  type: string;
  fileUrl?: string;
  uploadDate: string;
}

export interface Message {
  id: string;
  from: 'tenant' | 'manager';
  text: string;
  textEn: string;
  time: string;
  read: boolean;
}

export interface Preferences {
  immediateEmergency: boolean;
  dailySummary: boolean;
  smsAlerts: boolean;
  requestUpdates: boolean;
  announcements: boolean;
  rentReminders: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  propertyId: string | 'all';
  createdAt: string;
  createdBy: string;
}

export interface AppState {
  currentRole: Role;
  language: Language;
  notifications: Notification[];
  requests: Request[];
  properties: Property[];
  technicians: Technician[];
  users: User[];
  messages: Message[];
  preferences: Preferences;
  lease: Lease;
  toast: string | null;
  currentSuite: Suite;
  projects: Project[];
  projectActivities: Record<string, ProjectActivity[]>;
  projectDocuments: Record<string, ProjectDocument[]>;
  projectRisks: Record<string, ProjectRisk[]>;
  projectIpcEntries: Record<string, IpcEntry[]>;
  fmUnits: FmUnit[];
  fmDocuments: FmDocument[];
}

export type Action =
  | { type: 'SET_ROLE'; role: Role }
  | { type: 'SET_LANGUAGE'; language: Language }
  | { type: 'CREATE_REQUEST'; request: Request }
  | { type: 'UPDATE_REQUEST'; id: string; changes: Partial<Request> }
  | { type: 'ADD_NOTIFICATION'; notification: Notification }
  | { type: 'MARK_NOTIFICATIONS_READ' }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'ADD_USER'; user: User }
  | { type: 'SET_PREFERENCE'; key: keyof Preferences; value: boolean }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SET_SUITE'; suite: Suite }
  | { type: 'UPDATE_PROJECT'; projectId: string; changes: Partial<Project> }
  | { type: 'ADD_PROJECT'; project: Project; activities: ProjectActivity[]; documents: ProjectDocument[]; risks: ProjectRisk[] }
  | { type: 'UPDATE_ACTIVITY'; projectId: string; activityId: string; changes: Partial<ProjectActivity> }
  | { type: 'ADD_ACTIVITY'; projectId: string; activity: ProjectActivity }
  | { type: 'DELETE_ACTIVITY'; projectId: string; activityId: string }
  | { type: 'ADD_UNIT'; projectId: string; unit: ProjectUnit }
  | { type: 'UPDATE_UNIT'; projectId: string; unitId: string; changes: Partial<ProjectUnit> }
  | { type: 'DELETE_UNIT'; projectId: string; unitId: string }
  | { type: 'ADD_UNIT_INSTANCE'; projectId: string; unit: UnitInstance }
  | { type: 'UPDATE_UNIT_INSTANCE'; projectId: string; unitId: string; changes: Partial<UnitInstance> }
  | { type: 'DELETE_UNIT_INSTANCE'; projectId: string; unitId: string }
  | { type: 'ADD_DOCUMENT'; projectId: string; document: ProjectDocument }
  | { type: 'UPDATE_DOCUMENT'; projectId: string; documentId: string; changes: Partial<ProjectDocument> }
  | { type: 'DELETE_DOCUMENT'; projectId: string; documentId: string }
  | { type: 'ADD_RISK'; projectId: string; risk: ProjectRisk }
  | { type: 'UPDATE_RISK'; projectId: string; riskId: string; changes: Partial<ProjectRisk> }
  | { type: 'DELETE_RISK'; projectId: string; riskId: string }
  | { type: 'ADD_IPC_ENTRY'; projectId: string; entry: IpcEntry }
  | { type: 'UPDATE_IPC_ENTRY'; projectId: string; entryId: string; changes: Partial<IpcEntry> }
  | { type: 'DELETE_IPC_ENTRY'; projectId: string; entryId: string }
  | { type: 'RENAME_DOCUMENT_CATEGORY'; projectId: string; category: DocumentCategory; names: { name: string; nameEn: string } }
  | { type: 'ADD_DOCUMENT_CATEGORY'; projectId: string; category: CustomDocumentCategory }
  | { type: 'REMOVE_DOCUMENT_CATEGORY'; projectId: string; categoryId: string }
  | { type: 'ADD_FM_UNIT'; unit: FmUnit }
  | { type: 'UPDATE_FM_UNIT'; unitId: string; changes: Partial<FmUnit> }
  | { type: 'ADD_FM_DOCUMENT'; document: FmDocument }
  | { type: 'DELETE_FM_DOCUMENT'; documentId: string }
;
