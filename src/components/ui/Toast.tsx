import { useUi } from '@/state/uiStore';
import { CheckCircle2 } from 'lucide-react';

export function Toast() {
  const { ui } = useUi();
  if (!ui.toast) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-toast">
      <div className="flex items-center gap-3 bg-navy-800 text-white px-5 py-3 rounded-xl shadow-elevated">
        <CheckCircle2 className="w-5 h-5 text-success-500" />
        <span className="text-sm font-medium">{ui.toast}</span>
      </div>
    </div>
  );
}
