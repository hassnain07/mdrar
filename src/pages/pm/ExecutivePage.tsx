import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/state/uiStore';
import { useIpcList } from '@/queries/useIpc';
import { useRiskList } from '@/queries/useRisks';
import { generateExecutiveReport, type ReportLabels } from '@/lib/reportGenerator';
import { calcProjectProgress } from '@/data/pmMockData';
import type { Project, ProjectActivity, ActivityStatus, IpcEntry, IpcStatus, ProjectRisk, RiskResult } from '@/types';
import {
  Download, Building2, Briefcase, FileText, Calendar,
  TrendingUp, Wallet, PiggyBank, ArrowRightLeft,
  ArrowDownLeft, ArrowUpRight, Send, Inbox,
  AlertTriangle, User,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const DONUT_EXECUTED = '#9c4a52';
const DONUT_REMAINING = '#c9b896';
const BAR_COLORS = ['#9c4a52', '#475f72', '#c9a45c'];
const STAGE_DELIVERED = '#9c4a52';
const STAGE_PENDING = '#d4c9b0';

function formatSar(amount: number, sarLabel: string): string {
  return `${sarLabel} ${amount.toLocaleString('en-US')}`;
}

function activityStatusColor(status: ActivityStatus): string {
  const map: Record<ActivityStatus, string> = {
    not_started: '#d0c4a8',
    in_progress: '#9c4a52',
    completed: '#475f72',
    delayed: '#b86a5a',
    risk: '#a8795e',
  };
  return map[status];
}

type DateFilterMode = 'date' | 'month' | 'preset';

function ipcStatusBg(status: IpcStatus): string {
  switch (status) {
    case 'in_progress': return 'bg-powderblue-50 border-powderblue-200';
    case 'delayed': return 'bg-danger-50 border-danger-200';
    case 'completed': return 'bg-success-50 border-success-200';
  }
}

function ipcStatusDot(status: IpcStatus): string {
  switch (status) {
    case 'in_progress': return '#7ba3c4';
    case 'delayed': return '#dc6b6b';
    case 'completed': return '#5a9472';
  }
}

function riskResultBadgeClass(result: RiskResult): string {
  switch (result) {
    case 'pending': return 'bg-warning-50 text-warning-700 border-warning-200';
    case 'in_progress': return 'bg-powderblue-50 text-powderblue-700 border-powderblue-200';
    case 'resolved': return 'bg-success-50 text-success-700 border-success-200';
    case 'delayed': return 'bg-danger-50 text-danger-700 border-danger-200';
  }
}

function ipcStatusLabel(status: IpcStatus, isRtl: boolean): string {
  if (isRtl) {
    return status === 'in_progress' ? 'قيد التنفيذ' : status === 'delayed' ? 'متأخر' : 'مكتمل';
  }
  return status === 'in_progress' ? 'In Progress' : status === 'delayed' ? 'Delayed' : 'Completed';
}

export function ExecutivePage({
  project,
  activities,
  isRtl,
}: {
  project: Project;
  activities: ProjectActivity[];
  isRtl: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const sarLabel = isRtl ? 'ر.س' : 'SAR';
  const months = isRtl ? monthNamesAr : monthNamesEn;

  const { data: ipcResult } = useIpcList(project.id);
  const { data: riskResult } = useRiskList(project.id);
  const allIpcEntries = ipcResult?.data ?? [];
  const risks = riskResult?.data ?? [];

  const [filterMode, setFilterMode] = useState<DateFilterMode>('date');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthStart, setMonthStart] = useState('');
  const [monthEnd, setMonthEnd] = useState('');
  const [presetMonths, setPresetMonths] = useState('3');

  // Financial calculations
  const changeOrderTotal = activities.reduce((s, a) => s + (a.changeOrderAmount ?? 0), 0);
  const totalBudget = project.budget + changeOrderTotal;
  const executedToDate = activities.reduce((s, a) => s + (a.actualCost ?? 0), 0);
  const financialProgress = totalBudget > 0 ? (executedToDate / totalBudget) * 100 : 0;
  const remainingValue = totalBudget - executedToDate;

  const deliveredCount = activities.filter((a) => a.status === 'completed').length;
  const totalStages = activities.length;
  const pendingCount = totalStages - deliveredCount;

  const overallProgress = calcProjectProgress(activities);

  const contractorIpc = allIpcEntries
    .filter((e) => e.direction === 'incoming' && e.source === 'contractor')
    .sort((a, b) => (b.dateLogged || '').localeCompare(a.dateLogged || ''))
    .slice(0, 2);
  const consultantIpc = allIpcEntries
    .filter((e) => e.direction === 'incoming' && e.source === 'consultant')
    .sort((a, b) => (b.dateLogged || '').localeCompare(a.dateLogged || ''))
    .slice(0, 2);
  const outgoingIpc = allIpcEntries
    .filter((e) => e.direction === 'outgoing')
    .sort((a, b) => (b.dateLogged || '').localeCompare(a.dateLogged || ''))
    .slice(0, 2);

  const ipcSections = [
    { key: 'contractor', label: t('pm:execIpcContractor'), icon: Building2, entries: contractorIpc },
    { key: 'consultant', label: t('pm:execIpcConsultant'), icon: Briefcase, entries: consultantIpc },
    { key: 'outgoing', label: t('pm:execIpcOutgoing'), icon: Send, entries: outgoingIpc },
  ];

  // Date/month/preset range filtering for Schedule KPI
  const filteredActivities = useMemo(() => {
    if (filterMode === 'date') {
      return activities.filter((a) => {
        const fromMatch = !dateFrom || (a.startDate ?? '') >= dateFrom;
        const toMatch = !dateTo || (a.endDate ?? '') <= dateTo;
        return fromMatch && toMatch;
      });
    }
    if (filterMode === 'preset') {
      const months = Number(presetMonths);
      const projectStart = new Date(project.startDate + 'T00:00:00');
      const rangeStart = projectStart;
      const rangeEnd = new Date(projectStart.getFullYear(), projectStart.getMonth() + months, projectStart.getDate());
      const rangeStartStr = rangeStart.toISOString().slice(0, 10);
      const rangeEndStr = rangeEnd.toISOString().slice(0, 10);
      return activities.filter((a) => {
        const aStart = a.startDate ?? '';
        const aEnd = a.endDate ?? '';
        return aStart <= rangeEndStr && aEnd >= rangeStartStr;
      });
    }
    // Month mode
    if (!monthStart && !monthEnd) return activities;
    const startMonthIdx = monthStart ? Number(monthStart) : 0;
    const endMonthIdx = monthEnd ? Number(monthEnd) : 11;
    const projectYear = new Date(project.startDate + 'T00:00:00').getFullYear();
    const rangeStart = new Date(projectYear, startMonthIdx, 1).toISOString().slice(0, 10);
    const rangeEnd = new Date(projectYear, endMonthIdx + 1, 0).toISOString().slice(0, 10);
    return activities.filter((a) => {
      const aStart = a.startDate ?? '';
      const aEnd = a.endDate ?? '';
      return aStart <= rangeEnd && aEnd >= rangeStart;
    });
  }, [activities, filterMode, dateFrom, dateTo, monthStart, monthEnd, presetMonths, project.startDate]);

  const kpiFilteredPlannedCost = filteredActivities.reduce((s, a) => s + (a.plannedCost ?? 0), 0);
  const kpiFilteredActualCost = filteredActivities.reduce((s, a) => s + (a.actualCost ?? 0), 0);
  const kpiFilteredPlannedProgress = filteredActivities.length > 0
    ? Math.round(filteredActivities.reduce((s, a) => s + (a.percentComplete ?? 0), 0) / filteredActivities.length)
    : 0;
  const kpiFilteredActualProgress = filteredActivities.length > 0
    ? Math.round(filteredActivities.reduce((s, a) => s + (a.actualProgress ?? a.percentComplete ?? 0), 0) / filteredActivities.length)
    : 0;
  const kpiCostVariance = kpiFilteredPlannedCost - kpiFilteredActualCost;
  const kpiProgressVariance = kpiFilteredActualProgress - kpiFilteredPlannedProgress;

  const kpiCards = [
    { label: t('pm:execBudget'), value: formatSar(project.budget, sarLabel), icon: Wallet, highlight: false },
    { label: t('pm:execExecutedToDate'), value: formatSar(executedToDate, sarLabel), icon: TrendingUp, highlight: false },
    { label: t('pm:execFinancialProgress'), value: `${financialProgress.toFixed(1)}%`, icon: PiggyBank, highlight: false },
    { label: t('pm:execRemainingValue'), value: formatSar(remainingValue, sarLabel), icon: ArrowRightLeft, highlight: false },
    { label: t('pm:execChangeOrders'), value: formatSar(changeOrderTotal, sarLabel), icon: FileText, highlight: false },
  ];

  const barChartData = [
    { name: t('pm:execBudget'), value: project.budget, fill: BAR_COLORS[0] },
    { name: t('pm:execExecutedToDate'), value: executedToDate, fill: BAR_COLORS[1] },
    { name: t('pm:execRemainingValue'), value: remainingValue, fill: BAR_COLORS[2] },
  ];

  const donutData = [
    { name: t('pm:execDonutExecuted'), value: executedToDate, fill: DONUT_EXECUTED },
    { name: t('pm:execDonutRemaining'), value: Math.max(0, remainingValue), fill: DONUT_REMAINING },
  ];

  const stageDeliveredPct = totalStages > 0 ? (deliveredCount / totalStages) * 100 : 0;

  const today = new Date().toISOString().slice(0, 10);

  const exportReport = () => {
    const labels: ReportLabels = isRtl ? {
      isRtl: true,
      title: '',
      subtitle: () => `عقد رقم ${project.contractNumber || 'N/A'} · ملخص تنفيذي`,
      projectName: 'اسم المشروع',
      reportDate: 'تاريخ التقرير',
      contractor: 'المقاول',
      consultant: 'الاستشاري',
      contractNo: 'رقم العقد',
      paymentCertNo: 'رقم شهادة الدفع',
      section1Kpi: '',
      kpiBudget: 'الميزانية',
      kpiChangeOrderBudget: 'ميزانية أوامر التغيير',
      kpiExecutedToDate: 'المنفذ حتى تاريخه',
      kpiFinancialProgress: 'نسبة التقدم المالي',
      kpiRemainingValue: 'القيمة المتبقية',
      section2Charts: '',
      chartFinancialPosition: 'المركز المالي',
      chartExecutedVsRemaining: 'المنفذ مقابل المتبقي',
      barBudget: 'الميزانية',
      barExecutedToDate: 'المنفذ',
      barRemainingValue: 'المتبقي',
      donutExecuted: 'المنفذ',
      donutRemaining: 'المتبقي',
      donutCaption: (r) => `${r} متبقي للتنفيذ`,
      sectionStagePosition: 'مرحلة المشروع — {n} مراحل متتبعة',
      stageDelivered: 'مراحل مكتملة',
      stagePending: 'مراحل معلقة',
      stageCaptionLeft: (d, tot) => `${d} من ${tot} مرحلة مكتملة`,
      stageCaptionRight: (p) => `${p} مرحلة معلقة`,
      page2Header: 'جميع مهام المشروع — المخطط مقابل الفعلي',
      page2Subheader: 'جميع أنشطة الجدول الزمني للمشروع',
      colTaskName: 'اسم المهمة',
      colPlannedProgress: 'التقدم المخطط %',
      colActualProgress: 'التقدم الفعلي %',
      colActualSpent: 'المصروف الفعلي (ر.س)',
      colPlannedSpent: 'المخطط للصرف (ر.س)',
      colActivityStatus: 'الحالة',
      statusNotStarted: 'لم يبدأ',
      statusInProgress: 'قيد التنفيذ',
      statusCompleted: 'مكتمل',
      statusDelayed: 'متأخر',
      statusRisk: 'مخاطرة',
      footerConfidential: 'سري — للاستخدام الداخلي فقط',
      footerPage: (p, tot) => `صفحة ${p} من ${tot}`,
      footerReportDate: (d) => `تاريخ التقرير: ${d}`,
      sar: 'ر.س',
      emptyTasks: 'لا توجد أنشطة مجدولة لهذا المشروع بعد',
    } : {
      isRtl: false,
      title: '',
      subtitle: () => `Contract No. ${project.contractNumber || 'N/A'} · Executive Summary`,
      projectName: 'Project Name',
      reportDate: 'Report Date',
      contractor: 'Contractor',
      consultant: 'Consultant',
      contractNo: 'Contract No.',
      paymentCertNo: 'Payment Certificate No.',
      section1Kpi: '',
      kpiBudget: 'Budget',
      kpiChangeOrderBudget: 'Change Orders Budget',
      kpiExecutedToDate: 'Executed To Date Value',
      kpiFinancialProgress: 'Financial Progress',
      kpiRemainingValue: 'Remaining Value',
      section2Charts: '',
      chartFinancialPosition: 'Financial Position',
      chartExecutedVsRemaining: 'Executed vs. Remaining',
      barBudget: 'Budget',
      barExecutedToDate: 'Executed To Date',
      barRemainingValue: 'Remaining Value',
      donutExecuted: 'Executed',
      donutRemaining: 'Remaining',
      donutCaption: (r) => `${r} left to execute`,
      sectionStagePosition: 'PROJECT STAGE POSITION — {n} STAGES TRACKED',
      stageDelivered: 'Delivered',
      stagePending: 'Pending',
      stageCaptionLeft: (d, tot) => `${d} of ${tot} stages delivered`,
      stageCaptionRight: (p) => `${p} pending delivery`,
      page2Header: 'ALL PROJECT TASKS — PLANNED VS ACTUAL',
      page2Subheader: 'All Schedule Activities for This Project',
      colTaskName: 'Task Name',
      colPlannedProgress: 'Planned Progress %',
      colActualProgress: 'Actual Progress %',
      colActualSpent: 'Actual Spent (SAR)',
      colPlannedSpent: 'Planned Spent (SAR)',
      colActivityStatus: 'Status',
      statusNotStarted: 'Not Started',
      statusInProgress: 'In Progress',
      statusCompleted: 'Completed',
      statusDelayed: 'Delayed',
      statusRisk: 'At Risk',
      footerConfidential: 'CONFIDENTIAL — FOR INTERNAL USE ONLY',
      footerPage: (p, tot) => `Page ${p} of ${tot}`,
      footerReportDate: (d) => `Report Date: ${d}`,
      sar: 'SAR',
      emptyTasks: 'No scheduled activities for this project yet',
    };
    const pdfBytes = generateExecutiveReport(project, activities, labels);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(isRtl ? project.name : project.nameEn).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-executive-report.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast(t('pm:reportDownloaded'));
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header — matching the PDF report header */}
      <Card className="p-6 bg-gradient-to-br from-navy-50 to-stone-50 border-navy-100">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-navy-800">
              {isRtl ? project.name : project.nameEn}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {isRtl
                ? `عقد رقم ${project.contractNumber || 'N/A'} · ملخص تنفيذي`
                : `Contract No. ${project.contractNumber || 'N/A'} · Executive Summary`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">{t('pm:execContractor')}</p>
              <p className="font-medium text-navy-700">{isRtl ? project.contractor : project.contractorEn}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">{t('pm:execConsultant')}</p>
              <p className="font-medium text-navy-700">{isRtl ? (project.consultant || '—') : (project.consultantEn || project.consultant || '—')}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">{t('pm:execReportDate')}</p>
              <p className="font-medium text-navy-700">{today}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">{t('pm:execOverallProgress')}</p>
              <p className="font-bold text-copper-700">{overallProgress}%</p>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={i}
              className={`p-4 ${kpi.highlight ? 'bg-navy-700 border-navy-700 text-white' : 'bg-white'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.highlight ? 'bg-white/15' : 'bg-navy-50'}`}>
                  <Icon className={`w-4 h-4 ${kpi.highlight ? 'text-white' : 'text-navy-600'}`} />
                </div>
              </div>
              <p className={`text-lg font-bold ${kpi.highlight ? 'text-white' : 'text-navy-800'}`}>
                {kpi.value}
              </p>
              <p className={`text-xs mt-1 ${kpi.highlight ? 'text-navy-100' : 'text-stone-500'}`}>
                {kpi.label}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Charts — Financial Position bar + Executed vs Remaining donut */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-serif text-base font-semibold text-navy-800 mb-4">{t('pm:execChartFinancialPosition')}</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e1d5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 13) + '…' : v} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e0d8c5', fontSize: 12 }}
                  formatter={(v) => formatSar(Number(v), sarLabel)}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {barChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-base font-semibold text-navy-800 mb-4">{t('pm:execChartExecutedVsRemaining')}</h3>
          <div style={{ height: 260 }} className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={8}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e0d8c5', fontSize: 12 }}
                  formatter={(v) => formatSar(Number(v), sarLabel)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-stone-500 mt-2">
            {isRtl
              ? `${formatSar(remainingValue, sarLabel)} متبقي للتنفيذ`
              : `${formatSar(remainingValue, sarLabel)} left to execute`}
          </p>
        </Card>
      </div>

      {/* Project Stage Position bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-base font-semibold text-navy-800">
            {isRtl
              ? `مرحلة المشروع — ${totalStages} مراحل متتبعة`
              : `PROJECT STAGE POSITION — ${totalStages} STAGES TRACKED`}
          </h3>
        </div>
        <div className="relative h-8 rounded-full overflow-hidden" style={{ backgroundColor: STAGE_PENDING }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{ width: `${stageDeliveredPct}%`, backgroundColor: STAGE_DELIVERED }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_DELIVERED }} />
            <span className="text-navy-700 font-medium">
              {isRtl ? `${deliveredCount} من ${totalStages} مرحلة مكتملة` : `${deliveredCount} of ${totalStages} stages delivered`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-stone-500">
              {isRtl ? `${pendingCount} مرحلة معلقة` : `${pendingCount} pending delivery`}
            </span>
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_PENDING }} />
          </div>
        </div>
      </Card>

      {/* Schedule KPI Section with date/month filtering */}
      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-serif text-base font-semibold text-navy-800">
              {t('pm:execScheduleKpi')}
            </h3>
            {/* Filter mode toggle */}
            <div className="flex gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                onClick={() => setFilterMode('date')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterMode === 'date' ? 'bg-white text-navy-700 shadow-sm' : 'text-stone-500'
                }`}
              >
                {t('pm:execFilterByDate')}
              </button>
              <button
                onClick={() => setFilterMode('month')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterMode === 'month' ? 'bg-white text-navy-700 shadow-sm' : 'text-stone-500'
                }`}
              >
                {t('pm:execFilterByMonth')}
              </button>
              <button
                onClick={() => setFilterMode('preset')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterMode === 'preset' ? 'bg-white text-navy-700 shadow-sm' : 'text-stone-500'
                }`}
              >
                {t('pm:execFilterByPreset')}
              </button>
            </div>
          </div>

          {/* Date range filter */}
          {filterMode === 'date' && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                {t('pm:fromDate')}
                <input type="date" className="filter-input text-xs py-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <span className="text-stone-400 text-xs">→</span>
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                {t('pm:toDate')}
                <input type="date" className="filter-input text-xs py-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-stone-400 hover:text-danger-600"
                >
                  {t('pm:clearFilters')}
                </button>
              )}
            </div>
          )}

          {/* Multi-month selector */}
          {filterMode === 'month' && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                {t('pm:execMonthFrom')}
                <select className="filter-select text-xs py-1" value={monthStart} onChange={(e) => setMonthStart(e.target.value)}>
                  <option value="">{t('pm:execSelectMonth')}</option>
                  {months.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </label>
              <span className="text-stone-400 text-xs">→</span>
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                {t('pm:execMonthTo')}
                <select className="filter-select text-xs py-1" value={monthEnd} onChange={(e) => setMonthEnd(e.target.value)}>
                  <option value="">{t('pm:execSelectMonth')}</option>
                  {months.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </label>
              {(monthStart || monthEnd) && (
                <button
                  onClick={() => { setMonthStart(''); setMonthEnd(''); }}
                  className="text-xs text-stone-400 hover:text-danger-600"
                >
                  {t('pm:clearFilters')}
                </button>
              )}
            </div>
          )}

          {/* Preset month range */}
          {filterMode === 'preset' && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-stone-500 flex items-center gap-1.5">
                {t('pm:viewRange')}
                <select
                  value={presetMonths}
                  onChange={(e) => setPresetMonths(e.target.value)}
                  className="filter-select text-xs py-1"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                    <option key={m} value={m}>{t(`pm:range${m}Month`)}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* KPI summary for filtered range */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide">{t('pm:plannedCost')}</p>
              <p className="text-base font-bold text-navy-700 mt-1">{formatSar(kpiFilteredPlannedCost, sarLabel)}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide">{t('pm:actualCost')}</p>
              <p className="text-base font-bold text-navy-700 mt-1">{formatSar(kpiFilteredActualCost, sarLabel)}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide">{t('pm:execCostVariance')}</p>
              <p className={`text-base font-bold mt-1 ${kpiCostVariance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {kpiCostVariance >= 0 ? '+' : ''}{formatSar(kpiCostVariance, sarLabel)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide">{t('pm:execProgressVariance')}</p>
              <p className={`text-base font-bold mt-1 ${kpiProgressVariance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {kpiProgressVariance >= 0 ? '+' : ''}{kpiProgressVariance}%
              </p>
            </div>
          </div>

          {/* Schedule KPI table — planned vs actual per activity */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-start px-3 py-2 font-medium text-stone-500">{t('pm:activity')}</th>
                  <th className="text-center px-3 py-2 font-medium text-stone-500">{t('pm:plannedProgress')}</th>
                  <th className="text-center px-3 py-2 font-medium text-stone-500">{t('pm:actualProgress')}</th>
                  <th className="text-end px-3 py-2 font-medium text-stone-500">{t('pm:plannedCost')}</th>
                  <th className="text-end px-3 py-2 font-medium text-stone-500">{t('pm:actualCost')}</th>
                  <th className="text-center px-3 py-2 font-medium text-stone-500">{t('pm:activityStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-stone-400 text-sm">{t('pm:noItems')}</td>
                  </tr>
                ) : (
                  filteredActivities.map((a) => {
                    const planned = a.percentComplete ?? 0;
                    const actual = a.actualProgress ?? a.percentComplete ?? 0;
                    const variance = actual - planned;
                    return (
                      <tr key={a.id} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-3 py-2.5 text-navy-700">{isRtl ? a.name : a.nameEn}</td>
                        <td className="px-3 py-2.5 text-center text-stone-600">{planned}%</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-medium text-navy-700">{actual}%</span>
                          {variance !== 0 && (
                            <span className={`text-[10px] ms-1 ${variance > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                              ({variance > 0 ? '+' : ''}{variance})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-end text-stone-600">{(a.plannedCost ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-end text-navy-700 font-medium">{(a.actualCost ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: activityStatusColor(a.status) }}
                            title={t(`pm:${a.status === 'not_started' ? 'notStarted' : a.status === 'in_progress' ? 'inProgress' : a.status === 'completed' ? 'completedActivity' : a.status === 'delayed' ? 'delayedActivity' : 'riskActivity'}`)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredActivities.length > 0 && (
                <tfoot>
                  <tr className="bg-stone-100 font-bold">
                    <td className="px-3 py-2.5 text-navy-800">{t('pm:total')}</td>
                    <td className="px-3 py-2.5 text-center text-navy-800">{kpiFilteredPlannedProgress}%</td>
                    <td className="px-3 py-2.5 text-center text-navy-800">{kpiFilteredActualProgress}%</td>
                    <td className="px-3 py-2.5 text-end text-navy-800">{kpiFilteredPlannedCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-end text-navy-800">{kpiFilteredActualCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Card>

      {/* Live IPC Status Squares */}
      <div>
        <h3 className="font-serif text-base font-semibold text-navy-800 mb-3">
          {isRtl ? 'حالة IPC المباشرة' : 'Live IPC Status'}
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {ipcSections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <Card key={section.key} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center">
                    <SectionIcon className="w-4 h-4 text-navy-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-navy-700">{section.label}</h4>
                </div>
                {section.entries.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-stone-400">
                    <Inbox className="w-5 h-5 me-2" />
                    <span className="text-xs">{isRtl ? 'لا توجد إدخالات' : 'No entries'}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {section.entries.map((entry: IpcEntry) => (
                      <div
                        key={entry.id}
                        className={`rounded-xl border p-3 ${ipcStatusBg(entry.status)}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-navy-600 truncate">
                            {entry.reference || (isRtl ? entry.partyName : (entry.partyNameEn || entry.partyName)) || '—'}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium"
                            style={{ color: ipcStatusDot(entry.status) }}
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: ipcStatusDot(entry.status) }}
                            />
                            {ipcStatusLabel(entry.status, isRtl)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span className="truncate">
                            {isRtl ? entry.description : (entry.descriptionEn || entry.description)}
                          </span>
                          <span className="shrink-0 ms-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {entry.dateLogged}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Risks & Responsibilities — read-only for CEO */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-warning-600" />
          </div>
          <h3 className="font-serif text-base font-semibold text-navy-800">
            {isRtl ? 'المخاطر والمسؤوليات' : 'Risks & Responsibilities'}
          </h3>
        </div>
        {risks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-stone-400">
            <Inbox className="w-5 h-5 me-2" />
            <span className="text-sm">{isRtl ? 'لا توجد مخاطر مسجلة' : 'No risks recorded'}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {risks.map((r: ProjectRisk) => (
              <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-navy-800">
                      {isRtl ? r.name : r.nameEn}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {isRtl ? r.responsible : r.responsibleEn}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {r.deadline}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-stone-600 mt-2 line-clamp-2">
                        {isRtl ? r.description : r.descriptionEn}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${riskResultBadgeClass(r.result || 'pending')}`}>
                    {t(`pm:riskResult_${r.result || 'pending'}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
