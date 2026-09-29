import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUi } from '@/state/uiStore';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, children }: PageHeaderProps) {
  const { ui } = useUi();
  const isRtl = ui.language === 'ar';
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  return (
    <div className="mb-6">
      {backTo && (
        <a
          href={backTo}
          onClick={(e) => {
            e.preventDefault();
            window.history.back();
          }}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-navy-700 transition-colors mb-3"
        >
          <BackIcon className="w-4 h-4" />
          <span>{isRtl ? 'رجوع' : 'Back'}</span>
        </a>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-semibold text-navy-800">{title}</h1>
          {subtitle && <p className="text-stone-500 mt-1 text-sm md:text-base">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
    </div>
  );
}
