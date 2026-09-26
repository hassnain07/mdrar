import { useTranslation } from 'react-i18next';
import { useToast } from '@/state/uiStore';
import { useUi } from '@/state/uiStore';
import { usePreferences, useUpdatePreferences } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/PageStates';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Phone, Shield } from 'lucide-react';
import type { Preferences } from '@/types';

export function TenantSettings() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const showToast = useToast();
  const { data: prefs, isLoading } = usePreferences();
  const { mutate: updatePrefs } = useUpdatePreferences();

  const toggles: { key: keyof Preferences; label: string }[] = [
    { key: 'requestUpdates', label: t('requestUpdates') },
    { key: 'announcements', label: t('announcements') },
    { key: 'rentReminders', label: t('rentReminders') },
  ];

  const handleToggle = (key: keyof Preferences) => {
    if (!prefs) return;
    updatePrefs({ [key]: !prefs[key] }, { onSuccess: () => showToast(t('preferencesSaved')) });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title={t('settings')} />
      <div className="space-y-5">
        <Card>
          <CardBody>
            <CardTitle className="mb-4">{t('settingsTitle')}</CardTitle>
            <div className="space-y-1">
              {toggles.map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-b-0">
                  <span className="text-sm text-navy-700">{toggle.label}</span>
                  <button
                    onClick={() => handleToggle(toggle.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${prefs?.[toggle.key] ? 'bg-copper-500' : 'bg-stone-300'}`}
                  >
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all" style={{ insetInlineStart: prefs?.[toggle.key] ? '2px' : '22px' }} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between py-3 border-t border-stone-100 mt-1">
              <span className="text-sm text-navy-700">{t('language')}</span>
              <LanguageSwitcher />
            </div>
          </CardBody>
        </Card>

        <Card className="border-danger-200">
          <CardBody>
            <CardTitle className="mb-3">{t('emergencyContactTitle')}</CardTitle>
            <p className="text-sm text-stone-500 mb-4">{t('emergencyContactDesc')}</p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-danger-50">
              <div className="w-10 h-10 rounded-xl bg-danger-100 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-danger-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-navy-700">{t('security')}</p>
                <p className="text-xs text-stone-500">{t('securityNumber')}</p>
              </div>
              <a href="tel:0112345678" className="w-10 h-10 rounded-xl bg-danger-500 text-white flex items-center justify-center hover:bg-danger-600 transition-colors">
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
