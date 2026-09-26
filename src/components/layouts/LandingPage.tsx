import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useNavigate } from 'react-router-dom';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Building2, Home, Wrench, ArrowRight, ArrowLeft } from 'lucide-react';

export function LandingPage() {
  const { t } = useTranslation();
  const { ui } = useUi();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const selectRole = (role: 'tenant' | 'management' | 'technician') => {
    navigate('/login', { state: { portal: role } });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Brand size="md" />
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 md:py-20">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-10 md:mb-14 animate-slide-up">
            <p className="text-copper-500 font-medium text-sm tracking-wide uppercase mb-3">{t('tagline')}</p>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-navy-800 leading-tight">
              {t('welcome')}
            </h1>
            <p className="text-stone-500 mt-4 text-base md:text-lg max-w-xl mx-auto">
              {t('choosePortal')}
            </p>
          </div>

          {/* Role cards */}
          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            {/* Management */}
            <button
              onClick={() => selectRole('management')}
              className="group bg-white rounded-2xl border border-stone-200 shadow-soft p-7 md:p-8 text-start transition-all duration-300 hover:shadow-elevated hover:border-copper-300 hover:-translate-y-0.5 animate-slide-up"
            >
              <div className="w-14 h-14 rounded-2xl bg-copper-50 flex items-center justify-center mb-5 group-hover:bg-copper-100 transition-colors">
                <Building2 className="w-7 h-7 text-copper-600" />
              </div>
              <h2 className="font-serif text-xl md:text-2xl font-semibold text-navy-800 mb-2">
                {t('managementPortal')}
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-5">
                {t('managementDesc')}
              </p>
              <span className="inline-flex items-center gap-2 text-copper-600 font-medium text-sm group-hover:gap-3 transition-all">
                {t('enterPortal')}
                <Arrow className="w-4 h-4" />
              </span>
            </button>

            {/* Tenant */}
            <button
              onClick={() => selectRole('tenant')}
              className="group bg-white rounded-2xl border border-stone-200 shadow-soft p-7 md:p-8 text-start transition-all duration-300 hover:shadow-elevated hover:border-slateblue-300 hover:-translate-y-0.5 animate-slide-up"
              style={{ animationDelay: '0.05s' }}
            >
              <div className="w-14 h-14 rounded-2xl bg-slateblue-50 flex items-center justify-center mb-5 group-hover:bg-slateblue-100 transition-colors">
                <Home className="w-7 h-7 text-slateblue-500" />
              </div>
              <h2 className="font-serif text-xl md:text-2xl font-semibold text-navy-800 mb-2">
                {t('tenantPortal')}
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-5">
                {t('tenantDesc')}
              </p>
              <span className="inline-flex items-center gap-2 text-slateblue-500 font-medium text-sm group-hover:gap-3 transition-all">
                {t('enterPortal')}
                <Arrow className="w-4 h-4" />
              </span>
            </button>

            {/* Technician */}
            <button
              onClick={() => selectRole('technician')}
              className="group bg-white rounded-2xl border border-stone-200 shadow-soft p-7 md:p-8 text-start transition-all duration-300 hover:shadow-elevated hover:border-success-300 hover:-translate-y-0.5 animate-slide-up"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="w-14 h-14 rounded-2xl bg-success-50 flex items-center justify-center mb-5 group-hover:bg-success-100 transition-colors">
                <Wrench className="w-7 h-7 text-success-600" />
              </div>
              <h2 className="font-serif text-xl md:text-2xl font-semibold text-navy-800 mb-2">
                {isRtl ? 'بوابة الفني' : 'Technician Portal'}
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-5">
                {isRtl ? 'عرض الطلبات المسندة إليك وتحديث حالتها' : 'View your assigned requests and update their status'}
              </p>
              <span className="inline-flex items-center gap-2 text-success-600 font-medium text-sm group-hover:gap-3 transition-all">
                {t('enterPortal')}
                <Arrow className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-stone-400 text-xs">
          {isRtl ? 'نموذج بواسطة كود كلُب (codeclub.tech)' : 'A PROTOTYPE BY CODE CLUB (codeclub.tech)'}
        </div>
      </footer>
    </div>
  );
}
