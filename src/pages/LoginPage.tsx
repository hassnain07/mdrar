import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { Brand } from '@/components/shared/Brand';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { Building2, Home, HardHat, Wrench } from 'lucide-react';

type Portal = 'management' | 'tenant' | 'pm' | 'technician';

const HINTS: Record<Portal, { email: string; password: string }> = {
  management: { email: 'khalid@mdrar.sa', password: 'password' },
  tenant:     { email: 'm.alotaibi@example.com', password: 'password' },
  pm:         { email: 'pm@mdrar.sa', password: 'password' },
  technician: { email: 'salem@mdrar.sa', password: 'password' },
};

const ROLE_DEST: Record<string, string> = {
  management:  '/management',
  tenant:      '/tenant',
  pm_manager:  '/pm/dashboard',
  pm_viewer:   '/pm/dashboard',
  technician:  '/technician',
};

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { ui } = useUi();
  const navigate = useNavigate();
  const location = useLocation();
  const isRtl = ui.language === 'ar';

  const locationState = location.state as { from?: { pathname: string }; portal?: Portal } | null;
  const incomingPortal = locationState?.portal ?? null;
  const from = locationState?.from?.pathname ?? null;

  const [portal, setPortal] = useState<Portal | null>(incomingPortal);
  const [email, setEmail]     = useState(incomingPortal ? HINTS[incomingPortal].email : '');
  const [password, setPassword] = useState(incomingPortal ? HINTS[incomingPortal].password : '');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const selectPortal = (p: Portal) => {
    setPortal(p);
    setEmail(HINTS[p].email);
    setPassword(HINTS[p].password);
    setError('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const s = await signIn(email, password);
      const dest = from ?? ROLE_DEST[s.role] ?? '/';
      navigate(dest, { replace: true });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? (isRtl ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  const portals = [
    { key: 'management' as Portal, icon: Building2, title: t('managementPortal'), desc: t('managementDesc'), accent: 'copper' },
    { key: 'tenant'     as Portal, icon: Home,      title: t('tenantPortal'),     desc: t('tenantDesc'),     accent: 'slateblue' },
    { key: 'pm'         as Portal, icon: HardHat,   title: t('pm:projectManagement'), desc: t('pm:projectManagementDesc'), accent: 'navy' },
    { key: 'technician' as Portal, icon: Wrench,    title: isRtl ? 'بوابة الفني' : 'Technician Portal', desc: isRtl ? 'عرض الطلبات المسندة وتحديث حالتها' : 'View assigned requests and update their status', accent: 'green' },
  ];

  const accentMap: Record<string, { bg: string; border: string; icon: string }> = {
    copper:    { bg: 'bg-copper-50',     border: 'hover:border-copper-400', icon: 'text-copper-600' },
    slateblue: { bg: 'bg-powderblue-50', border: 'hover:border-navy-300',   icon: 'text-navy-600' },
    navy:      { bg: 'bg-navy-50',       border: 'hover:border-navy-400',   icon: 'text-navy-700' },
    green:     { bg: 'bg-success-50',    border: 'hover:border-success-400', icon: 'text-success-600' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Brand size="md" />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl w-full">
          {!portal ? (
            <>
              <div className="text-center mb-10">
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-navy-800">{t('welcome')}</h1>
                <p className="text-stone-500 mt-3">{t('choosePortal')}</p>
              </div>
              <div className="grid md:grid-cols-4 gap-5">
                {portals.map((p) => {
                  const Icon = p.icon;
                  const ac = accentMap[p.accent];
                  return (
                    <button
                      key={p.key}
                      onClick={() => selectPortal(p.key)}
                      className={`group bg-white rounded-2xl border border-stone-200 shadow-soft p-7 text-start transition-all hover:shadow-elevated ${ac.border} hover:-translate-y-0.5`}
                    >
                      <div className={`w-12 h-12 rounded-xl ${ac.bg} flex items-center justify-center mb-4`}>
                        <Icon className={`w-6 h-6 ${ac.icon}`} />
                      </div>
                      <h2 className="font-serif text-lg font-semibold text-navy-800 mb-1">{p.title}</h2>
                      <p className="text-stone-500 text-sm">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="max-w-md mx-auto">
              <button onClick={() => setPortal(null)} className="text-sm text-stone-500 hover:text-navy-700 mb-6 inline-flex items-center gap-1">
                ← {isRtl ? 'رجوع' : 'Back'}
              </button>
              <div className="bg-white rounded-2xl border border-stone-200 shadow-soft p-8">
                <h2 className="font-serif text-2xl font-semibold text-navy-800 mb-1">
                  {portals.find((p) => p.key === portal)?.title}
                </h2>
                <p className="text-xs text-stone-400 mb-6">
                  {isRtl ? 'كلمة المرور التجريبية: password' : 'Demo password: password'}
                </p>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-navy-700 block mb-1">
                      {isRtl ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-navy-700 block mb-1">
                      {isRtl ? 'كلمة المرور' : 'Password'}
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-danger-600">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (isRtl ? 'جارٍ الدخول...' : 'Signing in...') : (isRtl ? 'دخول' : 'Sign In')}
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-stone-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-stone-400 text-xs">
          {isRtl ? 'نموذج بواسطة كود كلُب (codeclub.tech)' : 'A PROTOTYPE BY CODE CLUB (codeclub.tech)'}
        </div>
      </footer>
    </div>
  );
}
