import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useProjectList } from '@/queries/useProjects';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import type { ProjectStatus } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts';
import { projectActivities } from '@/data/pmMockData';
import { Plus, Building2, TrendingUp, CheckCircle2, Home, Search, X } from 'lucide-react';

const statusColors: Record<ProjectStatus, string> = {
  on_track: '#6a8a5a',
  at_risk: '#b89c4a',
  delayed: '#b86a5a',
  completed: '#475f72',
};

function formatTimelineDate(dateStr: string, isRtl: boolean): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const months = isRtl ? monthsAr : monthsEn;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case 'on_track': return 'bg-success-50 text-success-700 border-success-100';
    case 'at_risk': return 'bg-warning-50 text-warning-700 border-warning-100';
    case 'delayed': return 'bg-danger-50 text-danger-700 border-danger-100';
    case 'completed': return 'bg-navy-50 text-navy-700 border-navy-100';
  }
}

export function PmDashboard() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: projectsResult, isLoading, isError, refetch } = useProjectList();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError message={t('errorLoading')} onRetry={() => void refetch()} />;

  const allProjects = projectsResult?.data ?? [];

  const filtered = allProjects.filter((p) => {
    const q = search.toLowerCase().trim();
    const nameMatch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.locationEn.toLowerCase().includes(q) ||
      p.contractor.toLowerCase().includes(q) ||
      p.contractorEn.toLowerCase().includes(q);
    const fromMatch = !fromDate || p.startDate >= fromDate;
    const toMatch = !toDate || p.endDate <= toDate;
    return nameMatch && fromMatch && toMatch;
  });

  const totalProjects = filtered.length;
  const onTrack = filtered.filter((p) => p.status === 'on_track' || p.status === 'completed').length;
  const totalUnits = filtered.reduce((s, p) => s + p.totalUnits, 0);

  const statCards = [
    { icon: Building2, label: t('pm:totalProjects'), value: totalProjects, accent: 'text-copper-600', bg: 'bg-copper-50' },
    { icon: TrendingUp, label: t('pm:avgProgress'), value: `${totalProjects}`, accent: 'text-slateblue-500', bg: 'bg-slateblue-50' },
    { icon: CheckCircle2, label: t('pm:projectsOnTrack'), value: onTrack, accent: 'text-success-600', bg: 'bg-success-50' },
    { icon: Home, label: t('pm:totalUnitsPortfolio'), value: totalUnits, accent: 'text-navy-600', bg: 'bg-navy-50' },
  ];

  const timelineData = filtered.map((p) => ({
    name: isRtl ? p.name : p.nameEn,
    end: p.totalDays,
    startDate: p.startDate,
    status: p.status,
  }));

  const maxTimelineEnd = Math.max(...timelineData.map((t) => t.end), 1);
  const globalStartDate = timelineData.length > 0
    ? timelineData.reduce((earliest, p) => p.startDate < earliest ? p.startDate : earliest, timelineData[0].startDate)
    : new Date().toISOString().slice(0, 10);

  const barData = filtered.map((p) => {
    const acts = projectActivities[p.id] ?? [];
    const total = acts.reduce((s, a) => s + a.duration, 0);
    const done = acts.reduce((s, a) => s + (a.duration * a.percentComplete) / 100, 0);
    return {
      name: isRtl ? p.name : p.nameEn,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      status: p.status,
    };
  });

  const hasFilters = search || fromDate || toDate;
  const clearFilters = () => { setSearch(''); setFromDate(''); setToDate(''); };

  return (
    <div>
      <PageHeader title={t('pm:pmDashboardTitle')} subtitle={t('pm:pmDashboardSub')}>
        <Button onClick={() => navigate('/pm/add-project')}>
          <Plus className="w-4 h-4" />
          {t('pm:addProject')}
        </Button>
      </PageHeader>

      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 start-3" />
            <input
              className="filter-input ps-9"
              placeholder={t('pm:search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 end-3 text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <input type="date" className="filter-input md:w-44" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="filter-input md:w-44" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="w-3.5 h-3.5" /> {t('pm:clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="p-4 md:p-5">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${s.accent}`} />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-navy-800">{s.value}</p>
              <p className="text-xs md:text-sm text-stone-500 mt-1">{s.label}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{t('pm:progressByProject')}</h3>
        {barData.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">{t('pm:noItems')}</p>
        ) : (
          <div style={{ height: Math.max(160, barData.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e0d8c5', fontSize: 12 }}
                  formatter={(v) => [`${Number(v)}%`, t('pm:percentComplete')]}
                />
                <Bar dataKey="progress" radius={[0, 6, 6, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={statusColors[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{t('pm:portfolioTimeline')}</h3>
        {timelineData.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">{t('pm:noItems')}</p>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-24 md:w-32 shrink-0" />
              <div className="flex-1 relative h-6">
                {[0, 25, 50, 75, 100].map((pct) => {
                  const dateStr = addDays(globalStartDate, Math.round((pct / 100) * maxTimelineEnd));
                  return (
                    <div key={pct} className="absolute text-[10px] text-stone-400 text-center"
                      style={{ [isRtl ? 'right' : 'left']: `${pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                      {formatTimelineDate(dateStr, isRtl)}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              {timelineData.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 md:w-32 shrink-0 text-xs md:text-sm text-stone-600 truncate">{p.name}</div>
                  <div className="flex-1 relative h-7 bg-stone-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute top-0 h-full rounded-lg"
                      style={{
                        width: `${(p.end / maxTimelineEnd) * 100}%`,
                        [isRtl ? 'right' : 'left']: 0,
                        backgroundColor: statusColors[p.status],
                        opacity: 0.4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-12">{t('pm:noItems')}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, idx) => (
            <Card
              key={p.id}
              hoverable
              onClick={() => navigate(`/pm/project/${p.id}`)}
              className={`p-5 ${idx % 2 === 0 ? 'bg-butteryellow-50' : 'bg-powderblue-50'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-navy-800">{isRtl ? p.name : p.nameEn}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">{isRtl ? p.location : p.locationEn}</p>
                </div>
                <Badge className={`${statusBadgeClass(p.status)} border`} dot>
                  {t(`pm:projectStatus_${p.status}`)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-stone-500 mb-3">
                <span>{p.totalUnits} {t('pm:units_count')}</span>
                <span>·</span>
                <span>{isRtl ? p.contractor : p.contractorEn}</span>
              </div>
              <p className="text-xs text-stone-400 mt-3">{t('pm:targetHandover')}: {p.endDate}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
