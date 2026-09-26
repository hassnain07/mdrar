import { type ReactNode, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { useRequestList } from '@/queries/useRequests';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { LayoutDashboard, Building2, Wrench, AlertTriangle, BarChart3, Users, Settings, MessageSquare, Megaphone, Menu, X, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SuiteSwitcher } from '@/components/shared/SuiteSwitcher';

export function ManagementLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { data: reqResult } = useRequestList({});
  const emergencyCount = (reqResult?.data ?? []).filter((r) => r.type === 'emergency' && r.status !== 'resolved').length;
  const { ui } = useUi();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isRtl = ui.language === 'ar';

  const navItems = [
    { to: '/management', label: t('dashboard'), icon: LayoutDashboard },
    { to: '/management/requests', label: t('requests'), icon: Wrench },
    { to: '/management/emergency', label: t('emergency'), icon: AlertTriangle },
    { to: '/management/properties', label: t('properties'), icon: Building2 },
    { to: '/management/messages', label: isRtl ? 'الرسائل' : 'Messages', icon: MessageSquare },
    { to: '/management/announcements', label: isRtl ? 'الإعلانات' : 'Announcements', icon: Megaphone },
    { to: '/management/reports', label: t('reports'), icon: BarChart3 },
    { to: '/management/users', label: t('users'), icon: Users },
    { to: '/management/settings', label: t('settings'), icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path || (path !== '/management' && location.pathname.startsWith(path));

  const handleLogout = () => { void signOut().then(() => navigate('/', { replace: true })); };

  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-e border-stone-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-stone-200">
          <Link to="/management"><Brand size="sm" /></Link>
        </div>
        <div className="px-3 pt-3 pb-1">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-navy-700 transition-colors w-full">
            <LogOut className="w-5 h-5" />
            {t('logout')}
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(item.to) ? 'bg-copper-50 text-copper-700' : 'text-stone-500 hover:bg-stone-100 hover:text-navy-700'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
                {item.to === '/management/emergency' && emergencyCount > 0 && (
                  <span className="ms-auto w-2 h-2 rounded-full bg-danger-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-navy-900/40" onClick={() => setSidebarOpen(false)} />
          <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} bottom-0 w-64 bg-white shadow-elevated flex flex-col animate-slide-in-right`}>
            <div className="px-5 py-5 border-b border-stone-200 flex items-center justify-between">
              <Brand size="sm" />
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-stone-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pt-3 pb-1">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-100 w-full">
                <LogOut className="w-5 h-5" />
                {t('logout')}
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive(item.to) ? 'bg-copper-50 text-copper-700' : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-stone-200 bg-white sticky top-0 z-30">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="md:hidden p-2 -ms-2 rounded-lg hover:bg-stone-100" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="md:hidden"><Brand size="sm" /></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSwitcher />
              <SuiteSwitcher />
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 py-6 md:py-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
