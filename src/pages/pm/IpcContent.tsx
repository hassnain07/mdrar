import { useState, useRef } from 'react';
import { useBilingualField } from '@/lib/useBilingualField';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/state/uiStore';
import { formatSar, genId } from '@/lib/helpers';
import { useIpcList, useCreateIpc, useUpdateIpc, useDeleteIpc } from '@/queries/useIpc';
import { useActivityList } from '@/queries/useActivities';
import { useProject } from '@/queries/useProjects';
import { PageSkeleton } from '@/components/ui/PageStates';
import type { IpcEntry, IpcStatus, IpcSource, IpcAttachment, ProjectActivity } from '@/types';
import {
  ArrowDownLeft, ArrowUpRight, Inbox, Send, Plus, Pencil, Trash2,
  Building2, Briefcase, FileText, Paperclip, X,
} from 'lucide-react';

type IpcSubTab = 'incoming' | 'outgoing';

function ipcStatusBadgeClass(status: IpcStatus): string {
  switch (status) {
    case 'in_progress': return 'bg-powderblue-50 text-powderblue-700 border-powderblue-200';
    case 'delayed': return 'bg-danger-50 text-danger-700 border-danger-200';
    case 'completed': return 'bg-success-50 text-success-700 border-success-200';
  }
}

function detectFileType(fileName: string): IpcAttachment['fileType'] {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  return 'other';
}

