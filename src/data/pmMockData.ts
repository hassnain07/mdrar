import type { Project, ProjectActivity, ProjectDocument, ProjectRisk, ActivityPhase, DocumentCategory, IpcEntry } from '@/types';

export const projects: Project[] = [
  {
    id: 'rimal',
    name: 'فلل الرمال',
    nameEn: 'Al Rimal Villas',
    location: 'العارض، الرياض',
    locationEn: 'Al-Arid, Riyadh',
    totalUnits: 64,
    unitTypes: [
      { id: 'rimal-a', type: 'فيلا نوع A', typeEn: 'Type A Villa', size: 420, bedrooms: 5, unitCount: 20, image: 'rimal-a', floorPlan: 'rimal-a-plan', model3d: 'rimal-a-3d', brochure: 'rimal-a-brochure' },
      { id: 'rimal-b', type: 'فيلا نوع B', typeEn: 'Type B Villa', size: 350, bedrooms: 4, unitCount: 24, image: 'rimal-b', floorPlan: 'rimal-b-plan', model3d: 'rimal-b-3d', brochure: 'rimal-b-brochure' },
      { id: 'rimal-c', type: 'فيلا نوع C', typeEn: 'Type C Villa', size: 280, bedrooms: 3, unitCount: 20, image: 'rimal-c', floorPlan: 'rimal-c-plan', model3d: 'rimal-c-3d', brochure: 'rimal-c-brochure' },
    ],
    startDate: '2026-02-28',
    endDate: '2027-02-28',
    totalDays: 365,
    contractor: 'شركة الإنشاءات المتقدمة',
    contractorEn: 'Advanced Construction Co.',
    budget: 185000000,
    status: 'on_track',
    unitInstances: [],
    consultant: 'مكتب الديار للاستشارات الهندسية',
    consultantEn: 'Al-Diyar Engineering Consulting',
    contractNumber: 'CON-2026-RIM-001',
  },
  {
    id: 'narjis2',
    name: 'واحة النرجس - المرحلة 2',
    nameEn: 'Wahat Al-Narjis Phase 2',
    location: 'النرجس، الرياض',
    locationEn: 'Al-Narjis, Riyadh',
    totalUnits: 48,
    unitTypes: [
      { id: 'narjis2-a', type: 'شقة نوع A', typeEn: 'Type A Apartment', size: 180, bedrooms: 3, unitCount: 28, image: 'narjis2-a', floorPlan: 'narjis2-a-plan', model3d: 'narjis2-a-3d', brochure: 'narjis2-a-brochure' },
      { id: 'narjis2-b', type: 'شقة نوع B', typeEn: 'Type B Apartment', size: 145, bedrooms: 2, unitCount: 20, image: 'narjis2-b', floorPlan: 'narjis2-b-plan', model3d: 'narjis2-b-3d', brochure: 'narjis2-b-brochure' },
    ],
    startDate: '2026-03-01',
    endDate: '2027-03-01',
    totalDays: 365,
    contractor: 'مجموعة البناء الحديث',
    contractorEn: 'Modern Building Group',
    budget: 142000000,
    status: 'on_track',
    unitInstances: [],
    consultant: 'مكتب النخبة للاستشارات',
    consultantEn: 'Elite Consulting Office',
    contractNumber: 'CON-2026-NAR-002',
  },
  {
    id: 'jazly-exp',
    name: 'توسعة ساحة جازلي',
    nameEn: 'Jazly Plaza Expansion',
    location: 'الملقا، الرياض',
    locationEn: 'Al-Malqa, Riyadh',
    totalUnits: 32,
    unitTypes: [
      { id: 'jazly-exp-a', type: 'محل تجاري', typeEn: 'Commercial Unit', size: 120, bedrooms: 0, unitCount: 18, image: 'jazly-exp-a', floorPlan: 'jazly-exp-a-plan', model3d: 'jazly-exp-a-3d', brochure: 'jazly-exp-a-brochure' },
      { id: 'jazly-exp-b', type: 'مكتب', typeEn: 'Office Unit', size: 85, bedrooms: 0, unitCount: 14, image: 'jazly-exp-b', floorPlan: 'jazly-exp-b-plan', model3d: 'jazly-exp-b-3d', brochure: 'jazly-exp-b-brochure' },
    ],
    startDate: '2026-07-01',
    endDate: '2027-06-01',
    totalDays: 334,
    contractor: 'شركة جازلي للإنشاء',
    contractorEn: 'Jazly Construction Co.',
    budget: 98000000,
    status: 'at_risk',
    unitInstances: [],
    consultant: 'مكتب جازلي الاستشاري',
    consultantEn: 'Jazly Consulting Bureau',
    contractNumber: 'CON-2026-JAZ-003',
  },
  {
    id: 'ajou-res',
    name: 'مساكن العجو',
    nameEn: 'Al-Ajou Residences',
    location: 'النرجس، الرياض',
    locationEn: 'Al-Narjis, Riyadh',
    totalUnits: 56,
    unitTypes: [
      { id: 'ajou-res-a', type: 'شقة نوع A', typeEn: 'Type A Apartment', size: 200, bedrooms: 3, unitCount: 32, image: 'ajou-res-a', floorPlan: 'ajou-res-a-plan', model3d: 'ajou-res-a-3d', brochure: 'ajou-res-a-brochure' },
      { id: 'ajou-res-b', type: 'شقة نوع B', typeEn: 'Type B Apartment', size: 160, bedrooms: 2, unitCount: 24, image: 'ajou-res-b', floorPlan: 'ajou-res-b-plan', model3d: 'ajou-res-b-3d', brochure: 'ajou-res-b-brochure' },
    ],
    startDate: '2025-10-01',
    endDate: '2026-12-01',
    totalDays: 426,
    contractor: 'شركة العجو العقارية',
    contractorEn: 'Al-Ajou Real Estate Co.',
    budget: 165000000,
    status: 'on_track',
    unitInstances: [],
    consultant: 'مكتب العجو للاستشارات',
    consultantEn: 'Al-Ajou Consulting Office',
    contractNumber: 'CON-2025-AJO-004',
  },
  {
    id: 'munsiyah',
    name: 'أبراج المونسية',
    nameEn: 'Wahat Al-Munsiyah Towers',
    location: 'المونسية، الرياض',
    locationEn: 'Al-Munsiyah, Riyadh',
    totalUnits: 72,
    unitTypes: [
      { id: 'munsiyah-a', type: 'شقة نوع A', typeEn: 'Type A Apartment', size: 190, bedrooms: 3, unitCount: 30, image: 'munsiyah-a', floorPlan: 'munsiyah-a-plan', model3d: 'munsiyah-a-3d', brochure: 'munsiyah-a-brochure' },
      { id: 'munsiyah-b', type: 'شقة نوع B', typeEn: 'Type B Apartment', size: 155, bedrooms: 2, unitCount: 32, image: 'munsiyah-b', floorPlan: 'munsiyah-b-plan', model3d: 'munsiyah-b-3d', brochure: 'munsiyah-b-brochure' },
      { id: 'munsiyah-c', type: 'بنتهاوس', typeEn: 'Penthouse', size: 320, bedrooms: 4, unitCount: 10, image: 'munsiyah-c', floorPlan: 'munsiyah-c-plan', model3d: 'munsiyah-c-3d', brochure: 'munsiyah-c-brochure' },
    ],
    startDate: '2026-01-01',
    endDate: '2027-02-01',
    totalDays: 396,
    contractor: 'شركة الإعمار الحضري',
    contractorEn: 'Urban Development Co.',
    budget: 210000000,
    status: 'on_track',
    unitInstances: [],
    consultant: 'مكتب الإعمار الحضري للاستشارات',
    consultantEn: 'Urban Development Consulting',
    contractNumber: 'CON-2026-MUN-005',
  },
  {
    id: 'nasriyah3',
    name: 'الناصرية - المرحلة 3',
    nameEn: 'Al-Nasriyah Phase 3',
    location: 'الناصرية، الرياض',
    locationEn: 'Al-Nasriyah, Riyadh',
    totalUnits: 40,
    unitTypes: [
      { id: 'nasriyah3-a', type: 'شقة نوع A', typeEn: 'Type A Apartment', size: 175, bedrooms: 3, unitCount: 22, image: 'nasriyah3-a', floorPlan: 'nasriyah3-a-plan', model3d: 'nasriyah3-a-3d', brochure: 'nasriyah3-a-brochure' },
      { id: 'nasriyah3-b', type: 'شقة نوع B', typeEn: 'Type B Apartment', size: 140, bedrooms: 2, unitCount: 18, image: 'nasriyah3-b', floorPlan: 'nasriyah3-b-plan', model3d: 'nasriyah3-b-3d', brochure: 'nasriyah3-b-brochure' },
    ],
    startDate: '2026-05-01',
    endDate: '2027-05-01',
    totalDays: 365,
    contractor: 'شركة الناصرية للإنشاء',
    contractorEn: 'Al-Nasriyah Construction Co.',
    budget: 128000000,
    status: 'delayed',
    unitInstances: [],
    consultant: 'مكتب الناصرية الاستشاري',
    consultantEn: 'Al-Nasriyah Consulting Office',
    contractNumber: 'CON-2026-NAS-006',
  },
  {
    id: 'wadi-ext',
    name: 'توسعة وادي الدواسر',
    nameEn: 'Wadi Al Dawasir Extension',
    location: 'الياسمين، الرياض',
    locationEn: 'Al-Yasmin, Riyadh',
    totalUnits: 28,
    unitTypes: [
      { id: 'wadi-ext-a', type: 'فيلا نوع A', typeEn: 'Type A Villa', size: 380, bedrooms: 4, unitCount: 16, image: 'wadi-ext-a', floorPlan: 'wadi-ext-a-plan', model3d: 'wadi-ext-a-3d', brochure: 'wadi-ext-a-brochure' },
      { id: 'wadi-ext-b', type: 'فيلا نوع B', typeEn: 'Type B Villa', size: 300, bedrooms: 3, unitCount: 12, image: 'wadi-ext-b', floorPlan: 'wadi-ext-b-plan', model3d: 'wadi-ext-b-3d', brochure: 'wadi-ext-b-brochure' },
    ],
    startDate: '2026-08-01',
    endDate: '2027-08-01',
    totalDays: 365,
    contractor: 'شركة وادي الإنشاء',
    contractorEn: 'Wadi Construction Co.',
    budget: 89000000,
    status: 'on_track',
    unitInstances: [],
    consultant: 'مكتب وادي للاستشارات الهندسية',
    consultantEn: 'Wadi Engineering Consulting',
    contractNumber: 'CON-2026-WAD-007',
  },
];

