import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useUi } from '@/state/uiStore';
import { Button } from '@/components/ui/Button';
import { ShieldOff } from 'lucide-react';

export function UnauthorizedPage() {
  const { signOut } = useAuth();
  const { ui } = useUi();
  const navigate = useNavigate();
  const isRtl = ui.language === 'ar';

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-danger-50 flex items-center justify-center mx-auto mb-4">
          <ShieldOff className="w-8 h-8 text-danger-600" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-navy-800 mb-2">
          {isRtl ? 'غير مصرح' : 'Unauthorized'}
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          {isRtl ? 'ليس لديك صلاحية للوصول إلى هذه الصفحة.' : "You don't have permission to access this page."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/')}>
            {isRtl ? 'الرئيسية' : 'Home'}
          </Button>
          <Button variant="danger" onClick={() => { void signOut(); navigate('/login'); }}>
            {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
        </div>
      </div>
    </div>
  );
}
