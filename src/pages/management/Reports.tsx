import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useRequestList } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { useTechnicians } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/PageStates';
import { BarChart3, Download, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Property, Request } from '@/types';

function exportRequestsCsv(requests: Request[], properties: Property[], isRtl: boolean) {
  const header = ['ID', 'Property', 'Unit', 'Tenant', 'Type', 'Category', 'Status', 'Priority', 'Date'];
  const rows = requests.map((r) => [
    r.id,
    properties.find((p) => p.id === r.propertyId)?.[isRtl ? 'name' : 'nameEn'] ?? r.propertyId,
    r.unit, r.tenant, r.type, r.category, r.status, r.priority, r.date,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mdrar-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportReportPdf(
  requests: Request[],
  properties: Property[],
  technicians: { id: string; name: string; nameEn: string; sla: number }[],
  isRtl: boolean,
) {
  const today = new Date().toISOString().slice(0, 10);
  const total = requests.length;
  const resolved = requests.filter((r) => r.status === 'resolved').length;
  const emergency = requests.filter((r) => r.type === 'emergency').length;
  const open = requests.filter((r) => r.status !== 'resolved').length;

  // Escape PDF text (ASCII only)
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');

  const ops: string[] = [];
  const W = 612, H = 792, M = 40;

  // Background
  ops.push('0.98 0.97 0.95 rg 0 0 612 792 re f');

  // Header bar
  ops.push('0.13 0.17 0.30 rg 0 730 612 62 re f');
  ops.push(`1 1 1 rg BT /F2 16 Tf ${M} 762 Td (${esc(isRtl ? 'تقرير الطلبات — مدرار' : 'Requests Report — MDRAR')}) Tj ET`);
  ops.push(`0.78 0.66 0.40 rg BT /F1 9 Tf ${M} 748 Td (${esc(isRtl ? `تاريخ التقرير: ${today}` : `Report Date: ${today}`)}) Tj ET`);

  // KPI cards
  const kpis = [
    { label: isRtl ? 'إجمالي الطلبات' : 'Total Requests', value: String(total), x: M },
    { label: isRtl ? 'مكتملة' : 'Resolved', value: String(resolved), x: M + 130 },
    { label: isRtl ? 'مفتوحة' : 'Open', value: String(open), x: M + 260 },
    { label: isRtl ? 'طوارئ' : 'Emergency', value: String(emergency), x: M + 390 },
  ];
  kpis.forEach(({ label, value, x }) => {
    ops.push(`1 1 1 rg ${x} 660 120 50 re f`);
    ops.push(`0.86 0.82 0.76 RG 0.5 w ${x} 660 120 50 re S`);
    ops.push(`0.13 0.17 0.30 rg BT /F2 20 Tf ${x + 10} 690 Td (${esc(value)}) Tj ET`);
    ops.push(`0.52 0.47 0.44 rg BT /F1 7 Tf ${x + 10} 672 Td (${esc(label)}) Tj ET`);
  });

  // Property breakdown section
  ops.push(`0.13 0.17 0.30 rg BT /F2 10 Tf ${M} 640 Td (${esc(isRtl ? 'توزيع الطلبات حسب العقار' : 'Requests by Property')}) Tj ET`);
  ops.push(`0.82 0.78 0.72 RG 0.3 w ${M} 636 ${W - 2 * M} 0.5 re f`);

  const maxPropCount = Math.max(...properties.map((p) => requests.filter((r) => r.propertyId === p.id).length), 1);
  const barAreaW = W - 2 * M - 160;
  let propY = 620;
  properties.slice(0, 8).forEach((p) => {
    const count = requests.filter((r) => r.propertyId === p.id).length;
    const barW = Math.max(2, (count / maxPropCount) * barAreaW);
    const name = isRtl ? p.name : p.nameEn;
    ops.push(`0.52 0.47 0.44 rg BT /F1 8 Tf ${M} ${propY + 3} Td (${esc(name.slice(0, 22))}) Tj ET`);
    ops.push(`0.50 0.20 0.25 rg ${M + 155} ${propY} ${barW} 12 re f`);
    ops.push(`0.13 0.17 0.30 rg BT /F1 7 Tf ${M + 158 + barW} ${propY + 3} Td (${esc(String(count))}) Tj ET`);
    propY -= 18;
  });

  // Category breakdown
  const catY = propY - 20;
  ops.push(`0.13 0.17 0.30 rg BT /F2 10 Tf ${M} ${catY} Td (${esc(isRtl ? 'توزيع الطلبات حسب الفئة' : 'Requests by Category')}) Tj ET`);
  ops.push(`0.82 0.78 0.72 RG 0.3 w ${M} ${catY - 4} ${W - 2 * M} 0.5 re f`);

  const cats = [
    { key: 'ac', label: isRtl ? 'تكييف' : 'AC', color: '0.72 0.42 0.30' },
    { key: 'plumbing', label: isRtl ? 'سباكة' : 'Plumbing', color: '0.39 0.48 0.56' },
    { key: 'electrical', label: isRtl ? 'كهرباء' : 'Electrical', color: '0.72 0.57 0.23' },
    { key: 'common', label: isRtl ? 'مشترك' : 'Common', color: '0.47 0.55 0.48' },
  ];
  cats.forEach(({ key, label, color }, i) => {
    const count = requests.filter((r) => r.category === key).length;
    const cx = M + i * 130;
    const cy = catY - 60;
    ops.push(`${color} rg ${cx} ${cy} 110 40 re f`);
    ops.push(`1 1 1 rg BT /F2 16 Tf ${cx + 8} ${cy + 22} Td (${esc(String(count))}) Tj ET`);
    ops.push(`1 1 1 rg BT /F1 7 Tf ${cx + 8} ${cy + 8} Td (${esc(label)}) Tj ET`);
  });

  // Technician performance
  const techY = catY - 120;
  ops.push(`0.13 0.17 0.30 rg BT /F2 10 Tf ${M} ${techY} Td (${esc(isRtl ? 'أداء الفنيين' : 'Technician Performance')}) Tj ET`);
  ops.push(`0.82 0.78 0.72 RG 0.3 w ${M} ${techY - 4} ${W - 2 * M} 0.5 re f`);

  const maxSla = 100;
  const techBarW = W - 2 * M - 160;
  let tY = techY - 20;
  technicians.forEach((tech) => {
    const bw = Math.max(2, (tech.sla / maxSla) * techBarW);
    const name = isRtl ? tech.name : tech.nameEn;
    ops.push(`0.52 0.47 0.44 rg BT /F1 8 Tf ${M} ${tY + 3} Td (${esc(name.slice(0, 22))}) Tj ET`);
    ops.push(`0.20 0.60 0.35 rg ${M + 155} ${tY} ${bw} 12 re f`);
    ops.push(`0.13 0.17 0.30 rg BT /F1 7 Tf ${M + 158 + bw} ${tY + 3} Td (${esc(`${tech.sla}%`)}) Tj ET`);
    tY -= 18;
  });

  // Footer
  ops.push(`0.82 0.78 0.72 RG 0.3 w ${M} 62 ${W - 2 * M} 0.5 re f`);
  ops.push(`0.52 0.47 0.44 rg BT /F1 6 Tf ${M} 52 Td (${esc(isRtl ? 'سري — للاستخدام الداخلي فقط' : 'CONFIDENTIAL — FOR INTERNAL USE ONLY')}) Tj ET`);
  ops.push(`0.52 0.47 0.44 rg BT /F1 6 Tf 460 52 Td (${esc(isRtl ? `تاريخ: ${today}` : `Date: ${today}`)}) Tj ET`);

  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob = new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mdrar-report-${today}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const isRtl = ui.language === 'ar';

  const [rangeDays, setRangeDays] = useState(30);

  const { data: reqResult, isLoading: reqLoading } = useRequestList({});
  const { data: propResult, isLoading: propLoading } = usePropertyList();
  const { data: technicians = [], isLoading: techLoading } = useTechnicians();

  const requests = reqResult?.data ?? [];
  const properties = propResult?.data ?? [];

  const volumeByDay = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      const count = requests.filter((r) => {
        const rDate = r.date?.slice(0, 10) ?? '';
        return rDate === dayKey;
      }).length;
      days.push({ label: String(d.getDate()), count });
    }
    return days;
  }, [requests, rangeDays]);

  const maxVolume = Math.max(...volumeByDay.map((d) => d.count), 1);

  if (reqLoading || propLoading || techLoading) return <PageSkeleton />;

  const total = requests.length;
  const resolved = requests.filter((r) => r.status === 'resolved').length;
  const emergency = requests.filter((r) => r.type === 'emergency').length;
  const maxProperty = Math.max(...properties.map((p) => requests.filter((r) => r.propertyId === p.id).length), 1);
  const categories = [
    { key: 'ac', color: '#b86b4b' },
    { key: 'plumbing', color: '#637b8e' },
    { key: 'electrical', color: '#b8923a' },
    { key: 'common', color: '#788d7b' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={t('reportsTitle')} subtitle={isRtl ? 'رؤى عملية لاتخاذ قرارات أفضل' : 'Actionable insights for better decisions'} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-copper-50 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-copper-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">{total}</p><p className="text-xs text-stone-500">{t('total')} {t('requests')}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-success-50 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-success-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">{resolved}</p><p className="text-xs text-stone-500">{t('completedRequests')}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-warning-50 flex items-center justify-center"><Clock3 className="w-4 h-4 text-warning-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">—</p><p className="text-xs text-stone-500">{t('averageResolution')} ({t('resolutionHours')})</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="w-9 h-9 rounded-lg bg-danger-50 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-danger-600" /></div><p className="text-2xl font-serif font-semibold text-navy-800 mt-3">{emergency}</p><p className="text-xs text-stone-500">{t('emergencyRequests')}</p></CardBody></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('requestVolume')}</CardTitle>
              <select
                className="filter-select w-auto text-xs"
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
              >
                <option value={30}>{t('last30')}</option>
                <option value={90}>{isRtl ? 'آخر 90 يوماً' : 'Last 90 days'}</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-48 flex items-end gap-1 border-b border-stone-200 px-2">
              {volumeByDay.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                  <div
                    className="w-full max-w-7 rounded-t bg-copper-300 hover:bg-copper-500 transition-colors"
                    style={{ height: `${(d.count / maxVolume) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                  />
                  {rangeDays <= 30 && <span className="text-[9px] text-stone-400">{d.label}</span>}
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
        <Button variant="outline" size="sm" onClick={() => exportReportPdf(requests, properties, technicians, isRtl)}>
          <Download className="w-4 h-4" />{t('exportPdf')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportRequestsCsv(requests, properties, isRtl)}>
          <Download className="w-4 h-4" />{t('exportExcel')}
        </Button>
      </div>
    </div>
  );
}
