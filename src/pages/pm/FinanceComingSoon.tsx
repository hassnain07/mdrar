import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/StoreContext';
import { useNavigate } from 'react-router-dom';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { SuiteSwitcher } from '@/components/shared/SuiteSwitcher';
import { Button } from '@/components/ui/Button';
import { TrendingUp, ArrowLeft, ArrowRight, BarChart3, DollarSign, Wallet } from 'lucide-react';

export function FinanceComingSoon() {
  const { t } = useTranslation();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const isRtl = state.language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const handleBack = () => {
    dispatch({ type: 'SET_SUITE', suite: 'hub' });
    navigate('/');
  };

  const previewCards = [
    { icon: BarChart3, label: t('pm:portfolioRevenue') },
    { icon: DollarSign, label: t('pm:projectCosts') },
    { icon: Wallet, label: t('pm:netProfit') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Brand size="sm" />
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <SuiteSwitcher />
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-2xl w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-copper-50 flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <TrendingUp className="w-10 h-10 text-copper-500" />
          </div>

          <p className="text-copper-500 font-medium text-sm tracking-wide uppercase mb-2">{t('pm:financeComingSoon')}</p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-navy-800 mb-4">{t('pm:financeComingSoonTitle')}</h1>
          <p className="text-stone-500 text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-8">
            {t('pm:financeComingSoonDesc')}
          </p>

          {/* Preview cards */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
            {previewCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-stone-200 p-4 md:p-5 opacity-50 select-none">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mb-3 mx-auto">
                    <Icon className="w-5 h-5 text-stone-400" />
                  </div>
                  <p className="text-xs md:text-sm text-stone-500 font-medium">{card.label}</p>
                  <p className="text-lg md:text-xl font-bold text-stone-300 mt-1">—</p>
                </div>
              );
            })}
          </div>

          <Button variant="outline" onClick={handleBack}>
            <BackIcon className="w-4 h-4" />
            {t('pm:backToHub')}
          </Button>
        </div>
      </div>
    </div>
  );
}
