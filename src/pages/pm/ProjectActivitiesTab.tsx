import { useState, useMemo, useRef } from 'react';
import { useBilingualField } from '@/lib/useBilingualField';
import { useTranslation } from 'react-i18next';
import { useActivityList, useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/queries/useActivities';
import { useToast } from '@/state/uiStore';
import { dataSource } from '@/data/client/index';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/PageStates';
import type { Project, ProjectActivity, ActivityPhoto, ActivityPhase, ActivityStatus } from '@/types';
import { Search, Download, Plus, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const phaseOrder: ActivityPhase[] = ['milestone','mobilization','engineering','procurement','construction','finishing','testing'];
const activityStatusColors: Record<ActivityStatus, string> = {
  not_started: '#d0c4a8', in_progress: '#9c4a52', completed: '#475f72', delayed: '#b86a5a', risk: '#a8795e',
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function durationBetween(s: string, e: string): number {
  return Math.max(1, Math.round((new Date(`${e}T00:00:00`).getTime() - new Date(`${s}T00:00:00`).getTime()) / 86400000));
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000);
}

function plannedProgress(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function formatDate(dateStr: string, isRtl: boolean): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ar = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${d.getDate()} ${(isRtl ? ar : en)[d.getMonth()]} ${d.getFullYear()}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToDay(dateStr: string | undefined, projectStartDate: string): number | null {
  if (!dateStr) return null;
  return daysBetween(dateStr, projectStartDate);
}

function startVarianceLabel(diffDays: number, t: (k: string, opts?: Record<string, unknown>) => string): { text: string; tone: 'on-time' | 'early' | 'late' } {
  if (diffDays === 0) return { text: t('pm:startedOnTime'), tone: 'on-time' };
  if (diffDays < 0) return { text: t('pm:startedEarly', { days: Math.abs(diffDays) }), tone: 'early' };
  return { text: t('pm:startedLate', { days: diffDays }), tone: 'late' };
}

function endVarianceLabel(diffDays: number, t: (k: string, opts?: Record<string, unknown>) => string): { text: string; tone: 'on-time' | 'early' | 'late' } {
  if (diffDays === 0) return { text: t('pm:completedOnTime'), tone: 'on-time' };
  if (diffDays < 0) return { text: t('pm:completedEarly', { days: Math.abs(diffDays) }), tone: 'early' };
  return { text: t('pm:completedLate', { days: diffDays }), tone: 'late' };
}

const varianceToneClass: Record<string, string> = {
  'on-time': 'bg-success-50 text-success-700 border-success-200',
  'early': 'bg-powderblue-50 text-powderblue-700 border-powderblue-200',
  'late': 'bg-danger-50 text-danger-700 border-danger-200',
};

export function ProjectActivitiesTab({ projectId, project, isRtl }: { projectId: string; project: Project; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: result, isLoading } = useActivityList(projectId);
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<ProjectActivity | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<ActivityPhase>>(new Set());
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleFrom, setScheduleFrom] = useState('');
  const [scheduleTo, setScheduleTo] = useState('');
  const [viewRangePreset, setViewRangePreset] = useState('3');
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');

  const rawActivities = result?.data ?? [];
  const activities = useMemo(() => rawActivities.map((a) => {
    const startDate = a.startDate || addDays(project.startDate, a.startDay);
    const endDate = a.endDate || addDays(project.startDate, a.endDay);
    return { ...a, startDate, endDate, duration: durationBetween(startDate, endDate), percentComplete: plannedProgress(startDate, endDate) };
  }), [rawActivities, project.startDate]);

  const filtered = useMemo(() => activities.filter((a) => {
    const q = scheduleSearch.toLowerCase().trim();
    return (!q || a.name.toLowerCase().includes(q) || a.nameEn.toLowerCase().includes(q) || a.activityId.toLowerCase().includes(q))
      && (!scheduleFrom || a.startDay >= Number(scheduleFrom))
      && (!scheduleTo || a.endDay <= Number(scheduleTo));
  }), [activities, scheduleSearch, scheduleFrom, scheduleTo]);

  const togglePhase = (phase: ActivityPhase) => {
    setCollapsedPhases((prev) => { const n = new Set(prev); n.has(phase) ? n.delete(phase) : n.add(phase); return n; });
  };

  const handleSave = (data: Partial<ProjectActivity>, isNew: boolean) => {
    const startDate = data.startDate || addDays(project.startDate, data.startDay ?? 0);
    const endDate = data.endDate || addDays(project.startDate, data.endDay ?? 1);
    const activity = {
      activityId: data.activityId || 'ACT-01',
      name: data.name || '',
      nameEn: data.nameEn || data.name || '',
      phase: data.phase || 'construction' as ActivityPhase,
      startDay: data.startDay ?? 0,
      endDay: data.endDay ?? 1,
      duration: durationBetween(startDate, endDate),
      percentComplete: data.actualProgress ?? data.percentComplete ?? 0,
      actualProgress: data.actualProgress ?? 0,
      startDate,
      endDate,
      actualStartDate: data.actualStartDate,
      actualEndDate: data.actualEndDate,
      status: data.status || 'not_started' as ActivityStatus,
      team: data.team || 'فريق المقاول الرئيسي',
      teamEn: data.teamEn || 'Main Contractor Team',
      description: data.description || '',
      descriptionEn: data.descriptionEn || '',
      actualCost: data.actualCost ?? 0,
      plannedCost: data.plannedCost ?? 0,
      changeOrderAmount: data.changeOrderAmount ?? 0,
      photos: data.photos ?? [],
    };
    const p = isNew
      ? createActivity.mutateAsync({ projectId, activity })
      : editingActivity ? updateActivity.mutateAsync({ projectId, activityId: editingActivity.id, changes: data }) : Promise.resolve(null);
    p.then(() => { setEditingActivity(null); setIsAdding(false); toast(t('pm:activitySaved')); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleDelete = () => {
    if (!deletingActivity) return;
    deleteActivity.mutateAsync({ projectId, activityId: deletingActivity.id })
      .then(() => { setDeletingActivity(null); toast(t('pm:activityDeleted')); })
      .catch(() => toast(t('errorSaving')));
  };

  const exportSchedulePdf = () => {
    const lines = [
      `${project.nameEn} - ${t('pm:schedule')}`,
      `Generated ${new Date().toISOString().slice(0, 10)}`,
      '',
      ...filtered.flatMap((a) => [
        `${a.activityId} | ${a.nameEn} | ${a.phase}`,
        `Dates: ${a.startDate} to ${a.endDate} | Duration: ${a.duration} days`,
        `Actual: ${a.actualProgress ?? a.percentComplete}%`,
        '',
      ]),
    ];
    const content = lines.slice(0, 48).map((line, i) => `BT /F1 9 Tf 40 ${748 - i * 15} Td (${line.replace(/[^\x20-\x7E]/g, '?').replace(/[\\()]/g, '\\$&')}) Tj ET`).join('\\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
      `<< /Length ${content.length} >>\\nstream\\n${content}\\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\\n';
    const offsets: number[] = [0];
    objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\\n${obj}\\nendobj\\n`; });
    const xref = pdf.length;
    pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
    offsets.slice(1).forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \\n`; });
    pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
    const blob = new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.nameEn.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-schedule.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 start-3" />
          <input className="filter-input ps-9" placeholder={t('pm:search')} value={scheduleSearch} onChange={(e) => setScheduleSearch(e.target.value)} />
        </div>
        <input type="number" className="filter-input md:w-32" placeholder={t('pm:fromDate')} value={scheduleFrom} onChange={(e) => setScheduleFrom(e.target.value)} />
        <input type="number" className="filter-input md:w-32" placeholder={t('pm:toDate')} value={scheduleTo} onChange={(e) => setScheduleTo(e.target.value)} />
        <Button variant="outline" size="sm" onClick={exportSchedulePdf}><Download className="w-3.5 h-3.5" /> {t('pm:scheduleExportPdf')}</Button>
        <Button size="sm" onClick={() => setIsAdding(true)}><Plus className="w-3.5 h-3.5" /> {t('pm:addActivity')}</Button>
      </div>

      {/* View Range Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-medium text-stone-500">{t('pm:viewRange')}:</span>
        <select value={viewRangePreset} onChange={(e) => setViewRangePreset(e.target.value)} className="filter-select text-xs py-1 px-2">
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
            <option key={m} value={m}>{t(`pm:range${m}Month`)}</option>
          ))}
          <option value="full">{t('pm:rangeFull')}</option>
          <option value="custom">{t('pm:rangeCustom')}</option>
        </select>
        {viewRangePreset === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input type="date" className="filter-input text-xs py-1" value={customRangeStart} onChange={(e) => setCustomRangeStart(e.target.value)} title={t('pm:customStart')} />
            <span className="text-stone-400 text-xs">→</span>
            <input type="date" className="filter-input text-xs py-1" value={customRangeEnd} onChange={(e) => setCustomRangeEnd(e.target.value)} title={t('pm:customEnd')} />
          </div>
        )}
      </div>

      {/* Desktop Gantt */}
      <Card className="p-5 hidden md:block overflow-x-auto">
        <div style={{ minWidth: 800 }}>
          <GanttChart activities={filtered} totalDays={project.totalDays} isRtl={isRtl} projectStartDate={project.startDate} t={t}
            onActivityClick={setEditingActivity} collapsedPhases={collapsedPhases} togglePhase={togglePhase}
            onDeleteActivity={setDeletingActivity}
            viewRangePreset={viewRangePreset} customRangeStart={customRangeStart} customRangeEnd={customRangeEnd}
          />
        </div>
      </Card>

      {/* Mobile checklist */}
      <div className="md:hidden space-y-3">
        {(() => {
          const todayStrMobile = getTodayStr();
          const todayDayMobile = (() => {
            const day = dateToDay(todayStrMobile, project.startDate);
            if (day === null || day < 0 || day > project.totalDays) return null;
            return day;
          })();
          if (todayDayMobile === null) return null;
          const todayPctMobile = (todayDayMobile / project.totalDays) * 100;
          return (
            <div className="rounded-xl bg-navy-600 text-white px-4 py-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/90 shrink-0" />
                  <span className="text-sm font-bold tracking-wide">{t('pm:todayMarker')}</span>
                </div>
                <span className="text-xs font-medium text-navy-100">{t('pm:todayDay', { day: todayDayMobile })} · {Math.round(todayPctMobile)}%</span>
              </div>
              <div className="mt-1 text-xs text-navy-100">{formatDate(todayStrMobile, isRtl)}</div>
              <div className="mt-2 h-1.5 rounded-full bg-navy-400/50 overflow-hidden">
                <div className="h-full rounded-full bg-white/80" style={{ width: `${todayPctMobile}%` }} />
              </div>
            </div>
          );
        })()}
        {phaseOrder.map((phase) => {
          const phaseActivities = filtered.filter((a) => a.phase === phase);
          if (phaseActivities.length === 0) return null;
          const isCollapsed = collapsedPhases.has(phase);
          return (
            <Card key={phase} className="overflow-hidden">
              <button onClick={() => togglePhase(phase)} className="w-full flex items-center justify-between px-4 py-3 bg-stone-50">
                <span className="font-medium text-sm text-navy-700">{t(`pm:phases.${phase}`)}</span>
                {isCollapsed ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronUp className="w-4 h-4 text-stone-400" />}
              </button>
              {!isCollapsed && (
                <div className="divide-y divide-stone-100">
                  {phaseActivities.map((a) => {
                    const aProgress = a.actualProgress ?? a.percentComplete;
                    const isPast = a.endDay < (dateToDay(getTodayStr(), project.startDate) ?? -1);
                    const isFuture = a.startDay > (dateToDay(getTodayStr(), project.startDate) ?? -1);
                    const isBehind = a.endDay < (dateToDay(getTodayStr(), project.startDate) ?? -1) && aProgress < 100;
                    const timelineBadge = isBehind
                      ? { label: t('pm:behindSchedule'), cls: 'bg-danger-50 text-danger-700 border-danger-200' }
                      : isPast
                        ? { label: t('pm:pastActivity'), cls: 'bg-stone-100 text-stone-500 border-stone-200' }
                        : isFuture
                          ? { label: t('pm:futureActivity'), cls: 'bg-powderblue-50 text-powderblue-700 border-powderblue-200' }
                          : { label: t('pm:inProgress'), cls: 'bg-copper-50 text-copper-700 border-copper-200' };
                    return (
                      <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                        <button onClick={() => setEditingActivity(a)} className="text-start flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-sm font-medium text-navy-700 truncate">{isRtl ? a.name : a.nameEn}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border shrink-0 ${timelineBadge.cls}`}>{timelineBadge.label}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs text-stone-500 flex-wrap">
                              <span className="font-medium">{t('pm:plannedDates')}:</span>
                              <span>{a.startDate} → {a.endDate}</span>
                              <span>{a.duration} {t('pm:days')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-500 flex-wrap">
                              <span className="font-medium">{t('pm:actualDates')}:</span>
                              {a.actualStartDate || a.actualEndDate ? (
                                <span>{a.actualStartDate || '—'} → {a.actualEndDate || t('pm:notYetCompleted')}</span>
                              ) : (
                                <span className="text-stone-400">{t('pm:notYetStarted')}</span>
                              )}
                              {a.actualStartDate && a.startDate && (() => {
                                const diff = daysBetween(a.actualStartDate, a.startDate);
                                const v = startVarianceLabel(diff, t);
                                return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${varianceToneClass[v.tone]}`}>{v.text}</span>;
                              })()}
                              {a.actualEndDate && a.endDate && (() => {
                                const diff = daysBetween(a.actualEndDate, a.endDate);
                                const v = endVarianceLabel(diff, t);
                                return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${varianceToneClass[v.tone]}`}>{v.text}</span>;
                              })()}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                                <span className="block h-full rounded-full" style={{ width: `${aProgress}%`, backgroundColor: activityStatusColors[a.status] }} />
                              </span>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: activityStatusColors[a.status] }}>{aProgress}%</span>
                            </div>
                          </div>
                        </button>
                        <button onClick={() => setDeletingActivity(a)} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors ms-2 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-stone-400 text-center py-12">{t('pm:noItems')}</p>}
      </div>

      <Modal open={!!editingActivity || isAdding} onClose={() => { setEditingActivity(null); setIsAdding(false); }} title={t('pm:editActivity')} className="max-w-lg">
        {(editingActivity || isAdding) && (
          <ActivityForm
            activity={editingActivity}
            projectId={projectId}
            projectStartDate={project.startDate}
            isRtl={isRtl}
            t={t}
            onSave={handleSave}
            onCancel={() => { setEditingActivity(null); setIsAdding(false); }}
          />
        )}
      </Modal>

      <Modal open={!!deletingActivity} onClose={() => setDeletingActivity(null)} title={t('pm:delete')}>
        <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDelete')}</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDelete} className="flex-1">{t('pm:delete')}</Button>
          <Button variant="outline" onClick={() => setDeletingActivity(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function GanttChart({
  activities, totalDays, isRtl, projectStartDate, t, onActivityClick, collapsedPhases, togglePhase, onDeleteActivity,
  viewRangePreset, customRangeStart, customRangeEnd,
}: {
  activities: ProjectActivity[];
  totalDays: number;
  isRtl: boolean;
  projectStartDate: string;
  t: (k: string, opts?: Record<string, unknown>) => string;
  onActivityClick: (a: ProjectActivity) => void;
  collapsedPhases: Set<ActivityPhase>;
  togglePhase: (p: ActivityPhase) => void;
  onDeleteActivity: (a: ProjectActivity) => void;
  viewRangePreset: string;
  customRangeStart: string;
  customRangeEnd: string;
}) {
  const todayStr = getTodayStr();
  const todayDay = dateToDay(todayStr, projectStartDate);

  // Compute the visible window
  const { windowStartDay, windowEndDay, windowDays } = useMemo(() => {
    if (viewRangePreset === 'full') {
      return { windowStartDay: 0, windowEndDay: totalDays, windowDays: totalDays };
    }
    if (viewRangePreset === 'custom' && customRangeStart && customRangeEnd) {
      const s = Math.max(0, daysBetween(customRangeStart, projectStartDate));
      const e = Math.min(totalDays, daysBetween(customRangeEnd, projectStartDate));
      if (e > s) return { windowStartDay: s, windowEndDay: e, windowDays: e - s };
    }
    // Preset months: center around today
    const months = viewRangePreset === '1' ? 1 : viewRangePreset === '3' ? 3 : viewRangePreset === '4' ? 4 : 5;
    const halfDays = Math.round((months * 30) / 2);
    let s: number, e: number;
    if (todayDay !== null && todayDay >= 0 && todayDay <= totalDays) {
      s = todayDay - halfDays;
      e = todayDay + halfDays;
    } else {
      s = 0;
      e = Math.min(totalDays, months * 30);
    }
    // Clamp to project bounds
    if (s < 0) { e += -s; s = 0; }
    if (e > totalDays) { s -= (e - totalDays); e = totalDays; }
    if (s < 0) s = 0;
    return { windowStartDay: s, windowEndDay: e, windowDays: Math.max(1, e - s) };
  }, [viewRangePreset, customRangeStart, customRangeEnd, totalDays, todayDay]);

  const [scrollOffset, setScrollOffset] = useState(0);
  const dragState = useRef<{ startX: number; startOffset: number; dragging: boolean }>({ startX: 0, startOffset: 0, dragging: false });
  const ganttBodyRef = useRef<HTMLDivElement>(null);

  const maxScroll = Math.max(0, windowStartDay);
  const minScroll = -(Math.max(0, totalDays - windowEndDay));
  const effectiveOffset = Math.max(minScroll, Math.min(maxScroll, scrollOffset));

  const visStartDay = windowStartDay - effectiveOffset;
  const visEndDay = windowEndDay - effectiveOffset;
  const visDays = Math.max(1, visEndDay - visStartDay);

  const todayInWindow = todayDay !== null && todayDay >= visStartDay && todayDay <= visEndDay;
  const todayPct = todayInWindow ? ((todayDay - visStartDay) / visDays) * 100 : null;

  // Generate axis ticks: ~5-6 evenly spaced
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const dayNum = Math.round(visStartDay + (i / (tickCount - 1)) * visDays);
    return { dayNum, pct: (i / (tickCount - 1)) * 100 };
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    dragState.current = { startX: e.clientX, startOffset: effectiveOffset, dragging: true };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.dragging || !ganttBodyRef.current) return;
    const rect = ganttBodyRef.current.getBoundingClientRect();
    const deltaPx = e.clientX - dragState.current.startX;
    const deltaPct = deltaPx / rect.width;
    const deltaDays = Math.round(deltaPct * visDays);
    const newOffset = dragState.current.startOffset + deltaDays;
    setScrollOffset(Math.max(minScroll, Math.min(maxScroll, newOffset)));
  };
  const handleMouseUp = () => { dragState.current.dragging = false; };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragState.current = { startX: e.touches[0].clientX, startOffset: effectiveOffset, dragging: true };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.dragging || !ganttBodyRef.current) return;
    const rect = ganttBodyRef.current.getBoundingClientRect();
    const deltaPx = e.touches[0].clientX - dragState.current.startX;
    const deltaPct = deltaPx / rect.width;
    const deltaDays = Math.round(deltaPct * visDays);
    const newOffset = dragState.current.startOffset + deltaDays;
    setScrollOffset(Math.max(minScroll, Math.min(maxScroll, newOffset)));
  };

  const scrollByDays = (days: number) => {
    setScrollOffset((prev) => Math.max(minScroll, Math.min(maxScroll, prev + days)));
  };

  const jumpToToday = () => {
    if (todayDay === null) return;
    const halfDays = Math.round(visDays / 2);
    const targetOffset = windowStartDay - (todayDay - halfDays);
    setScrollOffset(Math.max(minScroll, Math.min(maxScroll, targetOffset)));
  };

  const canScrollLeft = effectiveOffset < maxScroll;
  const canScrollRight = effectiveOffset > minScroll;
  const ScrollLeftIcon = isRtl ? ChevronRight : ChevronLeft;
  const ScrollRightIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div>
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button
            disabled={!canScrollLeft}
            onClick={() => scrollByDays(-Math.round(visDays * 0.25))}
            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('pm:scrollLeft')}
          >
            <ScrollLeftIcon className="w-4 h-4" />
          </button>
          <button
            disabled={!canScrollRight}
            onClick={() => scrollByDays(Math.round(visDays * 0.25))}
            className="p-1 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('pm:scrollRight')}
          >
            <ScrollRightIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[10px] text-stone-400">
          {formatDate(addDays(projectStartDate, visStartDay), isRtl)} → {formatDate(addDays(projectStartDate, visEndDay), isRtl)}
        </div>
        {!todayInWindow && todayDay !== null && (
          <button onClick={jumpToToday} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-navy-50 text-navy-700 text-[10px] font-medium border border-navy-200 hover:bg-navy-100 transition-colors">
            <Calendar className="w-3 h-3" /> {t('pm:jumpToToday')}
          </button>
        )}
        {todayInWindow && <div className="w-20" />}
      </div>

      <div className="flex items-center border-b border-stone-200 pb-1 mb-1">
        <div className="w-48 shrink-0 text-xs font-medium text-stone-400">{t('pm:activity')}</div>
        <div className="flex-1 relative h-8">
          {ticks.map((tick) => {
            const dateStr = addDays(projectStartDate, tick.dayNum);
            return (
              <div key={tick.dayNum} className="absolute text-[10px] text-stone-400 text-center"
                style={{ [isRtl ? 'right' : 'left']: `${tick.pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                <div className="font-medium text-stone-500">{formatDate(dateStr, isRtl)}</div>
                <div className="text-[9px] text-stone-300">D{tick.dayNum}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 mb-2 text-[10px] text-stone-400">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm border-2 border-stone-400 bg-stone-200" />{t('pm:plannedDates')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-success-500" />{t('pm:actualStartMarker')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-danger-500" />{t('pm:actualEndMarker')}</span>
        {todayInWindow && <span className="inline-flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-navy-500" />{t('pm:todayMarker')} ({todayStr})</span>}
      </div>
      <div
        ref={ganttBodyRef}
        className="relative cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {todayPct !== null && (
          <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ [isRtl ? 'right' : 'left']: `${todayPct}%` }}>
            <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-navy-500" style={{ [isRtl ? 'right' : 'left']: 0 }} />
            <div className="absolute -top-px z-30 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold text-white bg-navy-500 shadow"
              style={{ [isRtl ? 'right' : 'left']: 0, transform: isRtl ? 'translateX(50%)' : 'translateX(-50%)' }}>
              {t('pm:todayMarker')} · {formatDate(todayStr, isRtl)}
            </div>
          </div>
        )}
      {phaseOrder.map((phase) => {
        const phaseActivities = activities.filter((a) => a.phase === phase);
        if (phaseActivities.length === 0) return null;
        const isCollapsed = collapsedPhases.has(phase);
        return (
          <div key={phase}>
            <button onClick={() => togglePhase(phase)} className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-stone-50 text-start">
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-stone-400" /> : <ChevronUp className="w-3.5 h-3.5 text-stone-400" />}
              <span className="text-xs font-semibold text-navy-700">{t(`pm:phases.${phase}`)}</span>
              <span className="text-[10px] text-stone-400">({phaseActivities.length})</span>
            </button>
            {!isCollapsed && phaseActivities.map((a) => {
              const barStartPct = ((a.startDay - visStartDay) / visDays) * 100;
              const barWidthPct = (a.duration / visDays) * 100;
              const barOutOfView = barStartPct + barWidthPct < 0 || barStartPct > 100;
              const clampedStartPct = Math.max(0, barStartPct);
              const clampedWidthPct = Math.min(100, barStartPct + barWidthPct) - clampedStartPct;
              return (
                <div key={a.id} className="flex items-center py-1 group">
                  <div className="w-48 shrink-0 pe-2 flex items-center justify-between">
                    <button onClick={() => onActivityClick(a)} className="text-start">
                      <p className="text-xs font-medium text-navy-700 truncate group-hover:text-copper-600 transition-colors">{isRtl ? a.name : a.nameEn}</p>
                      <p className="text-[10px] text-stone-400">{a.activityId} · {a.duration}{t('pm:days')}</p>
                    </button>
                    <button onClick={() => onDeleteActivity(a)} className="p-1 rounded text-stone-300 hover:text-danger-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 relative h-6">
                    {!barOutOfView && (
                      <button onClick={() => onActivityClick(a)}
                        className="absolute top-0.5 h-5 rounded-md border-2 transition-all hover:opacity-80"
                        style={{
                          width: `${clampedWidthPct}%`,
                          [isRtl ? 'right' : 'left']: `${clampedStartPct}%`,
                          borderColor: activityStatusColors[a.status],
                          backgroundColor: `${activityStatusColors[a.status]}22`,
                        }} />
                    )}
                    {!barOutOfView && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none h-4"
                        style={{
                          [isRtl ? 'right' : 'left']: `${clampedStartPct}%`,
                          width: `${clampedWidthPct}%`,
                          minWidth: '68px',
                        }}
                      >
                        <div className="absolute inset-0 rounded-full border border-stone-300/50 shadow-sm overflow-hidden" style={{ backgroundColor: '#faf6ee' }}>
                          <div className="absolute inset-0 flex items-center justify-around px-1.5">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="w-0.5 h-2 rounded-full bg-stone-300/40" />
                            ))}
                          </div>
                        </div>
                        <div
                          className="absolute top-1/2 h-3.5 rounded-md flex items-center justify-center text-[8px] font-bold text-white whitespace-nowrap px-1 shadow"
                          style={{
                            [isRtl ? 'right' : 'left']: `${a.actualProgress ?? a.percentComplete}%`,
                            transform: `translate(${isRtl ? '50%' : '-50%'}, -50%)`,
                            backgroundColor: activityStatusColors[a.status],
                            minWidth: '30px',
                          }}
                        >
                          {a.actualProgress ?? a.percentComplete}%
                        </div>
                      </div>
                    )}
                    {!barOutOfView && (() => {
                      const aStartDay = dateToDay(a.actualStartDate, projectStartDate);
                      const aEndDay = dateToDay(a.actualEndDate, projectStartDate);
                      return <>
                        {aStartDay !== null && aStartDay >= visStartDay && aStartDay <= visEndDay && (
                          <div className="absolute top-0 bottom-0 w-0.5 bg-success-500 z-20 rounded-full"
                            style={{ [isRtl ? 'right' : 'left']: `${((aStartDay - visStartDay) / visDays) * 100}%` }}
                            title={t('pm:actualStartMarker')} />
                        )}
                        {aEndDay !== null && aEndDay >= visStartDay && aEndDay <= visEndDay && (
                          <div className="absolute top-0 bottom-0 w-0.5 bg-danger-500 z-20 rounded-full"
                            style={{ [isRtl ? 'right' : 'left']: `${((aEndDay - visStartDay) / visDays) * 100}%` }}
                            title={t('pm:actualEndMarker')} />
                        )}
                      </>;
                    })()}
                    {barOutOfView && (
                      <div className="absolute inset-0 flex items-center">
                        <span className="text-[9px] text-stone-300 italic ps-1">
                          {a.startDay < visStartDay ? '◀' : '▶'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function ActivityForm({ activity, projectId, projectStartDate, isRtl, t, onSave, onCancel }: {
  activity: ProjectActivity | null;
  projectId: string;
  projectStartDate: string;
  isRtl: boolean;
  t: (k: string) => string;
  onSave: (data: Partial<ProjectActivity>, isNew: boolean) => void;
  onCancel: () => void;
}) {
  const name = useBilingualField(activity?.name || '', activity?.nameEn || '');
  const team = useBilingualField(activity?.team || 'فريق المقاول الرئيسي', activity?.teamEn || 'Main Contractor Team');
  const [activityId, setActivityId] = useState(activity?.activityId || '');
  const [phase, setPhase] = useState<ActivityPhase>(activity?.phase || 'construction');
  const [startDate, setStartDate] = useState(activity?.startDate || addDays(projectStartDate, activity?.startDay ?? 0));
  const [endDate, setEndDate] = useState(activity?.endDate || addDays(projectStartDate, activity?.endDay ?? 1));
  const [actualStartDate, setActualStartDate] = useState(activity?.actualStartDate || '');
  const [actualEndDate, setActualEndDate] = useState(activity?.actualEndDate || '');
  const [status, setStatus] = useState<ActivityStatus>(activity?.status || 'not_started');
  const [actualProgress, setActualProgress] = useState(activity?.actualProgress ?? activity?.percentComplete ?? 0);
  const [description, setDescription] = useState(activity?.description || '');
  const [actualCost, setActualCost] = useState(activity?.actualCost ?? 0);
  const [plannedCost, setPlannedCost] = useState(activity?.plannedCost ?? 0);
  const [changeOrderAmount, setChangeOrderAmount] = useState(activity?.changeOrderAmount ?? 0);
  const [photoObjects, setPhotoObjects] = useState<ActivityPhoto[]>(activity?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew = !activity;
  const duration = durationBetween(startDate, endDate);
  const planned = plannedProgress(startDate, endDate);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { url } = await dataSource.storage.upload('activity-photos', `${projectId}/${Date.now()}-${file.name}`, file);
        const photo: ActivityPhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dataUrl: url,
          uploadDate: new Date().toISOString().slice(0, 10),
          fileType: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('video/') ? 'video' : 'other',
          fileName: file.name,
        };
        setPhotoObjects((prev) => [photo, ...prev]);
      }
    } finally {
      setUploading(false);
    }
  };

  const phaseOptions: ActivityPhase[] = ['milestone','mobilization','engineering','procurement','construction','finishing','testing'];

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:activity')} (AR)<input className="form-input mt-1" value={name.ar} onChange={(e) => name.setAr(e.target.value)} onBlur={() => void name.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:activity')} (EN)<input className="form-input mt-1" value={name.en} onChange={(e) => name.setEn(e.target.value)} onBlur={() => void name.onEnBlur()} dir="ltr" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:activityId')}<input className="form-input mt-1" value={activityId} onChange={(e) => setActivityId(e.target.value)} /></label>
        <label className="text-xs text-stone-500">{t('pm:phase')}
          <select className="filter-select mt-1" value={phase} onChange={(e) => setPhase(e.target.value as ActivityPhase)}>
            {phaseOptions.map((p) => <option key={p} value={p}>{t(`pm:phases.${p}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="text-xs text-stone-500">{t('pm:startDate')}<input type="date" className="form-input mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="text-xs text-stone-500">{t('pm:endDate')}<input type="date" className="form-input mt-1" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        <label className="text-xs text-stone-500">{t('pm:durationDays')}<input className="form-input mt-1 bg-stone-50" value={`${duration} ${t('pm:days')}`} readOnly /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:actualStartDate')}<input type="date" className="form-input mt-1" value={actualStartDate} onChange={(e) => setActualStartDate(e.target.value)} /></label>
        <label className="text-xs text-stone-500">{t('pm:actualEndDate')}<input type="date" className="form-input mt-1" value={actualEndDate} onChange={(e) => setActualEndDate(e.target.value)} /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:assignedTeam')} (AR)<input className="form-input mt-1" value={team.ar} onChange={(e) => team.setAr(e.target.value)} onBlur={() => void team.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:assignedTeam')} (EN)<input className="form-input mt-1" value={team.en} onChange={(e) => team.setEn(e.target.value)} onBlur={() => void team.onEnBlur()} dir="ltr" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slateblue-50 p-3">
          <p className="text-xs text-stone-500">{t('pm:plannedProgress')}</p>
          <p className="text-xl font-semibold text-slateblue-700 mt-1">{planned}%</p>
        </div>
        <div className="rounded-xl bg-copper-50 p-3">
          <label className="text-xs text-stone-500 mb-1.5 block">{t('pm:actualProgress')}</label>
          <input type="range" min={0} max={100} value={actualProgress} onChange={(e) => setActualProgress(Number(e.target.value))} className="w-full accent-copper-600" />
          <div className="flex justify-between text-xs text-stone-500 mt-1"><span>0%</span><span className="font-bold text-copper-700">{actualProgress}%</span><span>100%</span></div>
        </div>
      </div>
      <label className="text-xs text-stone-500 block">{t('pm:updateStatus')}
        <select className="filter-select mt-1" value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)}>
          <option value="not_started">{t('pm:notStarted')}</option>
          <option value="in_progress">{t('pm:inProgress')}</option>
          <option value="completed">{t('pm:completedActivity')}</option>
          <option value="delayed">{t('pm:delayedActivity')}</option>
        </select>
      </label>
      <label className="text-xs text-stone-500 block">{t('pm:description')}<textarea className="form-input mt-1 min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} dir={isRtl ? 'rtl' : 'ltr'} /></label>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs text-stone-500">{t('pm:plannedCost')}<input type="number" min={0} className="form-input mt-1" value={plannedCost} onChange={(e) => setPlannedCost(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('pm:actualCost')}<input type="number" min={0} className="form-input mt-1" value={actualCost} onChange={(e) => setActualCost(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('pm:changeOrderAmount')}<input type="number" min={0} className="form-input mt-1" value={changeOrderAmount} onChange={(e) => setChangeOrderAmount(Number(e.target.value))} /></label>
      </div>
      <div className="border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-navy-700">{t('pm:photos')}</p>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-copper-600 text-white text-xs font-medium cursor-pointer hover:bg-copper-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> {uploading ? '...' : t('pm:uploadPhoto')}
            <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf" multiple className="hidden" onChange={(e) => void handlePhotoUpload(e.target.files)} />
          </label>
        </div>
        {photoObjects.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photoObjects.map((photo) => (
              <div key={photo.id} className="relative">
                {photo.fileType === 'image' || !photo.fileType ? (
                  <img src={photo.dataUrl} alt={photo.fileName || ''} className="w-full h-20 object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-20 rounded-lg bg-stone-100 flex flex-col items-center justify-center gap-1">
                    <span className="text-[10px] text-stone-500 font-medium uppercase">{photo.fileType}</span>
                    <span className="text-[9px] text-stone-400 truncate px-1 max-w-full">{photo.fileName}</span>
                  </div>
                )}
                <span className="absolute bottom-1 end-1 text-[8px] bg-black/50 text-white rounded px-1">{photo.uploadDate}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ name: name.ar, nameEn: name.en, activityId, phase, startDate, endDate, actualStartDate: actualStartDate || undefined, actualEndDate: actualEndDate || undefined, duration, team: team.ar, teamEn: team.en, percentComplete: actualProgress, actualProgress, status, description, descriptionEn: description, actualCost, plannedCost, changeOrderAmount, photos: photoObjects }, isNew)} className="flex-1">{t('pm:saveChanges')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}