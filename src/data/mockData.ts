import type { AppState, Property, Request, Technician, User } from '@/types';
import { projects, projectActivities, projectDocuments, projectRisks, projectIpcEntries } from '@/data/pmMockData';

export const properties: Property[] = [
  { id: 'jazly', name: 'ساحة جازلي', nameEn: 'Jazly Plaza', location: 'حي الملقا، الرياض', units: 84, occupied: 78, openRequests: 6, emergency: 1, accent: '#b86b4b', unitLabels: ['A-101', 'A-102', 'A-103', 'A-104', 'A-201', 'A-202', 'A-203', 'A-204', 'A-205'] },
  { id: 'qurtuba', name: 'واحة قرطبة', nameEn: 'Wahat Qurtuba', location: 'قرطبة، الرياض', units: 112, occupied: 104, openRequests: 9, emergency: 2, accent: '#637b8e', unitLabels: ['B-101', 'B-102', 'B-103', 'B-104', 'B-201', 'B-202', 'B-203', 'B-204'] },
  { id: 'ajou', name: 'ساحة العجو', nameEn: 'Al-Ajou Square', location: 'النرجس، الرياض', units: 68, occupied: 61, openRequests: 4, emergency: 0, accent: '#a8795e', unitLabels: ['C-101', 'C-102', 'C-201', 'C-202', 'C-301', 'C-302'] },
  { id: 'arid', name: 'فلل مدرار العارض', nameEn: 'MDRAR Al-Arid Villas', location: 'العارض، الرياض', units: 42, occupied: 39, openRequests: 3, emergency: 0, accent: '#788d7b', unitLabels: ['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12'] },
  { id: 'nasriyah', name: 'مجمع الناصرية السكني', nameEn: 'Al-Nasriyah Residential Compound', location: 'الناصرية، الرياض', units: 96, occupied: 90, openRequests: 7, emergency: 1, accent: '#9b735e', unitLabels: ['D-101', 'D-102', 'D-201', 'D-202', 'D-301', 'D-302', 'D-401', 'D-408'] },
  { id: 'munsiyah', name: 'واحة المونسية', nameEn: 'Wahat Al-Munsiyah', location: 'المونسية، الرياض', units: 76, occupied: 69, openRequests: 5, emergency: 0, accent: '#6b7f83', unitLabels: ['E-101', 'E-102', 'E-115', 'E-201', 'E-202'] },
  { id: 'narjis', name: 'واحة النرجس', nameEn: 'Wahat Al-Narjis', location: 'النرجس، الرياض', units: 58, occupied: 55, openRequests: 2, emergency: 0, accent: '#a4866d', unitLabels: ['F-101', 'F-102', 'F-201', 'F-202'] },
  { id: 'wadi', name: 'مساكن وادي الدواسر', nameEn: 'Wadi Al Dawasir Residences', location: 'الياسمين، الرياض', units: 88, occupied: 81, openRequests: 5, emergency: 1, accent: '#718475', unitLabels: ['G-001', 'G-002', 'G-016', 'G-101', 'G-102'] },
];

export const technicians: Technician[] = [
  { id: 'tech-1', name: 'سالم القحطاني', nameEn: 'Salem Al-Qahtani', specialty: 'تكييف', resolved: 38, sla: 96 },
  { id: 'tech-2', name: 'فهد العتيبي', nameEn: 'Fahad Al-Otaibi', specialty: 'سباكة', resolved: 31, sla: 92 },
  { id: 'tech-3', name: 'ناصر الحربي', nameEn: 'Nasser Al-Harbi', specialty: 'كهرباء', resolved: 27, sla: 89 },
  { id: 'tech-4', name: 'أحمد منصور', nameEn: 'Ahmed Mansour', specialty: 'عام', resolved: 24, sla: 94 },
];

