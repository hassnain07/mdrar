import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useUsers, useCreateUser } from '@/queries/useShared';
import { usePropertyList } from '@/queries/useProperties';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/PageStates';
import { Mail, Building2, Copy, Check } from 'lucide-react';
import type { ManagementRole } from '@/types';

function genPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function UsersPage() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const isRtl = ui.language === 'ar';

  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: propResult, isLoading: propLoading } = usePropertyList();
  const properties = propResult?.data ?? [];
  const { mutateAsync: createUser, isPending } = useCreateUser();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ManagementRole>('owner');;
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [createdPassword, setCreatedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const roleLabel = (r: ManagementRole) => {
    if (r === 'technician') return isRtl ? 'فني' : 'Technician';
    if (r === 'owner') return isRtl ? 'مالك' : 'Owner';
    if (r === 'pm_manager') return isRtl ? 'مدير مشروع' : 'Project Manager';
    if (r === 'super_admin') return isRtl ? 'مدير النظام' : 'Super Admin';
    if (r === 'facility_manager') return isRtl ? 'مدير المرفق' : 'Facility Manager';
    return r;
  };

  const getPropertyName = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p ? (isRtl ? p.name : p.nameEn) : id;
  };

  const toggleProp = (id: string) =>
    setSelectedProps((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const resetForm = () => { setName(''); setEmail(''); setRole('facility_manager'); setSelectedProps([]); setCreatedPassword(''); setCopied(false); };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) return;
    const password = genPassword();
    try {
      await createUser({ name: name.trim(), email: email.trim(), role, properties: selectedProps, propertyIds: selectedProps, password });
      setCreatedPassword(password);
    } catch (err) {
      showToast((err as { message?: string })?.message ?? (isRtl ? 'تعذر إنشاء المستخدم' : 'Could not create user'));
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(createdPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (usersLoading || propLoading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('usersTitle')} subtitle={`${users.length} ${t('users')}`}>
        <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>
          {t('addUser')}
        </Button>
      </PageHeader>

      <Card>
        <CardBody className="p-0 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-start p-4 text-xs font-medium text-stone-400">{t('name')}</th>
                  <th className="text-start p-4 text-xs font-medium text-stone-400">{t('email')}</th>
                  <th className="text-start p-4 text-xs font-medium text-stone-400">{t('role')}</th>
                  <th className="text-start p-4 text-xs font-medium text-stone-400">{t('assignedProperties')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-stone-100 last:border-b-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slateblue-100 flex items-center justify-center text-xs font-semibold text-slateblue-600">{u.name.slice(0, 1)}</div>
                        <span className="text-sm font-medium text-navy-700">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-stone-500">{u.email}</td>
                    <td className="p-4"><Badge className="bg-stone-100 text-stone-700 border-stone-300">{roleLabel(u.role)}</Badge></td>
                    <td className="p-4 text-sm text-stone-500">
                      {u.properties.length === 0 ? t('allProperties') : u.properties.map(getPropertyName).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-stone-100">
            {users.map((u) => (
              <div key={u.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slateblue-100 flex items-center justify-center text-xs font-semibold text-slateblue-600">{u.name.slice(0, 1)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-700 truncate">{u.name}</p>
                    <p className="text-xs text-stone-400 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                  </div>
                  <Badge className="bg-stone-100 text-stone-700 border-stone-300">{roleLabel(u.role)}</Badge>
                </div>
                <p className="text-xs text-stone-500 mt-3 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {u.properties.length === 0 ? t('allProperties') : u.properties.map(getPropertyName).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title={isRtl ? 'إضافة مستخدم جديد' : 'Add New User'} className="max-w-lg">
        {createdPassword ? (
          <div className="space-y-4">
            <div className="bg-success-50 border border-success-200 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-success-700 mb-1">{isRtl ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully'}</p>
              <p className="text-xs text-success-600">{isRtl ? 'شارك كلمة المرور المؤقتة بشكل آمن مع المستخدم الجديد' : 'Share this temporary password securely with the new user'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">{isRtl ? 'كلمة المرور المؤقتة' : 'Temporary Password'}</p>
              <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <code className="flex-1 text-sm font-mono text-navy-800 tracking-wider">{createdPassword}</code>
                <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors text-stone-500">
                  {copied ? <Check className="w-4 h-4 text-success-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-1">{isRtl ? 'يجب على المستخدم تغييرها بعد أول تسجيل دخول' : 'The user should change this after their first sign-in'}</p>
            </div>
            <Button className="w-full" onClick={() => { setOpen(false); resetForm(); showToast(isRtl ? 'تمت إضافة المستخدم' : 'User added'); }}>
              {isRtl ? 'تم' : 'Done'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'الاسم الكامل' : 'Full Name'} *</label>
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">{isRtl ? 'البريد الإلكتروني' : 'Email'} *</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">{t('role')}</label>
              <select className="form-input" value={role} onChange={(e) => setRole(e.target.value as ManagementRole)}>
                <option value="owner">{isRtl ? 'مالك' : 'Owner'}</option>
                <option value="technician">{isRtl ? 'فني' : 'Technician'}</option>
                <option value="pm_manager">{isRtl ? 'مدير مشروع' : 'Project Manager'}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-2 block">{t('assignedProperties')}</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {properties.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs text-navy-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProps.includes(p.id)}
                      onChange={() => toggleProp(p.id)}
                      className="rounded"
                    />
                    {isRtl ? p.name : p.nameEn}
                  </label>
                ))}
              </div>
              <p className="text-xs text-stone-400 mt-1">{isRtl ? 'اتركه فارغاً للوصول لجميع العقارات' : 'Leave empty for access to all properties'}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleCreate} disabled={isPending || !name.trim() || !email.trim()}>
                {isPending ? '...' : (isRtl ? 'إنشاء الحساب' : 'Create Account')}
              </Button>
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
