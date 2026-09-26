import { type ReactNode } from 'react';
import { useStore } from '@/store/StoreContext';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { Home, Wrench, MessageSquare, Phone, User, LogOut, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { SuiteSwitcher } from '@/components/shared/SuiteSwitcher';

export function TenantLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state } = useStore();
  const { signOut } = useAuth();
  const { ui } = useUi();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const isRtl = ui.language === 'ar';

  const navItems = [
    { to: '/tenant', label: t('home'), icon: Home },
    { to: '/tenant/support', label: t('maintenanceSupport'), icon: Wrench },
    { to: '/tenant/contact', label: t('contact'), icon: MessageSquare },
    { to: '/tenant/emergency', label: t('emergency'), icon: Phone },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => { void signOut().then(() => navigate('/', { replace: true })); };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ms-2 rounded-lg hover:bg-stone-100" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/tenant"><Brand size="sm" /></Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <SuiteSwitcher />
            <NotificationBell />
            <Link to="/tenant/profile" className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
              <User className="w-5 h-5 text-navy-700" />
            </Link>
            <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
              <LogOut className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:block border-t border-stone-100">
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 h-12 relative">
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-copper-200 to-transparent" />
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.to) ? 'text-copper-700 bg-copper-50' : 'text-stone-500 hover:text-navy-700 hover:bg-stone-100'
                  }`}
                >
                  {isActive(item.to) && <span className="absolute -bottom-3 inset-x-3 h-0.5 rounded-full bg-copper-600" />}
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="md:hidden fixed inset-0 z-20 animate-fade-in">
          <div className="absolute inset-0 bg-navy-900/30" onClick={() => setMobileNav(false)} />
          <div className={`absolute top-16 ${isRtl ? 'right-0' : 'left-0'} bottom-0 w-64 bg-white shadow-elevated p-4 animate-slide-in-right`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNav(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium mb-1 transition-colors ${
                    isActive(item.to) ? 'text-copper-600 bg-copper-50' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 md:py-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-30">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                  isActive(item.to) ? 'text-copper-600' : 'text-stone-400'
                }`}
              >
                {isActive(item.to) && <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-copper-600" />}
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for bottom nav */}
      <div className="md:hidden h-16" />
    </div>
  );
}
