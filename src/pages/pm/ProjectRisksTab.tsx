import { useState } from 'react';
import { useBilingualField } from '@/lib/useBilingualField';
import { useTranslation } from 'react-i18next';
import { useRiskList, useCreateRisk, useUpdateRisk, useDeleteRisk } from '@/queries/useRisks';
import { useToast } from '@/state/uiStore';
import { dataSource } from '@/data/client/index';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/PageStates';
import type { ProjectRisk, RiskResult, ActivityPhoto } from '@/types';
import { Search, Plus, Trash2, Pencil, AlertTriangle, Calendar, User, Paperclip, FileText, Video } from 'lucide-react';

function riskResultBadgeClass(result: RiskResult): string {
  switch (result) {
    case 'pending': return 'bg-warning-50 text-warning-700 border-warning-200';
    case 'in_progress': return 'bg-powderblue-50 text-powderblue-700 border-powderblue-200';
    case 'resolved': return 'bg-success-50 text-success-700 border-success-200';
    case 'delayed': return 'bg-danger-50 text-danger-700 border-danger-200';
  }
}

export function ProjectRisksTab({ projectId, isRtl }: { projectId: string; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: result, isLoading } = useRiskList(projectId);
  const createRisk = useCreateRisk();
  const updateRisk = useUpdateRisk();
  const deleteRisk = useDeleteRisk();

  const [editingRisk, setEditingRisk] = useState<ProjectRisk | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingRisk, setDeletingRisk] = useState<ProjectRisk | null>(null);
  const [riskSearch, setRiskSearch] = useState('');
  const [riskFrom, setRiskFrom] = useState('');
  const [riskTo, setRiskTo] = useState('');

  const risks = result?.data ?? [];
  const filtered = risks.filter((r) => {
    const q = riskSearch.toLowerCase().trim();
    return (!q || r.name.toLowerCase().includes(q) || r.nameEn.toLowerCase().includes(q) || r.responsible.toLowerCase().includes(q))
      && (!riskFrom || r.dateRaised >= riskFrom)
      && (!riskTo || r.deadline <= riskTo);
  });

  const handleSave = (data: Partial<ProjectRisk>, isNew: boolean) => {
    const risk = {
      name: data.name || '',
      nameEn: data.nameEn || data.name || '',
      dateRaised: data.dateRaised || new Date().toISOString().slice(0, 10),
      responsible: data.responsible || '',
      responsibleEn: data.responsibleEn || data.responsible || '',
      description: data.description || '',
      descriptionEn: data.descriptionEn || '',
      deadline: data.deadline || '',
      reason: data.reason || '',
      reasonEn: data.reasonEn || '',
      result: data.result || 'pending' as RiskResult,
    };
    const p = isNew
      ? createRisk.mutateAsync({ projectId, risk })
      : editingRisk ? updateRisk.mutateAsync({ projectId, riskId: editingRisk.id, changes: data }) : Promise.resolve(null);
    p.then(() => { setEditingRisk(null); setIsAdding(false); toast(t('pm:riskSaved')); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleDelete = () => {
    if (!deletingRisk) return;
    deleteRisk.mutateAsync({ projectId, riskId: deletingRisk.id })
      .then(() => { setDeletingRisk(null); toast(t('pm:riskDeleted')); })
      .catch(() => toast(t('errorSaving')));
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 start-3" />
          <input className="filter-input ps-9" placeholder={t('pm:search')} value={riskSearch} onChange={(e) => setRiskSearch(e.target.value)} />
        </div>
        <input type="date" className="filter-input md:w-44" value={riskFrom} onChange={(e) => setRiskFrom(e.target.value)} />
        <input type="date" className="filter-input md:w-44" value={riskTo} onChange={(e) => setRiskTo(e.target.value)} />
        <Button size="sm" onClick={() => setIsAdding(true)}><Plus className="w-3.5 h-3.5" /> {t('pm:addRisk')}</Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-12">{t('pm:noItems')}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, idx) => (
            <Card key={r.id} className={`p-5 ${idx % 2 === 0 ? 'bg-butteryellow-50' : 'bg-powderblue-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-warning-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-serif text-base font-semibold text-navy-800">{isRtl ? r.name : r.nameEn}</h4>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{r.dateRaised}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{isRtl ? r.responsible : r.responsibleEn}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{r.deadline}</span>
                    </div>
                    <p className="text-sm text-stone-600 mt-2">{isRtl ? r.description : r.descriptionEn}</p>
                    {r.reason && <p className="text-xs text-danger-600 mt-2"><strong>{t('pm:reasonIfDelayed')}:</strong> {isRtl ? r.reason : r.reasonEn}</p>}
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${riskResultBadgeClass(r.result || 'pending')}`}>
                        {t(`pm:riskResult_${r.result || 'pending'}`)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingRisk(r)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeletingRisk(r)} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editingRisk || isAdding} onClose={() => { setEditingRisk(null); setIsAdding(false); }} title={t('pm:addRisk')} className="max-w-lg">
        {(editingRisk || isAdding) && (
          <RiskForm risk={editingRisk} projectId={projectId} isRtl={isRtl} t={t} onSave={handleSave} onCancel={() => { setEditingRisk(null); setIsAdding(false); }} />
        )}
      </Modal>

      <Modal open={!!deletingRisk} onClose={() => setDeletingRisk(null)} title={t('pm:delete')}>
        <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDelete')}</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDelete} className="flex-1">{t('pm:delete')}</Button>
          <Button variant="outline" onClick={() => setDeletingRisk(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function RiskForm({ risk, projectId, isRtl, t, onSave, onCancel }: {
  risk: ProjectRisk | null;
  projectId: string;
  isRtl: boolean;
  t: (k: string) => string;
  onSave: (data: Partial<ProjectRisk>, isNew: boolean) => void;
  onCancel: () => void;
}) {
  const riskName = useBilingualField(risk?.name || '', risk?.nameEn || '');
  const responsible = useBilingualField(risk?.responsible || '', risk?.responsibleEn || '');
  const description = useBilingualField(risk?.description || '', risk?.descriptionEn || '');
  const reason = useBilingualField(risk?.reason || '', risk?.reasonEn || '');
  const [dateRaised, setDateRaised] = useState(risk?.dateRaised || new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState(risk?.deadline || '');
  const [result, setResult] = useState<RiskResult>(risk?.result || 'pending');
  const [photoUrls, setPhotoUrls] = useState<ActivityPhoto[]>(risk?.photos ?? []);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { url } = await dataSource.storage.upload('risk-photos', `${projectId}/${Date.now()}-${file.name}`, file);
        const photo: ActivityPhoto = {
          id: `att-${Date.now()}-${file.name}`,
          dataUrl: url,
          uploadDate: new Date().toISOString().slice(0, 10),
          fileType: file.type.startsWith('image') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('video') ? 'video' : 'other',
          fileName: file.name,
        };
        setPhotoUrls((prev) => [photo, ...prev]);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:riskName')} (AR)<input className="form-input mt-1" value={riskName.ar} onChange={(e) => riskName.setAr(e.target.value)} onBlur={() => void riskName.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:riskName')} (EN)<input className="form-input mt-1" value={riskName.en} onChange={(e) => riskName.setEn(e.target.value)} onBlur={() => void riskName.onEnBlur()} dir="ltr" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:dateRaised')}<input type="date" className="form-input mt-1" value={dateRaised} onChange={(e) => setDateRaised(e.target.value)} /></label>
        <label className="text-xs text-stone-500">{t('pm:deadline')}<input type="date" className="form-input mt-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:responsiblePerson')} (AR)<input className="form-input mt-1" value={responsible.ar} onChange={(e) => responsible.setAr(e.target.value)} onBlur={() => void responsible.onArBlur()} dir="rtl" /></label>
        <label className="text-xs text-stone-500">{t('pm:responsiblePerson')} (EN)<input className="form-input mt-1" value={responsible.en} onChange={(e) => responsible.setEn(e.target.value)} onBlur={() => void responsible.onEnBlur()} dir="ltr" /></label>
      </div>
      <label className="text-xs text-stone-500 block">{t('pm:riskResult')}
        <select className="filter-select mt-1" value={result} onChange={(e) => setResult(e.target.value as RiskResult)}>
          <option value="pending">{t('pm:riskResult_pending')}</option>
          <option value="in_progress">{t('pm:riskResult_in_progress')}</option>
          <option value="resolved">{t('pm:riskResult_resolved')}</option>
          <option value="delayed">{t('pm:riskResult_delayed')}</option>
        </select>
      </label>
      <label className="text-xs text-stone-500 block">{t('pm:riskDescription')}<textarea className="form-input mt-1 min-h-[80px]" value={description.ar} onChange={(e) => description.setAr(e.target.value)} onBlur={() => void description.onArBlur()} dir="rtl" /></label>
      <label className="text-xs text-stone-500 block">{t('pm:reasonIfDelayed')}<textarea className="form-input mt-1 min-h-[60px]" value={reason.ar} onChange={(e) => reason.setAr(e.target.value)} onBlur={() => void reason.onArBlur()} dir="rtl" /></label>
      <div className="border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-navy-700">{t('pm:attachments')}</p>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-copper-600 text-white text-xs font-medium cursor-pointer hover:bg-copper-700 transition-colors">
            <Paperclip className="w-3.5 h-3.5" /> {uploading ? '...' : t('pm:uploadAttachment')}
            <input type="file" multiple className="hidden" onChange={(e) => void handleFileUpload(e.target.files)} />
          </label>
        </div>
        {photoUrls.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">{t('pm:noAttachments')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((photo) => (
              <div key={photo.id} className="relative">
                {photo.fileType === 'image' || !photo.fileType ? (
                  <img src={photo.dataUrl} alt={photo.fileName || ''} className="w-full h-20 object-cover rounded-lg" />
                ) : photo.fileType === 'video' ? (
                  <div className="w-full h-20 rounded-lg bg-stone-100 flex flex-col items-center justify-center gap-1">
                    <Video className="w-6 h-6 text-stone-400" />
                    <span className="text-[9px] text-stone-400 truncate px-1 max-w-full">{photo.fileName}</span>
                  </div>
                ) : (
                  <div className="w-full h-20 rounded-lg bg-stone-100 flex flex-col items-center justify-center gap-1">
                    <FileText className="w-6 h-6 text-stone-400" />
                    <span className="text-[9px] text-stone-400 truncate px-1 max-w-full">{photo.fileName}</span>
                  </div>
                )}
                <span className="absolute bottom-1 end-1 text-[8px] bg-black/50 text-white rounded px-1">{photo.uploadDate}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ name: riskName.ar, nameEn: riskName.en, dateRaised, responsible: responsible.ar, responsibleEn: responsible.en, description: description.ar, descriptionEn: description.en, deadline, reason: reason.ar, reasonEn: reason.en, result, photos: photoUrls }, !risk)} className="flex-1">{t('pm:saveChanges')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}
