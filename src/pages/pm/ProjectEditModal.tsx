import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useUpdateProject } from '@/queries/useProjects';
import { useToast } from '@/state/uiStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useBilingualField } from '@/lib/useBilingualField';
import type { ProjectStatus } from '@/types';

export function ProjectEditModal({ open, projectId, onClose, isRtl }: { open: boolean; projectId: string; onClose: () => void; isRtl: boolean }) {
  const { t } = useTranslation();
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject();
  const toast = useToast();

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('pm:editProjectDetails')} className="max-w-2xl">
      <ProjectForm
        project={project}
        isRtl={isRtl}
        t={t}
        onSave={(data) => {
          updateProject.mutateAsync({ id: projectId, changes: data })
            .then(() => { onClose(); toast(t('pm:projectSaved')); })
            .catch(() => toast(t('errorSaving')));
        }}
        onCancel={onClose}
        saving={updateProject.isPending}
      />
    </Modal>
  );
}

function ProjectForm({ project, isRtl, t, onSave, onCancel, saving }: {
  project: { name: string; nameEn: string; location: string; locationEn: string; totalUnits: number; contractor: string; contractorEn: string; startDate: string; endDate: string; budget: number; status: ProjectStatus; description?: string; descriptionEn?: string; contractNumber?: string; consultant?: string; consultantEn?: string };
  isRtl: boolean;
  t: (k: string) => string;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const name = useBilingualField(project.name, project.nameEn);
  const location = useBilingualField(project.location, project.locationEn);
  const contractor = useBilingualField(project.contractor, project.contractorEn);
  const consultant = useBilingualField(project.consultant ?? '', project.consultantEn ?? '');
  const description = useBilingualField(project.description ?? '', project.descriptionEn ?? '');
  const [totalUnits, setTotalUnits] = useState(project.totalUnits);
  const [startDate, setStartDate] = useState(project.startDate);
  const [endDate, setEndDate] = useState(project.endDate);
  const [budget, setBudget] = useState(project.budget);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [contractNumber, setContractNumber] = useState(project.contractNumber ?? '');

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('projectName')} (AR)<input className="form-input mt-1" value={name.ar} onChange={(e) => name.setAr(e.target.value)} onBlur={() => void name.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('projectName')} (EN)<input className="form-input mt-1" value={name.en} onChange={(e) => name.setEn(e.target.value)} onBlur={() => void name.onEnBlur()} dir="ltr" /></label>
        <label className="text-xs text-stone-500">{t('projectLocation')} (AR)<input className="form-input mt-1" value={location.ar} onChange={(e) => location.setAr(e.target.value)} onBlur={() => void location.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('projectLocation')} (EN)<input className="form-input mt-1" value={location.en} onChange={(e) => location.setEn(e.target.value)} onBlur={() => void location.onEnBlur()} dir="ltr" /></label>
        <label className="text-xs text-stone-500">{t('projectContractor')} (AR)<input className="form-input mt-1" value={contractor.ar} onChange={(e) => contractor.setAr(e.target.value)} onBlur={() => void contractor.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('projectContractor')} (EN)<input className="form-input mt-1" value={contractor.en} onChange={(e) => contractor.setEn(e.target.value)} onBlur={() => void contractor.onEnBlur()} dir="ltr" /></label>
        <label className="text-xs text-stone-500">{t('pm:contractNumber')}<input className="form-input mt-1" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} dir="ltr" /></label>
        <label className="text-xs text-stone-500">{t('pm:consultantName')} (AR)<input className="form-input mt-1" value={consultant.ar} onChange={(e) => consultant.setAr(e.target.value)} onBlur={() => void consultant.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:consultantName')} (EN)<input className="form-input mt-1" value={consultant.en} onChange={(e) => consultant.setEn(e.target.value)} onBlur={() => void consultant.onEnBlur()} dir="ltr" /></label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-xs text-stone-500">{t('pm:totalUnits')}<input type="number" min={0} className="form-input mt-1" value={totalUnits} onChange={(e) => setTotalUnits(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('projectBudget')}<input type="number" min={0} className="form-input mt-1" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label>
        <label className="text-xs text-stone-500">{t('projectStartDate')}<input type="date" className="form-input mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="text-xs text-stone-500">{t('projectEndDate')}<input type="date" className="form-input mt-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      </div>
      <label className="text-xs text-stone-500 block">{t('projectStatus')}
        <select className="filter-select mt-1" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          <option value="on_track">{t('pm:projectStatus_on_track')}</option>
          <option value="at_risk">{t('pm:projectStatus_at_risk')}</option>
          <option value="delayed">{t('pm:projectStatus_delayed')}</option>
          <option value="completed">{t('pm:projectStatus_completed')}</option>
        </select>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:projectDescription')} (AR)<textarea className="form-input mt-1 min-h-[100px]" value={description.ar} onChange={(e) => description.setAr(e.target.value)} onBlur={() => void description.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:projectDescription')} (EN)<textarea className="form-input mt-1 min-h-[100px]" value={description.en} onChange={(e) => description.setEn(e.target.value)} onBlur={() => void description.onEnBlur()} dir="ltr" /></label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" disabled={saving} onClick={() => onSave({ name: name.ar, nameEn: name.en, location: location.ar, locationEn: location.en, totalUnits, contractor: contractor.ar, contractorEn: contractor.en, startDate, endDate, budget, status, description: description.ar, descriptionEn: description.en, contractNumber, consultant: consultant.ar, consultantEn: consultant.en })}>
          {saving ? '...' : t('pm:saveChanges')}
        </Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}
