import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useRequestList } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TypeBadge, StatusBadge } from '@/components/ui/Badges';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { Building2, Users, Wrench, AlertTriangle, ArrowUpRight, MapPin, ChevronRight, ChevronLeft, Activity, Clock3 } from 'lucide-react';
import { propertyName } from '@/lib/helpers';

export function ManagementDashboard() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  const { data: propertiesResult, isLoading: propsLoading, isError: propsError, refetch: refetchProps } = usePropertyList();
  const { data: requestsResult, isLoading: reqsLoading, isError: reqsError, refetch: refetchReqs } = useRequestList();

  if (propsLoading || reqsLoading) return <PageSkeleton />;
  if (propsError || reqsError) return <PageError message={t('errorLoading')} onRetry={() => { void refetchProps(); void refetchReqs(); }} />;

  const properties = propertiesResult?.data ?? [];
  const requests = requestsResult?.data ?? [];

  const totalUnits = properties.reduce((sum, p) => sum + p.units, 0);
  const occupiedUnits = properties.reduce((sum, p) => sum + p.occupied, 0);
  const openRequests = requests.filter((r) => r.status !== 'resolved').length;
  const emergencyRequests = requests.filter((r) => r.type === 'emergency' && r.status !== 'resolved');
  const occupancy = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const stats = [
    { label: t('totalProperties'), value: properties.length, icon: Building2, color: 'bg-copper-50 text-copper-600', change: isRtl ? 'محفظة نشطة' : 'Active portfolio' },
    { label: t('occupancy'), value: `${occupancy}%`, icon: Users, color: 'bg-slateblue-50 text-slateblue-500', change: isRtl ? 'من إجمالي الوحدات' : 'of total units' },
    { label: t('openRequests'), value: openRequests, icon: Wrench, color: 'bg-warning-50 text-warning-600', change: isRtl ? 'تحتاج متابعة' : 'Need attention' },
    { label: t('emergencyRequests'), value: emergencyRequests.length, icon: AlertTriangle, color: 'bg-danger-50 text-danger-600', change: isRtl ? 'إجراء فوري' : 'Immediate action', onClick: () => navigate('/management/emergency') },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={t('dashboard')} subtitle={isRtl ? 'نظرة شاملة على محفظتك العقارية' : 'A complete view of your property portfolio'} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} onClick={stat.onClick} hoverable={!!stat.onClick} className={stat.onClick ? 'cursor-pointer' : ''}>
              <CardBody className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {stat.onClick && <ArrowUpRight className="w-4 h-4 text-danger-500" />}
                </div>
                <p className="text-2xl md:text-3xl font-serif font-semibold text-navy-800 mt-3">{stat.value}</p>
                <p className="text-xs md:text-sm text-stone-500 mt-0.5">{stat.label}</p>
                <p className="text-[11px] text-stone-400 mt-2">{stat.change}</p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {emergencyRequests.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-navy-800">{t('emergencyRequests')}</h2>
              <Badge className="bg-danger-100 text-danger-700 border-danger-200">{emergencyRequests.length}</Badge>
            </div>
            <button onClick={() => navigate('/management/emergency')} className="text-sm text-copper-600 font-medium flex items-center gap-1">
              {t('viewAll')} <Arrow className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {emergencyRequests.slice(0, 3).map((req) => (
              <Card key={req.id} hoverable onClick={() => navigate(`/management/request/${req.id}`)} className="border-danger-200">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-danger-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-danger-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-navy-800 text-sm">{req.id}</p>
                        <TypeBadge type={req.type} />
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-stone-600 mt-1 truncate">{req.description}</p>
                      <p className="text-xs text-stone-400 mt-1">{propertyName(req.propertyId, properties, ui.language)} · {req.unit} · {req.tenant}</p>
                    </div>
                    <Arrow className="w-5 h-5 text-stone-300 shrink-0 mt-1" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg font-semibold text-navy-800">{t('portfolio')}</h2>
          <button onClick={() => navigate('/management/properties')} className="text-sm text-copper-600 font-medium flex items-center gap-1">
            {t('viewAll')} <Arrow className="w-4 h-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => {
            const propertyRequests = requests.filter((r) => r.propertyId === property.id && r.status !== 'resolved');
            const propertyEmergency = propertyRequests.filter((r) => r.type === 'emergency');
            const pct = property.units > 0 ? Math.round((property.occupied / property.units) * 100) : 0;
            return (
              <Card key={property.id} hoverable onClick={() => navigate(`/management/property/${property.id}`)}>
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${property.accent}18` }}>
                        <Building2 className="w-4 h-4" style={{ color: property.accent }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-navy-800 text-sm truncate">{ui.language === 'ar' ? property.name : property.nameEn}</p>
                        <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5 truncate"><MapPin className="w-3 h-3 shrink-0" />{property.location}</p>
                      </div>
                    </div>
                    <Arrow className="w-4 h-4 text-stone-300 shrink-0" />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-stone-500">{t('occupancyLabel')}</span>
                      <span className="font-medium text-navy-700">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: property.accent }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-500">{propertyRequests.length} {t('open')}</span>
                    {propertyEmergency.length > 0 && <span className="flex items-center gap-1 text-xs text-danger-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" />{propertyEmergency.length}</span>}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle>{isRtl ? 'آخر نشاط' : 'Recent activity'}</CardTitle></CardHeader>
        <CardBody className="pt-0">
          <div className="space-y-3">
            {requests.slice(0, 4).map((req) => (
              <div key={req.id} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-b-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${req.type === 'emergency' ? 'bg-danger-50' : 'bg-stone-100'}`}>
                  <Activity className={`w-4 h-4 ${req.type === 'emergency' ? 'text-danger-600' : 'text-stone-500'}`} />
                </div>
                <div className="flex-1 min-w-0"><p className="text-sm text-navy-700 truncate">{req.id} — {req.description}</p><p className="text-xs text-stone-400 mt-0.5">{propertyName(req.propertyId, properties, ui.language)}</p></div>
                <Clock3 className="w-4 h-4 text-stone-300 shrink-0" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
