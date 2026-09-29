import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { StatusBadge, TypeBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/PageStates';
import {
  usePropertyList, useProperty, useCreateProperty, useLeases, useCreateLease, useUpdateLease,
  usePropertyDocuments, useUploadPropertyDocument, useDeletePropertyDocument,
} from '@/queries/useProperties';
import { useRequestList } from '@/queries/useRequests';
import { useToast } from '@/state/uiStore';
import { useUi } from '@/state/uiStore';
import { dataSource } from '@/data/client/index';
import { Building2, Users, Wrench, FileText, ChevronRight, ChevronLeft, MapPin, Plus, Trash2, Upload, X } from 'lucide-react';

export function PropertyDetail() {
  const { t } = useTranslation();
  const showToast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'units' | 'requests' | 'documents'>('overview');

  const propertyId = id ?? '';
  const { data: property, isLoading: propLoading } = useProperty(propertyId);
  const { data: units = [] } = useLeases(propertyId);
  const { data: docs = [] } = usePropertyDocuments(propertyId);
  const { data: reqResult } = useRequestList({ propertyId });
  const reqs = reqResult?.data ?? [];
  const createLease = useCreateLease();
  const updateLease = useUpdateLease(propertyId);
  const uploadDoc = useUploadPropertyDocument(propertyId);
  const deleteDoc = useDeletePropertyDocument(propertyId);

  const { ui } = useUi();
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  const [unitOpen, setUnitOpen] = useState(false);
  const [unitLabel, setUnitLabel] = useState('');

  const [occupyingUnit, setOccupyingUnit] = useState<{ id: string; label: string } | null>(null);
  const [occupyTenant, setOccupyTenant] = useState('');
  const [occupyEmail, setOccupyEmail] = useState('');
  const [occupyRent, setOccupyRent] = useState('');
  const [occupyLeaseStart, setOccupyLeaseStart] = useState('');
  const [occupyLeaseEnd, setOccupyLeaseEnd] = useState('');

  const [docOpen, setDocOpen] = useState(false);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (propLoading) return <PageSkeleton />;
  if (!property) return <div className="text-center py-12 text-stone-400">{t('noResults')}</div>;

  const tabs = [
    { id: 'overview', label: t('overview'), icon: Building2 },
    { id: 'units', label: t('unitsLeases'), icon: Users },
    { id: 'requests', label: t('propertyRequests'), icon: Wrench },
    { id: 'documents', label: t('propertyDocuments'), icon: FileText },
  ] as const;

  const resetUnitForm = () => setUnitLabel('');
  const resetOccupyForm = () => { setOccupyTenant(''); setOccupyEmail(''); setOccupyRent(''); setOccupyLeaseStart(''); setOccupyLeaseEnd(''); };
  const resetDocForm = () => setDocFiles([]);

  const handleAddUnit = () => {
    if (!unitLabel.trim()) return;
    createLease.mutate(
      { propertyId: property.id, label: unitLabel.trim(), status: 'vacant' },
      { onSuccess: () => { setUnitOpen(false); resetUnitForm(); showToast(isRtl ? 'تمت إضافة الوحدة' : 'Unit added'); } }
    );
  };

  const handleOccupy = async () => {
    if (!occupyingUnit || !occupyTenant.trim()) return;
    let tenantId: string | undefined;
    if (occupyEmail.trim()) {
      try {
        const { userId } = await dataSource.users.provisionTenant({
          email: occupyEmail.trim(),
          fullName: occupyTenant.trim(),
          role: 'tenant',
          tenantPropertyId: property.id,
          tenantUnit: occupyingUnit.label,
          leaseId: occupyingUnit.id,
        });
        tenantId = userId;
      } catch {
        showToast(isRtl ? 'تعذر إنشاء حساب المستأجر' : 'Could not create the resident account');
        return;
      }
    }
    updateLease.mutate(
      { id: occupyingUnit.id, changes: {
        status: 'occupied', tenant: occupyTenant.trim(),
        tenantEmail: occupyEmail.trim() || undefined,
        tenantId,
        rent: occupyRent ? Number(occupyRent) : undefined,
        leaseStart: occupyLeaseStart || undefined,
        leaseEnd: occupyLeaseEnd || undefined,
      }},
      { onSuccess: () => { setOccupyingUnit(null); resetOccupyForm(); showToast(isRtl ? 'تم تسجيل الإشغال وإنشاء حساب المستأجر' : 'Unit occupied and resident account created'); } }
    );
  };

  const handleVacate = (unitId: string) => {
    updateLease.mutate(
      { id: unitId, changes: { status: 'vacant', tenant: undefined, tenantEmail: undefined, rent: undefined, leaseStart: undefined, leaseEnd: undefined } },
      { onSuccess: () => showToast(isRtl ? 'تم تفريغ الوحدة' : 'Unit marked as vacant') }
    );
  };

  const handleUploadDocs = async () => {
    if (docFiles.length === 0) return;
    setDocUploading(true);
    try {
      for (const file of docFiles) await uploadDoc.mutateAsync(file);
      setDocOpen(false);
      resetDocForm();
      showToast(isRtl ? 'تم رفع المستندات' : 'Documents uploaded');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDownload = (fileUrl?: string, name?: string) => {
    if (!fileUrl) return;
    const a = window.document.createElement('a');
    a.href = fileUrl; a.download = name ?? 'document'; a.click();
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={isRtl ? property.name : property.nameEn} subtitle={property.location} backTo="/management/properties" />
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-stone-200">
        {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === item.id ? 'border-copper-500 text-copper-600' : 'border-transparent text-stone-500 hover:text-navy-700'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardBody className="p-4"><p className="text-xs text-stone-400">{t('totalUnits')}</p><p className="text-2xl font-serif font-semibold text-navy-800 mt-1">{property.units}</p></CardBody></Card>
            <Card><CardBody className="p-4"><p className="text-xs text-stone-400">{t('occupiedUnits')}</p><p className="text-2xl font-serif font-semibold text-navy-800 mt-1">{property.occupied}</p></CardBody></Card>
            <Card><CardBody className="p-4"><p className="text-xs text-stone-400">{t('openRequests')}</p><p className="text-2xl font-serif font-semibold text-warning-600 mt-1">{reqs.filter((r) => r.status !== 'resolved').length}</p></CardBody></Card>
            <Card><CardBody className="p-4"><p className="text-xs text-stone-400">{t('emergencyRequests')}</p><p className="text-2xl font-serif font-semibold text-danger-600 mt-1">{reqs.filter((r) => r.type === 'emergency' && r.status !== 'resolved').length}</p></CardBody></Card>
          </div>
          <Card><CardBody><CardTitle className="mb-4">{t('propertyDetails')}</CardTitle><div className="space-y-3"><div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-stone-400" /><span className="text-sm text-navy-700">{property.location}</span></div><div className="flex items-center gap-3"><Building2 className="w-4 h-4 text-stone-400" /><span className="text-sm text-navy-700">{property.units} {isRtl ? 'وحدة سكنية' : 'residential units'}</span></div></div></CardBody></Card>
        </div>
      )}

      {tab === 'units' && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>{t('unitsLeases')}</CardTitle>
              <Button size="sm" onClick={() => setUnitOpen(true)}><Plus className="w-4 h-4" />{isRtl ? 'إضافة وحدة' : 'Add Unit'}</Button>
            </div>
            {units.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-6">{isRtl ? 'لا توجد وحدات مضافة بعد' : 'No units added yet'}</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {units.map((u) => (
                  <div key={u.id} className={`p-3 rounded-xl border ${u.status === 'occupied' ? 'border-success-200 bg-success-50/30' : 'border-stone-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-navy-700">{u.label}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.status === 'occupied' ? 'bg-success-100 text-success-700' : 'bg-stone-100 text-stone-500'}`}>
                        {u.status === 'occupied' ? (isRtl ? 'مشغولة' : 'Occupied') : (isRtl ? 'شاغرة' : 'Vacant')}
                      </span>
                    </div>
                    {u.tenant && <p className="text-xs text-stone-600 truncate">{u.tenant}</p>}
                    {u.rent && <p className="text-xs text-copper-600 mt-0.5">{u.rent.toLocaleString()} {isRtl ? 'ر.س/شهرياً' : 'SAR/mo'}</p>}
                    {u.leaseStart && u.leaseEnd && <p className="text-xs text-stone-400 mt-0.5">{u.leaseStart} → {u.leaseEnd}</p>}
                    <div className="mt-3 pt-2 border-t border-stone-100">
                      {u.status === 'vacant' ? (
                        <button onClick={() => { setOccupyingUnit({ id: u.id, label: u.label }); resetOccupyForm(); }} className="text-xs font-medium text-copper-600 hover:text-copper-700 transition-colors">
                          {isRtl ? '+ تسجيل إشغال' : '+ Occupy'}
                        </button>
                      ) : (
                        <button onClick={() => handleVacate(u.id)} className="text-xs font-medium text-stone-400 hover:text-danger-600 transition-colors">
                          {isRtl ? 'تفريغ الوحدة' : 'Mark as Vacant'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'requests' && (
        <Card><CardBody><CardTitle className="mb-4">{t('propertyRequests')}</CardTitle><div className="space-y-2">{reqs.map((req) => <div key={req.id} onClick={() => navigate(`/management/request/${req.id}`)} className="p-3 rounded-xl border border-stone-200 hover:border-stone-300 cursor-pointer flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-sm font-medium text-navy-700">{req.id}</p><p className="text-xs text-stone-400 truncate">{req.description}</p></div><TypeBadge type={req.type} /><StatusBadge status={req.status} /><Arrow className="w-4 h-4 text-stone-300" /></div>)}</div></CardBody></Card>
      )}

      {tab === 'documents' && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>{t('propertyDocuments')}</CardTitle>
              <Button size="sm" onClick={() => setDocOpen(true)}><Upload className="w-4 h-4" />{isRtl ? 'رفع مستندات' : 'Upload Documents'}</Button>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-6">{isRtl ? 'لا توجد مستندات مضافة بعد' : 'No documents added yet'}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {docs.map((doc) => (
                  <div key={doc.id} className="p-4 rounded-xl border border-stone-200 flex items-center gap-3 group">
                    <button onClick={() => handleDownload(doc.fileUrl, doc.name)} disabled={!doc.fileUrl} className="shrink-0 disabled:cursor-not-allowed">
                      <FileText className={`w-5 h-5 transition-colors ${doc.fileUrl ? 'text-copper-500 group-hover:text-copper-700' : 'text-stone-300'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => handleDownload(doc.fileUrl, doc.name)} disabled={!doc.fileUrl} className="text-start w-full disabled:cursor-not-allowed">
                        <p className={`text-sm truncate transition-colors ${doc.fileUrl ? 'text-navy-700 hover:text-copper-600 cursor-pointer' : 'text-navy-700'}`}>{doc.name}</p>
                      </button>
                      <p className="text-xs text-stone-400">{doc.type.toUpperCase()} · {doc.uploadDate}</p>
                    </div>
                    <button onClick={() => { deleteDoc.mutate(doc.id); showToast(isRtl ? 'تم حذف المستند' : 'Document deleted'); }} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Modal open={unitOpen} onClose={() => { setUnitOpen(false); resetUnitForm(); }} title={isRtl ? 'إضافة وحدة' : 'Add Unit'} className="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'رقم الوحدة' : 'Unit Label'}</label>
            <input className="form-input" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="A-101" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleAddUnit} disabled={!unitLabel.trim() || createLease.isPending}>{isRtl ? 'إضافة الوحدة' : 'Add Unit'}</Button>
            <Button variant="outline" onClick={() => { setUnitOpen(false); resetUnitForm(); }}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!occupyingUnit} onClose={() => { setOccupyingUnit(null); resetOccupyForm(); }} title={isRtl ? `تسجيل إشغال — ${occupyingUnit?.label}` : `Occupy Unit — ${occupyingUnit?.label}`} className="max-w-lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'اسم المستأجر' : 'Tenant Name'} *</label>
              <input className="form-input" value={occupyTenant} onChange={(e) => setOccupyTenant(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'البريد الإلكتروني' : 'Email'}</label>
              <input className="form-input" type="email" value={occupyEmail} onChange={(e) => setOccupyEmail(e.target.value)} />
            </div>
          </div>
          {occupyEmail.trim() && (
            <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2">
              {isRtl
                ? 'سيتم إنشاء حساب لهذا البريد بكلمة مرور مؤقتة: 123456. أخبر المستأجر بتغييرها بعد أول تسجيل دخول.'
                : 'A resident account will be created for this email with a temporary password of 123456. Ask them to change it after their first sign-in.'}
            </p>
          )}
          <div>
            <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'الإيجار الشهري (ر.س)' : 'Monthly Rent (SAR)'}</label>
            <input className="form-input" type="number" min="0" value={occupyRent} onChange={(e) => setOccupyRent(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'بداية العقد' : 'Lease Start'}</label>
              <input className="form-input" type="date" value={occupyLeaseStart} onChange={(e) => setOccupyLeaseStart(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'نهاية العقد' : 'Lease End'}</label>
              <input className="form-input" type="date" value={occupyLeaseEnd} onChange={(e) => setOccupyLeaseEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleOccupy} disabled={!occupyTenant.trim() || updateLease.isPending}>{isRtl ? 'تأكيد الإشغال' : 'Confirm Occupancy'}</Button>
            <Button variant="outline" onClick={() => { setOccupyingUnit(null); resetOccupyForm(); }}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={docOpen} onClose={() => { setDocOpen(false); resetDocForm(); }} title={isRtl ? 'رفع مستندات' : 'Upload Documents'} className="max-w-md">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-copper-400 hover:bg-copper-50/30 transition-colors" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-8 h-8 text-stone-400 mx-auto mb-3" />
            <p className="text-sm text-stone-600 mb-1">{isRtl ? 'انقر لاختيار الملفات' : 'Click to select files'}</p>
            <p className="text-xs text-stone-400">{isRtl ? 'PDF، Word، Excel، صور...' : 'PDF, Word, Excel, images...'}</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) setDocFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
          </div>
          {docFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-500">{isRtl ? 'الملفات المختارة' : 'Selected files'} ({docFiles.length})</p>
              {docFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0"><FileText className="w-4 h-4 text-stone-400 shrink-0" /><span className="text-sm text-stone-600 truncate">{f.name}</span></div>
                  <button onClick={() => setDocFiles((prev) => prev.filter((_, j) => j !== i))} className="p-1 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleUploadDocs} disabled={docFiles.length === 0 || docUploading}>
              <Upload className="w-4 h-4" />{docUploading ? (isRtl ? 'جارٍ الرفع...' : 'Uploading...') : (isRtl ? 'رفع المستندات' : 'Upload Documents')}
            </Button>
            <Button variant="outline" onClick={() => { setDocOpen(false); resetDocForm(); }}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const ACCENT_COLORS = ['#b86b4b', '#637b8e', '#a8795e', '#788d7b', '#9b735e', '#6b7f83', '#a4866d', '#718475'];

export function PropertiesList() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const navigate = useNavigate();
  const showToast = useToast();
  const { data: propResult } = usePropertyList();
  const properties = propResult?.data ?? [];
  const { mutate: createProperty, isPending } = useCreateProperty();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [location, setLocation] = useState('');
  const [accent, setAccent] = useState(ACCENT_COLORS[0]);
  const isRtl = ui.language === 'ar';
  const resetForm = () => { setName(''); setNameEn(''); setLocation(''); setAccent(ACCENT_COLORS[0]); };
  const handleSubmit = () => {
    if (!name.trim() || !nameEn.trim() || !location.trim()) return;
    createProperty(
      { name: name.trim(), nameEn: nameEn.trim(), location: location.trim(), units: 0, occupied: 0, accent },
      { onSuccess: () => { setOpen(false); resetForm(); showToast(isRtl ? 'تمت إضافة العقار' : 'Property added'); } }
    );
  };
  return (
    <div className="animate-fade-in">
      <PageHeader title={t('properties')} subtitle={t('portfolio')}>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />{isRtl ? 'إضافة عقار' : 'Add Property'}</Button>
      </PageHeader>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {properties.map((p) => (
          <Card key={p.id} hoverable onClick={() => navigate(`/management/property/${p.id}`)}>
            <CardBody className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${p.accent}18` }}>
                  <Building2 className="w-5 h-5" style={{ color: p.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-semibold text-navy-800 truncate">{isRtl ? p.name : p.nameEn}</p>
                  <p className="text-xs text-stone-400 truncate">{p.location}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-stone-100 text-center">
                <div><p className="text-lg font-serif font-semibold text-navy-800">{p.units}</p><p className="text-[11px] text-stone-400">{t('totalUnits')}</p></div>
                <div><p className="text-lg font-serif font-semibold text-navy-800">{p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0}%</p><p className="text-[11px] text-stone-400">{t('occupancyLabel')}</p></div>
                <div><p className="text-lg font-serif font-semibold text-warning-600">{p.openRequests}</p><p className="text-[11px] text-stone-400">{t('open')}</p></div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title={isRtl ? 'إضافة عقار جديد' : 'Add New Property'} className="max-w-lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'اسم العقار (AR)' : 'Property Name (AR)'}</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} dir="rtl" /></div>
            <div><label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'اسم العقار (EN)' : 'Property Name (EN)'}</label><input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" /></div>
          </div>
          <div><label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'الموقع' : 'Location'}</label><input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div>
            <label className="text-xs text-stone-500 mb-2 block">{isRtl ? 'لون العقار' : 'Accent Color'}</label>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map((c) => (<button key={c} onClick={() => setAccent(c)} className={`w-7 h-7 rounded-lg border-2 transition-all ${accent === c ? 'border-navy-700 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={isPending || !name.trim() || !nameEn.trim() || !location.trim()}>{isPending ? '...' : (isRtl ? 'إضافة العقار' : 'Add Property')}</Button>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
