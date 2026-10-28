import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ServerCrash, ShieldAlert } from 'lucide-react';
import type { PermissionKey } from '@busify/shared';
import { AppShell, Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/feedback';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { homeFor } from '@/features/auth/homeFor';
import { JourneyProvider } from '@/features/journey/JourneyProvider';
import { ApiError } from '@/lib/api';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
import { JourneyPage } from '@/pages/passenger/JourneyPage';
import { HistoryPage } from '@/pages/passenger/HistoryPage';
import { SettingsPage } from '@/pages/passenger/SettingsPage';
import { MySupportPage } from '@/pages/support/MySupportPage';
import { TicketPage } from '@/pages/support/TicketPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Staff-only areas load on demand so passengers download less.
const DeskPage = lazy(() => import('@/pages/desk/DeskPage'));
const DeskReportPage = lazy(() => import('@/pages/desk/DeskReportPage'));
const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'));
const AdminRoutesPage = lazy(() => import('@/pages/admin/AdminRoutesPage'));
const AdminRouteEditorPage = lazy(() => import('@/pages/admin/AdminRouteEditorPage'));
const AdminStopsPage = lazy(() => import('@/pages/admin/AdminStopsPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage'));
const AdminActivityPage = lazy(() => import('@/pages/admin/AdminActivityPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

function FullPageMessage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-6">{children}</div>;
}

function ServerUnreachable() {
  const { retry, error } = useAuth();
  return (
    <FullPageMessage>
      <EmptyState
        icon={ServerCrash}
        title="Cannot reach the BUSIFY server"
        action={<Button onClick={retry}>Try again</Button>}
      >
        {error instanceof ApiError && error.status ? error.message : 'Make sure the server is running on the computer that hosts BUSIFY and that this device is on the same Wi-Fi network.'}
      </EmptyState>
    </FullPageMessage>
  );
}

function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageMessage><Spinner label="Loading BUSIFY" /></FullPageMessage>;
  if (status === 'unreachable') return <ServerUnreachable />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return (
    <JourneyProvider>
      <AppShell />
    </JourneyProvider>
  );
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageMessage><Spinner /></FullPageMessage>;
  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : homeFor(user)} replace />;
  return <>{children}</>;
}

function Allow({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <Page>
        <EmptyState icon={ShieldAlert} title="You do not have access to this page">
          Your account role does not include this area. Ask an administrator if you think this is a mistake.
        </EmptyState>
      </Page>
    );
  }
  return (
    <Suspense fallback={<Page><Spinner /></Page>}>{children}</Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route index element={<Allow permission="journeys:use"><JourneyPage /></Allow>} />
              <Route path="history" element={<Allow permission="journeys:use"><HistoryPage /></Allow>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<Allow permission="tickets:create"><MySupportPage /></Allow>} />
              <Route path="support/:id" element={<TicketPage mode="passenger" />} />
              <Route path="desk" element={<Allow permission="tickets:manage"><DeskPage /></Allow>} />
              <Route path="desk/tickets/:id" element={<Allow permission="tickets:manage"><TicketPage mode="staff" /></Allow>} />
              <Route path="desk/reports" element={<Allow permission="support:reports"><DeskReportPage /></Allow>} />
              <Route path="admin" element={<Allow permission="reports:view"><AdminOverviewPage /></Allow>} />
              <Route path="admin/routes" element={<Allow permission="routes:manage"><AdminRoutesPage /></Allow>} />
              <Route path="admin/routes/:id" element={<Allow permission="routes:manage"><AdminRouteEditorPage /></Allow>} />
              <Route path="admin/stops" element={<Allow permission="stops:manage"><AdminStopsPage /></Allow>} />
              <Route path="admin/users" element={<Allow permission="users:manage"><AdminUsersPage /></Allow>} />
              <Route path="admin/reports" element={<Allow permission="reports:view"><AdminReportsPage /></Allow>} />
              <Route path="admin/activity" element={<Allow permission="audit:view"><AdminActivityPage /></Allow>} />
              <Route path="admin/settings" element={<Allow permission="settings:manage"><AdminSettingsPage /></Allow>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
