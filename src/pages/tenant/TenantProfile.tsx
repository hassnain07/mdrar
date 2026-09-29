import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { useProperty } from '@/queries/useProperties';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Mail, MapPin, Home, LogOut, Building2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function TenantProfile() {
  const { t } = useTranslation();
  const { session, signOut, updatePassword } = useAuth();
  const { ui } = useUi();
  const showToast = useToast();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const { data: property } = useProperty(session?.tenantPropertyId ?? '');

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handlePasswordUpdate = async () => {
    setPwdError('');
    if (newPwd.length < 6) { setPwdError(isRtl ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' : 'Password must be at least 6 characters'); return; }
    if (newPwd !== confirmPwd) { setPwdError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return; }
    setPwdSaving(true);
    try {
      await updatePassword(newPwd);
      showToast(isRtl ? 'تم تحديث كلمة المرور' : 'Password updated');
      setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setPwdError((err as { message?: string })?.message ?? (isRtl ? 'تعذر تحديث كلمة المرور' : 'Could not update password'));
    } finally {
      setPwdSaving(false);
    }
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
            {property && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-navy-700">{isRtl ? property.name : property.nameEn}</span>
              </div>
            )}
            {property?.location && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-navy-700">{property.location}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors w-full justify-center mt-4"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {isRtl ? 'تغيير كلمة المرور' : 'Change Password'}
          </CardTitle>
          <div className="space-y-3">
            <input
              type="password"
              className="form-input"
              placeholder={isRtl ? 'كلمة المرور الجديدة' : 'New password'}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <input
              type="password"
              className="form-input"
              placeholder={isRtl ? 'تأكيد كلمة المرور' : 'Confirm password'}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
            {pwdError && <p className="text-sm text-danger-600">{pwdError}</p>}
            <Button onClick={handlePasswordUpdate} disabled={pwdSaving || !newPwd || !confirmPwd}>
              {pwdSaving ? '...' : (isRtl ? 'تحديث' : 'Update')}
            </Button>
          </div>
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirmLogout}
        title={isRtl ? 'تسجيل الخروج' : 'Sign Out'}
        message={isRtl ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?'}
        confirmLabel={t('logout')}
        cancelLabel={isRtl ? 'إلغاء' : 'Cancel'}
        onConfirm={() => { setConfirmLogout(false); void handleLogout(); }}
        onCancel={() => setConfirmLogout(false)}
        danger
      />
    </div>
  );
}
