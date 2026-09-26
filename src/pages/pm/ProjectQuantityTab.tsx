import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivityList } from '@/queries/useActivities';
import { useToast } from '@/state/uiStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/PageStates';
import type { Project } from '@/types';
import { Search, Download } from 'lucide-react';

export function ProjectQuantityTab({ projectId, project, isRtl }: { projectId: string; project: Project; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: result, isLoading } = useActivityList(projectId);
  const [qtySearch, setQtySearch] = useState('');
  const [qtyFrom, setQtyFrom] = useState('');
  const [qtyTo, setQtyTo] = useState('');

  const activities = result?.data ?? [];

  const filtered = useMemo(() => activities.filter((a) => {
    const q = qtySearch.toLowerCase().trim();
    return (!q || a.name.toLowerCase().includes(q) || a.nameEn.toLowerCase().includes(q) || a.activityId.toLowerCase().includes(q))
      && (!qtyFrom || a.startDay >= Number(qtyFrom))
      && (!qtyTo || a.endDay <= Number(qtyTo));
  }), [activities, qtySearch, qtyFrom, qtyTo]);

  if (isLoading) return <PageSkeleton />;

  const totalActual = activities.reduce((s, a) => s + a.actualCost, 0);
  const totalVariance = project.budget - totalActual;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 start-3" />
          <input className="filter-input ps-9" placeholder={t('pm:search')} value={qtySearch} onChange={(e) => setQtySearch(e.target.value)} />
        </div>
        <input type="number" className="filter-input md:w-32" placeholder={t('pm:fromDate')} value={qtyFrom} onChange={(e) => setQtyFrom(e.target.value)} />
        <input type="number" className="filter-input md:w-32" placeholder={t('pm:toDate')} value={qtyTo} onChange={(e) => setQtyTo(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => toast(t('pm:exportReady'))}><Download className="w-3.5 h-3.5" /> {t('pm:downloadTable')}</Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-start px-4 py-3 font-medium text-stone-500">{t('pm:activity')}</th>
              <th className="text-start px-4 py-3 font-medium text-stone-500">{t('pm:activityId')}</th>
              <th className="text-end px-4 py-3 font-medium text-stone-500">{t('pm:plannedBudget')}</th>
              <th className="text-end px-4 py-3 font-medium text-stone-500">{t('pm:actualSpent')}</th>
              <th className="text-end px-4 py-3 font-medium text-stone-500">{t('pm:actualProgress')}</th>
              <th className="text-end px-4 py-3 font-medium text-stone-500">{t('pm:variance')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const variance = a.plannedCost - a.actualCost;
              return (
                <tr key={a.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 text-navy-700">{isRtl ? a.name : a.nameEn}</td>
                  <td className="px-4 py-3 text-stone-400 text-xs">{a.activityId}</td>
                  <td className="px-4 py-3 text-end text-navy-700">{a.plannedCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-end text-navy-700">{a.actualCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-end">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-16 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                        <span className="block h-full rounded-full bg-copper-500" style={{ width: `${a.actualProgress ?? a.percentComplete}%` }} />
                      </span>
                      <span className="text-xs font-medium text-navy-700">{a.actualProgress ?? a.percentComplete}%</span>
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-end font-medium ${variance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {variance >= 0 ? '+' : ''}{variance.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-stone-100 font-bold">
              <td className="px-4 py-3 text-navy-800" colSpan={2}>{t('pm:total')}</td>
              <td className="px-4 py-3 text-end text-navy-800">{project.budget.toLocaleString()}</td>
              <td className="px-4 py-3 text-end text-navy-800">{totalActual.toLocaleString()}</td>
              <td className="px-4 py-3 text-end text-navy-800">
                {Math.round(activities.reduce((s, a) => s + (a.actualProgress ?? a.percentComplete), 0) / Math.max(activities.length, 1))}%
              </td>
              <td className={`px-4 py-3 text-end ${totalVariance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Badge className={totalActual <= project.budget ? 'bg-success-50 text-success-700 border-success-100' : 'bg-danger-50 text-danger-700 border-danger-100'}>
          {totalActual <= project.budget ? t('pm:underBudget') : t('pm:overBudget')}
        </Badge>
        <span className="text-xs text-stone-500">{t('pm:totalBudget')}: <strong className="text-navy-700">{project.budget.toLocaleString()} {t('sar')}</strong></span>
      </div>
    </div>
  );
}
