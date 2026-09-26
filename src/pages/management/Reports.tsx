import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useRequestList } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { useTechnicians } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/PageStates';
import { BarChart3, Download, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';

export function Reports() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const isRtl = ui.language === 'ar';

  const { data: reqResult, isLoading: reqLoading } = useRequestList({});
  const { data: propResult, isLoading: propLoading } = usePropertyList();
  const { data: technicians = [], isLoading: techLoading } = useTechnicians();

  const requests = reqResult?.data ?? [];
  const properties = propResult?.data ?? [];

  if (reqLoading || propLoading || techLoading) return <PageSkeleton />;

  const total = requests.length;
  const resolved = requests.filter((r) => r.status === 'resolved').length;
  const emergency = requests.filter((r) => r.type === 'emergency').length;
  const bars = [58, 72, 48, 88, 66, 92, 74, 81, 63, 76, 89, 70];
  const maxProperty = Math.max(...properties.map((p) => requests.filter((r) => r.propertyId === p.id).length), 1);
  const categories = [
    { key: 'ac', color: '#b86b4b' },
    { key: 'plumbing', color: '#637b8e' },
    { key: 'electrical', color: '#b8923a' },
    { key: 'common', color: '#788d7b' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={t('reportsTitle')} subtitle={isRtl ? 'رؤى عملية لاتخاذ قرارات أفضل' : 'Actionable insights for better decisions'}>
        <select className="filter-select w-auto">
          <option>{t('last30')}</option>
          <option>{isRtl ? 'آخر 90 يوماً' : 'Last 90 days'}</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => showToast(t('exportSuccess'))}>
          <Download className="w-4 h-4" />{t('export')}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-copper-50 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-copper-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">{total}</p><p className="text-xs text-stone-500">{t('total')} {t('requests')}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-success-50 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-success-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">{resolved}</p><p className="text-xs text-stone-500">{t('completedRequests')}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-warning-50 flex items-center justify-center"><Clock3 className="w-4 h-4 text-warning-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">18.4</p><p className="text-xs text-stone-500">{t('averageResolution')} ({t('resolutionHours')})</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-danger-50 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-danger-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">{emergency}</p><p className="text-xs text-stone-500">{t('emergencyRequests')}</p></CardBody></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t('requestVolume')}</CardTitle></CardHeader>
          <CardBody>
            <div className="h-48 flex items-end gap-2 border-b border-stone-200 px-2">
              {bars.map((height, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                  <div className="w-full max-w-7 rounded-t bg-copper-300 hover:bg-copper-500 transition-colors" style={{ height: `${height}%` }} />
                  <span className="text-[9px] text-stone-400">{i + 1}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('propertyBreakdown')}</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-3">
              {properties.slice(0, 6).map((p) => {
                const count = requests.filter((r) => r.propertyId === p.id).length;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-stone-600 truncate">{isRtl ? p.name : p.nameEn}</span>
                      <span className="font-medium text-navy-700">{count}</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full">
                      <div className="h-full rounded-full bg-slateblue-400" style={{ width: `${(count / maxProperty) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t('categoryBreakdown')}</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => {
                const count = requests.filter((r) => r.category === c.key).length;
                return (
                  <div key={c.key} className="p-3 rounded-xl bg-stone-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-sm text-navy-700">{t(c.key)}</span>
                    </div>
                    <p className="text-xl font-serif font-semibold text-navy-800 mt-2">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('technicianPerformance')}</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-3">
              {technicians.map((tech) => (
                <div key={tech.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slateblue-100 flex items-center justify-center text-xs font-semibold text-slateblue-600">{tech.name.slice(0, 1)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-navy-700 truncate">{isRtl ? tech.name : tech.nameEn}</span>
                      <span className="text-success-600 font-medium">{tech.sla}% SLA</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full mt-1">
                      <div className="h-full bg-success-500 rounded-full" style={{ width: `${tech.sla}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => showToast(t('exportSuccess'))}><Download className="w-4 h-4" />{t('exportPdf')}</Button>
        <Button variant="outline" size="sm" onClick={() => showToast(t('exportSuccess'))}><Download className="w-4 h-4" />{t('exportExcel')}</Button>
      </div>
    </div>
  );
}
