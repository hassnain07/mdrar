import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useNavigate } from 'react-router-dom';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Building2, HardHat, ArrowRight, ArrowLeft } from 'lucide-react';

export function SuiteHub() {
  const { t } = useTranslation();
  const { ui, uiDispatch } = useUi();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const goFM = () => { uiDispatch({ type: 'SET_SUITE', suite: 'fm' }); navigate('/facility'); };
  const goPM = () => { uiDispatch({ type: 'SET_SUITE', suite: 'pm' }); navigate('/login', { state: { portal: 'pm' } }); };
  const cards = [
    {
      icon: Building2,
      title: t('pm:facilityManagement'),
      desc: t('pm:facilityManagementDesc'),
      onClick: goFM,
      accent: 'copper',
    },
    {
      icon: HardHat,
      title: t('pm:projectManagement'),
      desc: t('pm:projectManagementDesc'),
      onClick: goPM,
      accent: 'slateblue',
    },
  ];

  const accentClasses: Record<string, { bg: string; icon: string; hover: string; text: string }> = {
    copper: { bg: 'bg-copper-50', icon: 'text-copper-700', hover: 'hover:border-copper-400', text: 'text-copper-700' },
    slateblue: { bg: 'bg-powderblue-100', icon: 'text-navy-600', hover: 'hover:border-navy-300', text: 'text-navy-600' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      <header className="border-b border-stone-300 bg-copper-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Brand size="md" variant="dark" />
          <LanguageSwitcher variant="dark" />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 md:py-20">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-10 md:mb-14 animate-slide-up">
            <p className="text-copper-600 font-medium text-sm tracking-wide uppercase mb-3">{t('tagline')}</p>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-navy-800 leading-tight">
              {t('pm:suiteHub')}
            </h1>
            <p className="text-stone-600 mt-4 text-base md:text-lg max-w-2xl mx-auto">
              {t('pm:suiteHubSub')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 md:gap-6 max-w-3xl mx-auto">
            {cards.map((card, i) => {
              const Icon = card.icon;
              const ac = accentClasses[card.accent];
              return (
                <button
                  key={i}
                  onClick={card.onClick}
                  className={`group bg-white rounded-2xl border border-stone-200 shadow-soft p-7 md:p-8 text-start transition-all duration-300 hover:shadow-elevated ${ac.hover} hover:-translate-y-0.5 animate-slide-up`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className={`w-14 h-14 rounded-2xl ${ac.bg} flex items-center justify-center mb-5 group-hover:opacity-80 transition-opacity`}>
                    <Icon className={`w-7 h-7 ${ac.icon}`} />
                  </div>
                  <h2 className="font-serif text-xl md:text-2xl font-semibold text-navy-800 mb-2">
                    {card.title}
                  </h2>
                  <p className="text-stone-500 text-sm leading-relaxed mb-5">
                    {card.desc}
                  </p>
                  <span className={`inline-flex items-center gap-2 ${ac.text} font-medium text-sm group-hover:gap-3 transition-all`}>
                    {t('pm:enterModule')}
                    <Arrow className="w-4 h-4" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="border-t border-stone-300 py-6 bg-copper-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-copper-100 text-xs">
          {isRtl ? 'نموذج بواسطة كود كلُب (codeclub.tech)' : 'A PROTOTYPE BY CODE CLUB (codeclub.tech)'}
        </div>
      </footer>
    </div>
  );
}
