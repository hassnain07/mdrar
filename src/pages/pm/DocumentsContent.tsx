import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/state/uiStore';
import { useDocumentList, useDocumentCategories, useCreateDocument, useUpdateDocument, useDeleteDocument, useRenameDocumentCategory, useAddDocumentCategory, useRemoveDocumentCategory } from '@/queries/useDocuments';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/PageStates';
import type { ProjectDocument, DocumentCategoryRecord } from '@/types';
import {
  FileText, Search, Plus, Trash2, Pencil, Eye, Download,
  ArrowRight, ArrowLeft, ChevronLeft, ChevronRight,
  FileSignature, Map, HardHat, FileCheck, FileBarChart, Mail,
  Upload, X, FolderPlus,
} from 'lucide-react';

const builtinConfig: Record<string, { icon: typeof FileText; bg: string; text: string; border: string }> = {
  contracts:         { icon: FileSignature,  bg: 'bg-copper-50',      text: 'text-copper-700',      border: 'hover:border-copper-400' },
  master_plan:       { icon: Map,            bg: 'bg-powderblue-50',  text: 'text-navy-700',        border: 'hover:border-navy-300' },
  construction_files:{ icon: HardHat,        bg: 'bg-butteryellow-50',text: 'text-butteryellow-700',border: 'hover:border-butteryellow-300' },
  permits:           { icon: FileCheck,      bg: 'bg-success-50',     text: 'text-success-700',     border: 'hover:border-success-300' },
  reports:           { icon: FileBarChart,   bg: 'bg-stone-100',      text: 'text-stone-700',       border: 'hover:border-stone-400' },
  correspondence:    { icon: Mail,           bg: 'bg-powderblue-50',  text: 'text-powderblue-700',  border: 'hover:border-powderblue-300' },
};

const customConfig = { bg: 'bg-copper-50', text: 'text-copper-700', border: 'hover:border-copper-400' };

