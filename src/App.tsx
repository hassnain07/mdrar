import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UiProvider, useUi } from '@/state/uiStore';
import { AuthProvider } from '@/auth/AuthProvider';
import { ProtectedRoute, RequireRole } from '@/auth/ProtectedRoute';
import { Toast } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PageSkeleton } from '@/components/ui/PageStates';

// Layouts — small, load eagerly
import { SuiteHub } from '@/components/layouts/SuiteHub';
import { LandingPage } from '@/components/layouts/LandingPage';
import { TenantLayout } from '@/components/layouts/TenantLayout';
import { ManagementLayout } from '@/components/layouts/ManagementLayout';
import { PmLayout } from '@/components/layouts/PmLayout';
import { TechnicianLayout } from '@/components/layouts/TechnicianLayout';

// Auth pages — small, load eagerly
import { LoginPage } from '@/pages/LoginPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

// Tenant pages — lazy
const TenantHome = lazy(() => import('@/pages/tenant/TenantHome').then((m) => ({ default: m.TenantHome })));
const ResidentSupport = lazy(() => import('@/pages/tenant/ResidentSupport').then((m) => ({ default: m.ResidentSupport })));
const MyRequests = lazy(() => import('@/pages/tenant/MyRequests').then((m) => ({ default: m.MyRequests })));
const TenantRequestDetail = lazy(() => import('@/pages/tenant/TenantRequestDetail').then((m) => ({ default: m.TenantRequestDetail })));
const ContactManager = lazy(() => import('@/pages/tenant/ContactManager').then((m) => ({ default: m.ContactManager })));
const TenantSettings = lazy(() => import('@/pages/tenant/TenantSettings').then((m) => ({ default: m.TenantSettings })));
const TenantProfile = lazy(() => import('@/pages/tenant/TenantProfile').then((m) => ({ default: m.TenantProfile })));
const EmergencyContact = lazy(() => import('@/pages/tenant/EmergencyContact').then((m) => ({ default: m.EmergencyContact })));

// Management pages — lazy
const ManagementDashboard = lazy(() => import('@/pages/management/ManagementDashboard').then((m) => ({ default: m.ManagementDashboard })));
const ManagementRequests = lazy(() => import('@/pages/management/ManagementRequests').then((m) => ({ default: m.ManagementRequests })));
const ManagementRequestDetail = lazy(() => import('@/pages/management/ManagementRequestDetail').then((m) => ({ default: m.ManagementRequestDetail })));
const PropertyDetailPage = lazy(() => import('@/pages/management/PropertyDetail').then((m) => ({ default: m.PropertyDetail })));
const PropertiesListPage = lazy(() => import('@/pages/management/PropertyDetail').then((m) => ({ default: m.PropertiesList })));
const Reports = lazy(() => import('@/pages/management/Reports').then((m) => ({ default: m.Reports })));
const UsersPage = lazy(() => import('@/pages/management/UsersPage').then((m) => ({ default: m.UsersPage })));
const ManagementSettings = lazy(() => import('@/pages/management/ManagementSettings').then((m) => ({ default: m.ManagementSettings })));
const ManagementMessages = lazy(() => import('@/pages/management/ManagementMessages').then((m) => ({ default: m.ManagementMessages })));
const ManagementAnnouncements = lazy(() => import('@/pages/management/ManagementAnnouncements').then((m) => ({ default: m.ManagementAnnouncements })));

// Technician pages — lazy
const TechnicianDashboard = lazy(() => import('@/pages/technician/TechnicianDashboard').then((m) => ({ default: m.TechnicianDashboard })));
const TechnicianRequestDetail = lazy(() => import('@/pages/technician/TechnicianRequestDetail').then((m) => ({ default: m.TechnicianRequestDetail })));
const TechnicianProfile = lazy(() => import('@/pages/technician/TechnicianProfile').then((m) => ({ default: m.TechnicianProfile })));

