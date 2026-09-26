import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { useRequestList } from '@/queries/useRequests';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge, TypeBadge } from '@/components/ui/Badges';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import type { RequestStatus } from '@/types';

export function MyRequests() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const { session } = useAuth();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ChevronLeft : ChevronRight;
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');

  const { data, isLoading, isError, refetch } = useRequestList({ tenantId: session?.userId });
  const allRequests = data?.data ?? [];

  const myRequests = allRequests
    .filter((r) => !statusFilter || r.status === statusFilter)
    .sort((a, b) => b.id.localeCompare(a.id));

  const statusOptions: { value: RequestStatus | ''; label: string }[] = [
    { value: '', label: t('allStatuses') },
    { value: 'submitted', label: t('submitted') },
    { value: 'acknowledged', label: t('acknowledged') },
    { value: 'in_progress', label: t('in_progress') },
    { value: 'resolved', label: t('resolved') },
  ];

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError message={t('noResults')} onRetry={() => void refetch()} />;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title={t('myRequests')} subtitle={t('myRequestsDesc')} />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RequestStatus | '')}
          className="filter-select"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Button size="sm" onClick={() => navigate('/tenant/support')}>
          <Plus className="w-3.5 h-3.5" /> {t('newRequest')}
        </Button>
      </div>

      {myRequests.length === 0 ? (
        <Card><CardBody className="text-center text-stone-400 text-sm py-12">{t('noRequests')}</CardBody></Card>
      ) : (
        <div className="space-y-3">
          {myRequests.map((req) => (
            <Card key={req.id} hoverable onClick={() => navigate(`/tenant/request/${req.id}`)}>
              <CardBody className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-stone-400 mb-1">{req.id} · {req.date}</p>
                  <p className="font-medium text-navy-800 text-sm truncate">{req.description}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <TypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                  </div>
                </div>
                <Arrow className="w-5 h-5 text-stone-300 shrink-0" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
