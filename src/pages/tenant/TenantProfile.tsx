import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Mail, MapPin, Home, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TenantProfile() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const { ui } = useUi();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const initial = session?.name?.slice(0, 1) ?? '?';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title={t('profile')} />
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-copper-100 flex items-center justify-center text-copper-600 font-serif text-2xl font-bold">
              {initial}
            </div>
            <div>
              <p className="font-serif text-lg font-semibold text-navy-800">{session?.name}</p>
              <p className="text-sm text-stone-500">{isRtl ? 'مستأجر' : 'Resident'}</p>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-stone-400" />
              <span className="text-sm text-navy-700">{session?.email}</span>
            </div>
            {session?.tenantUnit && (
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-navy-700">{isRtl ? `الوحدة ${session.tenantUnit}` : `Unit ${session.tenantUnit}`}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-stone-400" />
              <span className="text-sm text-navy-700">{isRtl ? 'الرياض' : 'Riyadh'}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors w-full justify-center mt-4"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