export const activityDefs: { id: string; activityId: string; name: string; nameEn: string; phase: ActivityPhase; startDay: number; duration: number }[] = [
  { id: 'mile-01', activityId: 'MILE-01', name: 'بداية المشروع', nameEn: 'Project Start Milestone', phase: 'milestone', startDay: 0, duration: 1 },
  { id: 'mob-01', activityId: 'MOB-01', name: 'التعبئة وتجهيز الموقع', nameEn: 'Mobilization & Site Establishment', phase: 'mobilization', startDay: 1, duration: 15 },
  { id: 'eng-01', activityId: 'ENG-01', name: 'تنسيق التصميم والرسومات التنفيذية', nameEn: 'Design Coordination & Shop Drawings', phase: 'engineering', startDay: 10, duration: 30 },
  { id: 'eng-02', activityId: 'ENG-02', name: 'إعداد العينات والاعتمادات', nameEn: 'Mockup Preparation & Approvals', phase: 'engineering', startDay: 25, duration: 20 },
  { id: 'pro-01', activityId: 'PRO-01', name: 'توريد المواد طويلة التوريد', nameEn: 'Procurement of Long Lead Items', phase: 'procurement', startDay: 15, duration: 60 },
  { id: 'con-01', activityId: 'CON-01', name: 'المساحة والضبط الأرضي', nameEn: 'Surveying & Setting Out', phase: 'construction', startDay: 16, duration: 7 },
  { id: 'con-02', activityId: 'CON-02', name: 'الحفر وأعمال التربة', nameEn: 'Excavation & Earthworks', phase: 'construction', startDay: 20, duration: 25 },
  { id: 'con-03', activityId: 'CON-03', name: 'الأساسات والهياكل التحتية', nameEn: 'Foundations & Substructure', phase: 'construction', startDay: 40, duration: 35 },
  { id: 'con-04', activityId: 'CON-04', name: 'الهيكل العلوي (إطار خرساني)', nameEn: 'Superstructure (Concrete Frame)', phase: 'construction', startDay: 70, duration: 80 },
  { id: 'con-05', activityId: 'CON-05', name: 'أعمال البناء (البلوك)', nameEn: 'Masonry (Block Works)', phase: 'construction', startDay: 100, duration: 40 },
  { id: 'con-06', activityId: 'CON-06', name: 'التمديدات الأولية (ميكانيكا وكهرباء)', nameEn: 'MEP First Fix (Internal)', phase: 'construction', startDay: 110, duration: 50 },
  { id: 'con-07', activityId: 'CON-07', name: 'الأسقف والعزل المائي', nameEn: 'Roofing & Waterproofing', phase: 'construction', startDay: 140, duration: 25 },
  { id: 'con-08', activityId: 'CON-08', name: 'البياض الداخلي', nameEn: 'Internal Plastering Works', phase: 'construction', startDay: 150, duration: 40 },
  { id: 'con-09', activityId: 'CON-09', name: 'البياض الخارجي والواجهات', nameEn: 'External Plaster & Façade', phase: 'construction', startDay: 160, duration: 45 },
  { id: 'con-10', activityId: 'CON-10', name: 'الأسقف المعلقة والأقسام', nameEn: 'Ceiling & Partition Works', phase: 'construction', startDay: 170, duration: 35 },
  { id: 'con-11', activityId: 'CON-11', name: 'تشطيبات الأرضيات والجدران', nameEn: 'Floor & Wall Finishes', phase: 'construction', startDay: 190, duration: 50 },
  { id: 'con-12', activityId: 'CON-12', name: 'الألمنيوم والنوافذ والزجاج', nameEn: 'Aluminum, Windows & Glazing', phase: 'construction', startDay: 175, duration: 40 },
  { id: 'con-13', activityId: 'CON-13', name: 'الأبواب والنجارة', nameEn: 'Doors & Joinery Works', phase: 'construction', startDay: 200, duration: 35 },
  { id: 'con-14', activityId: 'CON-14', name: 'الأعمال الخارجية والبنية التحتية', nameEn: 'External Works & Infrastructure', phase: 'construction', startDay: 210, duration: 60 },
  { id: 'fin-01', activityId: 'FIN-01', name: 'أعمال الدهان (الطبقة النهائية)', nameEn: 'Painting Works (Final Coat)', phase: 'finishing', startDay: 230, duration: 35 },
  { id: 'fin-02', activityId: 'FIN-02', name: 'التمديدات النهائية والاختبارات', nameEn: 'MEP Second Fix & Testing', phase: 'finishing', startDay: 235, duration: 40 },
  { id: 'fin-03', activityId: 'FIN-03', name: 'التنسيق الخارجي والري', nameEn: 'Landscaping & Irrigation', phase: 'finishing', startDay: 255, duration: 30 },
  { id: 'tst-01', activityId: 'TST-01', name: 'الاختبارات والتشغيل', nameEn: 'Testing & Commissioning', phase: 'testing', startDay: 275, duration: 25 },
  { id: 'tst-02', activityId: 'TST-02', name: 'المعاينة وإصلاح العيوب', nameEn: 'Snagging & Rectification', phase: 'testing', startDay: 295, duration: 20 },
  { id: 'tst-03', activityId: 'TST-03', name: 'التنظيف النهائي والتسليم', nameEn: 'Final Cleaning & Handover', phase: 'testing', startDay: 315, duration: 15 },
];

