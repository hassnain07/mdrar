import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useCreateProject } from '@/queries/useProjects';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { genId } from '@/lib/helpers';
import { useBilingualField } from '@/lib/useBilingualField';
import type { ProjectUnit } from '@/types';

export function AddProject() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const navigate = useNavigate();
  const toast = useToast();
  const createProject = useCreateProject();
  const isRtl = ui.language === 'ar';
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const projectName = useBilingualField();
  const projectLocation = useBilingualField();
  const projectContractor = useBilingualField();
  const projectConsultant = useBilingualField();
  const [totalUnits, setTotalUnits] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [budget, setBudget] = useState(0);
  const [unitTypes, setUnitTypes] = useState<ProjectUnit[]>([{ id: genId('unit'), type: '', typeEn: '', size: 0, bedrooms: 0, unitCount: 0, image: '', floorPlan: '', model3d: '', brochure: '' }]);

  const addUnitType = () => {
    setUnitTypes([...unitTypes, { id: genId('unit'), type: '', typeEn: '', size: 0, bedrooms: 0, unitCount: 0, image: '', floorPlan: '', model3d: '', brochure: '' }]);
  };
  const removeUnitType = (id: string) => {
    setUnitTypes(unitTypes.filter((u) => u.id !== id));
  };
  const updateUnitType = (id: string, field: keyof ProjectUnit, value: string | number) => {
    setUnitTypes(unitTypes.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };

  // Mirror AR↔EN within each unit type row
  const updateUnitTypeAr = (id: string, value: string) => {
    setUnitTypes(unitTypes.map((u) => {
      if (u.id !== id) return u;
      return { ...u, type: value, typeEn: u.typeEn || value };
    }));
  };
  const updateUnitTypeEn = (id: string, value: string) => {
    setUnitTypes(unitTypes.map((u) => {
      if (u.id !== id) return u;
      return { ...u, typeEn: value, type: u.type || value };
    }));
  };

  const translateUnitTypeAr = async (id: string, value: string) => {
    const unit = unitTypes.find((u) => u.id === id);
    if (!unit || unit.typeEn) return; // already has EN, don't overwrite
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(value)}&langpair=ar|en`);
      const json = await res.json() as { responseData?: { translatedText?: string } };
      const translated = json.responseData?.translatedText ?? '';
      if (translated && translated !== value) {
        setUnitTypes((prev) => prev.map((u) => u.id === id ? { ...u, typeEn: translated } : u));
      }
    } catch { /* ignore */ }
  };

  const translateUnitTypeEn = async (id: string, value: string) => {
    const unit = unitTypes.find((u) => u.id === id);
    if (!unit || unit.type) return; // already has AR, don't overwrite
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(value)}&langpair=en|ar`);
      const json = await res.json() as { responseData?: { translatedText?: string } };
      const translated = json.responseData?.translatedText ?? '';
      if (translated && translated !== value) {
        setUnitTypes((prev) => prev.map((u) => u.id === id ? { ...u, type: translated } : u));
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

    createProject.mutate({
      name: projectName.ar || projectName.en,
      nameEn: projectName.en || projectName.ar,
      location: projectLocation.ar || projectLocation.en,
      locationEn: projectLocation.en || projectLocation.ar,
      totalUnits,
      unitTypes: unitTypes.filter((u) => u.type || u.typeEn),
      startDate,
      endDate,
      totalDays: totalDays || 365,
      contractor: projectContractor.ar || projectContractor.en,
      contractorEn: projectContractor.en || projectContractor.ar,
      contractNumber: contractNumber || undefined,
      consultant: projectConsultant.ar || undefined,
      consultantEn: projectConsultant.en || undefined,
      budget,
      status: 'on_track',
    }, {
      onSuccess: () => { toast(t('pm:projectCreated')); navigate('/pm'); },
      onError: () => toast(t('errorSaving')),
    });
  };

  return (
    <div>
      <button
        onClick={() => navigate('/pm')}
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-navy-700 transition-colors mb-3"
      >
        <BackIcon className="w-4 h-4" />
        <span>{t('back')}</span>
      </button>

      <PageHeader title={t('pm:addProjectTitle')} subtitle={t('pm:addProjectSub')} />

      <form onSubmit={handleSubmit}>
        <Card className="p-5 md:p-6 space-y-5">
          {/* Names */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:projectNameAr')}</label>
              <input className="form-input" value={projectName.ar} onChange={(e) => projectName.setAr(e.target.value)} onBlur={() => void projectName.onArBlur()} required dir="rtl" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:projectNameEn')}</label>
              <input className="form-input" value={projectName.en} onChange={(e) => projectName.setEn(e.target.value)} onBlur={() => void projectName.onEnBlur()} required dir="ltr" />
            </div>
          </div>

          {/* Locations */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:locationAr')}</label>
              <input className="form-input" value={projectLocation.ar} onChange={(e) => projectLocation.setAr(e.target.value)} onBlur={() => void projectLocation.onArBlur()} required dir="rtl" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:locationEn')}</label>
              <input className="form-input" value={projectLocation.en} onChange={(e) => projectLocation.setEn(e.target.value)} onBlur={() => void projectLocation.onEnBlur()} required dir="ltr" />
            </div>
          </div>

          {/* Contractor */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:contractorAr')}</label>
              <input className="form-input" value={projectContractor.ar} onChange={(e) => projectContractor.setAr(e.target.value)} onBlur={() => void projectContractor.onArBlur()} required dir="rtl" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:contractorEn')}</label>
              <input className="form-input" value={projectContractor.en} onChange={(e) => projectContractor.setEn(e.target.value)} onBlur={() => void projectContractor.onEnBlur()} required dir="ltr" />
            </div>
          </div>

          {/* Contract Number & Consultant */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:contractNumber')}</label>
              <input className="form-input" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="CN-001/2025" dir="ltr" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:consultantName')} (AR)</label>
              <input className="form-input" value={projectConsultant.ar} onChange={(e) => projectConsultant.setAr(e.target.value)} onBlur={() => void projectConsultant.onArBlur()} dir="rtl" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:consultantName')} (EN)</label>
              <input className="form-input" value={projectConsultant.en} onChange={(e) => projectConsultant.setEn(e.target.value)} onBlur={() => void projectConsultant.onEnBlur()} dir="ltr" />
            </div>
          </div>

          {/* Numbers */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:totalUnits')}</label>
              <input type="number" min={1} className="form-input" value={totalUnits} onChange={(e) => setTotalUnits(Number(e.target.value))} required />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:startDate')}</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:endDate')}</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-navy-700 mb-1.5 block">{t('pm:budget')} ({t('sar')})</label>
            <input type="number" min={0} className="form-input" value={budget} onChange={(e) => setBudget(Number(e.target.value))} required />
          </div>

          {/* Unit types */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-navy-700">{t('pm:unitTypes')}</label>
              <Button type="button" variant="outline" size="sm" onClick={addUnitType}>
                <Plus className="w-3.5 h-3.5" />
                {t('pm:addUnitType')}
              </Button>
            </div>
            <div className="space-y-3">
              {unitTypes.map((unit, i) => (
                <div key={unit.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end p-3 bg-stone-50 rounded-xl">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">{t('pm:unitType')} (AR)</label>
                    <input className="form-input" value={unit.type} onChange={(e) => updateUnitTypeAr(unit.id, e.target.value)} onBlur={() => void translateUnitTypeAr(unit.id, unit.type)} dir="rtl" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">{t('pm:unitType')} (EN)</label>
                    <input className="form-input" value={unit.typeEn} onChange={(e) => updateUnitTypeEn(unit.id, e.target.value)} onBlur={() => void translateUnitTypeEn(unit.id, unit.typeEn)} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">{t('pm:size')}</label>
                    <input type="number" min={0} className="form-input" value={unit.size} onChange={(e) => updateUnitType(unit.id, 'size', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">{t('pm:bedrooms')}</label>
                    <input type="number" min={0} className="form-input" value={unit.bedrooms} onChange={(e) => updateUnitType(unit.id, 'bedrooms', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">{t('pm:unitCount')}</label>
                    <input type="number" min={0} className="form-input" value={unit.unitCount} onChange={(e) => updateUnitType(unit.id, 'unitCount', Number(e.target.value))} />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUnitType(unit.id)}
                    className="p-2.5 rounded-xl text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors justify-self-end"
                    disabled={unitTypes.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" className="flex-1">{t('pm:createProject')}</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/pm')}>{t('cancel')}</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
