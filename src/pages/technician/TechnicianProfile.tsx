import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { useToast } from '@/state/uiStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Mail, Wrench, Lock } from 'lucide-react';

export function TechnicianProfile() {
  const { t } = useTranslation();
  const { session, updatePassword } = useAuth();
  const { ui } = useUi();
  const showToast = useToast();
  const isRtl = ui.language === 'ar';

  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const handlePasswordUpdate = async () => {
    setPwdError('');
    if (newPwd.length < 6) {
      setPwdError(isRtl ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setPwdSaving(true);
    try {
      await updatePassword(newPwd);
      showToast(isRtl ? 'تم تحديث كلمة المرور' : 'Password updated');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setPwdError((err as { message?: string })?.message ?? (isRtl ? 'تعذر تحديث كلمة المرور' : 'Could not update password'));
    } finally {
      setPwdSaving(false);
    }
  };

  const initial = session?.name?.slice(0, 1) ?? '?';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title={isRtl ? 'الملف الشخصي' : 'Profile'} />
      <div className="space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slateblue-100 flex items-center justify-center text-slateblue-600 font-serif text-2xl font-bold">
                {initial}
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-navy-800">{session?.name}</p>
                <p className="text-sm text-stone-500">{isRtl ? 'فني' : 'Technician'}</p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-navy-700">{session?.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-navy-700">{isRtl ? 'فني صيانة' : 'Maintenance Technician'}</span>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
              <span className="text-sm text-navy-700">{t('language')}</span>
              <LanguageSwitcher />
            </div>
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
      </div>
    </div>
  );
}
