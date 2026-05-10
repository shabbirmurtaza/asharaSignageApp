import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { LoginPage } from '@/pages/Login';
import { SignupPage } from '@/pages/Signup';
import { Stub } from '@/pages/Stub';
import { AdminEventsPage } from '@/pages/admin/Events';
import { AdminVenuesPage } from '@/pages/admin/Venues';
import { AdminDepartmentsPage } from '@/pages/admin/Departments';
import { AdminSizesPage } from '@/pages/admin/Sizes';
import { AdminUsersPage } from '@/pages/admin/Users';
import { AdminUserDetailPage } from '@/pages/admin/UserDetail';
import { AdminSignupApprovalsPage } from '@/pages/admin/SignupApprovals';
import { HodDashboardPage } from '@/pages/hod/Dashboard';
import { HodApprovalsPage } from '@/pages/hod/Approvals';
import { ProductionPipelinePage } from '@/pages/production/Pipeline';
import { MyRequestsPage } from '@/pages/department/MyRequests';
import { NewRequestPage } from '@/pages/department/NewRequest';
import { RequestDetailPage } from '@/pages/department/RequestDetail';
import { SignLibraryPage } from '@/pages/library/SignLibrary';
import { SignDetailPage } from '@/pages/library/SignDetail';
import { LibrarySignNewPage } from '@/pages/library/SignNew';
import { useAuth } from '@/lib/auth';
import { defaultRouteForRole } from '@/lib/rbac';

const HomeRedirect = () => {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteForRole(session.primaryRole)} replace />;
};

const Shell = ({ children }: { children: ReactNode }) => (
  <AppShell>{children}</AppShell>
);

export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />

    <Route path="/" element={<HomeRedirect />} />

    {/* super_admin */}
    <Route path="/admin/events" element={<RequireAuth allow={['super_admin']}><Shell><AdminEventsPage /></Shell></RequireAuth>} />
    <Route path="/admin/venues" element={<RequireAuth allow={['super_admin']}><Shell><AdminVenuesPage /></Shell></RequireAuth>} />
    <Route path="/admin/departments" element={<RequireAuth allow={['super_admin']}><Shell><AdminDepartmentsPage /></Shell></RequireAuth>} />
    <Route path="/admin/sizes" element={<RequireAuth allow={['super_admin']}><Shell><AdminSizesPage /></Shell></RequireAuth>} />
    <Route path="/admin/users" element={<RequireAuth allow={['super_admin']}><Shell><AdminUsersPage /></Shell></RequireAuth>} />
    <Route path="/admin/users/approvals" element={<RequireAuth allow={['super_admin']}><Shell><AdminSignupApprovalsPage /></Shell></RequireAuth>} />
    <Route path="/admin/users/:id" element={<RequireAuth allow={['super_admin']}><Shell><AdminUserDetailPage /></Shell></RequireAuth>} />

    {/* signage_hod */}
    <Route path="/hod/dashboard" element={<RequireAuth allow={['signage_hod']}><Shell><HodDashboardPage /></Shell></RequireAuth>} />
    <Route path="/hod/approvals" element={<RequireAuth allow={['signage_hod']}><Shell><HodApprovalsPage /></Shell></RequireAuth>} />

    {/* signage_production */}
    <Route path="/production/pipeline" element={<RequireAuth allow={['signage_production', 'super_admin']}><Shell><ProductionPipelinePage /></Shell></RequireAuth>} />

    {/* department_user */}
    <Route path="/my/requests" element={<RequireAuth allow={['department_user']}><Shell><MyRequestsPage /></Shell></RequireAuth>} />
    <Route path="/my/requests/new" element={<RequireAuth allow={['department_user']}><Shell><NewRequestPage /></Shell></RequireAuth>} />
    <Route path="/my/requests/:id" element={<RequireAuth allow={['department_user']}><Shell><RequestDetailPage /></Shell></RequireAuth>} />

    {/* library — any authenticated; /library/new before /library/:id */}
    <Route path="/library" element={<RequireAuth><Shell><SignLibraryPage /></Shell></RequireAuth>} />
    <Route path="/library/new" element={<RequireAuth allow={['signage_hod', 'super_admin', 'department_user']}><Shell><LibrarySignNewPage /></Shell></RequireAuth>} />
    <Route path="/library/:id" element={<RequireAuth><Shell><SignDetailPage /></Shell></RequireAuth>} />

    <Route path="*" element={<HomeRedirect />} />
  </Routes>
);

// Stub kept imported for legacy fallback if needed
void Stub;
