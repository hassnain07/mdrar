import { useTranslation } from 'react-i18next';
import { useUi } from '@/state/uiStore';
import { statusColor, typeColor, priorityColor } from '@/lib/helpers';
import { Badge } from '@/components/ui/Badge';

export function StatusBadge({ status }: { status: import('@/types').RequestStatus }) {
  const { t } = useTranslation();
  return <Badge className={statusColor(status)} dot>{t(status)}</Badge>;
}

export function TypeBadge({ type }: { type: import('@/types').RequestType }) {
  const { t } = useTranslation();
  return <Badge className={typeColor(type)}>{t(type === 'emergency' ? 'emergencyType' : type)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: 'normal' | 'high' | 'critical' }) {
  const { t } = useTranslation();
  return <Badge className={priorityColor(priority)}>{priority === 'critical' ? t('critical') : priority === 'high' ? t('high') : t('normal')}</Badge>;
}

export function EmergencyBanner() {
  const { ui } = useUi();
  const isRtl = ui.language === 'ar';
  return (
    <div className="bg-danger-50 border border-danger-100 rounded-xl px-4 py-3 flex items-center gap-2 text-danger-700">
      <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
      <span className="text-sm font-medium">
        {isRtl ? 'طلب طارئ — يحتاج إلى إجراء فوري' : 'Emergency request — immediate action required'}
      </span>
    </div>
  );
}
