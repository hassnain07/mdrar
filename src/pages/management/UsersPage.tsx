import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useUsers } from '@/queries/useShared';
import { usePropertyList } from '@/queries/useProperties';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/PageStates';
import { Mail, Building2 } from 'lucide-react';
import type { ManagementRole } from '@/types';

export function UsersPage() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const isRtl = ui.language === 'ar';

  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: propResult, isLoading: propLoading } = usePropertyList();
  const properties = propResult?.data ?? [];

  const roleLabel = (r: ManagementRole) => t(r === 'technician' ? 'technicianRole' : r);

  const getPropertyName = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p ? (isRtl ? p.name : p.nameEn) : id;
  };

  if (usersLoading || propLoading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('usersTitle')} subtitle={`${users.length} ${t('users')}`}>
        <button
          onClick={() => showToast(isRtl ? 'لإضافة مستخدم، استخدم لوحة Supabase → Authentication → Invite User' : 'To add a user, use Supabase Dashboard → Authentication → Invite User')}
          className="btn-outline text-sm px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
        >
          {t('addUser')}
        </button>
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
    </div>
  );
}
