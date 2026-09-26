import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useAuth } from '@/auth/AuthProvider';
import { useRequest, useUpdateRequest, useAddTimelineEvent } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Clock, MapPin, UserRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { propertyName } from '@/lib/helpers';
import type { RequestStatus } from '@/types';

export function TechnicianRequestDetail() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const { session } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';

  const { data: req, isLoading, isError, refetch } = useRequest(id ?? '');
  const { data: propertiesResult } = usePropertyList();
  const { mutate: updateRequest } = useUpdateRequest();
  const { mutate: addTimeline } = useAddTimelineEvent();

  const properties = propertiesResult?.data ?? [];

  if (isLoading) return <PageSkeleton />;
  if (isError || !req) return <PageError message={t('noResults')} onRetry={() => void refetch()} />;

  const now = () => new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  const updateStatus = (status: RequestStatus, labelAr: string, labelEn: string) => {
    const label = isRtl ? labelAr : labelEn;
    const actor = session?.name ?? (isRtl ? 'الفني' : 'Technician');

    addTimeline(
      { id: req.id, event: { status, label, time: now(), actor } },
      {
        onSuccess: () => {
          updateRequest({ id: req.id, changes: { status } });
          // Notify management that technician updated the status
          showToast(label);
        },
      },
    );
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/technician')} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-navy-700 mb-5 transition-colors">
        <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
        {isRtl ? 'رجوع' : 'Back'}
      </button>

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
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-xs font-mono text-stone-400">{req.id}</span>
              <StatusBadge status={req.status} />
              <TypeBadge type={req.type} />
              <PriorityBadge priority={req.priority} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
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
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-1">{t('description')}</p>
              <p className="text-sm text-navy-700 leading-relaxed">{req.description}</p>
            </div>
          </CardBody>
        </Card>

        {/* Status actions */}
        <Card>
          <CardBody>
            <CardTitle className="mb-4">{isRtl ? 'تحديث الحالة' : 'Update Status'}</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => updateStatus('acknowledged', 'تم استلام الطلب من الفني', 'Acknowledged by technician')}
                disabled={req.status !== 'submitted'}
                variant="outline"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isRtl ? 'استلام الطلب' : 'Acknowledge'}
              </Button>
              <Button
                onClick={() => updateStatus('in_progress', 'بدأ الفني التنفيذ', 'Technician started work')}
                disabled={req.status === 'in_progress' || req.status === 'resolved'}
                variant="secondary"
              >
                <Clock className="w-4 h-4" />
                {isRtl ? 'بدء التنفيذ' : 'Start work'}
              </Button>
              <Button
                onClick={() => updateStatus('resolved', 'أنهى الفني العمل — بانتظار تأكيد الإدارة', 'Technician completed — awaiting management confirmation')}
                disabled={req.status === 'resolved'}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isRtl ? 'إنهاء العمل' : 'Mark complete'}
              </Button>
            </div>
            <p className="text-xs text-stone-400 mt-3">
              {isRtl ? 'سيتلقى فريق الإدارة إشعاراً بكل تحديث' : 'Management will be notified of every update'}
            </p>
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
      </div>
    </div>
  );
}
