import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useRequest } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge, TypeBadge } from '@/components/ui/Badges';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/PageStates';
import { Clock, MessageSquare } from 'lucide-react';
import { propertyName } from '@/lib/helpers';

export function TenantRequestDetail() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: req, isLoading } = useRequest(id ?? '');
  const { data: propertiesResult } = usePropertyList();
  const properties = propertiesResult?.data ?? [];

  if (isLoading) return <PageSkeleton />;

  if (!req) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-400">{t('noResults')}</p>
        <LinkButton to="/tenant" variant="outline" size="sm" className="mt-4">{t('back')}</LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title={req.id} subtitle={req.description.slice(0, 60) + '...'} />

      <div className="space-y-4">
        {/* Status */}
        <Card>
          <CardBody>
            <p className="text-xs text-stone-400 mb-2">{t('currentStatus')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={req.status} />
              <TypeBadge type={req.type} />
            </div>
          </CardBody>
        </Card>

        {/* Details */}
        <Card>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('property')}</p>
                <p className="text-sm font-medium text-navy-700">{propertyName(req.propertyId, properties, ui.language)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('unit')}</p>
                <p className="text-sm font-medium text-navy-700">{req.unit}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('requestType')}</p>
                <p className="text-sm font-medium text-navy-700">{t(req.type === 'emergency' ? 'emergencyType' : req.type)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('category')}</p>
                <p className="text-sm font-medium text-navy-700">{t(req.category)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">{t('description')}</p>
              <p className="text-sm text-navy-700 leading-relaxed">{req.description}</p>
            </div>
            {req.photo && (
              <div>
                <p className="text-xs text-stone-400 mb-1">{t('photo')}</p>
                <img src={req.photo} alt="" className="rounded-lg border border-stone-200 max-h-64 object-cover" />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Timeline */}
        <Card>
          <CardBody>
            <h3 className="font-serif font-semibold text-navy-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400" />
              {t('timeline')}
            </h3>
            <div className="space-y-4">
              {(req.timeline ?? []).map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${i === (req.timeline?.length ?? 0) - 1 ? 'bg-copper-500' : 'bg-stone-300'} shrink-0 mt-1`} />
                    {i < (req.timeline?.length ?? 0) - 1 && <div className="w-px flex-1 bg-stone-200 mt-1" />}
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

        <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/tenant/contact')}>
          <MessageSquare className="w-4 h-4" />
          {t('messageManager')}
        </Button>
      </div>
    </div>
  );
}
