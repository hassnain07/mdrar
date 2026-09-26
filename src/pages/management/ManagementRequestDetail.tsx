import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useRequest, useUpdateRequest, useAddTimelineEvent } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { useTechnicians } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { Clock, UserRound, MapPin, CheckCircle2, UserCog } from 'lucide-react';
import { propertyName } from '@/lib/helpers';
import type { RequestStatus } from '@/types';

export function ManagementRequestDetail() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const { id } = useParams<{ id: string }>();
  const isRtl = ui.language === 'ar';

  const { data: req, isLoading, isError, refetch } = useRequest(id ?? '');
  const { data: propertiesResult } = usePropertyList();
  const { data: technicians = [] } = useTechnicians();
  const { mutate: updateRequest } = useUpdateRequest();
  const { mutate: addTimeline } = useAddTimelineEvent();

  const properties = propertiesResult?.data ?? [];

  if (isLoading) return <PageSkeleton />;
  if (isError || !req) return <PageError message={t('noResults')} onRetry={() => void refetch()} />;

  const now = () => new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  const advanceStatus = (status: RequestStatus, labelAr: string, labelEn: string) => {
    const label = isRtl ? labelAr : labelEn;
    addTimeline(
      { id: req.id, event: { status, label, time: now(), actor: isRtl ? 'فريق الإدارة' : 'Management team' } },
      { onSuccess: () => {
          updateRequest({ id: req.id, changes: { status } });
          // Notify the tenant of the status change
          showToast(label);
        },
      },
    );
  };

  const assignTechnician = (technicianId: string) => {
    const tech = technicians.find((t) => t.id === technicianId);
    const techLabel = isRtl ? tech?.name : tech?.nameEn;
    updateRequest(
      { id: req.id, changes: { technicianId } },
      { onSuccess: () => {
          addTimeline({ id: req.id, event: {
            status: req.status,
            label: isRtl ? `تم تعيين الفني: ${techLabel}` : `Technician assigned: ${techLabel}`,
            time: now(),
            actor: isRtl ? 'فريق الإدارة' : 'Management team',
          }});
          showToast(isRtl ? `تم تعيين ${techLabel}` : `${techLabel} assigned`);
        },
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <PageHeader title={req.id} subtitle={t('requestDetails')} />
      <div className="space-y-4">

        {req.type === 'emergency' && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl px-4 py-3 flex items-center gap-2 text-danger-700 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
            {isRtl ? 'طلب طارئ — يحتاج إلى إجراء فوري' : 'Emergency request — immediate action required'}
          </div>
        )}

        {/* Details */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={req.status} />
              <TypeBadge type={req.type} />
              <PriorityBadge priority={req.priority} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('property')}</p>
                <p className="text-sm font-medium text-navy-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {propertyName(req.propertyId, properties, ui.language)}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('unit')}</p>
                <p className="text-sm font-medium text-navy-700">{req.unit}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('tenant')}</p>
                <p className="text-sm font-medium text-navy-700 flex items-center gap-1">
                  <UserRound className="w-3.5 h-3.5 text-stone-400" />{req.tenant}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('date')}</p>
                <p className="text-sm font-medium text-navy-700">{req.date}</p>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-1">{t('description')}</p>
              <p className="text-sm text-navy-700 leading-relaxed">{req.description}</p>
            </div>
          </CardBody>
        </Card>

        {/* Technician assignment */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-stone-400" />
              {t('technician')}
            </CardTitle>
            <div className="flex items-center gap-3">
              <select
                value={req.technicianId ?? ''}
                onChange={(e) => { if (e.target.value) assignTechnician(e.target.value); }}
                className="form-input flex-1"
              >
                <option value="">{isRtl ? '— اختر فنياً —' : '— Select technician —'}</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {isRtl ? tech.name : tech.nameEn} — {tech.specialty}
                  </option>
                ))}
              </select>
              {req.technicianId && (
                <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0" />
              )}
            </div>
            {req.technicianId && (
              <p className="text-xs text-success-600 mt-2">
                {isRtl ? 'تم تعيين الفني — سيتلقى إشعاراً بالطلب' : 'Technician assigned — they will see this request in their dashboard'}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Timeline */}
        <Card>
          <CardBody>
            <h3 className="font-serif font-semibold text-navy-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400" />{t('timeline')}
            </h3>
            <div className="space-y-4">
              {req.timeline.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${i === req.timeline.length - 1 ? 'bg-copper-500' : 'bg-stone-300'} mt-1`} />
                    {i < req.timeline.length - 1 && <div className="w-px flex-1 bg-stone-200 mt-1" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-navy-700">{event.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{event.time} — {event.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Status actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => advanceStatus('acknowledged', 'تم استلام الطلب', 'Request acknowledged')}
            disabled={req.status !== 'submitted'}
            variant="outline"
          >
            <CheckCircle2 className="w-4 h-4" />{t('acknowledge')}
          </Button>
          <Button
            onClick={() => advanceStatus('in_progress', 'بدأ التنفيذ', 'Work started')}
            disabled={req.status === 'in_progress' || req.status === 'resolved'}
            variant="secondary"
          >
            <Clock className="w-4 h-4" />{t('startProgress')}
          </Button>
          <Button
            onClick={() => advanceStatus('resolved', 'تم حل الطلب', 'Request resolved')}
            disabled={req.status === 'resolved'}
          >
            <CheckCircle2 className="w-4 h-4" />{t('markResolved')}
          </Button>
        </div>
        <p className="text-xs text-stone-400 text-center">{t('tenantNotified')}</p>
      </div>
    </div>
  );
}
