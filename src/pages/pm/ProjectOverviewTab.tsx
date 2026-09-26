import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityList } from '@/queries/useActivities';
import { useIpcList } from '@/queries/useIpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { generateExecutiveReport, type ReportLabels } from '@/lib/reportGenerator';
import { useToast } from '@/state/uiStore';
import type { Project, ActivityStatus, IpcStatus, IpcEntry } from '@/types';
import { MapPin, Home, Building2, Calendar, FileText, Download, Briefcase, Send, Inbox } from 'lucide-react';
import {
  PieChart, Pie, Cell as PieCell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const activityStatusColors: Record<ActivityStatus, string> = {
  not_started: '#d0c4a8', in_progress: '#9c4a52', completed: '#475f72', delayed: '#b86a5a', risk: '#a8795e',
};

function formatDate(dateStr: string, isRtl: boolean): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ar = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${d.getDate()} ${(isRtl ? ar : en)[d.getMonth()]} ${d.getFullYear()}`;
}

export function ProjectOverviewTab({ projectId, project, isRtl }: { projectId: string; project: Project; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: activitiesResult } = useActivityList(projectId);
  const { data: ipcResult } = useIpcList(projectId);
  const activities = activitiesResult?.data ?? [];
  const allIpc = ipcResult?.data ?? [];

  const activityStatusCounts: Record<ActivityStatus, number> = { not_started: 0, in_progress: 0, completed: 0, delayed: 0, risk: 0 };
  activities.forEach((a) => { activityStatusCounts[a.status]++; });
  const pieData = (Object.keys(activityStatusCounts) as ActivityStatus[])
    .map((k) => ({
      name: t(`pm:${k === 'not_started' ? 'notStarted' : k === 'in_progress' ? 'inProgress' : k === 'completed' ? 'completedActivity' : k === 'delayed' ? 'delayedActivity' : 'riskActivity'}`),
      value: activityStatusCounts[k],
      status: k,
    }))
    .filter((d) => d.value > 0);

  const curveData = useMemo(() => {
    if (activities.length === 0) return [];
    // Use startDay/endDay (numbers) relative to project start to build the S-curve
    const maxDay = Math.max(...activities.map((a) => a.endDay ?? (a.startDay + a.duration)));
    const projectStart = new Date(`${project.startDate}T00:00:00`).getTime();
    const msPerDay = 86400000;
    // Sample at each activity boundary day
    const days = Array.from(new Set(activities.flatMap((a) => [a.startDay, a.endDay ?? (a.startDay + a.duration)]))).sort((x, y) => x - y);
    return days.map((day) => {
      const date = new Date(projectStart + day * msPerDay).toISOString().slice(0, 10);
      const planned = Math.round(
        activities.reduce((sum, a) => {
          const end = a.endDay ?? (a.startDay + a.duration);
          if (day <= a.startDay) return sum;
          if (day >= end) return sum + 100;
          return sum + Math.round(((day - a.startDay) / a.duration) * 100);
        }, 0) / activities.length,
      );
      const actual = Math.round(
        activities.reduce((sum, a) => {
          const end = a.endDay ?? (a.startDay + a.duration);
          // completed activities contribute their full actual progress
          if (day >= end) return sum + (a.actualProgress ?? a.percentComplete);
          // in-progress: scale actual progress by how far through the activity we are
          if (day > a.startDay) return sum + Math.round(((a.actualProgress ?? a.percentComplete) * (day - a.startDay)) / a.duration);
          return sum;
        }, 0) / activities.length,
      );
      return { date, planned, actual,
        plannedCost: Math.round(activities.reduce((sum, a) => {
          const end = a.endDay ?? (a.startDay + a.duration);
          if (day <= a.startDay) return sum;
          if (day >= end) return sum + a.plannedCost;
          return sum + Math.round((a.plannedCost * (day - a.startDay)) / a.duration);
        }, 0)),
        actualCost: Math.round(activities.reduce((sum, a) => {
          const end = a.endDay ?? (a.startDay + a.duration);
          if (day >= end) return sum + a.actualCost;
          if (day > a.startDay) return sum + Math.round((a.actualCost * (day - a.startDay)) / a.duration);
          return sum;
        }, 0)),
      };
    });
  }, [activities, project.startDate]);

  const exportReport = () => {
    const labels: ReportLabels = isRtl ? {
      isRtl: true, title: '', subtitle: () => `عقد رقم ${project.contractNumber || 'N/A'} · ملخص تنفيذي`,
      projectName: 'اسم المشروع', reportDate: 'تاريخ التقرير', contractor: 'المقاول', consultant: 'الاستشاري',
      contractNo: 'رقم العقد', paymentCertNo: 'رقم شهادة الدفع', section1Kpi: '', kpiBudget: 'الميزانية',
      kpiChangeOrderBudget: 'ميزانية أوامر التغيير', kpiExecutedToDate: 'المنفذ حتى تاريخه',
      kpiFinancialProgress: 'نسبة التقدم المالي', kpiRemainingValue: 'القيمة المتبقية', section2Charts: '',
      chartFinancialPosition: 'المركز المالي', chartExecutedVsRemaining: 'المنفذ مقابل المتبقي',
      barBudget: 'الميزانية', barExecutedToDate: 'المنفذ', barRemainingValue: 'المتبقي',
      donutExecuted: 'المنفذ', donutRemaining: 'المتبقي', donutCaption: (r) => `${r} متبقي`,
      sectionStagePosition: 'مرحلة المشروع', stageDelivered: 'مكتملة', stagePending: 'معلقة',
      stageCaptionLeft: (d, total) => `${d} من ${total}`, stageCaptionRight: (p) => `${p} معلقة`,
      page2Header: 'جميع مهام المشروع', page2Subheader: 'جميع الأنشطة',
      colTaskName: 'اسم المهمة', colPlannedProgress: 'المخطط %', colActualProgress: 'الفعلي %',
      colActualSpent: 'المصروف (ر.س)', colPlannedSpent: 'المخطط (ر.س)', colActivityStatus: 'الحالة',
      statusNotStarted: 'لم يبدأ', statusInProgress: 'قيد التنفيذ', statusCompleted: 'مكتمل',
      statusDelayed: 'متأخر', statusRisk: 'مخاطرة', footerConfidential: 'سري',
      footerPage: (p, total) => `صفحة ${p} من ${total}`, footerReportDate: (d) => `تاريخ: ${d}`,
      sar: 'ر.س', emptyTasks: 'لا توجد أنشطة',
    } : {
      isRtl: false, title: '', subtitle: () => `Contract No. ${project.contractNumber || 'N/A'} · Executive Summary`,
      projectName: 'Project Name', reportDate: 'Report Date', contractor: 'Contractor', consultant: 'Consultant',
      contractNo: 'Contract No.', paymentCertNo: 'Payment Certificate No.', section1Kpi: '', kpiBudget: 'Budget',
      kpiChangeOrderBudget: 'Change Orders Budget', kpiExecutedToDate: 'Executed To Date',
      kpiFinancialProgress: 'Financial Progress', kpiRemainingValue: 'Remaining Value', section2Charts: '',
      chartFinancialPosition: 'Financial Position', chartExecutedVsRemaining: 'Executed vs. Remaining',
      barBudget: 'Budget', barExecutedToDate: 'Executed To Date', barRemainingValue: 'Remaining Value',
      donutExecuted: 'Executed', donutRemaining: 'Remaining', donutCaption: (r) => `${r} left`,
      sectionStagePosition: 'PROJECT STAGE POSITION', stageDelivered: 'Delivered', stagePending: 'Pending',
      stageCaptionLeft: (d, total) => `${d} of ${total}`, stageCaptionRight: (p) => `${p} pending`,
      page2Header: 'ALL PROJECT TASKS', page2Subheader: 'All Schedule Activities',
      colTaskName: 'Task Name', colPlannedProgress: 'Planned %', colActualProgress: 'Actual %',
      colActualSpent: 'Actual Spent (SAR)', colPlannedSpent: 'Planned Spent (SAR)', colActivityStatus: 'Status',
      statusNotStarted: 'Not Started', statusInProgress: 'In Progress', statusCompleted: 'Completed',
      statusDelayed: 'Delayed', statusRisk: 'At Risk', footerConfidential: 'CONFIDENTIAL',
      footerPage: (p, total) => `Page ${p} of ${total}`, footerReportDate: (d) => `Report Date: ${d}`,
      sar: 'SAR', emptyTasks: 'No scheduled activities yet',
    };
    const pdfBytes = generateExecutiveReport(project, activities, labels);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(isRtl ? project.name : project.nameEn).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-report.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast(t('pm:reportDownloaded'));
  };

  const statusBg = (s: IpcStatus) => s === 'in_progress' ? 'bg-powderblue-50 border-powderblue-200' : s === 'delayed' ? 'bg-danger-50 border-danger-200' : 'bg-success-50 border-success-200';
  const statusDot = (s: IpcStatus) => s === 'in_progress' ? '#7ba3c4' : s === 'delayed' ? '#dc6b6b' : '#5a9472';
  const statusLbl = (s: IpcStatus) => isRtl ? (s === 'in_progress' ? 'قيد التنفيذ' : s === 'delayed' ? 'متأخر' : 'مكتمل') : (s === 'in_progress' ? 'In Progress' : s === 'delayed' ? 'Delayed' : 'Completed');

  const ipcSections = [
    { key: 'contractor', label: t('pm:execIpcContractor'), icon: Building2, entries: allIpc.filter((e) => e.direction === 'incoming' && e.source === 'contractor').slice(0, 2) },
    { key: 'consultant', label: t('pm:execIpcConsultant'), icon: Briefcase, entries: allIpc.filter((e) => e.direction === 'incoming' && e.source === 'consultant').slice(0, 2) },
    { key: 'outgoing', label: t('pm:execIpcOutgoing'), icon: Send, entries: allIpc.filter((e) => e.direction === 'outgoing').slice(0, 2) },
  ];

  return (
    <div className="animate-fade-in">
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{t('pm:keyFacts')}</h3>
          <dl className="space-y-3">
            {[
              { icon: MapPin, label: t('pm:location'), value: isRtl ? project.location : project.locationEn },
              { icon: Home, label: t('pm:totalUnits'), value: String(project.totalUnits) },
              { icon: Calendar, label: t('pm:startDate'), value: project.startDate },
              { icon: Calendar, label: t('pm:targetHandover'), value: project.endDate },
              { icon: Building2, label: t('pm:contractor'), value: isRtl ? project.contractor : project.contractorEn },
              { icon: FileText, label: t('pm:budget'), value: `${project.budget.toLocaleString()} ${t('sar')}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-sm text-stone-500 flex items-center gap-2"><Icon className="w-4 h-4" />{label}</dt>
                <dd className="text-sm font-medium text-navy-700">{value}</dd>
              </div>
            ))}
          </dl>
          {(() => {
            const changeOrderTotal = activities.reduce((s, a) => s + (a.changeOrderAmount ?? 0), 0);
            const totalWithChanges = project.budget + changeOrderTotal;
            if (changeOrderTotal === 0) return null;
            return (
              <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-stone-500">{t('pm:changeOrderBudget')}</dt>
                  <dd className="text-sm font-medium text-navy-700">{changeOrderTotal.toLocaleString()} {t('sar')}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-semibold text-navy-800">{t('pm:totalBudgetWithChanges')}</dt>
                  <dd className="text-sm font-bold text-navy-800">{totalWithChanges.toLocaleString()} {t('sar')}</dd>
                </div>
              </div>
            );
          })()}
        </Card>

        <Card className="p-5 lg:col-span-1">
          <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{t('pm:projectDescription')}</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            {isRtl
              ? `مشروع ${project.name} يقع في ${project.location}، يضم ${project.totalUnits} وحدة سكنية. يتولى التنفيذ ${project.contractor}.`
              : `${project.nameEn} is located in ${project.locationEn}, featuring ${project.totalUnits} residential units. Executed by ${project.contractorEn}.`}
          </p>
        </Card>

        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg font-semibold text-navy-800">{t('pm:statusDistribution')}</h3>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="w-3.5 h-3.5" /> {t('pm:downloadReport')}
            </Button>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <PieCell key={i} fill={activityStatusColors[entry.status]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e0d8c5', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{t('pm:progressCurve')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e1d5" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => formatDate(d, isRtl)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e0d8c5', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="planned" name={t('pm:plannedProgress')} stroke="#637b8e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="actual" name={t('pm:actualProgress')} stroke="#b86b4b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{t('pm:costCurve')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e1d5" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => formatDate(d, isRtl)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e0d8c5', fontSize: 12 }} formatter={(v) => `${Number(v).toLocaleString()} ${t('sar')}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="plannedCost" name={t('pm:plannedCost')} stroke="#637b8e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="actualCost" name={t('pm:actualCost')} stroke="#b86b4b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="font-serif text-lg font-semibold text-navy-800 mb-4">{isRtl ? 'ملخص حالة IPC' : 'IPC Status Summary'}</h3>
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
                      <div key={entry.id} className={`rounded-xl border p-3 ${statusBg(entry.status)}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-navy-600 truncate">{entry.reference || (isRtl ? entry.partyName : (entry.partyNameEn || entry.partyName)) || '—'}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: statusDot(entry.status) }}>
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: statusDot(entry.status) }} />
                            {statusLbl(entry.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span className="truncate">{isRtl ? entry.description : (entry.descriptionEn || entry.description)}</span>
                          <span className="shrink-0 ms-2 flex items-center gap-1"><Calendar className="w-3 h-3" />{entry.dateLogged}</span>
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
    </div>
  );
}
