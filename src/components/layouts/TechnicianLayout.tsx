import { type ReactNode, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { LayoutDashboard, LogOut, Menu, X, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function TechnicianLayout({ children }: { children: ReactNode }) {
  const { signOut, session } = useAuth();
  const { ui } = useUi();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const isRtl = ui.language === 'ar';

  const navItems = [
    { to: '/technician', label: isRtl ? 'طلباتي المسندة' : 'My Assigned Requests', icon: LayoutDashboard },
    { to: '/technician/profile', label: isRtl ? 'الملف الشخصي' : 'Profile', icon: UserRound },
  ];

  const isActive = (path: string) => location.pathname === path || (path !== '/technician' && location.pathname.startsWith(path));
  const handleLogout = () => { void signOut().then(() => navigate('/', { replace: true })); };

  const SidebarContent = () => (
    <>
      <div className="px-3 pt-3 pb-1">
        <p className="px-3 py-2 text-xs text-stone-400 font-medium truncate">{session?.name}</p>
        <button onClick={() => setConfirmLogout(true)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-navy-700 transition-colors w-full">
          <LogOut className="w-5 h-5" />
          {isRtl ? 'تسجيل الخروج' : 'Log out'}
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive(item.to) ? 'bg-copper-50 text-copper-700' : 'text-stone-500 hover:bg-stone-100 hover:text-navy-700'}`}>
              <Icon className="w-5 h-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-e border-stone-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-stone-200">
          <Brand size="sm" />
          <p className="text-xs text-stone-400 mt-1">{isRtl ? 'بوابة الفني' : 'Technician Portal'}</p>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-navy-900/40" onClick={() => setSidebarOpen(false)} />
          <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} bottom-0 w-64 bg-white shadow-elevated flex flex-col animate-slide-in-right`}>
            <div className="px-5 py-5 border-b border-stone-200 flex items-center justify-between">
              <Brand size="sm" />
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
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
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 py-6 md:py-8 max-w-4xl mx-auto w-full">
          {children}
        </main>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title={isRtl ? 'تسجيل الخروج' : 'Sign Out'}
        message={isRtl ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?'}
        confirmLabel={isRtl ? 'تسجيل الخروج' : 'Log out'}
        cancelLabel={isRtl ? 'إلغاء' : 'Cancel'}
        onConfirm={() => { setConfirmLogout(false); handleLogout(); }}
        onCancel={() => setConfirmLogout(false)}
        danger
      />
    </div>
  );
}
