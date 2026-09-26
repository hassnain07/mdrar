import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useAddUnit, useUpdateUnit, useDeleteUnit, useAddUnitInstance, useUpdateUnitInstance, useDeleteUnitInstance } from '@/queries/useProjects';
import { useToast } from '@/state/uiStore';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/PageStates';
import type { Project, ProjectUnit, UnitInstance, UnitCategory, FloorLevel, TownhouseType } from '@/types';
import { Image as ImageIcon, Plus, Trash2, Pencil, ChevronRight, ChevronLeft, Box, MapPin, Download, Paperclip } from 'lucide-react';

export function ProjectUnitsTab({ projectId, project, isRtl }: { projectId: string; project: Project; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const addUnit = useAddUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const addUnitInstance = useAddUnitInstance();
  const updateUnitInstance = useUpdateUnitInstance();
  const deleteUnitInstance = useDeleteUnitInstance();

  const [selectedModel, setSelectedModel] = useState<ProjectUnit | null>(null);
  const [editingUnit, setEditingUnit] = useState<ProjectUnit | null>(null);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<ProjectUnit | null>(null);
  const [editingUnitInstance, setEditingUnitInstance] = useState<UnitInstance | null>(null);
  const [isAddingUnitInstance, setIsAddingUnitInstance] = useState(false);
  const [deletingUnitInstance, setDeletingUnitInstance] = useState<UnitInstance | null>(null);

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const handleUnitSave = (data: Partial<ProjectUnit>, isNew: boolean) => {
    const p = isNew
      ? addUnit.mutateAsync({ projectId, unit: { type: data.type || '', typeEn: data.typeEn || '', size: data.size ?? 0, bedrooms: data.bedrooms ?? 0, unitCount: data.unitCount ?? 0, image: data.image || '', floorPlan: data.floorPlan || '', model3d: data.model3d || '', brochure: data.brochure || '', category: data.category } })
      : editingUnit ? updateUnit.mutateAsync({ projectId, unitId: editingUnit.id, changes: data }) : Promise.resolve(null);
    p.then(() => { setEditingUnit(null); setIsAddingUnit(false); toast(t('pm:modelSaved')); }).catch(() => toast(t('errorSaving')));
  };

  const handleUnitDelete = () => {
    if (!deletingUnit) return;
    deleteUnit.mutateAsync({ projectId, unitId: deletingUnit.id })
      .then(() => { setDeletingUnit(null); toast(t('pm:modelDeleted')); }).catch(() => toast(t('errorSaving')));
  };

  const handleUnitInstanceSave = (data: Partial<UnitInstance>, isNew: boolean) => {
    if (!selectedModel) return;
    const p = isNew
      ? addUnitInstance.mutateAsync({ projectId, unit: { modelId: selectedModel.id, label: data.label || '', labelEn: data.labelEn || '', floor: data.floor ?? 1, status: data.status || 'available', floorPlan: data.floorPlan || selectedModel.floorPlan, model3d: data.model3d || selectedModel.model3d, brochure: data.brochure || selectedModel.brochure, price: data.price, space: data.space, attachmentName: data.attachmentName, floorLevel: data.floorLevel, townhouseType: data.townhouseType } })
      : editingUnitInstance ? updateUnitInstance.mutateAsync({ projectId, unitId: editingUnitInstance.id, changes: data }) : Promise.resolve(null);
    p.then(() => { setEditingUnitInstance(null); setIsAddingUnitInstance(false); toast(t('pm:unitInstanceSaved')); }).catch(() => toast(t('errorSaving')));
  };

  const handleUnitInstanceDelete = () => {
    if (!deletingUnitInstance) return;
    deleteUnitInstance.mutateAsync({ projectId, unitId: deletingUnitInstance.id })
      .then(() => { setDeletingUnitInstance(null); toast(t('pm:unitInstanceDeleted')); }).catch(() => toast(t('errorSaving')));
  };

  if (!selectedModel) {
    return (
      <div className="animate-fade-in">
        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={() => setIsAddingUnit(true)}><Plus className="w-3.5 h-3.5" /> {t('pm:addModel')}</Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.unitTypes.map((unit, idx) => (
            <Card key={unit.id} className={`overflow-hidden cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-0.5 ${idx % 2 === 0 ? 'bg-butteryellow-50' : 'bg-powderblue-50'}`} onClick={() => setSelectedModel(unit)}>
              <div className="h-40 bg-stone-200 flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-stone-400" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-serif text-base font-semibold text-navy-800">{isRtl ? unit.type : unit.typeEn}</h4>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-2">
                      <span>{unit.size} م²</span>
                      {unit.bedrooms > 0 && <span>· {unit.bedrooms} {t('pm:bedrooms')}</span>}
                      <span>· {unit.unitCount} {t('pm:units_count')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditingUnit(unit)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeletingUnit(unit)} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-copper-600 font-medium mt-3">
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{(project.unitInstances || []).filter((u) => u.modelId === unit.id).length} {t('pm:units_count')}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Modal open={!!editingUnit || isAddingUnit} onClose={() => { setEditingUnit(null); setIsAddingUnit(false); }} title={isAddingUnit ? t('pm:addModel') : t('pm:editModel')} className="max-w-lg">
          {(editingUnit || isAddingUnit) && <UnitForm unit={editingUnit} isRtl={isRtl} t={t} onSave={handleUnitSave} onCancel={() => { setEditingUnit(null); setIsAddingUnit(false); }} />}
        </Modal>
        <Modal open={!!deletingUnit} onClose={() => setDeletingUnit(null)} title={t('pm:delete')}>
          <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDelete')}</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleUnitDelete} className="flex-1">{t('pm:delete')}</Button>
            <Button variant="outline" onClick={() => setDeletingUnit(null)}>{t('cancel')}</Button>
          </div>
        </Modal>
      </div>
    );
  }

  const instances = (project.unitInstances || []).filter((u) => u.modelId === selectedModel.id);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <button onClick={() => setSelectedModel(null)} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-navy-700 transition-colors">
          <BackIcon className="w-4 h-4" /><span>{t('pm:backToModels')}</span>
        </button>
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-lg font-semibold text-navy-800">{isRtl ? selectedModel.type : selectedModel.typeEn}</h3>
          <Button size="sm" onClick={() => setIsAddingUnitInstance(true)}><Plus className="w-3.5 h-3.5" /> {t('pm:addUnit')}</Button>
        </div>
      </div>

      {instances.length === 0 ? (
        <Card><CardBody className="text-center text-stone-400 text-sm py-12">{t('pm:noUnitsInModel')}</CardBody></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((unit, idx) => (
            <Card key={unit.id} className={`p-4 ${idx % 2 === 0 ? 'bg-butteryellow-50' : 'bg-powderblue-50'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-serif text-base font-semibold text-navy-800">{isRtl ? unit.label : unit.labelEn}</h4>
                  <div className="flex items-center gap-3 text-xs text-stone-500 mt-2 flex-wrap">
                    {unit.price ? <span className="font-medium text-navy-700">{unit.price.toLocaleString()} {t('sar')}</span> : null}
                    {unit.space ? <span>{unit.space} م²</span> : null}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${unit.status === 'available' ? 'bg-success-50 text-success-600' : unit.status === 'reserved' ? 'bg-warning-50 text-warning-600' : 'bg-danger-50 text-danger-600'}`}>
                      {t(`pm:unit${unit.status.charAt(0).toUpperCase()}${unit.status.slice(1)}`)}
                    </span>
                  </div>
                  {unit.attachmentName && <div className="flex items-center gap-1 text-xs text-copper-600 mt-2"><Paperclip className="w-3 h-3" /><span className="truncate">{unit.attachmentName}</span></div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingUnitInstance(unit)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeletingUnitInstance(unit)} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => toast(t('pm:floorPlanToast', { name: isRtl ? unit.label : unit.labelEn }))}><MapPin className="w-3.5 h-3.5" /> {t('pm:viewFloorPlan')}</Button>
                <Button variant="outline" size="sm" onClick={() => toast(t('pm:model3DToast', { name: isRtl ? unit.label : unit.labelEn }))}><Box className="w-3.5 h-3.5" /> {t('pm:view3DModel')}</Button>
                <Button variant="outline" size="sm" onClick={() => toast(t('pm:brochureToast', { name: isRtl ? unit.label : unit.labelEn }))}><Download className="w-3.5 h-3.5" /> {t('pm:downloadBrochure')}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editingUnitInstance || isAddingUnitInstance} onClose={() => { setEditingUnitInstance(null); setIsAddingUnitInstance(false); }} title={isAddingUnitInstance ? t('pm:addUnit') : t('pm:editUnit')} className="max-w-lg">
        {(editingUnitInstance || isAddingUnitInstance) && <UnitInstanceForm unit={editingUnitInstance} model={selectedModel} isRtl={isRtl} t={t} onSave={handleUnitInstanceSave} onCancel={() => { setEditingUnitInstance(null); setIsAddingUnitInstance(false); }} />}
      </Modal>
      <Modal open={!!deletingUnitInstance} onClose={() => setDeletingUnitInstance(null)} title={t('pm:delete')}>
        <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDelete')}</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleUnitInstanceDelete} className="flex-1">{t('pm:delete')}</Button>
          <Button variant="outline" onClick={() => setDeletingUnitInstance(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function UnitForm({ unit, isRtl, t, onSave, onCancel }: { unit: ProjectUnit | null; isRtl: boolean; t: (k: string) => string; onSave: (d: Partial<ProjectUnit>, isNew: boolean) => void; onCancel: () => void }) {
  const [type, setType] = useState(unit?.type || '');
  const [typeEn, setTypeEn] = useState(unit?.typeEn || '');
  const [size, setSize] = useState(unit?.size ?? 0);
  const [bedrooms, setBedrooms] = useState(unit?.bedrooms ?? 0);
  const [unitCount, setUnitCount] = useState(unit?.unitCount ?? 0);
  const [category, setCategory] = useState<UnitCategory | ''>(unit?.category || '');
  const [floorPlan, setFloorPlan] = useState(unit?.floorPlan || '');
  const [model3d, setModel3d] = useState(unit?.model3d || '');
  const [brochure, setBrochure] = useState(unit?.brochure || '');
  return (
    <div className="space-y-4">
      <label className="text-xs text-stone-500 block">{t('pm:unitCategory')}
        <select className="filter-select mt-1" value={category} onChange={(e) => setCategory(e.target.value as UnitCategory | '')}>
          <option value="">—</option>
          <option value="villa">{t('pm:unitCategoryVilla')}</option>
          <option value="floor">{t('pm:unitCategoryFloor')}</option>
          <option value="townhouse">{t('pm:unitCategoryTownhouse')}</option>
        </select>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:unitType')} (AR)<input className="form-input mt-1" value={type} onChange={(e) => setType(e.target.value)} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:unitType')} (EN)<input className="form-input mt-1" value={typeEn} onChange={(e) => setTypeEn(e.target.value)} dir="ltr" /></label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-stone-500">{t('pm:size')}<input type="number" min={0} className="form-input mt-1" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('pm:bedrooms')}<input type="number" min={0} className="form-input mt-1" value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('pm:unitCount')}<input type="number" min={0} className="form-input mt-1" value={unitCount} onChange={(e) => setUnitCount(Number(e.target.value))} /></label>
      </div>
      <label className="text-xs text-stone-500 block">{t('pm:floorPlan')}<input className="form-input mt-1" value={floorPlan} onChange={(e) => setFloorPlan(e.target.value)} placeholder={t('pm:assetPlaceholder')} dir="ltr" /></label>
      <label className="text-xs text-stone-500 block">{t('pm:model3d')}<input className="form-input mt-1" value={model3d} onChange={(e) => setModel3d(e.target.value)} placeholder={t('pm:assetPlaceholder')} dir="ltr" /></label>
      <label className="text-xs text-stone-500 block">{t('pm:brochure')}<input className="form-input mt-1" value={brochure} onChange={(e) => setBrochure(e.target.value)} placeholder={t('pm:assetPlaceholder')} dir="ltr" /></label>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ type, typeEn, size, bedrooms, unitCount, image: '', floorPlan, model3d, brochure, category: category || undefined }, !unit)} className="flex-1">{t('pm:saveChanges')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}

function UnitInstanceForm({ unit, model, isRtl, t, onSave, onCancel }: { unit: UnitInstance | null; model: ProjectUnit | null; isRtl: boolean; t: (k: string) => string; onSave: (d: Partial<UnitInstance>, isNew: boolean) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(unit?.label || '');
  const [labelEn, setLabelEn] = useState(unit?.labelEn || '');
  const [floor, setFloor] = useState(unit?.floor ?? 1);
  const [status, setStatus] = useState<'available' | 'reserved' | 'sold'>(unit?.status || 'available');
  const [price, setPrice] = useState(unit?.price ?? 0);
  const [space, setSpace] = useState(unit?.space ?? 0);
  const [attachmentName, setAttachmentName] = useState(unit?.attachmentName || '');
  const [floorLevel, setFloorLevel] = useState<FloorLevel | ''>(unit?.floorLevel || '');
  const [townhouseType, setTownhouseType] = useState<TownhouseType | ''>(unit?.townhouseType || '');
  const category = model?.category;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:unitLabel')} (AR)<input className="form-input mt-1" value={label} onChange={(e) => setLabel(e.target.value)} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:unitLabel')} (EN)<input className="form-input mt-1" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} dir="ltr" /></label>
      </div>
      {category === 'floor' && (
        <label className="text-xs text-stone-500 block">{t('pm:unitFloorLevel')}
          <select className="filter-select mt-1" value={floorLevel} onChange={(e) => setFloorLevel(e.target.value as FloorLevel | '')}>
            <option value="">—</option>
            <option value="ground">{t('pm:unitFloorGround')}</option>
            <option value="1">{t('pm:unitFloor1')}</option>
            <option value="2">{t('pm:unitFloor2')}</option>
          </select>
        </label>
      )}
      {category === 'townhouse' && (
        <label className="text-xs text-stone-500 block">{t('pm:unitTownhouseType')}
          <select className="filter-select mt-1" value={townhouseType} onChange={(e) => setTownhouseType(e.target.value as TownhouseType | '')}>
            <option value="">—</option>
            <option value="A">{t('pm:unitTownhouseA')}</option>
            <option value="B">{t('pm:unitTownhouseB')}</option>
          </select>
        </label>
      )}
      {category !== 'villa' && category !== 'floor' && category !== 'townhouse' && (
        <label className="text-xs text-stone-500 block">{t('pm:unitFloor')}<input type="number" min={0} className="form-input mt-1" value={floor} onChange={(e) => setFloor(Number(e.target.value))} /></label>
      )}
      <label className="text-xs text-stone-500 block">{t('pm:unitStatus')}
        <select className="filter-select mt-1" value={status} onChange={(e) => setStatus(e.target.value as 'available' | 'reserved' | 'sold')}>
          <option value="available">{t('pm:unitAvailable')}</option>
          <option value="reserved">{t('pm:unitReserved')}</option>
          <option value="sold">{t('pm:unitSold')}</option>
        </select>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:unitPrice')}<input type="number" min={0} className="form-input mt-1" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('pm:unitSpace')}<input type="number" min={0} className="form-input mt-1" value={space} onChange={(e) => setSpace(Number(e.target.value))} /></label>
      </div>
      {(category === 'villa' || category === 'townhouse') && (
        <div>
          <label className="text-xs text-stone-500 block mb-1">{t('pm:unitAttachment')}</label>
          {attachmentName ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2">
              <span className="text-sm text-navy-700 truncate">{attachmentName}</span>
              <button onClick={() => setAttachmentName('')} className="text-stone-400 hover:text-danger-600 text-xs">{t('cancel')}</button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-copper-600 text-white text-xs font-medium cursor-pointer hover:bg-copper-700 transition-colors">
              <Paperclip className="w-3.5 h-3.5" /> {t('pm:unitAttachmentUpload')}
              <input type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setAttachmentName(e.target.files[0].name); }} />
            </label>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ label, labelEn, floor, status, price, space, attachmentName: attachmentName || undefined, floorLevel: floorLevel || undefined, townhouseType: townhouseType || undefined }, !unit)} className="flex-1">{t('pm:saveChanges')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}