export const requests: Request[] = [
  { id: 'REQ-1048', propertyId: 'jazly', unit: 'A-204', tenant: 'محمد العتيبي', tenantEmail: 'm.alotaibi@example.com', type: 'emergency', category: 'ac', description: 'تسرب ماء كبير من وحدة التكييف في غرفة المعيشة ويحتاج إلى تدخل عاجل.', status: 'submitted', priority: 'critical', date: '2026-08-30', technicianId: 'tech-1', timeline: [{ id: 't1', status: 'submitted', label: 'تم إرسال الطلب', time: '30 أغسطس، 10:42 ص', actor: 'محمد العتيبي' }] },
  { id: 'REQ-1047', propertyId: 'qurtuba', unit: 'B-110', tenant: 'Sarah Johnson', tenantEmail: 'sarah.j@example.com', type: 'corrective', category: 'plumbing', description: 'The kitchen faucet is leaking continuously and needs repair.', status: 'in_progress', priority: 'high', date: '2026-08-29', technicianId: 'tech-2', timeline: [{ id: 't2', status: 'submitted', label: 'Request submitted', time: '29 Aug, 09:20 AM', actor: 'Sarah Johnson' }, { id: 't3', status: 'in_progress', label: 'Work started', time: '29 Aug, 01:15 PM', actor: 'Fahad Al-Otaibi' }] },
  { id: 'REQ-1046', propertyId: 'ajou', unit: 'C-302', tenant: 'ريم السالم', tenantEmail: 'reem@example.com', type: 'preventive', category: 'electrical', description: 'فحص دوري لمفاتيح الإضاءة في الوحدة.', status: 'acknowledged', priority: 'normal', date: '2026-08-28', technicianId: 'tech-3', timeline: [{ id: 't4', status: 'submitted', label: 'تم إرسال الطلب', time: '28 أغسطس، 04:10 م', actor: 'ريم السالم' }, { id: 't5', status: 'acknowledged', label: 'تم استلام الطلب', time: '28 أغسطس، 05:00 م', actor: 'فريق الإدارة' }] },
  { id: 'REQ-1045', propertyId: 'arid', unit: 'V-12', tenant: 'Omar Hassan', tenantEmail: 'omar@example.com', type: 'corrective', category: 'common', description: 'Pool lighting needs repair before the weekend.', status: 'resolved', priority: 'normal', date: '2026-08-25', technicianId: 'tech-4', timeline: [{ id: 't6', status: 'submitted', label: 'Request submitted', time: '25 Aug, 08:00 AM', actor: 'Omar Hassan' }, { id: 't7', status: 'resolved', label: 'Resolved', time: '26 Aug, 02:30 PM', actor: 'Ahmed Mansour' }] },
  { id: 'REQ-1044', propertyId: 'nasriyah', unit: 'D-408', tenant: 'عبدالله الزهراني', tenantEmail: 'abdullah@example.com', type: 'emergency', category: 'electrical', description: 'انقطاع الكهرباء مع رائحة احتراق في اللوحة الرئيسية.', status: 'acknowledged', priority: 'critical', date: '2026-08-24', technicianId: 'tech-3', timeline: [{ id: 't8', status: 'submitted', label: 'تم إرسال الطلب', time: '24 أغسطس، 11:05 ص', actor: 'عبدالله الزهراني' }, { id: 't9', status: 'acknowledged', label: 'تم تصعيد الطلب', time: '24 أغسطس، 11:12 ص', actor: 'فريق الإدارة' }] },
  { id: 'REQ-1043', propertyId: 'munsiyah', unit: 'E-115', tenant: 'Nora Al-Shehri', tenantEmail: 'nora@example.com', type: 'corrective', category: 'ac', description: 'Bedroom AC is making a loud noise during operation.', status: 'submitted', priority: 'high', date: '2026-08-23', timeline: [{ id: 't10', status: 'submitted', label: 'Request submitted', time: '23 Aug, 03:45 PM', actor: 'Nora Al-Shehri' }] },
  { id: 'REQ-1042', propertyId: 'narjis', unit: 'F-201', tenant: 'خالد الغامدي', tenantEmail: 'khalid@example.com', type: 'preventive', category: 'plumbing', description: 'فحص ضغط المياه الشهري للوحدة.', status: 'resolved', priority: 'normal', date: '2026-08-21', technicianId: 'tech-2', timeline: [{ id: 't11', status: 'resolved', label: 'تم إغلاق الطلب', time: '22 أغسطس، 01:20 م', actor: 'فهد العتيبي' }] },
  { id: 'REQ-1041', propertyId: 'wadi', unit: 'G-016', tenant: 'Liam Cooper', tenantEmail: 'liam@example.com', type: 'emergency', category: 'plumbing', description: 'Water is flooding the ground-floor hallway near unit G-016.', status: 'in_progress', priority: 'critical', date: '2026-08-20', technicianId: 'tech-2', timeline: [{ id: 't12', status: 'in_progress', label: 'Work started', time: '20 Aug, 07:15 AM', actor: 'Fahad Al-Otaibi' }] },
];