// PM pages — lazy (heaviest bundle)
const PmDashboard = lazy(() => import('@/pages/pm/PmDashboard').then((m) => ({ default: m.PmDashboard })));
const ProjectDetail = lazy(() => import('@/pages/pm/ProjectDetail').then((m) => ({ default: m.ProjectDetail })));
const AddProject = lazy(() => import('@/pages/pm/AddProject').then((m) => ({ default: m.AddProject })));
const FinanceComingSoon = lazy(() => import('@/pages/pm/FinanceComingSoon').then((m) => ({ default: m.FinanceComingSoon })));
const PmProfile = lazy(() => import('@/pages/pm/PmProfile').then((m) => ({ default: m.PmProfile })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function LanguageSync() {
  const { ui } = useUi();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (i18n.language !== ui.language) void i18n.changeLanguage(ui.language);
    document.documentElement.lang = ui.language;
    document.documentElement.dir = ui.language === 'ar' ? 'rtl' : 'ltr';
  }, [ui.language, i18n]);
  return null;
}

function RouteSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
      {children}
    </Suspense>
  );
}

function AppRoutes() {
  const { ui } = useUi();
  return (
    <>
      <LanguageSync />
      <Routes>
        {/* Public */}
        <Route path="/" element={<SuiteHub />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/facility" element={<LandingPage />} />

        {/* Tenant routes */}
        <Route path="/tenant" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><TenantHome /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/support" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><ResidentSupport /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/requests" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><MyRequests /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/request/:id" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><TenantRequestDetail /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/contact" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><ContactManager /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/settings" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><TenantSettings /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/profile" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><TenantProfile /></RouteSuspense></TenantLayout></RequireRole>} />
        <Route path="/tenant/emergency" element={<RequireRole roles={['tenant']}><TenantLayout><RouteSuspense><EmergencyContact /></RouteSuspense></TenantLayout></RequireRole>} />

        {/* Management routes */}
        <Route path="/management" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementDashboard /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/requests" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementRequests /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/emergency" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementRequests emergencyOnly /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/request/:id" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementRequestDetail /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/properties" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><PropertiesListPage /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/property/:id" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><PropertyDetailPage /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/reports" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><Reports /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/users" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><UsersPage /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/settings" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementSettings /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/messages" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementMessages /></RouteSuspense></ManagementLayout></RequireRole>} />
        <Route path="/management/announcements" element={<RequireRole roles={['management']}><ManagementLayout><RouteSuspense><ManagementAnnouncements /></RouteSuspense></ManagementLayout></RequireRole>} />

        {/* PM routes */}
        <Route path="/pm" element={<RequireRole roles={['pm_manager', 'pm_viewer', 'management']}><Navigate to="/pm/dashboard" replace /></RequireRole>} />
        <Route path="/pm/dashboard" element={<RequireRole roles={['pm_manager', 'pm_viewer', 'management']}><PmLayout><RouteSuspense><PmDashboard /></RouteSuspense></PmLayout></RequireRole>} />
        <Route path="/pm/project/:id" element={<RequireRole roles={['pm_manager', 'pm_viewer', 'management']}><PmLayout><RouteSuspense><ProjectDetail /></RouteSuspense></PmLayout></RequireRole>} />
        <Route path="/pm/add-project" element={<RequireRole roles={['pm_manager', 'management']}><PmLayout><RouteSuspense><AddProject /></RouteSuspense></PmLayout></RequireRole>} />
        <Route path="/pm/profile" element={<RequireRole roles={['pm_manager', 'pm_viewer', 'management']}><PmLayout><RouteSuspense><PmProfile /></RouteSuspense></PmLayout></RequireRole>} />

        {/* Technician routes */}
        <Route path="/technician" element={<RequireRole roles={['technician']}><TechnicianLayout><RouteSuspense><TechnicianDashboard /></RouteSuspense></TechnicianLayout></RequireRole>} />
        <Route path="/technician/request/:id" element={<RequireRole roles={['technician']}><TechnicianLayout><RouteSuspense><TechnicianRequestDetail /></RouteSuspense></TechnicianLayout></RequireRole>} />
        <Route path="/technician/profile" element={<RequireRole roles={['technician']}><TechnicianLayout><RouteSuspense><TechnicianProfile /></RouteSuspense></TechnicianLayout></RequireRole>} />

        <Route path="/finance" element={<RouteSuspense><FinanceComingSoon /></RouteSuspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UiProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </UiProvider>
    </QueryClientProvider>
  );
}

export default App;
