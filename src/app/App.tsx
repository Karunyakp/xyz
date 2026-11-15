import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './context';
import { configured } from '../infrastructure/supabase';
import { AuthPage, SetupPage, OnboardingPage } from '../features/Auth';
import { Layout } from './Layout';
import { Loading, Card, Button, Empty, ErrorBox } from '../components/ui';
import type { ReactNode } from 'react';
const Events = lazy(() => import('../features/Events').then((m) => ({ default: m.EventList })));
const Home = lazy(() => import('../features/Events').then((m) => ({ default: m.Home })));
const Detail = lazy(() => import('../features/Events').then((m) => ({ default: m.EventDetail })));
const Wizard = lazy(() =>
  import('../features/EventWizard').then((m) => ({ default: m.EventWizard })),
);
const Overview = lazy(() =>
  import('../features/Operations').then((m) => ({ default: m.Overview })),
);
const Approvals = lazy(() =>
  import('../features/Operations').then((m) => ({ default: m.Approvals })),
);
const Workspace = lazy(() =>
  import('../features/Operations').then((m) => ({ default: m.EventWorkspace })),
);
const Student = Object.fromEntries(
  [
    'MyEvents',
    'CalendarPage',
    'Clubs',
    'Opportunities',
    'Passport',
    'Notifications',
    'Profile',
    'Support',
    'VerifyCertificate',
  ].map((name) => [
    name,
    lazy(() => import('../features/Student').then((m) => ({ default: m[name as keyof typeof m] }))),
  ]),
);
const TeamAccess = lazy(() =>
  import('../features/TeamAccess').then((m) => ({ default: m.TeamAccess })),
);
const AcademicTerms = lazy(() =>
  import('../features/AcademicTerms').then((m) => ({ default: m.AcademicTerms })),
);
const Users = lazy(() => import('../features/Admin').then((m) => ({ default: m.UsersPage })));
const Directory = lazy(() =>
  import('../features/Admin').then((m) => ({ default: m.DirectoryPage })),
);
const Settings = lazy(() => import('../features/Admin').then((m) => ({ default: m.SettingsPage })));
const Audit = lazy(() => import('../features/Admin').then((m) => ({ default: m.AuditPage })));
const Platform = lazy(() => import('../features/Admin').then((m) => ({ default: m.PlatformPage })));
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: true } },
});
function Guard({ permission, children }: { permission?: string; children: ReactNode }) {
  const { can, context } = useApp();
  return (permission === 'platform' ? context?.platform_admin : !permission || can(permission)) ? (
    <>{children}</>
  ) : (
    <Card>
      <Empty
        title="This workspace needs a different role."
        text="Ask your institution administrator if you need access."
        action={
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
        }
      />
    </Card>
  );
}
function AppRoutes() {
  const { session, authLoading, contextLoading, context, institutionId, error } = useApp();
  if (!configured) return <SetupPage />;
  if (authLoading) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/verify/:code" element={<Student.VerifyCertificate />} />
        <Route path="/reset-password" element={<AuthPage />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/auth/callback" element={<Navigate to="/" replace />} />
        <Route
          path="/*"
          element={
            !session ? (
              <Navigate to="/login" replace />
            ) : contextLoading ? (
              <Loading />
            ) : error ? (
              <div className="onboarding">
                <ErrorBox error={error} />
              </div>
            ) : !institutionId && !context?.platform_admin ? (
              <OnboardingPage />
            ) : (
              <Routes>
                <Route element={<Layout />}>
                  <Route
                    index
                    element={institutionId ? <Home /> : <Navigate to="/platform" replace />}
                  />
                  <Route path="explore" element={<Events />} />
                  <Route path="events/:id" element={<Detail />} />
                  <Route
                    path="create-event"
                    element={
                      <Guard permission="event.create">
                        <Wizard />
                      </Guard>
                    }
                  />
                  <Route
                    path="events/:id/edit"
                    element={
                      <Guard permission="event.manage">
                        <Wizard />
                      </Guard>
                    }
                  />
                  <Route
                    path="manage-events"
                    element={
                      <Guard permission="event.manage">
                        <Events managed />
                      </Guard>
                    }
                  />
                  {[
                    ['my-events', 'MyEvents'],
                    ['calendar', 'CalendarPage'],
                    ['clubs', 'Clubs'],
                    ['opportunities', 'Opportunities'],
                    ['passport', 'Passport'],
                    ['notifications', 'Notifications'],
                    ['profile', 'Profile'],
                    ['support', 'Support'],
                  ].map(([path, name]) => {
                    const Component = Student[name];
                    return <Route key={path} path={path} element={<Component />} />;
                  })}
                  <Route
                    path="workspace"
                    element={
                      <Guard permission="report.read">
                        <Overview />
                      </Guard>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <Guard permission="report.read">
                        <Overview reports />
                      </Guard>
                    }
                  />
                  <Route
                    path="approvals"
                    element={
                      <Guard permission="event.approve">
                        <Approvals />
                      </Guard>
                    }
                  />
                  {(
                    [
                      'registrations',
                      'check-in',
                      'operations',
                      'volunteers',
                      'announcements',
                      'certificates',
                      'feedback',
                      'finance',
                      'completion',
                    ] as const
                  ).map((mode) => (
                    <Route key={mode} path={mode} element={<Workspace mode={mode} />} />
                  ))}
                  <Route
                    path="team-access"
                    element={
                      <Guard permission="event.manage">
                        <TeamAccess />
                      </Guard>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <Guard permission="users.manage">
                        <Users />
                      </Guard>
                    }
                  />
                  <Route
                    path="academic-terms"
                    element={
                      <Guard permission="directory.manage">
                        <AcademicTerms />
                      </Guard>
                    }
                  />
                  {(['departments', 'clubs', 'venues', 'resources'] as const).map((kind) => (
                    <Route
                      key={kind}
                      path={kind === 'clubs' ? 'manage-clubs' : kind}
                      element={
                        <Guard permission="directory.manage">
                          <Directory kind={kind} />
                        </Guard>
                      }
                    />
                  ))}
                  <Route
                    path="settings"
                    element={
                      <Guard permission="institution.manage">
                        <Settings />
                      </Guard>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <Guard permission="audit.read">
                        <Audit />
                      </Guard>
                    }
                  />
                  <Route
                    path="platform"
                    element={
                      <Guard permission="platform">
                        <Platform />
                      </Guard>
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <Card>
                        <Empty
                          title="This page isn’t on the map."
                          action={
                            <Button asChild>
                              <Link to="/">Back to campus</Link>
                            </Button>
                          }
                        />
                      </Card>
                    }
                  />
                </Route>
              </Routes>
            )
          }
        />
      </Routes>
    </Suspense>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AppProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <AppRoutes />
          <Toaster position="bottom-right" richColors closeButton />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
