import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { Languages } from 'lucide-react';

export function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { i18n } = useTranslation();
  const { ui, uiDispatch } = useUi();

  const switchTo = (lang: 'ar' | 'en') => {
    void i18n.changeLanguage(lang);
    uiDispatch({ type: 'SET_LANGUAGE', language: lang });
  };

  const active = variant === 'dark' ? 'text-white bg-white/15' : 'text-copper-600 bg-copper-50';
  const inactive = variant === 'dark' ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-stone-400 hover:text-navy-700';
  const icon = variant === 'dark' ? 'text-white/60' : 'text-stone-400';
  const sep = variant === 'dark' ? 'text-white/30' : 'text-stone-300';

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Languages className={`w-4 h-4 ${icon}`} />
      <button onClick={() => switchTo('ar')} className={`px-1.5 py-0.5 rounded-md font-medium transition-colors ${ui.language === 'ar' ? active : inactive}`}>
        العربية
      </button>
      <span className={sep}>|</span>
      <button onClick={() => switchTo('en')} className={`px-1.5 py-0.5 rounded-md font-medium transition-colors ${ui.language === 'en' ? active : inactive}`}>
        English
      </button>
    </div>
  );
}
