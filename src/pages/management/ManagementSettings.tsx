import { useTranslation } from 'react-i18next';
import { useToast } from '@/state/uiStore';
import { usePreferences, useUpdatePreferences } from '@/queries/useShared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/PageStates';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import type { Preferences } from '@/types';

export function ManagementSettings() {
  const { t } = useTranslation();
  const showToast = useToast();
  const { data: prefs, isLoading } = usePreferences();
  const { mutate: updatePrefs } = useUpdatePreferences();

  const toggles: { key: keyof Preferences; label: string }[] = [
    { key: 'immediateEmergency', label: t('immediateEmergency') },
    { key: 'dailySummary', label: t('dailySummary') },
    { key: 'smsAlerts', label: t('smsAlerts') },
  ];

  const handleToggle = (key: keyof Preferences) => {
    if (!prefs) return;
    updatePrefs({ [key]: !prefs[key] }, { onSuccess: () => showToast(t('preferencesSaved')) });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="max-w-2xl animate-fade-in">
      <PageHeader title={t('settingsTitle')} />
      <Card>
        <CardBody>
          <CardTitle className="mb-4">{t('settings')}</CardTitle>
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
    </div>
  );
}
