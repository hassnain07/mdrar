import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useAuth } from '@/auth/AuthProvider';
import { useRequestList } from '@/queries/useRequests';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/ui/Badges';
import { ClipboardList, ChevronRight } from 'lucide-react';

export function TechnicianDashboard() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const { session } = useAuth();
  const isRtl = ui.language === 'ar';

  const technicianId = session?.technicianId ?? session?.userId ?? '';

  const { data, isLoading, isError, refetch } = useRequestList({ technicianId });
  const requests = data?.data ?? [];

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError message={t('noResults')} onRetry={() => void refetch()} />;

  const open = requests.filter((r) => r.status !== 'resolved');
  const done = requests.filter((r) => r.status === 'resolved');

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy-800">
          {isRtl ? `مرحباً، ${session?.name}` : `Welcome, ${session?.name}`}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          {isRtl ? 'الطلبات المسندة إليك' : 'Requests assigned to you'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="text-center py-5">
            <p className="text-3xl font-bold text-copper-600">{open.length}</p>
            <p className="text-sm text-stone-500 mt-1">{isRtl ? 'طلبات مفتوحة' : 'Open requests'}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-5">
            <p className="text-3xl font-bold text-success-600">{done.length}</p>
            <p className="text-sm text-stone-500 mt-1">{isRtl ? 'طلبات مكتملة' : 'Completed'}</p>
          </CardBody>
        </Card>
      </div>

      {/* Open requests */}
      <div>
        <h2 className="font-serif font-semibold text-navy-800 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-stone-400" />
          {isRtl ? 'الطلبات المفتوحة' : 'Open Requests'}
        </h2>
        {open.length === 0 ? (
          <Card><CardBody><p className="text-stone-400 text-sm text-center py-4">{t('noRequests')}</p></CardBody></Card>
        ) : (
          <div className="space-y-3">
            {open.map((req) => (
              <Link key={req.id} to={`/technician/request/${req.id}`}>
                <Card className="hover:shadow-elevated transition-shadow cursor-pointer">
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-xs font-mono text-stone-400">{req.id}</span>
                          <StatusBadge status={req.status} />
                          <TypeBadge type={req.type} />
                          <PriorityBadge priority={req.priority} />
                        </div>
                        <p className="text-sm text-navy-700 line-clamp-2">{req.description}</p>
                        <p className="text-xs text-stone-400 mt-1">{req.unit} — {req.tenant}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-stone-300 shrink-0 mt-1 ${isRtl ? 'rotate-180' : ''}`} />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {done.length > 0 && (
        <div>
          <h2 className="font-serif font-semibold text-navy-800 mb-3">{isRtl ? 'الطلبات المكتملة' : 'Completed Requests'}</h2>
          <div className="space-y-3">
            {done.map((req) => (
              <Link key={req.id} to={`/technician/request/${req.id}`}>
                <Card className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                  <CardBody>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-stone-400">{req.id}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-navy-700 line-clamp-1">{req.description}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
