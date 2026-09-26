import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useAuth } from '@/auth/AuthProvider';
import { useRequestList } from '@/queries/useRequests';
import { useAnnouncementList } from '@/queries/useAnnouncements';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge, TypeBadge } from '@/components/ui/Badges';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { Wrench, MessageSquare, Phone, Megaphone, ChevronLeft, ChevronRight, MapPin, Home, Plus, Clock, CheckCircle2, ListChecks } from 'lucide-react';

export function TenantHome() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const { session } = useAuth();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  const { data: requestsResult, isLoading, isError, refetch } = useRequestList(
    session?.tenantPropertyId ? { tenantId: session.email } : undefined,
  );
  const { data: announcements = [] } = useAnnouncementList(
    session?.tenantPropertyId ?? undefined,
  );

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError message={t('errorLoading')} onRetry={() => void refetch()} />;

  const myRequests = requestsResult?.data ?? [];
  const recentRequests = [...myRequests].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 3);
  const openCount = myRequests.filter((r) => r.status !== 'resolved').length;
  const resolvedCount = myRequests.filter((r) => r.status === 'resolved').length;
  const totalCount = myRequests.length;

  const quickActions = [
    { icon: Wrench, label: t('maintenanceSupport'), to: '/tenant/support', color: 'text-copper-600 bg-copper-50', hoverBorder: 'hover:border-copper-300' },
    { icon: MessageSquare, label: t('contact'), to: '/tenant/contact', color: 'text-slateblue-500 bg-slateblue-50', hoverBorder: 'hover:border-slateblue-300' },
    { icon: Phone, label: t('emergency'), to: '/tenant/emergency', color: 'text-danger-600 bg-danger-50', hoverBorder: 'hover:border-danger-300' },
  ];

  const stats = [
    { label: t('openRequests'), value: openCount, icon: Clock, color: 'text-copper-600 bg-copper-50' },
    { label: t('resolvedRequests'), value: resolvedCount, icon: CheckCircle2, color: 'text-success-600 bg-success-50' },
    { label: t('totalRequests'), value: totalCount, icon: ListChecks, color: 'text-slateblue-500 bg-slateblue-50' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 text-white p-6 md:p-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -end-10 w-48 h-48 rounded-full bg-copper-500 blur-3xl" />
          <div className="absolute -bottom-12 -start-12 w-40 h-40 rounded-full bg-copper-400 blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-copper-300 text-sm font-medium mb-1">{t('welcomeBack')}</p>
            <h1 className="font-serif text-2xl md:text-3xl font-semibold">{session?.name ?? t('greeting')}</h1>
            <p className="text-navy-200 text-sm mt-1.5">{t('manageRequests')}</p>
          </div>
          <button
            onClick={() => navigate('/tenant/support')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-copper-600 hover:bg-copper-700 text-white text-sm font-medium transition-colors shadow-soft shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('newRequestShort')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardBody className="flex flex-col items-center sm:items-start sm:flex-row sm:items-center gap-2 sm:gap-3 text-center sm:text-start">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-serif font-semibold text-navy-800 leading-none">{stat.value}</p>
                  <p className="text-[11px] sm:text-xs text-stone-500 mt-1">{stat.label}</p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-copper-50 flex items-center justify-center shrink-0">
              <Home className="w-6 h-6 text-copper-600" />
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-0.5">{t('property')}</p>
              <p className="font-serif font-semibold text-navy-800">{isRtl ? 'ساحة جازلي' : 'Jazly Plaza'}</p>
              <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {isRtl ? 'حي الملقا، الرياض' : 'Al-Malqa, Riyadh'}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slateblue-50 flex items-center justify-center shrink-0">
              <Home className="w-6 h-6 text-slateblue-500" />
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-0.5">{t('unit')}</p>
              <p className="font-serif font-semibold text-navy-800">{session?.tenantUnit ?? 'A-204'}</p>
              <p className="text-xs text-stone-400 mt-0.5">{isRtl ? 'الطابق الثاني' : 'Second floor'}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id} className="bg-gradient-to-br from-copper-50 to-stone-50 border-copper-200">
              <CardBody className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-copper-100 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5 text-copper-600" />
                </div>
                <div>
                  <p className="font-medium text-navy-800 text-sm mb-1">{isRtl ? ann.title : ann.titleEn}</p>
                  <p className="text-sm text-stone-600 leading-relaxed">{isRtl ? ann.body : ann.bodyEn}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-serif text-lg font-semibold text-navy-800 mb-3">{t('quickActions')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className={`bg-white rounded-2xl border border-stone-200 shadow-soft p-5 flex items-center gap-4 transition-all hover:shadow-elevated hover:border-stone-300 hover:-translate-y-0.5 ${action.hoverBorder}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${action.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-navy-700 text-start">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg font-semibold text-navy-800">{t('recentRequests')}</h2>
          <button onClick={() => navigate('/tenant/requests')} className="text-sm text-copper-600 hover:text-copper-700 font-medium flex items-center gap-1">
            {t('viewAll')}
            <Arrow className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {recentRequests.length === 0 ? (
            <Card>
              <CardBody className="text-center text-stone-400 text-sm py-10 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-stone-300" />
                </div>
                {t('noRequests')}
              </CardBody>
            </Card>
          ) : (
            recentRequests.map((req) => (
              <Card key={req.id} hoverable onClick={() => navigate(`/tenant/request/${req.id}`)}>
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-navy-800 text-sm truncate">{req.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <TypeBadge type={req.type} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                  <Arrow className="w-5 h-5 text-stone-300 shrink-0" />
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
