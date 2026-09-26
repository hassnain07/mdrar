import { useTranslation } from 'react-i18next';
import { useStore } from '@/store/StoreContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Phone, Shield, AlertTriangle } from 'lucide-react';

export function EmergencyContact() {
  const { t } = useTranslation();
  const { state } = useStore();
  const isRtl = state.language === 'ar';

  const contacts = [
    { label: t('security'), number: '011 234 5678', icon: Shield, color: 'text-danger-600 bg-danger-50' },
    { label: isRtl ? 'الصيانة الطارئة' : 'Emergency Maintenance', number: '055 123 4567', icon: AlertTriangle, color: 'text-copper-600 bg-copper-50' },
    { label: isRtl ? 'الإدارة' : 'Management', number: '011 234 5679', icon: Phone, color: 'text-slateblue-500 bg-slateblue-50' },
  ];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader title={t('emergency')} subtitle={t('emergencyContactDesc')} />

      <div className="space-y-3">
        {contacts.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardBody className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-800 text-sm">{c.label}</p>
                  <p className="text-sm text-stone-500" dir="ltr">{c.number}</p>
                </div>
                <a href={`tel:${c.number.replace(/\s/g, '')}`} className="w-10 h-10 rounded-xl bg-copper-500 text-white flex items-center justify-center hover:bg-copper-600 transition-colors shrink-0">
                  <Phone className="w-5 h-5" />
                </a>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
