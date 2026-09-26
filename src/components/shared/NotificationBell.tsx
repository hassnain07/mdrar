import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNotifications, useMarkNotificationsRead,
  useTenantNotifications, useMarkTenantNotificationsRead,
  notificationKeys, tenantNotifKeys,
} from '@/queries/useShared';
import { Bell, AlertTriangle, Check } from 'lucide-react';

export function NotificationBell() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isTenant = session?.role === 'tenant';
  const tenantEmail = session?.email ?? '';

  const mgmtQuery = useNotifications();
  const tenantQuery = useTenantNotifications(isTenant ? tenantEmail : '');
  const { mutate: markMgmtRead } = useMarkNotificationsRead();
  const { mutate: markTenantRead } = useMarkTenantNotificationsRead(tenantEmail);

  const notifications = isTenant ? (tenantQuery.data ?? []) : (mgmtQuery.data ?? []);
  const unread = notifications.filter((n) => !n.read).length;

  const qc = useQueryClient();
  useEffect(() => {
    if (!session || import.meta.env.VITE_DATA_SOURCE !== 'supabase') return;
    let channel: ReturnType<typeof import('@/data/client/supabase/client').supabase.channel> | null = null;
    import('@/data/client/supabase/client').then(({ supabase }) => {
      channel = supabase
        .channel(`notifications:${session.userId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `recipient_id=eq.${session.userId}`,
        }, () => {
          if (isTenant) qc.invalidateQueries({ queryKey: tenantNotifKeys.forTenant(tenantEmail) });
          else qc.invalidateQueries({ queryKey: notificationKeys.all });
        })
        .subscribe();
    });
    return () => { if (channel) import('@/data/client/supabase/client').then(({ supabase }) => supabase.removeChannel(channel!)); };
  }, [session, qc, isTenant, tenantEmail]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unread > 0) {
      if (isTenant) markTenantRead();
      else markMgmtRead();
    }
  };

  const handleMarkAll = () => {
    if (isTenant) markTenantRead();
    else markMgmtRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative p-2 rounded-xl hover:bg-stone-100 transition-colors">
        <Bell className="w-5 h-5 text-navy-700" />
        {unread > 0 && (
          <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-copper-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-2 w-[calc(100vw-2rem)] max-w-sm md:w-80 bg-white rounded-2xl border border-stone-200 shadow-elevated z-50 animate-scale-in overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-navy-800">{t('notifications')}</h3>
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-copper-600 hover:text-copper-700 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {t('markAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-stone-400 text-sm">{t('noNotifications')}</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-stone-100 last:border-b-0 ${!n.read ? 'bg-copper-50/40' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 p-1.5 rounded-lg ${n.emergency ? 'bg-danger-100' : 'bg-stone-100'}`}>
                        {n.emergency ? <AlertTriangle className="w-3.5 h-3.5 text-danger-600" /> : <Bell className="w-3.5 h-3.5 text-stone-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-800">{n.title}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{n.body}</p>
                        <p className="text-[11px] text-stone-400 mt-1">{n.time}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-copper-500 mt-1.5 shrink-0" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
