import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUi } from '@/state/uiStore';
import { useRequestList } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { TypeBadge, StatusBadge, PriorityBadge } from '@/components/ui/Badges';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { AlertTriangle, Search, SlidersHorizontal, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { propertyName } from '@/lib/helpers';
import type { RequestType, RequestStatus, Category } from '@/types';

export function ManagementRequests({ emergencyOnly = false }: { emergencyOnly?: boolean }) {
  const { t } = useTranslation();
  const { ui } = useUi();
  const navigate = useNavigate();
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<RequestType | 'all'>(emergencyOnly ? 'emergency' : 'all');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  const { data: requestsResult, isLoading: reqsLoading, isError: reqsError, refetch } = useRequestList();
  const { data: propertiesResult, isLoading: propsLoading } = usePropertyList();

  const requests = requestsResult?.data ?? [];
  const properties = propertiesResult?.data ?? [];

  const filtered = useMemo(() => requests.filter((r) => {
    if (emergencyOnly && r.type !== 'emergency') return false;
    if (propertyFilter !== 'all' && r.propertyId !== propertyFilter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (search && !`${r.id} ${r.tenant} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [requests, emergencyOnly, propertyFilter, typeFilter, statusFilter, categoryFilter, search]);

  const clearFilters = () => { setPropertyFilter('all'); setTypeFilter(emergencyOnly ? 'emergency' : 'all'); setStatusFilter('all'); setCategoryFilter('all'); setSearch(''); };

  if (reqsLoading || propsLoading) return <PageSkeleton />;
  if (reqsError) return <PageError message={t('errorLoading')} onRetry={() => void refetch()} />;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={emergencyOnly ? t('emergency') : t('requests')} subtitle={emergencyOnly ? t('emergencyOnly') : `${filtered.length} ${t('requestsCount')}`}>
        {emergencyOnly && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger-50 text-danger-700 border border-danger-200 text-xs font-medium"><AlertTriangle className="w-3.5 h-3.5" />{t('emergencyOnly')}</span>}
      </PageHeader>

      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-navy-700"><SlidersHorizontal className="w-4 h-4 text-stone-400" />{t('filter')}</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="filter-select">
              <option value="all">{t('allProperties')}</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{ui.language === 'ar' ? p.name : p.nameEn}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as RequestType | 'all')} className="filter-select">
              <option value="all">{t('filterByType')}</option><option value="preventive">{t('preventive')}</option><option value="corrective">{t('corrective')}</option><option value="emergency">{t('emergencyType')}</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')} className="filter-select">
              <option value="all">{t('filterByStatus')}</option><option value="submitted">{t('submitted')}</option><option value="acknowledged">{t('acknowledged')}</option><option value="in_progress">{t('in_progress')}</option><option value="resolved">{t('resolved')}</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')} className="filter-select">
              <option value="all">{t('filterByCategory')}</option><option value="ac">{t('ac')}</option><option value="plumbing">{t('plumbing')}</option><option value="electrical">{t('electrical')}</option><option value="common">{t('common')}</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1"><Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="filter-input ps-9" /></div>
            {(propertyFilter !== 'all' || typeFilter !== (emergencyOnly ? 'emergency' : 'all') || statusFilter !== 'all' || categoryFilter !== 'all' || search) && <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-copper-600 font-medium whitespace-nowrap"><X className="w-3.5 h-3.5" />{t('clearFilters')}</button>}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 ? <Card><CardBody className="py-12 text-center text-stone-400 text-sm">{t('noResults')}</CardBody></Card> : filtered.map((req) => (
          <Card key={req.id} hoverable onClick={() => navigate(`/management/request/${req.id}`)} className={req.type === 'emergency' ? 'border-danger-200' : ''}>
            <CardBody className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${req.type === 'emergency' ? 'bg-danger-50' : 'bg-stone-100'}`}>
                  {req.type === 'emergency' ? <AlertTriangle className="w-4 h-4 text-danger-600" /> : <span className="text-xs font-semibold text-stone-500">{req.id.slice(-2)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-navy-800 text-sm">{req.id}</span><TypeBadge type={req.type} /><StatusBadge status={req.status} /><PriorityBadge priority={req.priority} /></div>
                  <p className="text-sm text-stone-600 mt-1 truncate">{req.description}</p>
                  <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap text-xs text-stone-400"><span>{propertyName(req.propertyId, properties, ui.language)}</span><span>·</span><span>{req.unit}</span><span>·</span><span>{req.tenant}</span><span>·</span><span>{req.date}</span></div>
                </div>
                <Arrow className="w-5 h-5 text-stone-300 shrink-0 mt-1" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
