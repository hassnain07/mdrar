import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useCreateRequest } from '@/queries/useRequests';
import { usePropertyList } from '@/queries/useProperties';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Camera, ChevronDown, X, CheckCircle2 } from 'lucide-react';
import type { RequestType, Category } from '@/types';

export function ResidentSupport() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const { session } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';

  const { data: propertiesResult } = usePropertyList();
  const properties = propertiesResult?.data ?? [];
  const { mutateAsync: createRequest, isPending } = useCreateRequest();

  const [reqType, setReqType] = useState<RequestType | ''>('');
  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [visitDateTime, setVisitDateTime] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState(session?.tenantPropertyId ?? '');
  const [selectedUnit, setSelectedUnit] = useState(session?.tenantUnit ?? '');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [wasEmergency, setWasEmergency] = useState(false);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const unitOptions = selectedProperty?.unitLabels || [];
  const isEmergency = reqType === 'emergency';

  const typeOptions: { value: RequestType; label: string }[] = [
    { value: 'preventive', label: t('preventive') },
    { value: 'corrective', label: t('corrective') },
    { value: 'emergency', label: t('emergencyType') },
  ];

  const categoryOptions: { value: Category; label: string }[] = [
    { value: 'ac', label: t('ac') },
    { value: 'plumbing', label: t('plumbing') },
    { value: 'electrical', label: t('electrical') },
    { value: 'common', label: t('common') },
  ];

  const handleSubmit = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!selectedPropertyId) newErrors.property = true;
    if (!selectedUnit) newErrors.unit = true;
    if (!reqType) newErrors.reqType = true;
    if (!category) newErrors.category = true;
    if (!description.trim()) newErrors.description = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const req = await createRequest({
        propertyId: selectedPropertyId,
        unit: selectedUnit,
        tenant: session?.name ?? '',
        tenantEmail: session?.email ?? '',
        type: reqType as RequestType,
        category: category as Category,
        description: description.trim(),
        status: 'submitted',
        priority: isEmergency ? 'critical' : reqType === 'corrective' ? 'high' : 'normal',
        date: new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-GB'),
        photo: photoName || undefined,
      });
      setSubmittedId(req.id);
      setWasEmergency(isEmergency);
      setSubmitted(true);
      showToast(isEmergency ? t('emergencySubmitted') : t('requestCreated'));
    } catch {
      showToast(t('errorSaving'));
    }
  };

  const resetForm = () => {
    setReqType(''); setCategory(''); setDescription(''); setVisitDateTime('');
    setPhotoName(''); setErrors({}); setSubmitted(false); setSubmittedId(''); setWasEmergency(false);
  };

  const handleClose = () => navigate('/tenant');

  const inputClass = (hasError?: boolean) =>
    `w-full px-3 py-2 rounded-lg border text-sm transition-all bg-white ${
      hasError ? 'border-danger-300' : 'border-stone-200 hover:border-stone-300 focus:border-copper-300'
    } focus:outline-none focus:ring-2 focus:ring-copper-100`;

  const labelClass = 'block text-xs font-medium text-navy-700 mb-1.5';

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-2xl shadow-elevated border border-stone-200 w-full max-w-sm p-8 text-center animate-scale-in">
          <button onClick={handleClose} className={`absolute top-3 ${isRtl ? 'left-3' : 'right-3'} p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors`}>
            <X className="w-4 h-4" />
          </button>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${wasEmergency ? 'bg-danger-50' : 'bg-success-50'}`}>
            <CheckCircle2 className={`w-7 h-7 ${wasEmergency ? 'text-danger-600' : 'text-success-600'}`} />
          </div>
          <h2 className="font-serif text-lg font-semibold text-navy-800 mb-2">
            {wasEmergency ? t('emergencySubmitted') : t('requestSubmittedSuccess')}
          </h2>
          <p className="text-sm text-stone-500 mb-1">{t('requestSubmittedSuccessDesc')}</p>
          <p className="text-sm font-medium text-copper-600 mb-5">{submittedId}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={resetForm} variant="outline" className="w-full">{t('submitAnother')}</Button>
            <Button onClick={handleClose} className="w-full">{t('backToHome')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={handleClose} />
      <div dir={isRtl ? 'rtl' : 'ltr'} className="relative bg-white rounded-2xl shadow-elevated border border-stone-200 w-full max-w-[600px] max-h-[92vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-serif text-base font-semibold text-navy-800">{t('raiseServiceRequest')}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('tenantName')}</label>
              <input className={inputClass()} value={session?.name ?? ''} readOnly />
            </div>
            <div>
              <label className={labelClass}>{t('phone')}</label>
              <input className={inputClass()} value="055 123 4567" readOnly dir="ltr" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('propertyName')}</label>
              <div className="relative">
                <select
                  value={selectedPropertyId}
                  onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedUnit(''); setErrors({ ...errors, property: false }); }}
                  className={`${inputClass(errors.property)} appearance-none pe-9`}
                >
                  <option value="">{isRtl ? 'اختر العقار' : 'Select property'}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{isRtl ? p.name : p.nameEn}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.property && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
            </div>
            <div>
              <label className={labelClass}>{t('unitNumber')}</label>
              <div className="relative">
                <select
                  disabled={!selectedPropertyId}
                  value={selectedUnit}
                  onChange={(e) => { setSelectedUnit(e.target.value); setErrors({ ...errors, unit: false }); }}
                  className={`${inputClass(errors.unit)} appearance-none pe-9 ${!selectedPropertyId ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{isRtl ? 'اختر الوحدة' : 'Select unit'}</option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.unit && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('requestType')}</label>
              <div className="relative">
                <select
                  value={reqType}
                  onChange={(e) => { setReqType(e.target.value as RequestType); setErrors({ ...errors, reqType: false }); }}
                  className={`${inputClass(errors.reqType)} appearance-none pe-9`}
                >
                  <option value="">{isRtl ? 'اختر نوع الطلب' : 'Select request type'}</option>
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.reqType && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
            </div>
            <div>
              <label className={labelClass}>{t('category')}</label>
              <div className="relative">
                <select
                  disabled={!reqType}
                  value={category}
                  onChange={(e) => { setCategory(e.target.value as Category); setErrors({ ...errors, category: false }); }}
                  className={`${inputClass(errors.category)} appearance-none pe-9 ${!reqType ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">{t('selectCategory')}</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.category && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('visitDateTime')}</label>
            <input type="datetime-local" value={visitDateTime} onChange={(e) => setVisitDateTime(e.target.value)} className={inputClass()} />
          </div>

          {isEmergency && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-danger-700">{t('emergencyUrgent')}</p>
                <p className="text-[11px] text-danger-600 mt-0.5">{t('emergencyUrgentDesc')}</p>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{t('problemDescription')}</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors({ ...errors, description: false }); }}
              rows={3}
              className={`${inputClass(errors.description)} resize-none`}
              placeholder={t('problemPlaceholder')}
            />
            {errors.description && <p className="text-danger-600 text-xs mt-1">{t('required')}</p>}
          </div>

          <div>
            <label className={labelClass}>{t('attachPhotos')}</label>
            <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-5 rounded-lg border-2 border-dashed border-stone-300 hover:border-copper-300 cursor-pointer transition-colors">
              <Camera className="w-5 h-5 text-stone-400" />
              <span className="text-xs text-stone-500 text-center px-2">{photoName || t('attachPhotoHint')}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setPhotoName(file.name); }} />
            </label>
          </div>

          <Button onClick={handleSubmit} size="lg" className="w-full bg-[#7a2230] hover:bg-[#631d29] text-white border-none" disabled={isPending}>
            {isPending ? '...' : t('submitRequestBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