export function IpcContent({ projectId, isRtl }: { projectId: string; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();

  const { data: ipcResult, isLoading } = useIpcList(projectId);
  const { data: activitiesResult } = useActivityList(projectId);
  const { data: project } = useProject(projectId);
  const createIpc = useCreateIpc();
  const updateIpc = useUpdateIpc();
  const deleteIpc = useDeleteIpc();

  const [subTab, setSubTab] = useState<IpcSubTab>('incoming');
  const [editingEntry, setEditingEntry] = useState<IpcEntry | null>(null);
  const [isAddingSource, setIsAddingSource] = useState<IpcSource | null>(null);
  const [isAddingOutgoing, setIsAddingOutgoing] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<IpcEntry | null>(null);

  if (isLoading) return <PageSkeleton />;

  const activities = activitiesResult?.data ?? [];
  const allEntries = ipcResult?.data ?? [];
  const incomingEntries = allEntries.filter((e) => e.direction === 'incoming');
  const outgoingEntries = allEntries.filter((e) => e.direction === 'outgoing');

  const handleSave = (data: Partial<IpcEntry>, isNew: boolean) => {
    const p = isNew
      ? createIpc.mutateAsync({ projectId, entry: { projectId, direction: data.direction || 'incoming', source: data.source, partyName: data.partyName, partyNameEn: data.partyNameEn, reference: data.reference, activityId: data.activityId, amount: data.amount ?? 0, description: data.description || '', descriptionEn: data.descriptionEn || '', status: data.status || 'in_progress', dateLogged: data.dateLogged || new Date().toISOString().slice(0, 10) } })
      : editingEntry ? updateIpc.mutateAsync({ projectId, entryId: editingEntry.id, changes: data }) : Promise.resolve(null);
    p.then(() => { setEditingEntry(null); setIsAddingSource(null); setIsAddingOutgoing(false); toast(t('pm:ipcEntrySaved')); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleDelete = () => {
    if (!deletingEntry) return;
    deleteIpc.mutateAsync({ projectId, entryId: deletingEntry.id })
      .then(() => { setDeletingEntry(null); toast(t('pm:ipcEntryDeleted')); })
      .catch(() => toast(t('errorSaving')));
  };

  const subTabs: { key: IpcSubTab; label: string; icon: typeof Inbox }[] = [
    { key: 'incoming', label: t('pm:ipcIncoming'), icon: ArrowDownLeft },
    { key: 'outgoing', label: t('pm:ipcOutgoing'), icon: ArrowUpRight },
  ];

  return (
    <div className="animate-fade-in">
      {/* Sub-tab header */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-4 w-fit">
        {subTabs.map((st) => {
          const Icon = st.icon;
          return (
            <button
              key={st.key}
              onClick={() => setSubTab(st.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                subTab === st.key
                  ? 'bg-white text-navy-700 shadow-sm'
                  : 'text-stone-500 hover:text-navy-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {st.label}
            </button>
          );
        })}
      </div>

      {/* Description banner */}
      <div className="mb-4 rounded-xl bg-navy-50 border border-navy-100 px-4 py-3">
        <p className="text-sm text-navy-700 leading-relaxed">
          {subTab === 'incoming' ? t('pm:ipcIncomingDesc') : t('pm:ipcOutgoingDesc')}
        </p>
      </div>

      {/* Incoming IPC — two sections */}
      {subTab === 'incoming' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {(['contractor', 'consultant'] as IpcSource[]).map((source) => {
            const entries = incomingEntries.filter((e) => e.source === source);
            const defaultName = source === 'contractor'
              ? (isRtl ? (project?.contractor ?? '') : (project?.contractorEn ?? ''))
              : (isRtl ? (project?.consultant || '') : (project?.consultantEn || ''));
            const defaultNameEn = source === 'contractor'
              ? (project?.contractorEn ?? '')
              : (project?.consultantEn || '');
            const sectionIcon = source === 'contractor' ? Building2 : Briefcase;
            const SectionIcon = sectionIcon;
            return (
              <Card key={source} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-navy-50 flex items-center justify-center">
                      <SectionIcon className="w-5 h-5 text-navy-600" />
                    </div>
                    <h3 className="font-serif text-base font-semibold text-navy-800">
                      {source === 'contractor' ? t('pm:ipcContractorSection') : t('pm:ipcConsultantSection')}
                    </h3>
                  </div>
                  <Button size="sm" onClick={() => setIsAddingSource(source)}>
                    <Plus className="w-3.5 h-3.5" /> {t('pm:ipcAddNew')}
                  </Button>
                </div>

                {entries.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                      <Inbox className="w-6 h-6 text-stone-400" />
                    </div>
                    <p className="text-sm text-stone-400">{t('pm:ipcNoEntries')}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {entries.map((entry) => (
                      <IpcEntryCard
                        key={entry.id}
                        entry={entry}
                        activities={activities}
                        isRtl={isRtl}
                        t={t}
                        onEdit={() => setEditingEntry(entry)}
                        onDelete={() => setDeletingEntry(entry)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Outgoing IPC — single list */}
      {subTab === 'outgoing' && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-navy-50 flex items-center justify-center">
                <Send className="w-5 h-5 text-navy-600" />
              </div>
              <h3 className="font-serif text-base font-semibold text-navy-800">
                {t('pm:ipcOutgoingSection')}
              </h3>
            </div>
            <Button size="sm" onClick={() => setIsAddingOutgoing(true)}>
              <Plus className="w-3.5 h-3.5" /> {t('pm:ipcAddNew')}
            </Button>
          </div>

          {outgoingEntries.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-stone-400" />
              </div>
              <p className="text-sm text-stone-400">{t('pm:ipcNoEntries')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {outgoingEntries.map((entry) => (
                <IpcEntryCard
                  key={entry.id}
                  entry={entry}
                  activities={activities}
                  isRtl={isRtl}
                  t={t}
                  onEdit={() => setEditingEntry(entry)}
                  onDelete={() => setDeletingEntry(entry)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={!!editingEntry || isAddingSource !== null || isAddingOutgoing}
        onClose={() => { setEditingEntry(null); setIsAddingSource(null); setIsAddingOutgoing(false); }}
        title={editingEntry ? t('pm:ipcEditEntry') : t('pm:ipcAddEntry')}
        className="max-w-lg"
      >
        <IpcForm
          entry={editingEntry}
          direction={subTab}
          source={isAddingSource || editingEntry?.source || undefined}
          defaultPartyName={isAddingSource === 'contractor'
            ? (isRtl ? (project?.contractor ?? '') : (project?.contractorEn ?? ''))
            : isAddingSource === 'consultant'
              ? (isRtl ? (project?.consultant || '') : (project?.consultantEn || ''))
              : editingEntry?.partyName || ''}
          defaultPartyNameEn={isAddingSource === 'contractor'
            ? (project?.contractorEn ?? '')
            : isAddingSource === 'consultant'
              ? (project?.consultantEn || '')
              : editingEntry?.partyNameEn || ''}
          activities={activities}
          isRtl={isRtl}
          t={t}
          onSave={handleSave}
          onCancel={() => { setEditingEntry(null); setIsAddingSource(null); setIsAddingOutgoing(false); }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deletingEntry} onClose={() => setDeletingEntry(null)} title={t('pm:ipcDelete')}>
        <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDelete')}</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDelete} className="flex-1">{t('pm:delete')}</Button>
          <Button variant="outline" onClick={() => setDeletingEntry(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function IpcEntryCard({
  entry, activities, isRtl, t, onEdit, onDelete,
}: {
  entry: IpcEntry;
  activities: ProjectActivity[];
  isRtl: boolean;
  t: (key: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const activity = activities.find((a) => a.id === entry.activityId);
  const statusKey = entry.status === 'in_progress' ? 'ipcStatusInProgress'
    : entry.status === 'delayed' ? 'ipcStatusDelayed' : 'ipcStatusCompleted';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.reference && (
              <span className="text-xs font-mono text-navy-600 bg-navy-50 px-2 py-0.5 rounded">
                {entry.reference}
              </span>
            )}
            {entry.partyName && (
              <span className="text-xs text-stone-500">{isRtl ? entry.partyName : (entry.partyNameEn || entry.partyName)}</span>
            )}
          </div>
          {activity && (
            <p className="text-sm font-medium text-navy-800 mt-1">
              {isRtl ? activity.name : activity.nameEn}
            </p>
          )}
          <p className="text-sm text-stone-600 mt-1 line-clamp-2">{isRtl ? entry.description : (entry.descriptionEn || entry.description)}</p>
          <div className="flex items-center gap-3 text-xs text-stone-400 mt-2 flex-wrap">
            <span className="font-semibold text-copper-700">{formatSar(entry.amount, isRtl ? 'ar' : 'en')}</span>
            <span>{entry.dateLogged}</span>
            {entry.attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {entry.attachments.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${ipcStatusBadgeClass(entry.status)}`}>
            {t(`pm:${statusKey}`)}
          </span>
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IpcForm({
  entry, direction, source, defaultPartyName, defaultPartyNameEn,
  activities, isRtl, t, onSave, onCancel,
}: {
  entry: IpcEntry | null;
  direction: IpcSubTab;
  source?: IpcSource;
  defaultPartyName: string;
  defaultPartyNameEn: string;
  activities: ProjectActivity[];
  isRtl: boolean;
  t: (key: string) => string;
  onSave: (data: Partial<IpcEntry>, isNew: boolean) => void;
  onCancel: () => void;
}) {
  const isOutgoing = direction === 'outgoing';
  const partyField = useBilingualField(entry?.partyName || defaultPartyName, entry?.partyNameEn || defaultPartyNameEn);
  const descField = useBilingualField(entry?.description || '', entry?.descriptionEn || '');
  const [reference, setReference] = useState(entry?.reference || '');
  const [activityId, setActivityId] = useState(entry?.activityId || '');
  const [amount, setAmount] = useState(entry?.amount ?? 0);
  const [status, setStatus] = useState<IpcStatus>(entry?.status || 'in_progress');
  const [attachments, setAttachments] = useState<IpcAttachment[]>(entry?.attachments || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string | undefined;
        const att: IpcAttachment = {
          id: genId('att'),
          fileName: file.name,
          fileType: detectFileType(file.name),
          uploadDate: new Date().toISOString().slice(0, 10),
          url: dataUrl,
        };
        setAttachments((prev) => [...prev, att]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    const data: Partial<IpcEntry> = {
      direction: isOutgoing ? 'outgoing' : 'incoming',
      source: isOutgoing ? undefined : (source || entry?.source),
      partyName: isOutgoing ? undefined : partyField.ar,
      partyNameEn: isOutgoing ? undefined : partyField.en,
      reference: isOutgoing ? reference : undefined,
      activityId: activityId || undefined,
      amount,
      description: descField.ar,
      descriptionEn: descField.en || undefined,
      status,
      attachments,
    };
    onSave(data, !entry);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      {/* Incoming: party name fields */}
      {!isOutgoing && (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-stone-500">{t('pm:ipcPartyName')} (AR)
            <input className="form-input mt-1" value={partyField.ar} onChange={(e) => partyField.setAr(e.target.value)} onBlur={() => void partyField.onArBlur()} dir="rtl" />
          </label>
          <label className="text-xs text-stone-500">{t('pm:ipcPartyName')} (EN)
            <input className="form-input mt-1" value={partyField.en} onChange={(e) => partyField.setEn(e.target.value)} onBlur={() => void partyField.onEnBlur()} dir="ltr" />
          </label>
        </div>
      )}

      {/* Outgoing: reference field */}
      {isOutgoing && (
        <label className="text-xs text-stone-500 block">{t('pm:ipcReference')}
          <input className="form-input mt-1" value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />
        </label>
      )}

      {/* Phase / Task dropdown */}
      <label className="text-xs text-stone-500 block">{t('pm:ipcPhase')}
        <select className="filter-select mt-1" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          <option value="">{t('pm:ipcNoPhase')}</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {isRtl ? a.name : a.nameEn} ({a.activityId})
            </option>
          ))}
        </select>
      </label>

      {/* Amount */}
      <label className="text-xs text-stone-500 block">{t('pm:ipcAmount')}
        <input type="number" min={0} className="form-input mt-1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </label>

      {/* Description */}
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">{t('pm:ipcDescription')} (AR)
          <textarea className="form-input mt-1 min-h-[80px]" value={descField.ar} onChange={(e) => descField.setAr(e.target.value)} onBlur={() => void descField.onArBlur()} dir="rtl" />
        </label>
        <label className="text-xs text-stone-500">{t('pm:ipcDescription')} (EN)
          <textarea className="form-input mt-1 min-h-[80px]" value={descField.en} onChange={(e) => descField.setEn(e.target.value)} onBlur={() => void descField.onEnBlur()} dir="ltr" />
        </label>
      </div>

      {/* Status */}
      <label className="text-xs text-stone-500 block">{t('pm:ipcStatus')}
        <select className="filter-select mt-1" value={status} onChange={(e) => setStatus(e.target.value as IpcStatus)}>
          <option value="in_progress">{t('pm:ipcStatusInProgress')}</option>
          <option value="delayed">{t('pm:ipcStatusDelayed')}</option>
          <option value="completed">{t('pm:ipcStatusCompleted')}</option>
        </select>
      </label>

      {/* Attachments */}
      <div>
        <label className="text-xs text-stone-500 block mb-2">{t('pm:ipcAttachments')}</label>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="w-3.5 h-3.5" /> {t('pm:ipcAddAttachment')}
        </Button>
        {attachments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {att.fileType === 'image' && att.url ? (
                    <img src={att.url} alt={att.fileName} className="w-8 h-8 rounded object-cover shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                  )}
                  {att.url ? (
                    <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.fileName} className="text-xs text-copper-600 hover:underline truncate">{att.fileName}</a>
                  ) : (
                    <span className="text-xs text-stone-600 truncate">{att.fileName}</span>
                  )}
                  <span className="text-[10px] text-stone-400 shrink-0">{att.uploadDate}</span>
                </div>
                <button onClick={() => removeAttachment(att.id)} className="text-stone-400 hover:text-danger-600 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={handleSubmit}>{t('pm:ipcStore')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}