export function DocumentsContent({ projectId, isRtl }: { projectId: string; isRtl: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();

  const { data: docsResult, isLoading } = useDocumentList(projectId);
  const { data: categories = [] } = useDocumentCategories(projectId);
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const deleteDoc = useDeleteDocument();
  const renameCategory = useRenameDocumentCategory();
  const addCategoryMut = useAddDocumentCategory();
  const removeCategoryMut = useRemoveDocumentCategory();

  const documents = useMemo(() => docsResult?.data ?? [], [docsResult]);
  const builtinCategories = categories.filter((c) => c.isDefault);
  const customCategories = categories.filter((c) => !c.isDefault);

  const [activeCategory, setActiveCategory] = useState<DocumentCategoryRecord | null>(null);
  const [search, setSearch] = useState('');
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<ProjectDocument | null>(null);
  const [uploadFiles, setUploadFiles] = useState<{ name: string; nameEn: string }[]>([]);
  const [renamingCategory, setRenamingCategory] = useState<DocumentCategoryRecord | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const EnterIcon = isRtl ? ArrowLeft : ArrowRight;

  const getCategoryName = (cat: DocumentCategoryRecord): string => isRtl ? cat.name : cat.nameEn;
  const getCategoryDesc = (cat: DocumentCategoryRecord): string =>
    cat.isDefault ? t(`pm:docCategory_${cat.key}_desc`) : t('pm:customCategory');

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => { counts[d.categoryId] = (counts[d.categoryId] || 0) + 1; });
    return counts;
  }, [documents]);

  const categoryDocs = useMemo(() => {
    if (!activeCategory) return [];
    return documents
      .filter((d) => d.categoryId === activeCategory.id)
      .filter((d) => {
        const q = search.toLowerCase().trim();
        return !q || d.name.toLowerCase().includes(q) || d.nameEn.toLowerCase().includes(q);
      });
  }, [documents, activeCategory, search]);

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    setUploadFiles((prev) => [...prev, ...Array.from(files).map((f) => ({ name: f.name, nameEn: f.name }))]);
  };

  const handleUploadSubmit = () => {
    if (uploadFiles.length === 0 || !activeCategory) return;
    const today = new Date().toISOString().slice(0, 10);
    Promise.all(uploadFiles.map((f) =>
      createDoc.mutateAsync({ projectId, categoryId: activeCategory.id, doc: { name: f.name, nameEn: f.nameEn, type: 'pdf', uploadDate: today } })
    )).then(() => { toast(t('pm:documentsUploaded')); setUploadFiles([]); setIsAddingDoc(false); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleDocSave = (data: Partial<ProjectDocument>, isNew: boolean) => {
    if (!activeCategory) return;
    const p = isNew
      ? createDoc.mutateAsync({ projectId, categoryId: activeCategory.id, doc: { name: data.name || '', nameEn: data.nameEn || data.name || '', type: data.type || 'pdf', uploadDate: data.uploadDate || new Date().toISOString().slice(0, 10) } })
      : editingDoc ? updateDoc.mutateAsync({ projectId, documentId: editingDoc.id, changes: { name: data.name, nameEn: data.nameEn } }) : Promise.resolve();
    p.then(() => { setEditingDoc(null); setIsAddingDoc(false); toast(t('pm:documentSaved')); }).catch(() => toast(t('errorSaving')));
  };

  const handleDocDelete = () => {
    if (!deletingDoc) return;
    deleteDoc.mutateAsync({ projectId, documentId: deletingDoc.id })
      .then(() => { setDeletingDoc(null); toast(t('pm:documentDeleted')); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleCategoryRename = (cat: DocumentCategoryRecord, name: string, nameEn: string) => {
    renameCategory.mutateAsync({ projectId, categoryId: cat.id, names: { name, nameEn } })
      .then(() => { setRenamingCategory(null); toast(t('pm:categoryRenamed')); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleAddCategory = (name: string, nameEn: string) => {
    addCategoryMut.mutateAsync({ projectId, names: { name, nameEn } })
      .then(() => { setIsAddingCategory(false); toast(t('pm:categoryAdded')); })
      .catch(() => toast(t('errorSaving')));
  };

  const handleRemoveCategory = () => {
    if (!deletingCategoryId) return;
    removeCategoryMut.mutateAsync({ projectId, categoryId: deletingCategoryId })
      .then(() => { setDeletingCategoryId(null); if (activeCategory?.id === deletingCategoryId) setActiveCategory(null); toast(t('pm:categoryDeleted')); })
      .catch((e: { message?: string }) => toast(e?.message ?? t('errorSaving')));
  };

  if (isLoading) return <PageSkeleton />;

  // --- Category tiles view ---
  if (!activeCategory) {
    return (
      <div className="animate-fade-in">
        <div className="flex justify-end mb-4">
          <Button size="sm" variant="outline" onClick={() => setIsAddingCategory(true)}>
            <FolderPlus className="w-4 h-4" /> {t('pm:addCategory')}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtinCategories.map((cat) => {
            const cfg = builtinConfig[cat.key] ?? { ...customConfig, icon: FileText };
            const Icon = cfg.icon;
            const count = countsByCategory[cat.id] || 0;
            return (
              <div key={cat.id} className={`group bg-white rounded-2xl border border-stone-200 shadow-soft p-5 text-start transition-all duration-300 hover:shadow-elevated ${cfg.border} hover:-translate-y-0.5 relative`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${cfg.text}`} />
                  </div>
                  <span className="text-xs font-medium text-stone-400 bg-stone-50 px-2 py-1 rounded-full">
                    {count} {t('pm:files')}
                  </span>
                </div>
                <button onClick={() => { setActiveCategory(cat); setSearch(''); }} className="w-full text-start">
                  <p className="font-serif text-base font-semibold text-navy-800 mb-1">{getCategoryName(cat)}</p>
                  <p className="text-xs text-stone-400 leading-snug mb-3">{getCategoryDesc(cat)}</p>
                  <span className={`inline-flex items-center gap-1 ${cfg.text} text-xs font-medium group-hover:gap-2 transition-all`}>
                    {t('pm:viewCategory')}
                    <EnterIcon className="w-3 h-3" />
                  </span>
                </button>
                <button
                  onClick={() => setRenamingCategory(cat)}
                  className="absolute top-3 end-3 p-1.5 rounded-lg text-stone-300 hover:bg-stone-100 hover:text-navy-700 transition-colors opacity-0 group-hover:opacity-100"
                  title={t('pm:renameCategory')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {customCategories.map((cat) => {
            const count = countsByCategory[cat.id] || 0;
            return (
              <div key={cat.id} className={`group bg-white rounded-2xl border border-stone-200 shadow-soft p-5 text-start transition-all duration-300 hover:shadow-elevated ${customConfig.border} hover:-translate-y-0.5 relative`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl ${customConfig.bg} flex items-center justify-center`}>
                    <FileText className={`w-6 h-6 ${customConfig.text}`} />
                  </div>
                  <span className="text-xs font-medium text-stone-400 bg-stone-50 px-2 py-1 rounded-full">
                    {count} {t('pm:files')}
                  </span>
                </div>
                <button onClick={() => { setActiveCategory(cat); setSearch(''); }} className="w-full text-start">
                  <p className="font-serif text-base font-semibold text-navy-800 mb-1">{getCategoryName(cat)}</p>
                  <p className="text-xs text-stone-400 leading-snug mb-3">{t('pm:customCategory')}</p>
                  <span className={`inline-flex items-center gap-1 ${customConfig.text} text-xs font-medium group-hover:gap-2 transition-all`}>
                    {t('pm:viewCategory')}
                    <EnterIcon className="w-3 h-3" />
                  </span>
                </button>
                <div className="absolute top-3 end-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setRenamingCategory(cat)} className="p-1.5 rounded-lg text-stone-300 hover:bg-stone-100 hover:text-navy-700 transition-colors" title={t('pm:renameCategory')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeletingCategoryId(cat.id)} className="p-1.5 rounded-lg text-stone-300 hover:bg-danger-50 hover:text-danger-600 transition-colors" title={t('pm:delete')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add category modal */}
        <Modal open={isAddingCategory} onClose={() => setIsAddingCategory(false)} title={t('pm:addCategory')} className="max-w-md">
          <AddCategoryForm isRtl={isRtl} t={t} onSave={handleAddCategory} onCancel={() => setIsAddingCategory(false)} />
        </Modal>

        {/* Rename category modal */}
        <Modal open={!!renamingCategory} onClose={() => setRenamingCategory(null)} title={t('pm:renameCategory')} className="max-w-md">
          {renamingCategory && (
            <RenameCategoryForm
              currentName={renamingCategory.name}
              currentNameEn={renamingCategory.nameEn}
              defaultName={renamingCategory.name}
              defaultNameEn={renamingCategory.nameEn}
              isRtl={isRtl}
              t={t}
              onSave={(name, nameEn) => handleCategoryRename(renamingCategory, name, nameEn)}
              onCancel={() => setRenamingCategory(null)}
            />
          )}
        </Modal>

        {/* Delete custom category confirm */}
        <Modal open={!!deletingCategoryId} onClose={() => setDeletingCategoryId(null)} title={t('pm:delete')}>
          <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDeleteCategory')}</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleRemoveCategory} className="flex-1">{t('pm:delete')}</Button>
            <Button variant="outline" onClick={() => setDeletingCategoryId(null)}>{t('cancel')}</Button>
          </div>
        </Modal>
      </div>
    );
  }

  // --- Category detail view ---
  const isCustom = !activeCategory.isDefault;
  const cfg = isCustom ? { ...customConfig, icon: FileText } : builtinConfig[activeCategory.key] ?? { ...customConfig, icon: FileText };
  const Icon = cfg.icon;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setActiveCategory(null)}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-navy-700 transition-colors"
        >
          <BackIcon className="w-4 h-4" />
          {t('pm:allCategories')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${cfg.text}`} />
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-navy-800">{getCategoryName(activeCategory)}</h2>
            <p className="text-xs text-stone-400">{getCategoryDesc(activeCategory)}</p>
          </div>
          <button
            onClick={() => setRenamingCategory(activeCategory)}
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors"
            title={t('pm:renameCategory')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <Button size="sm" onClick={() => { setIsAddingDoc(true); setUploadFiles([]); }}>
          <Plus className="w-4 h-4" /> {t('pm:addDocument')}
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 start-3" />
          <input className="filter-input ps-9" placeholder={t('pm:search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {categoryDocs.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl ${cfg.bg} flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-8 h-8 ${cfg.text}`} />
          </div>
          <p className="text-sm text-stone-400 mb-4">{t('pm:noDocumentsInCategory')}</p>
          <Button size="sm" onClick={() => { setIsAddingDoc(true); setUploadFiles([]); }}>
            <Plus className="w-4 h-4" /> {t('pm:addDocument')}
          </Button>
        </div>
      ) : (
        <Card className="divide-y divide-stone-100">
          {categoryDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-stone-500" />
                </div>
                <div>
                  <span className="text-sm font-medium text-navy-700">{isRtl ? doc.name : doc.nameEn}</span>
                  <p className="text-xs text-stone-400">{doc.uploadDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toast(t('pm:docViewToast', { name: isRtl ? doc.name : doc.nameEn }))} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors" title={t('pm:view')}>
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toast(t('pm:docDownloadToast', { name: isRtl ? doc.name : doc.nameEn }))} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors" title={t('pm:download')}>
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingDoc(doc)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-navy-700 transition-colors" title={t('pm:edit')}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeletingDoc(doc)} className="p-1.5 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors" title={t('pm:delete')}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Upload modal */}
      <Modal open={isAddingDoc && !editingDoc} onClose={() => { setIsAddingDoc(false); setUploadFiles([]); }} title={t('pm:uploadDocuments')} className="max-w-lg">
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-copper-400 hover:bg-copper-50/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-stone-400 mx-auto mb-3" />
            <p className="text-sm text-stone-600 mb-1">{t('pm:uploadMultipleFiles')}</p>
            <p className="text-xs text-stone-400">{t('pm:uploadMultipleFilesDesc')}</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleAddFiles(e.target.files)} />
          </div>

          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-500">{t('pm:selectedFiles')} ({uploadFiles.length})</p>
              {uploadFiles.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="text-sm text-stone-600 truncate">{f.name}</span>
                  </div>
                  <button onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== idx))} className="p-1 rounded-lg text-stone-400 hover:bg-danger-50 hover:text-danger-600 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button size="sm" className="w-full mt-2" onClick={handleUploadSubmit} disabled={uploadFiles.length === 0}>
                <Upload className="w-4 h-4" /> {t('pm:uploadDocuments')}
              </Button>
            </div>
          )}

          <div className="border-t border-stone-200 pt-4">
            <p className="text-xs text-stone-400 mb-3">{t('pm:orAddManually')}</p>
            <ManualDocForm onSave={handleDocSave} isRtl={isRtl} t={t} />
          </div>
        </div>
      </Modal>

      {/* Edit document modal */}
      <Modal open={!!editingDoc} onClose={() => setEditingDoc(null)} title={t('pm:editDocument')} className="max-w-lg">
        {editingDoc && <EditDocForm doc={editingDoc} isRtl={isRtl} t={t} onSave={handleDocSave} onCancel={() => setEditingDoc(null)} />}
      </Modal>

      {/* Delete document confirm */}
      <Modal open={!!deletingDoc} onClose={() => setDeletingDoc(null)} title={t('pm:delete')}>
        <p className="text-sm text-stone-600 mb-4">{t('pm:confirmDelete')}</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDocDelete} className="flex-1">{t('pm:delete')}</Button>
          <Button variant="outline" onClick={() => setDeletingDoc(null)}>{t('cancel')}</Button>
        </div>
      </Modal>

      {/* Rename category modal */}
      <Modal open={!!renamingCategory} onClose={() => setRenamingCategory(null)} title={t('pm:renameCategory')} className="max-w-md">
        {renamingCategory && (
          <RenameCategoryForm
            currentName={renamingCategory.name}
            currentNameEn={renamingCategory.nameEn}
            defaultName={renamingCategory.name}
            defaultNameEn={renamingCategory.nameEn}
            isRtl={isRtl}
            t={t}
            onSave={(name, nameEn) => handleCategoryRename(renamingCategory, name, nameEn)}
            onCancel={() => setRenamingCategory(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function AddCategoryForm({ isRtl, t, onSave, onCancel }: { isRtl: boolean; t: (k: string) => string; onSave: (name: string, nameEn: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:categoryName')}</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:categoryNameEn')}</label>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(name || nameEn, nameEn || name)} disabled={!name.trim() && !nameEn.trim()} className="flex-1">
          <Plus className="w-4 h-4" /> {t('pm:addCategory')}
        </Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}

function RenameCategoryForm({
  currentName, currentNameEn, defaultName, defaultNameEn, isRtl, t, onSave, onCancel,
}: {
  currentName: string; currentNameEn: string; defaultName: string; defaultNameEn: string;
  isRtl: boolean; t: (k: string) => string; onSave: (name: string, nameEn: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(currentName || defaultName);
  const [nameEn, setNameEn] = useState(currentNameEn || defaultNameEn);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:categoryName')}</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:categoryNameEn')}</label>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(name, nameEn)} className="flex-1">{t('pm:saveChanges')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}

function ManualDocForm({ onSave, isRtl, t }: { onSave: (data: Partial<ProjectDocument>, isNew: boolean) => void; isRtl: boolean; t: (k: string) => string }) {
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:documentName')} (AR)</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:documentName')} (EN)</label>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
        </div>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={!name.trim() && !nameEn.trim()}
        onClick={() => onSave({ name: name || nameEn, nameEn: nameEn || name, type: 'pdf', uploadDate: new Date().toISOString().slice(0, 10) }, true)}
      >
        <Plus className="w-4 h-4" /> {t('pm:addDocument')}
      </Button>
    </div>
  );
}

function EditDocForm({ doc, isRtl, t, onSave, onCancel }: { doc: ProjectDocument; isRtl: boolean; t: (k: string) => string; onSave: (data: Partial<ProjectDocument>, isNew: boolean) => void; onCancel: () => void }) {
  const [name, setName] = useState(doc.name);
  const [nameEn, setNameEn] = useState(doc.nameEn);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:documentName')} (AR)</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{t('pm:documentName')} (EN)</label>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ name, nameEn }, false)} className="flex-1">{t('pm:saveChanges')}</Button>
        <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </div>
  );
}
