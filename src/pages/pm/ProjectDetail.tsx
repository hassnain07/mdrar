import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useProject } from '@/queries/useProjects';
import { useActivityList } from '@/queries/useActivities';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { DocumentsContent } from '@/pages/pm/DocumentsContent';
import { IpcContent } from '@/pages/pm/IpcContent';
import { ExecutivePage } from '@/pages/pm/ExecutivePage';
import { ProjectActivitiesTab } from '@/pages/pm/ProjectActivitiesTab';
import { ProjectUnitsTab } from '@/pages/pm/ProjectUnitsTab';
import { ProjectRisksTab } from '@/pages/pm/ProjectRisksTab';
import { ProjectOverviewTab } from '@/pages/pm/ProjectOverviewTab';
import { ProjectQuantityTab } from '@/pages/pm/ProjectQuantityTab';
import { ProjectEditModal } from '@/pages/pm/ProjectEditModal';
import { calcProjectProgress } from '@/data/pmMockData';
import { ChevronLeft, ChevronRight, MapPin, Home, Building2, Pencil } from 'lucide-react';

type TabKey = 'overview' | 'schedule' | 'units' | 'documents' | 'quantity' | 'risks' | 'ipc' | 'executive';

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'on_track': return 'bg-success-50 text-success-700 border-success-100';
    case 'at_risk': return 'bg-warning-50 text-warning-700 border-warning-100';
    case 'delayed': return 'bg-danger-50 text-danger-700 border-danger-100';
    case 'completed': return 'bg-navy-50 text-navy-700 border-navy-100';
    default: return 'bg-stone-100 text-stone-600 border-stone-300';
  }
}

export function ProjectDetail() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editingProject, setEditingProject] = useState(false);

  const { data: project, isLoading, isError, refetch } = useProject(id ?? '');
  const { data: activitiesResult } = useActivityList(id ?? '');
  const activities = activitiesResult?.data ?? [];

  if (isLoading) return <PageSkeleton />;
  if (isError || !project) return <PageError message={t('errorLoading')} onRetry={() => void refetch()} />;

  const progress = calcProjectProgress(activities);
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const isExecutive = activeTab === 'executive';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t('pm:overview') },
    { key: 'schedule', label: t('pm:schedule') },
    { key: 'units', label: t('pm:units') },
    { key: 'documents', label: t('pm:documents') },
    { key: 'quantity', label: t('pm:quantityTable') },
    { key: 'risks', label: t('pm:risksResponsibilities') },
    { key: 'ipc', label: t('pm:ipc') },
  ];

  return (
    <div>
      <button onClick={() => navigate('/pm/dashboard')} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-navy-700 transition-colors mb-3">
        <BackIcon className="w-4 h-4" />
        <span>{t('back')}</span>
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-semibold text-navy-800">{isRtl ? project.name : project.nameEn}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-stone-500 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{isRtl ? project.location : project.locationEn}</span>
            <span className="flex items-center gap-1"><Home className="w-4 h-4" />{project.totalUnits} {t('pm:units_count')}</span>
            <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{isRtl ? project.contractor : project.contractorEn}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setEditingProject(true)}>
            <Pencil className="w-3.5 h-3.5" /> {t('pm:editProject')}
          </Button>
          <Badge className={`${statusBadgeClass(project.status)} border`} dot>{t(`pm:projectStatus_${project.status}`)}</Badge>
          <div className="text-end">
            <p className="text-3xl font-bold text-navy-800">{progress}%</p>
            <p className="text-xs text-stone-500">{t('pm:overallProgress')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-stone-300 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'border-copper-600 text-copper-700' : 'border-transparent text-stone-500 hover:text-navy-700'
            }`}>
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setActiveTab('executive')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap mb-[-1px] rounded-t-lg ${
            isExecutive ? 'bg-navy-700 text-white border-navy-700' : 'bg-navy-50 text-navy-700 border-navy-200 hover:bg-navy-100'
          }`}
        >
          {t('pm:executive')}
        </button>
      </div>

      {activeTab === 'overview' && <ProjectOverviewTab projectId={id!} project={project} isRtl={isRtl} />}
      {activeTab === 'schedule' && <ProjectActivitiesTab projectId={id!} project={project} isRtl={isRtl} />}
      {activeTab === 'units' && <ProjectUnitsTab projectId={id!} project={project} isRtl={isRtl} />}
      {activeTab === 'documents' && <DocumentsContent projectId={id!} isRtl={isRtl} />}
      {activeTab === 'quantity' && <ProjectQuantityTab projectId={id!} project={project} isRtl={isRtl} />}
      {activeTab === 'risks' && <ProjectRisksTab projectId={id!} isRtl={isRtl} />}
      {activeTab === 'ipc' && <IpcContent projectId={id!} isRtl={isRtl} />}
      {activeTab === 'executive' && <ExecutivePage project={project} activities={activities} isRtl={isRtl} />}

      <ProjectEditModal open={editingProject} projectId={id!} onClose={() => setEditingProject(false)} isRtl={isRtl} />
    </div>
  );
}
