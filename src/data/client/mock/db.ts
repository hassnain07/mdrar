/**
 * Mock "database" — in-memory tables seeded from existing mock data,
 * persisted per-table to localStorage. Schema version bump wipes stale data.
 */
import type {
  Property, Request, Technician, User, Message, Preferences,
  Notification, Project, ProjectActivity, ProjectDocument, ProjectRisk, IpcEntry, Announcement, FmUnit, FmDocument,
} from '@/types';
import type { Session } from '@/data/client/dataSource';

export interface AuthUser {
  email: string;
  password: string;
  name: string;
  role: Session['role'];
  managementRole?: Session['managementRole'];
  tenantPropertyId?: string;
  tenantUnit?: string;
}
import {
  properties as seedProperties,
  requests as seedRequests,
  technicians as seedTechnicians,
  users as seedUsers,
} from '@/data/mockData';
import { initialState } from '@/data/mockData';
import {
  projects as seedProjects,
  projectActivities as seedActivities,
  projectDocuments as seedDocuments,
  projectRisks as seedRisks,
  projectIpcEntries as seedIpc,
} from '@/data/pmMockData';

const SCHEMA_VERSION = 'v2';

function loadTable<T>(key: string, seed: T): T {
  try {
    const versionKey = `mdrar_mock_schema_${key}`;
    const storedVersion = localStorage.getItem(versionKey);
    if (storedVersion !== SCHEMA_VERSION) {
      localStorage.removeItem(`mdrar_mock_${key}`);
      localStorage.setItem(versionKey, SCHEMA_VERSION);
      return seed;
    }
    const raw = localStorage.getItem(`mdrar_mock_${key}`);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return seed;
}

function saveTable<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`mdrar_mock_${key}`, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

// ---- Seed auth users ----
const SEED_AUTH_USERS: AuthUser[] = [
  { email: 'khalid@mdrar.sa',          password: 'password', name: 'خالد الشهري',       role: 'management', managementRole: 'super_admin' },
  { email: 'sarah@mdrar.sa',           password: 'password', name: 'Sarah Miller',       role: 'management', managementRole: 'facility_manager' },
  { email: 'salem@mdrar.sa',           password: 'password', name: 'سالم القحطاني',      role: 'technician', managementRole: 'technician' },
  { email: 'fahad@mdrar.sa',           password: 'password', name: 'فهد العتيبي',        role: 'technician', managementRole: 'technician' },
  { email: 'owner@mdrar.sa',           password: 'password', name: 'عبدالرحمن الراجحي', role: 'management', managementRole: 'owner' },
  { email: 'pm@mdrar.sa',              password: 'password', name: 'PM Manager',         role: 'pm_manager' },
  { email: 'm.alotaibi@example.com',   password: 'password', name: 'محمد العتيبي',       role: 'tenant', tenantPropertyId: 'jazly', tenantUnit: 'A-204' },
  { email: 'sarah.j@example.com',      password: 'password', name: 'Sarah Johnson',      role: 'tenant', tenantPropertyId: 'qurtuba', tenantUnit: 'B-110' },
];

// ---- Tables ----
export const db = {
  authUsers: loadTable<AuthUser[]>('authUsers', SEED_AUTH_USERS),
  properties: loadTable<Property[]>('properties', seedProperties),
  requests: loadTable<Request[]>('requests', seedRequests),
  technicians: loadTable<Technician[]>('technicians', seedTechnicians),
  users: loadTable<User[]>('users', seedUsers),
  messages: loadTable<Message[]>('messages', [
    { id: 'm1', from: 'manager', text: 'مرحباً بك، كيف يمكننا مساعدتك اليوم؟', textEn: 'Welcome, how can we help you today?', time: new Date(Date.now() - 3600_000).toISOString(), read: true },
    { id: 'm2', from: 'tenant', text: 'أرغب بالاستفسار عن موعد الصيانة القادمة.', textEn: 'I would like to ask about the next maintenance appointment.', time: new Date(Date.now() - 3540_000).toISOString(), read: false },
  ]),
  // Global notifications (management bucket — default)
  notifications: loadTable<Notification[]>('notifications', [
    { id: 'n1', title: 'طلب طارئ جديد', body: 'طلب REQ-1048 يحتاج إلى إجراء فوري', time: 'منذ 12 دقيقة', read: false, emergency: true },
    { id: 'n2', title: 'تذكير بالصيانة', body: '3 طلبات بانتظار التحديث', time: 'منذ ساعتين', read: false },
  ]),
  // Per-tenant notifications keyed by tenantEmail
  tenantNotifications: loadTable<Record<string, Notification[]>>('tenantNotifications', {}),
  announcements: loadTable<Announcement[]>('announcements', [
    { id: 'ann-1', title: 'فحص أنظمة التكييف', titleEn: 'AC Systems Inspection', body: 'سيتم إجراء فحص دوري لأنظمة التكييف في المبنى يوم الخميس القادم من الساعة 9 صباحاً حتى 12 ظهراً.', bodyEn: 'A routine inspection of the building AC systems is scheduled for next Thursday from 9 AM to 12 PM.', propertyId: 'all', createdAt: new Date().toISOString(), createdBy: 'خالد الشهري' },
  ]),
  preferences: loadTable<Preferences>('preferences', {
    immediateEmergency: true,
    dailySummary: true,
    smsAlerts: false,
    requestUpdates: true,
    announcements: true,
    rentReminders: true,
  }),
  projects: loadTable<Project[]>('projects', seedProjects),
  projectActivities: loadTable<Record<string, ProjectActivity[]>>('projectActivities', seedActivities),
  projectDocuments: loadTable<Record<string, ProjectDocument[]>>('projectDocuments', seedDocuments),
  projectRisks: loadTable<Record<string, ProjectRisk[]>>('projectRisks', seedRisks),
  projectIpcEntries: loadTable<Record<string, IpcEntry[]>>('projectIpcEntries', seedIpc),
  fmUnits: loadTable<FmUnit[]>('fmUnits', initialState.fmUnits),
  fmDocuments: loadTable<FmDocument[]>('fmDocuments', initialState.fmDocuments),
};

// ---- Persist helpers ----
export const persist = {
  authUsers: () => saveTable('authUsers', db.authUsers),
  properties: () => saveTable('properties', db.properties),
  requests: () => saveTable('requests', db.requests),
  technicians: () => saveTable('technicians', db.technicians),
  users: () => saveTable('users', db.users),
  messages: () => saveTable('messages', db.messages),
  notifications: () => saveTable('notifications', db.notifications),
  tenantNotifications: () => saveTable('tenantNotifications', db.tenantNotifications),
  announcements: () => saveTable('announcements', db.announcements),
  preferences: () => saveTable('preferences', db.preferences),
  projects: () => saveTable('projects', db.projects),
  projectActivities: () => saveTable('projectActivities', db.projectActivities),
  projectDocuments: () => saveTable('projectDocuments', db.projectDocuments),
  projectRisks: () => saveTable('projectRisks', db.projectRisks),
  projectIpcEntries: () => saveTable('projectIpcEntries', db.projectIpcEntries),
  fmUnits: () => saveTable('fmUnits', db.fmUnits),
  fmDocuments: () => saveTable('fmDocuments', db.fmDocuments),
};

/** Dev helper — wipe all mock tables and reload seed data */
export function resetMockDb(): void {
  const keys = ['authUsers','properties','requests','technicians','users','messages','notifications','tenantNotifications','announcements','preferences','projects','projectActivities','projectDocuments','projectRisks','projectIpcEntries','fmUnits','fmDocuments'];
  keys.forEach((k) => {
    localStorage.removeItem(`mdrar_mock_${k}`);
    localStorage.removeItem(`mdrar_mock_schema_${k}`);
  });
  window.location.reload();
}

/**
 * Dev helper — clear ALL data and leave only the super_admin account.
 * Mirrors what reset_to_super_admin_only.sql does for Supabase.
 * Login after reset: admin@mdrar.sa / Admin@1234
 */
export function resetMockDbClean(): void {
  const superAdmin: AuthUser = {
    email: 'admin@mdrar.sa',
    password: 'Admin@1234',
    name: 'System Administrator',
    role: 'management',
    managementRole: 'super_admin',
  };

  // Wipe every table key
  const keys = ['authUsers','properties','requests','technicians','users','messages','notifications','tenantNotifications','announcements','preferences','projects','projectActivities','projectDocuments','projectRisks','projectIpcEntries','fmUnits','fmDocuments'];
  keys.forEach((k) => {
    localStorage.removeItem(`mdrar_mock_${k}`);
    localStorage.removeItem(`mdrar_mock_schema_${k}`);
  });

  // Persist only the super_admin auth user; everything else stays empty
  localStorage.setItem('mdrar_mock_authUsers', JSON.stringify([superAdmin]));
  localStorage.setItem('mdrar_mock_schema_authUsers', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_properties', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_properties', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_requests', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_requests', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_technicians', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_technicians', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_users', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_users', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_messages', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_messages', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_notifications', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_notifications', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_tenantNotifications', JSON.stringify({}));
  localStorage.setItem('mdrar_mock_schema_tenantNotifications', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_announcements', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_announcements', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_projects', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_projects', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_projectActivities', JSON.stringify({}));
  localStorage.setItem('mdrar_mock_schema_projectActivities', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_projectDocuments', JSON.stringify({}));
  localStorage.setItem('mdrar_mock_schema_projectDocuments', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_projectRisks', JSON.stringify({}));
  localStorage.setItem('mdrar_mock_schema_projectRisks', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_projectIpcEntries', JSON.stringify({}));
  localStorage.setItem('mdrar_mock_schema_projectIpcEntries', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_fmUnits', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_fmUnits', SCHEMA_VERSION);
  localStorage.setItem('mdrar_mock_fmDocuments', JSON.stringify([]));
  localStorage.setItem('mdrar_mock_schema_fmDocuments', SCHEMA_VERSION);

  window.location.reload();
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__resetMockDb = resetMockDb;
  (window as unknown as Record<string, unknown>).__resetMockDbClean = resetMockDbClean;
}