export const users: User[] = [
  { id: 'u1', name: 'خالد الشهري', email: 'khalid@mdrar.sa', role: 'super_admin', properties: ['all'] },
  { id: 'u2', name: 'Sarah Miller', email: 'sarah@mdrar.sa', role: 'facility_manager', properties: ['jazly', 'qurtuba'] },
  { id: 'u3', name: 'سالم القحطاني', email: 'salem@mdrar.sa', role: 'technician', properties: ['jazly', 'nasriyah'] },
  { id: 'u4', name: 'عبدالرحمن الراجحي', email: 'owner@mdrar.sa', role: 'owner', properties: ['arid', 'wadi'] },
];

export const initialState: AppState = {
  currentRole: null,
  language: 'ar',
  notifications: [
    { id: 'n1', title: 'طلب طارئ جديد', body: 'طلب REQ-1048 يحتاج إلى إجراء فوري', time: 'منذ 12 دقيقة', read: false, emergency: true },
    { id: 'n2', title: 'تذكير بالصيانة', body: '3 طلبات بانتظار التحديث', time: 'منذ ساعتين', read: false },
  ],
  requests,
  properties,
  technicians,
  users,
  messages: [
    { id: 'm1', from: 'manager', text: 'مرحباً بك، كيف يمكننا مساعدتك اليوم؟', textEn: 'Welcome, how can we help you today?', time: '10:32 ص' },
    { id: 'm2', from: 'tenant', text: 'أرغب بالاستفسار عن موعد الصيانة القادمة.', textEn: 'I would like to ask about the next maintenance appointment.', time: '10:34 ص' },
  ],
  preferences: {
    immediateEmergency: true,
    dailySummary: true,
    smsAlerts: false,
    requestUpdates: true,
    announcements: true,
    rentReminders: true,
  },
  lease: {
    unit: 'A-204',
    property: 'ساحة جازلي',
    term: '01 يناير 2026 — 31 ديسمبر 2026',
    rent: 72000,
    deposit: 6000,
    rentStatus: 'paid',
  },
  toast: null,
  currentSuite: 'hub',
  projects,
  projectActivities,
  projectDocuments,
  projectRisks,
  projectIpcEntries,
  fmUnits: [
    { id: 'fmu-1', propertyId: 'jazly', label: 'A-101', status: 'occupied', tenant: 'محمد العتيبي', tenantEmail: 'm.alotaibi@example.com', rent: 72000, leaseStart: '2026-01-01', leaseEnd: '2026-12-31' },
    { id: 'fmu-2', propertyId: 'jazly', label: 'A-102', status: 'vacant' },
    { id: 'fmu-3', propertyId: 'jazly', label: 'A-204', status: 'occupied', tenant: 'سارة الأحمد', tenantEmail: 'sara@example.com', rent: 68000, leaseStart: '2026-03-01', leaseEnd: '2027-02-28' },
    { id: 'fmu-4', propertyId: 'qurtuba', label: 'B-101', status: 'occupied', tenant: 'Sarah Johnson', tenantEmail: 'sarah.j@example.com', rent: 85000, leaseStart: '2026-02-01', leaseEnd: '2027-01-31' },
    { id: 'fmu-5', propertyId: 'qurtuba', label: 'B-110', status: 'vacant' },
  ],
  fmDocuments: [
    { id: 'fmd-1', propertyId: 'jazly', name: 'مخطط الموقع', type: 'pdf', uploadDate: '2025-01-15' },
    { id: 'fmd-2', propertyId: 'jazly', name: 'دليل التشغيل والصيانة', type: 'pdf', uploadDate: '2025-01-15' },
    { id: 'fmd-3', propertyId: 'qurtuba', name: 'Site Plan', type: 'pdf', uploadDate: '2025-02-10' },
  ],
};
