import { VenueAvailability } from '../components/VenueAvailability';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Download,
  Users,
  Building2,
  ShieldCheck,
  Mail,
  UploadCloud,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { useRows, useAction } from '../app/hooks';
import {
  clubService,
  departmentService,
  institutionService,
  userService,
  venueService,
  storageService,
} from '../services';
import { exportRows, importSheet } from '../services/exportService';
import type { DataRow } from '../domain/models';
import {
  Button,
  Card,
  PageHeader,
  DataTable,
  Modal,
  SmartForm,
  QueryState,
  StatusBadge,
  Metric,
  type Field,
} from '../components/ui';
import { rows } from '../services/repository';
const roles = [
  'admin',
  'hod',
  'faculty',
  'club_admin',
  'organiser',
  'volunteer',
  'student',
  'external',
];
export function UsersPage() {
  const { institutionId } = useApp();
  const [search, setSearch] = useState(''),
    [open, setOpen] = useState(false),
    [edit, setEdit] = useState<DataRow | null>(null);
  const [imported, setImported] = useState<Record<string, string>[]>([]),
    [importResult, setImportResult] = useState<string[]>([]);
  const q = useQuery({
    queryKey: ['users', institutionId, search],
    queryFn: () => userService.list(institutionId, search),
  });
  const depts = useRows('departments'),
    assignments = useRows('role_assignments'),
    invitations = useRows('invitations');
  const action = useAction();
  const roleFields: Field[] = [
    {
      name: 'role',
      label: 'Role',
      type: 'select',
      options: roles.map((r) => ({ value: r, label: r.replaceAll('_', ' ') })),
      required: !edit,
    },
    {
      name: 'scope_type',
      label: 'Role scope',
      type: 'select',
      required: true,
      options: ['institution', 'department', 'club', 'event'].map((s) => ({ value: s, label: s })),
    },
    {
      name: 'scope_id',
      label: 'Scope ID',
      hint: 'Leave empty for institution scope. Copy department, club or event ID from its management page.',
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & ACCESS"
        title="The right people. The right access."
        description="Invite members, assign scoped responsibilities and maintain institutional records."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Invite member
          </Button>
        }
      />
      <Card>
        <div className="workspace-toolbar">
          <input
            placeholder="Search name or email…"
            aria-label="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() =>
              action.run(() => exportRows(q.data || [], 'PLANORA-People'), 'People exported')
            }
          >
            <Download size={16} />
            Export
          </Button>
          <label className="file-button">
            <UploadCloud size={16} />
            Import invitations
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  void action.run(async () => {
                    setImported(await importSheet(f));
                    setImportResult([]);
                  }, 'Import ready for review');
              }}
            />
          </label>
        </div>
        <QueryState loading={q.isLoading} error={q.error}>
          <DataTable
            rows={q.data || []}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'kind', label: 'Member type' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge value={String(r.status)} />,
              },
              {
                key: 'user_id',
                label: 'Scoped roles',
                render: (r) =>
                  assignments.data
                    ?.filter((a) => a.user_id === r.user_id)
                    .map((a) => String(a.role) + ' / ' + a.scope_type)
                    .join(', '),
              },
            ]}
            actions={(r) => (
              <Button variant="secondary" size="sm" onClick={() => setEdit(r)}>
                Manage
              </Button>
            )}
          />
        </QueryState>
      </Card>
      <Card>
        <h2>Invitation history</h2>
        <DataTable
          rows={invitations.data || []}
          columns={[
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'scope_type', label: 'Scope' },
            { key: 'accepted_at', label: 'Accepted at' },
            { key: 'expires_at', label: 'Expires' },
          ]}
        />
      </Card>
      <Modal
        title="Invite a campus member"
        description="Administrative access is always assigned by an authorised institution administrator."
        open={open}
        onOpenChange={setOpen}
      >
        <SmartForm
          initial={{ role: 'student', scope_type: 'institution' }}
          fields={[
            { name: 'email', label: 'Email address', type: 'email', required: true },
            ...roleFields,
            {
              name: 'department_id',
              label: 'Department',
              type: 'select',
              options: depts.data?.map((d) => ({ value: d.id, label: String(d.name) })),
            },
          ]}
          submitLabel="Create invitation & send email"
          onSubmit={async (p) => {
            const result = await userService.invite(institutionId, p);
            await action.run(
              async () => undefined,
              result.email_sent
                ? 'Invitation sent'
                : 'Invitation created; email delivery unavailable for this account',
            );
            setOpen(false);
          }}
        />
      </Modal>
      <Modal
        title={'Manage ' + String(edit?.name || 'member')}
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
      >
        <p className="muted">User ID: {String(edit?.user_id || '')}</p>
        {edit && (
          <SmartForm
            initial={{ ...edit, scope_type: 'institution' }}
            fields={[
              {
                name: 'status',
                label: 'Account status',
                type: 'select',
                options: ['active', 'inactive'].map((s) => ({ value: s, label: s })),
                required: true,
              },
              {
                name: 'department_id',
                label: 'Department',
                type: 'select',
                options: depts.data?.map((d) => ({ value: d.id, label: String(d.name) })),
              },
              { name: 'student_number', label: 'Student number / USN' },
              { name: 'academic_year', label: 'Academic year', type: 'number', min: 1, max: 8 },
              ...roleFields,
              { name: 'revoke', label: 'Revoke the selected scoped role', type: 'checkbox' },
            ]}
            onSubmit={async (p) => {
              const clean = { ...p };
              if (!p.role) delete clean.role;
              await userService.update(institutionId, String(edit.user_id), clean);
              await action.run(async () => undefined, 'Membership updated');
              setEdit(null);
            }}
          />
        )}
      </Modal>
      <Modal
        title="Review invitation import"
        description="Required column: email. Optional: role, scope_type, scope_id, department_id. Each row creates an invitation; it does not silently grant access."
        open={imported.length > 0}
        onOpenChange={(v) => !v && setImported([])}
      >
        <DataTable
          rows={imported}
          columns={[
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
          ]}
        />
        <Button
          disabled={action.busy}
          onClick={() =>
            action.run(async () => {
              const results: string[] = [];
              for (const row of imported) {
                try {
                  const r = await userService.invite(institutionId, {
                    role: 'student',
                    scope_type: 'institution',
                    ...row,
                  });
                  results.push(
                    `${row.email}: ${r.email_sent ? 'invited' : 'invitation saved; email not delivered'}`,
                  );
                } catch (e) {
                  results.push(`${row.email}: ${e instanceof Error ? e.message : 'failed'}`);
                }
                setImportResult([...results]);
              }
            }, 'Batch finished; review each result')
          }
        >
          Send {imported.length} invitations
        </Button>
        {importResult.map((r, i) => (
          <p key={i}>{r}</p>
        ))}
      </Modal>
    </>
  );
}
export function DirectoryPage({
  kind,
}: {
  kind: 'departments' | 'clubs' | 'venues' | 'resources';
}) {
  const { institutionId } = useApp();
  const q = useRows(kind);
  const [editing, setEditing] = useState<DataRow | null>(null),
    [open, setOpen] = useState(false);
  const action = useAction();
  const depts = useRows('departments');
  const bookings = useRows('venue_bookings');
  const members = useRows('club_memberships');
  const fields: Field[] = [
    { name: 'name', label: 'Name', required: true },
    ...(kind === 'departments' ? [{ name: 'code', label: 'Department code', required: true }] : []),
    ...(kind === 'venues'
      ? [
          { name: 'building', label: 'Building' },
          { name: 'room', label: 'Room' },
          { name: 'floor', label: 'Floor' },
          { name: 'capacity', label: 'Capacity', type: 'number' as const, min: 1, required: true },
          { name: 'equipment', label: 'Equipment', type: 'list' as const },
          { name: 'restrictions', label: 'Access restrictions', type: 'textarea' as const },
          { name: 'maintenance', label: 'Unavailable for maintenance', type: 'checkbox' as const },
        ]
      : [{ name: 'description', label: 'Description', type: 'textarea' as const }]),
    ...(kind === 'resources'
      ? [
          {
            name: 'quantity',
            label: 'Total available quantity',
            type: 'number' as const,
            min: 1,
            required: true,
          },
        ]
      : []),
    ...(kind === 'clubs'
      ? [
          {
            name: 'department_id',
            label: 'Associated department',
            type: 'select' as const,
            options: depts.data?.map((d) => ({ value: d.id, label: String(d.name) })),
          },
          {
            name: 'accepting_members',
            label: 'Accept membership applications',
            type: 'checkbox' as const,
          },
        ]
      : []),
  ];
  const names = {
    departments: 'Departments',
    clubs: 'Clubs & communities',
    venues: 'Venues & facilities',
    resources: 'Shared resources',
  };
  const service = {
    departments: departmentService.save,
    clubs: clubService.save,
    venues: venueService.save,
    resources: venueService.resource,
  }[kind];
  return (
    <>
      <PageHeader
        eyebrow="INSTITUTION DIRECTORY"
        title={names[kind]}
        description="Keep the spaces, teams and resources behind your campus organised."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            Add {kind === 'resources' ? 'resource' : kind.slice(0, -1)}
          </Button>
        }
      />
      <QueryState loading={q.isLoading} error={q.error}>
        <Card>
          <DataTable
            rows={q.data || []}
            columns={[
              { key: 'name', label: 'Name' },
              ...fields
                .filter((f) => f.name !== 'name')
                .slice(0, 4)
                .map((f) => ({ key: f.name, label: f.label })),
              {
                key: 'id',
                label: 'Scope ID',
                render: (r) => <code className="small-code">{r.id}</code>,
              },
            ]}
            actions={(r) => (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(r);
                  setOpen(true);
                }}
              >
                Edit
              </Button>
            )}
          />
        </Card>
      </QueryState>
      {kind === 'venues' && (
        <>
          <VenueAvailability venues={q.data || []} bookings={bookings.data || []} />
          <Card>
            <h2>Venue bookings & requests</h2>
            <DataTable
              rows={bookings.data || []}
              columns={[
                {
                  key: 'venue_id',
                  label: 'Venue',
                  render: (r) => String(q.data?.find((v) => v.id === r.venue_id)?.name || ''),
                },
                {
                  key: 'event_id',
                  label: 'Event',
                  render: (r) => (
                    <Link to={'/events/' + r.event_id}>
                      Open event <ArrowUpRight size={13} />
                    </Link>
                  ),
                },
                { key: 'starts_at', label: 'Start' },
                { key: 'ends_at', label: 'End' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge value={String(r.status)} />,
                },
              ]}
            />
            <p className="muted">
              Confirmed bookings are reserved transactionally during final event approval.
              Conflicting reservations are rejected.
            </p>
          </Card>
        </>
      )}
      {kind === 'clubs' && (
        <Card>
          <h2>Membership applications</h2>
          <DataTable
            rows={members.data?.filter((m) => m.status === 'applied') || []}
            columns={[
              {
                key: 'club_id',
                label: 'Club',
                render: (r) => String(q.data?.find((c) => c.id === r.club_id)?.name || ''),
              },
              { key: 'user_id', label: 'Applicant ID' },
              { key: 'created_at', label: 'Applied' },
            ]}
            actions={(r) => (
              <>
                <Button
                  size="sm"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(
                      () => clubService.action(String(r.club_id), 'accepted', r.id),
                      'Member accepted',
                    )
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(
                      () => clubService.action(String(r.club_id), 'rejected', r.id),
                      'Application rejected',
                    )
                  }
                >
                  Reject
                </Button>
              </>
            )}
          />
          <p className="muted">
            Faculty and student coordinators are assigned with club-scoped roles in People & access.
          </p>
        </Card>
      )}
      <Modal
        title={(editing ? 'Edit ' : 'Create ') + kind.slice(0, -1)}
        open={open}
        onOpenChange={setOpen}
      >
        <>
          {kind === 'clubs' && editing && (
            <label className="field">
              Club logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void action.run(
                      () => storageService.branding(institutionId, file, editing.id),
                      'Club logo updated',
                    );
                }}
              />
            </label>
          )}
          <SmartForm
            initial={editing || { accepting_members: true }}
            fields={fields}
            onSubmit={async (p) => {
              await service(institutionId, p, editing?.id);
              await action.run(async () => undefined, 'Directory updated');
              setOpen(false);
            }}
          />
        </>
      </Modal>
    </>
  );
}
export function SettingsPage() {
  const { institution, institutionId, refresh } = useApp();
  const action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="MAKE PLANORA YOURS"
        title="Your institution. Your way."
        description="Manage institutional identity, registration policies and approval requirements."
      />
      <div className="two-col">
        <Card>
          <h2>Institution policies</h2>
          <label className="field" style={{ marginBottom: 24 }}>
            Institution logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void action.run(async () => {
                    await storageService.branding(institutionId, file);
                    await refresh();
                  }, 'Institution branding updated');
              }}
            />
          </label>
          <SmartForm
            initial={{ name: institution?.name, ...institution?.settings }}
            fields={[
              { name: 'name', label: 'Institution name', required: true },
              { name: 'timezone', label: 'Default timezone', required: true },
              {
                name: 'allowed_domains',
                label: 'Approved institutional email domains',
                type: 'list',
                hint: 'Use domains only, for example college.edu.in. Empty means invitation-only onboarding.',
              },
              {
                name: 'external_registration',
                label: 'Allow invited external participants',
                type: 'checkbox',
              },
              {
                name: 'approval_required',
                label: 'Require independent approval before publishing',
                type: 'checkbox',
              },
              {
                name: 'approval_count',
                label: 'Required independent reviewers',
                type: 'number',
                min: 1,
                max: 10,
                required: true,
              },
              {
                name: 'waitlist_hours',
                label: 'Waitlist acceptance window (hours)',
                type: 'number',
                min: 1,
                max: 168,
                required: true,
              },
              {
                name: 'email_notifications',
                label: 'Enable optional notification email delivery',
                type: 'checkbox',
              },
            ]}
            onSubmit={async (p) => {
              const { name, ...settings } = p;
              await institutionService.settings(institutionId, { name, settings });
              await refresh();
              await action.run(async () => undefined, 'Institution settings updated');
            }}
          />
        </Card>
        <Card>
          <ShieldCheck size={30} />
          <h2>Access belongs to your institution.</h2>
          <p>
            Every member has institution membership. Responsibilities can be assigned at
            institution, department, club or event level.
          </p>
          <p>
            Platform administrators see tenant usage summaries. They do not automatically receive
            access to student profiles, attendance or academic details.
          </p>
          <Link className="text-link" to="/users">
            Manage people & access <ArrowUpRight size={16} />
          </Link>
          <h3>Provider status</h3>
          <p>Registrations: free only</p>
          <p>Payments: not configured</p>
          <p>Authentication email: managed by your Supabase project settings</p>
          <p>
            Optional announcement email: requires the notification delivery function, email provider
            and scheduler.
          </p>
        </Card>
      </div>
    </>
  );
}
export function AuditPage() {
  const q = useRows('audit_logs', { order: 'created_at', limit: 1000 });
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTABILITY, BUILT IN"
        title="A clear record of what changed."
        description="The latest 1,000 operations in your authorised institution."
      />
      <QueryState loading={q.isLoading} error={q.error}>
        <Card>
          <DataTable
            rows={q.data || []}
            columns={[
              { key: 'created_at', label: 'Timestamp' },
              { key: 'action', label: 'Action' },
              { key: 'actor_id', label: 'Actor ID' },
              { key: 'entity_type', label: 'Record type' },
              { key: 'details', label: 'Details' },
            ]}
          />
        </Card>
      </QueryState>
    </>
  );
}
export function PlatformPage() {
  const q = useQuery({ queryKey: ['platform-metrics'], queryFn: institutionService.metrics });
  const support = useQuery({ queryKey: ['platform-support'], queryFn: institutionService.support });
  const plans = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => rows('subscription_plans', ''),
  });
  const [form, setForm] = useState(''),
    [target, setTarget] = useState<DataRow | null>(null);
  const action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="PLANORA PLATFORM"
        title="A home for every campus."
        description="Tenant administration and aggregate usage. Student records remain institution-scoped."
        action={
          <Button onClick={() => setForm('create_institution')}>
            <Plus size={16} />
            Create institution
          </Button>
        }
      />
      <div className="stats-grid three">
        <Metric label="Institutions" value={q.data?.length || 0} icon={<Building2 />} />
        <Metric
          label="Active campuses"
          value={q.data?.filter((i) => i.status === 'active').length || 0}
          icon={<ShieldCheck />}
        />
        <Metric
          label="Total memberships"
          value={q.data?.reduce((n, i) => n + Number(i.members), 0) || 0}
          icon={<Users />}
        />
      </div>
      <QueryState loading={q.isLoading} error={q.error}>
        <Card>
          <DataTable
            rows={q.data || []}
            columns={[
              { key: 'name', label: 'Institution' },
              { key: 'status', label: 'Status' },
              { key: 'plan', label: 'Plan' },
              { key: 'events', label: 'Events' },
              { key: 'members', label: 'Members' },
            ]}
            actions={(r) => (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTarget(r);
                  setForm('update_institution');
                }}
              >
                Manage tenant
              </Button>
            )}
          />
        </Card>
      </QueryState>
      <div className="two-col">
        <Card>
          <div className="section-title">
            <h2>Subscription plans</h2>
            <Button variant="secondary" size="sm" onClick={() => setForm('plan')}>
              Add plan
            </Button>
          </div>
          <DataTable
            rows={plans.data || []}
            columns={[
              { key: 'name', label: 'Plan' },
              { key: 'features', label: 'Features' },
            ]}
            actions={(r) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTarget(r);
                  setForm('update_plan');
                }}
              >
                Configure
              </Button>
            )}
          />
          <p className="muted">
            Plans enforce event creation, registration access and active-event allowances. Billing
            is not configured.
          </p>
          <Button variant="secondary" onClick={() => setForm('category')}>
            Add global event category
          </Button>
        </Card>
        <Card>
          <h2>Support requests</h2>
          {support.data?.map((s) => (
            <div className="note" key={s.id}>
              <StatusBadge value={String(s.status)} />
              <h3>{String(s.subject)}</h3>
              <p>{String(s.body)}</p>
              {s.status === 'open' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    action.run(
                      () => institutionService.platform('resolve_support', { id: s.id }),
                      'Request resolved',
                    )
                  }
                >
                  Resolve
                </Button>
              )}
            </div>
          ))}
        </Card>
      </div>
      <Modal
        title={form.replaceAll('_', ' ')}
        open={!!form}
        onOpenChange={(v) => !v && setForm('')}
      >
        <SmartForm
          initial={target || {}}
          fields={
            form === 'create_institution'
              ? [
                  { name: 'name', label: 'Institution name', required: true },
                  { name: 'slug', label: 'Institution slug', required: true },
                  {
                    name: 'owner_id',
                    label: 'Verified owner account UUID',
                    required: true,
                    hint: 'The owner first creates and verifies their own account.',
                  },
                ]
              : form === 'update_institution'
                ? [
                    {
                      name: 'status',
                      label: 'Tenant status',
                      type: 'select',
                      required: true,
                      options: ['active', 'suspended'].map((s) => ({ value: s, label: s })),
                    },
                    {
                      name: 'plan',
                      label: 'Subscription plan',
                      type: 'select',
                      options: plans.data?.map((p) => ({
                        value: String(p.name),
                        label: String(p.name),
                      })),
                    },
                  ]
                : [
                    { name: 'name', label: 'Name', required: true },
                    ...(['plan', 'update_plan'].includes(form)
                      ? [
                          {
                            name: 'features',
                            label: 'Feature configuration',
                            type: 'json' as const,
                            hint: 'Use an object: events_enabled (boolean), registration_enabled (boolean), max_active_events (positive integer).',
                          },
                        ]
                      : []),
                  ]
          }
          onSubmit={async (p) => {
            await institutionService.platform(form, { ...p, id: target?.id });
            await action.run(async () => undefined, 'Platform configuration saved');
            setForm('');
            setTarget(null);
          }}
        />
      </Modal>
      <p className="muted">
        <Mail size={14} /> Tenant suspension immediately blocks membership-based database access.
      </p>
    </>
  );
}