const teams = [
  { team: 'فريق المقاول الرئيسي', teamEn: 'Main Contractor Team' },
  { team: 'فريق التصميم', teamEn: 'Design Team' },
  { team: 'فريق المشتريات', teamEn: 'Procurement Team' },
  { team: 'فريق الإنشاءات', teamEn: 'Construction Team' },
  { team: 'فريق التشطيبات', teamEn: 'Finishing Team' },
  { team: 'فريق الاختبارات', teamEn: 'Testing Team' },
];

const phaseCostWeights: Record<ActivityPhase, number> = {
  milestone: 0,
  mobilization: 0.02,
  engineering: 0.08,
  procurement: 0.15,
  construction: 0.50,
  finishing: 0.15,
  testing: 0.10,
};

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00`);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

function buildActivities(projectProgress: number, budget: number, projectStartDate: string): ProjectActivity[] {
  const totalDuration = 330;
  const todayDay = Math.round((projectProgress / 100) * totalDuration);

  return activityDefs.map((a) => {
    const activityEnd = a.startDay + a.duration;
    let status: import('@/types').ActivityStatus = 'not_started';
    let percentComplete = 0;

    if (a.phase === 'milestone') {
      status = 'completed';
      percentComplete = 100;
    } else if (activityEnd <= todayDay) {
      status = 'completed';
      percentComplete = 100;
    } else if (a.startDay < todayDay) {
      status = 'in_progress';
      percentComplete = Math.round(((todayDay - a.startDay) / a.duration) * 100);
    }

    const teamIdx = ['milestone', 'mobilization', 'engineering', 'procurement', 'construction', 'finishing', 'testing'].indexOf(a.phase);
    const team = teams[Math.min(teamIdx, teams.length - 1)];

    const phaseWeight = phaseCostWeights[a.phase] / activityDefs.filter((d) => d.phase === a.phase).length;
    const plannedCost = Math.round(budget * phaseWeight);
    const actualCost = status === 'completed' ? plannedCost : status === 'in_progress' ? Math.round(plannedCost * (percentComplete / 100)) : 0;

    let actualStartDate: string | undefined;
    let actualEndDate: string | undefined;
    if (status === 'completed') {
      const startOffset = a.id === 'mob-01' ? 2 : a.id === 'con-01' ? -1 : 0;
      const endOffset = a.id === 'mob-01' ? 3 : a.id === 'con-01' ? -1 : a.id === 'eng-01' ? 2 : 0;
      actualStartDate = addDays(projectStartDate, a.startDay + startOffset);
      actualEndDate = addDays(projectStartDate, activityEnd + endOffset);
    } else if (status === 'in_progress') {
      const startOffset = a.id === 'con-04' ? 5 : 0;
      actualStartDate = addDays(projectStartDate, a.startDay + startOffset);
    }

    return {
      id: a.id,
      activityId: a.activityId,
      name: a.name,
      nameEn: a.nameEn,
      phase: a.phase,
      startDay: a.startDay,
      endDay: a.startDay + a.duration,
      duration: a.duration,
      percentComplete,
      status,
      team: team.team,
      teamEn: team.teamEn,
      description: '',
      descriptionEn: '',
      actualCost,
      plannedCost,
      changeOrderAmount: 0,
      actualStartDate,
      actualEndDate,
    };
  });
}

export const projectActivities: Record<string, ProjectActivity[]> = {
  rimal: buildActivities(40, 185000000, '2026-02-28'),
  narjis2: buildActivities(45, 142000000, '2026-03-01'),
  'jazly-exp': buildActivities(15, 98000000, '2026-07-01'),
  'ajou-res': buildActivities(85, 165000000, '2025-10-01'),
  munsiyah: buildActivities(55, 210000000, '2026-01-01'),
  nasriyah3: (() => {
    const start = '2026-05-01';
    const acts = buildActivities(30, 128000000, start);
    return acts.map((a) => {
      if (a.phase === 'construction' && a.status === 'in_progress') {
        return { ...a, status: 'delayed' as const, actualStartDate: addDays(start, a.startDay + 5) };
      }
      return a;
    });
  })(),
  'wadi-ext': buildActivities(8, 89000000, '2026-08-01'),
};

export const projectDocuments: Record<string, ProjectDocument[]> = {
  rimal: [
    { id: 'doc-r1', name: 'عقد الإنشاء', nameEn: 'Construction Contract', type: 'pdf', uploadDate: '2026-08-15', category: 'contracts', categoryId: 'contracts', categoryName: 'عقود الإنشاء', categoryNameEn: 'Construction Contracts' },
    { id: 'doc-r2', name: 'الخطة الرئيسية', nameEn: 'Master Plan', type: 'pdf', uploadDate: '2026-08-10', category: 'master_plan', categoryId: 'master_plan', categoryName: 'المخطط الرئيسي', categoryNameEn: 'Master Plan' },
    { id: 'doc-r3', name: 'رخصة البناء', nameEn: 'Building Permit', type: 'pdf', uploadDate: '2026-07-20', category: 'permits', categoryId: 'permits', categoryName: 'التراخيص', categoryNameEn: 'Permits' },
    { id: 'doc-r4', name: 'الموافقة البيئية', nameEn: 'Environmental Clearance', type: 'pdf', uploadDate: '2026-07-05', category: 'permits', categoryId: 'permits', categoryName: 'التراخيص', categoryNameEn: 'Permits' },
    { id: 'doc-r5', name: 'جدول المقاول', nameEn: 'Contractor Schedule', type: 'pdf', uploadDate: '2026-08-25', category: 'construction_files', categoryId: 'construction_files', categoryName: 'ملفات البناء', categoryNameEn: 'Construction Files' },
  ],
};

const defaultDocs: ProjectDocument[] = [
  { id: 'doc-d1', name: 'عقد الإنشاء', nameEn: 'Construction Contract', type: 'pdf', uploadDate: '2026-08-15', category: 'contracts', categoryId: 'contracts', categoryName: 'عقود الإنشاء', categoryNameEn: 'Construction Contracts' },
  { id: 'doc-d2', name: 'الخطة الرئيسية', nameEn: 'Master Plan', type: 'pdf', uploadDate: '2026-08-10', category: 'master_plan', categoryId: 'master_plan', categoryName: 'المخطط الرئيسي', categoryNameEn: 'Master Plan' },
  { id: 'doc-d3', name: 'رخصة البناء', nameEn: 'Building Permit', type: 'pdf', uploadDate: '2026-07-20', category: 'permits', categoryId: 'permits', categoryName: 'التراخيص', categoryNameEn: 'Permits' },
  { id: 'doc-d4', name: 'الموافقة البيئية', nameEn: 'Environmental Clearance', type: 'pdf', uploadDate: '2026-07-05', category: 'permits', categoryId: 'permits', categoryName: 'التراخيص', categoryNameEn: 'Permits' },
  { id: 'doc-d5', name: 'جدول المقاول', nameEn: 'Contractor Schedule', type: 'pdf', uploadDate: '2026-08-25', category: 'construction_files', categoryId: 'construction_files', categoryName: 'ملفات البناء', categoryNameEn: 'Construction Files' },
];

for (const p of projects) {
  if (!projectDocuments[p.id]) {
    projectDocuments[p.id] = defaultDocs.map((d) => ({ ...d, id: `${d.id}-${p.id}` }));
  }
}

const defaultRisks: Omit<ProjectRisk, 'id'>[] = [
  {
    name: 'تأخر توريد المواد طويلة التوريد',
    nameEn: 'Long-lead procurement delay',
    dateRaised: '2026-08-20',
    responsible: 'فريق المشتريات',
    responsibleEn: 'Procurement Team',
    description: 'مواد الألمنيوم والزجاج قد تتأخر عن الجدول الزمني المخطط له',
    descriptionEn: 'Aluminum and glazing materials may arrive behind the planned schedule',
    deadline: '2026-10-15',
    reason: '',
    reasonEn: '',
    result: 'pending',
  },
  {
    name: 'تأخر تصاريح البلدية',
    nameEn: 'Municipal permit delays',
    dateRaised: '2026-08-10',
    responsible: 'فريق التصميم',
    responsibleEn: 'Design Team',
    description: 'تصاريح الواجهات الخارجية معلقة لدى البلدية',
    descriptionEn: 'Façade permits are pending at the municipality',
    deadline: '2026-09-30',
    reason: 'بطء في استجابة البلدية على المراجعات المعمارية',
    reasonEn: 'Slow municipality response on architectural reviews',
    result: 'delayed',
  },
];

export const projectRisks: Record<string, ProjectRisk[]> = {};
for (const p of projects) {
  projectRisks[p.id] = defaultRisks.map((r, i) => ({ ...r, id: `risk-${p.id}-${i}` }));
}

export const projectIpcEntries: Record<string, IpcEntry[]> = {
  rimal: [
    { id: 'ipc-r1', projectId: 'rimal', direction: 'incoming', source: 'contractor', partyName: 'شركة الإنشاءات المتقدمة', partyNameEn: 'Advanced Construction Co.', activityId: 'con-04', amount: 12500000, description: 'دفعة أولية لأعمال الهيكل العلوي - المرحلة الأولى', descriptionEn: 'Initial payment for superstructure works - Phase 1', status: 'completed', dateLogged: '2026-08-15', attachments: [{ id: 'att-r1', fileName: 'IPC-CON-001.pdf', fileType: 'pdf', uploadDate: '2026-08-15' }] },
    { id: 'ipc-r2', projectId: 'rimal', direction: 'incoming', source: 'contractor', partyName: 'شركة الإنشاءات المتقدمة', partyNameEn: 'Advanced Construction Co.', activityId: 'con-08', amount: 8200000, description: 'دفعة أعمال البياض الداخلي', descriptionEn: 'Internal plastering payment', status: 'delayed', dateLogged: '2026-09-10', attachments: [{ id: 'att-r2a', fileName: 'IPC-CON-002.pdf', fileType: 'pdf', uploadDate: '2026-09-10' }] },
    { id: 'ipc-r3', projectId: 'rimal', direction: 'incoming', source: 'consultant', partyName: 'مكتب الديار للاستشارات الهندسية', partyNameEn: 'Al-Diyar Engineering Consulting', activityId: 'eng-01', amount: 850000, description: 'أتعاب اعتماد الرسومات التنفيذية - المرحلة الثانية', descriptionEn: 'Shop drawing approval fees - Phase 2', status: 'in_progress', dateLogged: '2026-09-01', attachments: [{ id: 'att-r3', fileName: 'Claim-ENG-02.pdf', fileType: 'pdf', uploadDate: '2026-09-01' }] },
    { id: 'ipc-r4', projectId: 'rimal', direction: 'outgoing', reference: 'BNK-IPC-2026-001', activityId: 'con-04', amount: 12500000, description: 'طلب IPC للبنك - دفعة الهيكل العلوي', descriptionEn: 'Bank IPC request - superstructure payment', status: 'completed', dateLogged: '2026-08-16', attachments: [] },
    { id: 'ipc-r5', projectId: 'rimal', direction: 'outgoing', reference: 'BNK-IPC-2026-002', activityId: 'con-08', amount: 8200000, description: 'طلب IPC للبنك - دفعة البياض الداخلي', descriptionEn: 'Bank IPC request - plastering payment', status: 'in_progress', dateLogged: '2026-09-11', attachments: [{ id: 'att-r5', fileName: 'BNK-002.pdf', fileType: 'pdf', uploadDate: '2026-09-11' }] },
  ],
  'jazly-exp': [
    { id: 'ipc-j1', projectId: 'jazly-exp', direction: 'incoming', source: 'contractor', partyName: 'شركة جازلي للإنشاء', partyNameEn: 'Jazly Construction Co.', activityId: 'con-02', amount: 4500000, description: 'دفعة أعمال الحفر وأعمال التربة', descriptionEn: 'Excavation and earthworks payment', status: 'in_progress', dateLogged: '2026-09-05', attachments: [{ id: 'att-j1', fileName: 'IPC-JAZ-001.pdf', fileType: 'pdf', uploadDate: '2026-09-05' }] },
    { id: 'ipc-j2', projectId: 'jazly-exp', direction: 'incoming', source: 'consultant', partyName: 'مكتب جازلي الاستشاري', partyNameEn: 'Jazly Consulting Bureau', activityId: 'eng-02', amount: 320000, description: 'أتعاب اعتماد العينات', descriptionEn: 'Mockup approval fees', status: 'delayed', dateLogged: '2026-09-08', attachments: [] },
    { id: 'ipc-j3', projectId: 'jazly-exp', direction: 'outgoing', reference: 'BNK-IPC-2026-J01', activityId: 'con-02', amount: 4500000, description: 'طلب IPC للبنك - دفعة الحفر', descriptionEn: 'Bank IPC request - excavation payment', status: 'in_progress', dateLogged: '2026-09-06', attachments: [] },
  ],
  'nasriyah3': [
    { id: 'ipc-n1', projectId: 'nasriyah3', direction: 'incoming', source: 'contractor', partyName: 'شركة الناصرية للإنشاء', partyNameEn: 'Al-Nasriyah Construction Co.', activityId: 'con-04', amount: 9800000, description: 'دفعة الهيكل العلوي - متأخرة عن الجدول', descriptionEn: 'Superstructure payment - behind schedule', status: 'delayed', dateLogged: '2026-09-12', attachments: [{ id: 'att-n1', fileName: 'IPC-NAS-001.pdf', fileType: 'pdf', uploadDate: '2026-09-12' }] },
    { id: 'ipc-n2', projectId: 'nasriyah3', direction: 'incoming', source: 'consultant', partyName: 'مكتب الناصرية الاستشاري', partyNameEn: 'Al-Nasriyah Consulting Office', activityId: 'eng-01', amount: 540000, description: 'أتعاب مراجعة التصميم', descriptionEn: 'Design review fees', status: 'completed', dateLogged: '2026-08-20', attachments: [] },
    { id: 'ipc-n3', projectId: 'nasriyah3', direction: 'outgoing', reference: 'BNK-IPC-2026-N01', activityId: 'con-04', amount: 9800000, description: 'طلب IPC للبنك - دفعة الهيكل', descriptionEn: 'Bank IPC request - superstructure', status: 'delayed', dateLogged: '2026-09-13', attachments: [] },
  ],
  munsiyah: [
    { id: 'ipc-m1', projectId: 'munsiyah', direction: 'incoming', source: 'contractor', partyName: 'شركة الإعمار الحضري', partyNameEn: 'Urban Development Co.', activityId: 'con-11', amount: 15600000, description: 'دفعة تشطيبات الأرضيات والجدران', descriptionEn: 'Floor and wall finishes payment', status: 'in_progress', dateLogged: '2026-09-14', attachments: [{ id: 'att-m1', fileName: 'IPC-MUN-001.pdf', fileType: 'pdf', uploadDate: '2026-09-14' }] },
    { id: 'ipc-m2', projectId: 'munsiyah', direction: 'incoming', source: 'consultant', partyName: 'مكتب الإعمار الحضري للاستشارات', partyNameEn: 'Urban Development Consulting', activityId: 'fin-02', amount: 720000, description: 'أتعاب الإشراف على التمديدات النهائية', descriptionEn: 'MEP second fix supervision fees', status: 'in_progress', dateLogged: '2026-09-15', attachments: [] },
    { id: 'ipc-m3', projectId: 'munsiyah', direction: 'outgoing', reference: 'BNK-IPC-2026-M01', activityId: 'con-11', amount: 15600000, description: 'طلب IPC للبنك - دفعة التشطيبات', descriptionEn: 'Bank IPC request - finishes payment', status: 'completed', dateLogged: '2026-09-14', attachments: [{ id: 'att-m3', fileName: 'BNK-MUN-001.pdf', fileType: 'pdf', uploadDate: '2026-09-14' }] },
  ],
  'ajou-res': [
    { id: 'ipc-a1', projectId: 'ajou-res', direction: 'incoming', source: 'contractor', partyName: 'شركة العجو العقارية', partyNameEn: 'Al-Ajou Real Estate Co.', activityId: 'fin-01', amount: 6700000, description: 'دفعة أعمال الدهان النهائية', descriptionEn: 'Final painting works payment', status: 'completed', dateLogged: '2026-09-02', attachments: [] },
    { id: 'ipc-a2', projectId: 'ajou-res', direction: 'outgoing', reference: 'BNK-IPC-2026-A01', activityId: 'fin-01', amount: 6700000, description: 'طلب IPC للبنك - دفعة الدهان', descriptionEn: 'Bank IPC request - painting payment', status: 'completed', dateLogged: '2026-09-03', attachments: [] },
  ],
};
for (const p of projects) {
  if (!projectIpcEntries[p.id]) {
    projectIpcEntries[p.id] = [];
  }
}

export function calcProjectProgress(activities: ProjectActivity[]): number {
  if (activities.length === 0) return 0;
  const total = activities.reduce((sum, a) => sum + a.duration, 0);
  const done = activities.reduce((sum, a) => sum + (a.duration * a.percentComplete) / 100, 0);
  return Math.round((done / total) * 100);
}

