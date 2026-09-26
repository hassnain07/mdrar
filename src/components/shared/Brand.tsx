import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';

export function Brand({ size = 'md', variant = 'light' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg', container: 'gap-2' },
    md: { icon: 'w-10 h-10', text: 'text-xl', container: 'gap-2.5' },
    lg: { icon: 'w-14 h-14', text: 'text-3xl', container: 'gap-3' },
  };
  const s = sizes[size];
  const textColor = variant === 'dark' ? 'text-white' : 'text-navy-800';
  const iconBg = variant === 'dark' ? 'bg-white/15' : 'bg-copper-700';

  return (
    <div className={`flex items-center ${s.container}`}>
      <div className={`${s.icon} rounded-xl overflow-hidden ${iconBg} flex items-center justify-center text-white shadow-soft`}>
        <img
          src="/assets/images/Mdrar_Company_Profile_English.jpg"
          alt="Mdrar"
          className="w-full h-full object-fill"
        />
      </div>
      <span className={`font-serif font-bold ${textColor} ${s.text}`}>{t('brand')}</span>
    </div>
  );
}
