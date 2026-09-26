import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { useNavigate } from 'react-router-dom';
import { Grid, ChevronDown, Building2, HardHat, Home } from 'lucide-react';

export function SuiteSwitcher() {
  const { t } = useTranslation();
  const { uiDispatch } = useUi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const go = (path: string, suite: 'hub' | 'fm' | 'pm') => {
    uiDispatch({ type: 'SET_SUITE', suite });
    navigate(path);
    setOpen(false);
  };

  const items = [
    { icon: Home, label: t('pm:hub'), onClick: () => go('/', 'hub') },
    { icon: Building2, label: t('pm:facilityManagement'), onClick: () => go('/facility', 'fm') },
    { icon: HardHat, label: t('pm:projectManagement'), onClick: () => go('/pm', 'pm') },
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 p-2 rounded-xl hover:bg-stone-100 transition-colors text-navy-700" title={t('pm:suiteSwitcher')}>
        <Grid className="w-5 h-5" />
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-2 w-56 bg-white rounded-2xl border border-stone-200 shadow-elevated z-50 animate-scale-in overflow-hidden">
            <div className="px-4 py-2.5 border-b border-stone-100">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">{t('pm:suiteSwitcher')}</p>
            </div>
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button key={i} onClick={item.onClick} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-stone-50 transition-colors text-start">
                  <Icon className="w-4 h-4 text-stone-400" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
