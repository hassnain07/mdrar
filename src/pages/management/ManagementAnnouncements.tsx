import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useAuth } from '@/auth/AuthProvider';
import { usePropertyList } from '@/queries/useProperties';
import { useAnnouncementList, useCreateAnnouncement, useDeleteAnnouncement } from '@/queries/useAnnouncements';
import { useBilingualField } from '@/lib/useBilingualField';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton, PageError } from '@/components/ui/PageStates';
import { Megaphone, Plus, Trash2, Building2, Globe } from 'lucide-react';

export function ManagementAnnouncements() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const { session } = useAuth();
  const isRtl = ui.language === 'ar';

  const [modalOpen, setModalOpen] = useState(false);
  const title = useBilingualField();
  const body = useBilingualField();
  const [propertyId, setPropertyId] = useState<string>('all');

  const { data: announcements = [], isLoading, isError, refetch } = useAnnouncementList();
  const { data: propertiesResult } = usePropertyList();
  const { mutate: create, isPending: creating } = useCreateAnnouncement();
  const { mutate: remove } = useDeleteAnnouncement();

  const properties = propertiesResult?.data ?? [];

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError message={t('noResults')} onRetry={() => void refetch()} />;

  const resetForm = () => { title.reset(); body.reset(); setPropertyId('all'); };

  const handleCreate = () => {
    if (!title.ar.trim() || !body.ar.trim()) return;
    create(
      {
        title: title.ar.trim(),
        titleEn: title.en.trim() || title.ar.trim(),
        body: body.ar.trim(),
        bodyEn: body.en.trim() || body.ar.trim(),
        propertyId,
        createdBy: session?.name ?? '',
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          resetForm();
          showToast(isRtl ? 'تم نشر الإعلان' : 'Announcement published');
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    remove(id, { onSuccess: () => showToast(isRtl ? 'تم حذف الإعلان' : 'Announcement deleted') });
  };

  const propertyLabel = (pid: string) => {
    if (pid === 'all') return isRtl ? 'جميع العقارات' : 'All properties';
    const p = properties.find((x) => x.id === pid);
    return p ? (isRtl ? p.name : p.nameEn) : pid;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={isRtl ? 'الإعلانات' : 'Announcements'}
        subtitle={isRtl ? 'أرسل إعلانات للمستأجرين' : 'Send announcements to residents'}
      >
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          {isRtl ? 'إعلان جديد' : 'New announcement'}
        </Button>
      </PageHeader>

      {announcements.length === 0 ? (
        <Card>
          <CardBody className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-copper-50 flex items-center justify-center">
              <Megaphone className="w-7 h-7 text-copper-400" />
            </div>
            <p className="text-stone-400 text-sm">{isRtl ? 'لا توجد إعلانات بعد' : 'No announcements yet'}</p>
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" />
              {isRtl ? 'أنشئ أول إعلان' : 'Create first announcement'}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardBody className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-copper-50 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5 text-copper-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-navy-800 text-sm">{isRtl ? ann.title : ann.titleEn}</p>
                      <p className="text-sm text-stone-600 mt-1 leading-relaxed">{isRtl ? ann.body : ann.bodyEn}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="p-1.5 rounded-lg hover:bg-danger-50 text-stone-400 hover:text-danger-600 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      {ann.propertyId === 'all'
                        ? <Globe className="w-3.5 h-3.5" />
                        : <Building2 className="w-3.5 h-3.5" />}
                      {propertyLabel(ann.propertyId)}
                    </span>
                    <span>·</span>
                    <span>{ann.createdBy}</span>
                    <span>·</span>
                    <span>{new Date(ann.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-GB')}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={isRtl ? 'إعلان جديد' : 'New Announcement'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-navy-700 block mb-1">
              {isRtl ? 'العنوان (عربي)' : 'Title (Arabic)'}
            </label>
            <input className="form-input" dir="rtl" value={title.ar} onChange={(e) => title.setAr(e.target.value)} onBlur={() => void title.onArBlur()} />
          </div>
          <div>
            <label className="text-sm font-medium text-navy-700 block mb-1">
              {isRtl ? 'العنوان (إنجليزي)' : 'Title (English)'}
            </label>
            <input className="form-input" dir="ltr" value={title.en} onChange={(e) => title.setEn(e.target.value)} onBlur={() => void title.onEnBlur()} />
          </div>
          <div>
            <label className="text-sm font-medium text-navy-700 block mb-1">
              {isRtl ? 'نص الإعلان (عربي)' : 'Body (Arabic)'}
            </label>
            <textarea className="form-input min-h-[80px]" dir="rtl" value={body.ar} onChange={(e) => body.setAr(e.target.value)} onBlur={() => void body.onArBlur()} />
          </div>
          <div>
            <label className="text-sm font-medium text-navy-700 block mb-1">
              {isRtl ? 'نص الإعلان (إنجليزي)' : 'Body (English)'}
            </label>
            <textarea className="form-input min-h-[80px]" dir="ltr" value={body.en} onChange={(e) => body.setEn(e.target.value)} onBlur={() => void body.onEnBlur()} />
          </div>
          <div>
            <label className="text-sm font-medium text-navy-700 block mb-1">
              {isRtl ? 'العقار' : 'Property'}
            </label>
            <select className="form-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="all">{isRtl ? 'جميع العقارات' : 'All properties'}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{isRtl ? p.name : p.nameEn}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleCreate} disabled={creating || !title.ar.trim() || !body.ar.trim()}>
              {creating ? (isRtl ? 'جارٍ النشر...' : 'Publishing...') : (isRtl ? 'نشر الإعلان' : 'Publish')}
            </Button>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
