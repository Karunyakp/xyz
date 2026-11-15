import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { Home, EventList, EventDetail } from '../src/features/Events';
import { EventWizard } from '../src/features/EventWizard';
import {
  MyEvents,
  CalendarPage,
  Clubs,
  Opportunities,
  Passport,
  Notifications,
  Profile,
  Support,
  VerifyCertificate,
} from '../src/features/Student';
import { Overview, Approvals, EventWorkspace } from '../src/features/Operations';
import {
  UsersPage,
  DirectoryPage,
  SettingsPage,
  AuditPage,
  PlatformPage,
} from '../src/features/Admin';
import { AuthPage, SetupPage, OnboardingPage } from '../src/features/Auth';
import { TeamAccess } from '../src/features/TeamAccess';
import { AcademicTerms, PeriodComparison } from '../src/features/AcademicTerms';
import { Layout } from '../src/app/Layout';
const fixture = vi.hoisted(() => ({
  institutionId: 'tenant-a',
  institution: {
    id: 'tenant-a',
    name: 'Test Institution',
    settings: {
      timezone: 'Asia/Kolkata',
      allowed_domains: [],
      approval_count: 1,
      waitlist_hours: 24,
    },
  },
  context: {
    profile: { full_name: 'Test Student', interests: [], skills: [], bio: '' },
    institutions: [{ id: 'tenant-a', name: 'Test Institution' }],
    memberships: [],
    assignments: [],
    role_permissions: [],
    platform_admin: true,
  },
  session: { user: { id: 'user-a', email: 'test@example.invalid' } },
  can: () => true,
  refresh: async () => {},
  setInstitution: () => {},
}));
vi.mock('../src/app/context', () => ({ useApp: () => fixture }));
vi.mock('../src/infrastructure/supabase', () => ({
  supabase: null,
  configured: false,
  appUrl: 'http://localhost:5173',
  db: () => {
    throw new Error('Unexpected network call during route render');
  },
  rpc: vi.fn(),
}));
const event = {
  id: 'event-a',
  institution_id: 'tenant-a',
  title: 'Test Event',
  status: 'DRAFT',
  created_by: 'user-a',
  starts_at: '2027-01-01T10:00:00Z',
  ends_at: '2027-01-01T12:00:00Z',
  registration_deadline: '2027-01-01T09:00:00Z',
  timezone: 'Asia/Kolkata',
  description: 'Test-only event for rendering checks.',
  category: 'Technical',
  event_type: 'Workshop',
  mode: 'offline',
  capacity: 10,
  questions: [],
  agenda: [],
  faqs: [],
  attachments: [],
  eligible_years: [],
  eligible_departments: [],
  estimated_budget: 0,
};
const pages: [string, React.ReactNode, string?][] = [
  ['academic terms', <AcademicTerms />],
  ['period comparison', <PeriodComparison />],
  ['student home', <Home />],
  ['explore', <EventList />],
  ['event details', <EventDetail />, '/events/event-a'],
  ['event wizard', <EventWizard />],
  ['my events', <MyEvents />],
  ['calendar', <CalendarPage />],
  ['clubs', <Clubs />],
  ['opportunities', <Opportunities />],
  ['passport', <Passport />],
  ['notifications', <Notifications />],
  ['profile', <Profile />],
  ['support', <Support />],
  ['verification', <VerifyCertificate />, '/verify/code'],
  ['organiser overview', <Overview />],
  ['reports', <Overview reports />],
  ['faculty approvals', <Approvals />],
  ['users', <UsersPage />],
  ['departments', <DirectoryPage kind="departments" />],
  ['club management', <DirectoryPage kind="clubs" />],
  ['venues', <DirectoryPage kind="venues" />],
  ['resources', <DirectoryPage kind="resources" />],
  ['settings', <SettingsPage />],
  ['audit', <AuditPage />],
  ['platform', <PlatformPage />],
  ['login', <AuthPage />],
  ['configuration', <SetupPage />],
  ['onboarding', <OnboardingPage />],
  ['application shell', <Layout />],
  ['team responsibility', <TeamAccess />],
  ...(
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
  ).map((mode) => [mode, <EventWorkspace mode={mode} />] as [string, React.ReactNode]),
];
describe('Major route rendering with isolated test fixtures (no production demo data)', () => {
  for (const [name, page, path = '/'] of pages)
    it(name, () => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, enabled: false } },
      });
      client.setQueryData(['event', 'event-a'], event);
      client.setQueryData(
        ['rows', 'events', 'tenant-a', { order: 'starts_at', ascending: true }],
        [event],
      );
      const markup = renderToString(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route
                path={
                  path.startsWith('/events')
                    ? '/events/:id'
                    : path.startsWith('/verify')
                      ? '/verify/:code'
                      : '*'
                }
                element={page}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(markup.length).toBeGreaterThan(100);
      expect(markup).not.toContain('NaN');
      client.clear();
    });
});
