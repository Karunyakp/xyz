import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  ScanLine,
  Camera,
  StopCircle,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  ClipboardCheck,
  Activity,
} from 'lucide-react';
import { useApp } from '../app/context';
import { useRows, useAction } from '../app/hooks';
import {
  analyticsService,
  approvalService,
  attendanceService,
  budgetService,
  certificateService,
  notificationService,
  registrationService,
  reportService,
  storageService,
  venueService,
  volunteerService,
  userService,
} from '../services';
import { exportRows } from '../services/exportService';
import { PeriodComparison } from './AcademicTerms';
import type { Analytics, CampusEvent, DataRow, MetricPoint } from '../domain/models';
import {
  Button,
  Card,
  PageHeader,
  Metric,
  QueryState,
  Empty,
  DataTable,
  StatusBadge,
  Modal,
  SmartForm,
  type Field,
} from '../components/ui';
export function Overview({ reports = false }: { reports?: boolean }) {
  const { institutionId } = useApp();
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(
    new Date(new Date().getFullYear() + 1, 0, 1).toISOString().slice(0, 10),
  );
  const q = useQuery({
    queryKey: ['analytics', institutionId, from, to],
    queryFn: () =>
      analyticsService.get(institutionId, new Date(from).toISOString(), new Date(to).toISOString()),
    enabled: !!institutionId && !!from && !!to,
  });
  const action = useAction();
  const events = useRows<CampusEvent>('events', { order: 'starts_at', ascending: true });
  const stats = q.data;
  return (
    <>
      <PageHeader
        eyebrow={reports ? 'TURN ACTIVITY INTO INSIGHT' : 'YOUR ORGANISER WORKSPACE'}
        title={reports ? 'See the bigger picture.' : 'Make every experience count.'}
        description="Live institutional activity within your authorised scope."
        action={
          <Button asChild>
            <Link to="/manage-events">
              Manage events <ArrowUpRight size={16} />
            </Link>
          </Button>
        }
      />
      <div className="report-filters">
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Until (exclusive)
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button
          variant="secondary"
          disabled={!stats || action.busy}
          onClick={() =>
            action.run(
              () =>
                exportRows(
                  stats
                    ? Object.entries(stats).flatMap(([key, value]) =>
                        Array.isArray(value)
                          ? value.map((p: MetricPoint) => ({
                              metric: key,
                              group: p.name,
                              value: p.value,
                            }))
                          : [{ metric: key, group: 'total', value }],
                      )
                    : [],
                  'PLANORA-Report',
                ),
              'Report exported',
            )
          }
        >
          <Download size={16} /> Export report
        </Button>
      </div>
      <QueryState loading={q.isLoading} error={q.error}>
        {stats && (
          <>
            <div className="stats-grid">
              <Metric
                label="Events created"
                value={stats.events}
                detail={`${stats.upcoming} upcoming experiences`}
                icon={<CalendarDays />}
              />
              <Metric
                label="Registrations"
                value={stats.registrations}
                detail={`${stats.unique_participants} individual participants`}
                icon={<Users />}
              />
              <Metric
                label="Checked in"
                value={stats.attendance}
                detail={`${stats.confirmed ? Math.round((stats.attendance / stats.confirmed) * 100) : 0}% of confirmed registrations`}
                icon={<CheckCircle2 />}
              />
              <Metric
                label="Awaiting review"
                value={stats.pending}
                detail="Proposals needing a decision"
                icon={<Clock />}
              />
            </div>
            <div className="chart-grid">
              <Card>
                <div className="section-title">
                  <div>
                    <div className="eyebrow">CAMPUS PULSE</div>
                    <h2>Registration activity</h2>
                  </div>
                  <TrendingUp size={22} />
                </div>
                <Chart values={stats.trend} />
              </Card>
              <Card>
                <div className="eyebrow">ROOM TO GROW</div>
                <h2>Participation snapshot</h2>
                <div className="progress-metric">
                  <strong>
                    {stats.capacity ? Math.round((stats.confirmed / stats.capacity) * 100) : 0}%
                  </strong>
                  <p>Capacity utilisation</p>
                  <progress value={stats.confirmed} max={stats.capacity || 1} />
                </div>
                <div className="summary-row">
                  <span>Confirmed / all registrations</span>
                  <b>
                    {stats.registrations
                      ? Math.round((stats.confirmed / stats.registrations) * 100)
                      : 0}
                    %
                  </b>
                </div>
                <div className="summary-row">
                  <span>Total event capacity</span>
                  <b>{stats.capacity.toLocaleString()}</b>
                </div>
              </Card>
            </div>
            {reports ? (
              <>
                <ReportCharts stats={stats} />
                <PeriodComparison />
              </>
            ) : (
              <div className="two-col">
                <Card>
                  <h2>Action required</h2>
                  {events.data
                    ?.filter((e) =>
                      ['PENDING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'DRAFT'].includes(
                        e.status,
                      ),
                    )
                    .slice(0, 6)
                    .map((e) => (
                      <Link key={e.id} className="list-link" to={'/events/' + e.id}>
                        <span>{e.title}</span>
                        <StatusBadge value={e.status} />
                      </Link>
                    ))}
                  {!stats.pending && (
                    <p className="muted">
                      There are no proposals waiting for review in this period.
                    </p>
                  )}
                </Card>
                <Card>
                  <h2>Coming up</h2>
                  {events.data
                    ?.filter((e) => new Date(e.starts_at) > new Date())
                    .slice(0, 5)
                    .map((e) => (
                      <Link key={e.id} className="list-link" to={'/events/' + e.id}>
                        <span>
                          {e.title}
                          <small>{new Date(e.starts_at).toLocaleDateString()}</small>
                        </span>
                        <ArrowUpRight size={16} />
                      </Link>
                    ))}
                </Card>
              </div>
            )}
          </>
        )}
      </QueryState>
    </>
  );
}
function Chart({ values, bars = false }: { values: MetricPoint[]; bars?: boolean }) {
  return values.length ? (
    <div className="chart">
      <ResponsiveContainer width="100%" height={250}>
        {bars ? (
          <BarChart data={values}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" fill="#246b55" radius={[5, 5, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={values}>
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#73b18c" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#73b18c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip />
            <Area
              dataKey="value"
              stroke="#246b55"
              fill="url(#chart-fill)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  ) : (
    <Empty
      title="The story starts with your first event."
      text="Real activity will populate this chart."
    />
  );
}
function ReportCharts({ stats }: { stats: Analytics }) {
  return (
    <div className="two-col">
      {[
        ['Events by category', stats.category],
        ['Department activity', stats.departments],
        ['Club activity', stats.clubs],
        ['Month-by-month', stats.monthly],
        ['Approved finance entries (INR)', stats.finance],
      ].map(([title, points]) => (
        <Card key={String(title)}>
          <h2>{String(title)}</h2>
          <Chart bars values={points as MetricPoint[]} />
        </Card>
      ))}
    </div>
  );
}
export function Approvals() {
  const q = useRows<CampusEvent>('events', { order: 'starts_at', ascending: true });
  const { can } = useApp();
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [selected, setSelected] = useState<CampusEvent | null>(null);
  const [decision, setDecision] = useState('APPROVED');
  const action = useAction();
  const history = useRows('approvals', {
    eventId: selected?.id || '00000000-0000-0000-0000-000000000000',
    order: 'created_at',
  });
  const bookings = useRows('venue_bookings');
  return (
    <>
      <PageHeader
        eyebrow="FACULTY REVIEW DESK"
        title="Great experiences start with a clear yes."
        description="Review proposals, budgets and venue availability before they reach your campus."
      />
      <div className="category-tabs">
        {['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'].map((t) => (
          <button key={t} className={t === tab ? 'selected' : ''} onClick={() => setTab(t)}>
            {t.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      <QueryState loading={q.isLoading} error={q.error}>
        <Card>
          <DataTable
            rows={q.data?.filter((e) => e.status === tab && can('event.approve', e)) || []}
            columns={[
              {
                key: 'title',
                label: 'Proposal',
                render: (e) => <Link to={'/events/' + e.id}>{e.title}</Link>,
              },
              {
                key: 'starts_at',
                label: 'Date',
                render: (e) => new Date(e.starts_at).toLocaleString(),
              },
              {
                key: 'estimated_budget',
                label: 'Budget',
                render: (e) => '₹' + e.estimated_budget.toLocaleString('en-IN'),
              },
              { key: 'capacity', label: 'Capacity' },
              {
                key: 'venue_id',
                label: 'Venue status',
                render: (e) =>
                  bookings.data?.some(
                    (b) =>
                      b.event_id !== e.id &&
                      b.venue_id === e.venue_id &&
                      b.status === 'confirmed' &&
                      String(b.starts_at) < e.ends_at &&
                      String(b.ends_at) > e.starts_at,
                  ) ? (
                    <StatusBadge value="conflict" />
                  ) : (
                    'No confirmed conflict'
                  ),
              },
            ]}
            actions={(e) => (
              <Button size="sm" variant="secondary" onClick={() => setSelected(e)}>
                Review
              </Button>
            )}
          />
        </Card>
      </QueryState>
      <Modal
        title={selected?.title || 'Review proposal'}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        {selected && (
          <>
            <p className="prose">{selected.description}</p>
            <p>
              Estimated budget: ₹{selected.estimated_budget.toLocaleString('en-IN')} ·{' '}
              {selected.capacity} places
            </p>
            {selected.status === 'PENDING_APPROVAL' && (
              <>
                <label className="field">
                  Decision
                  <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                    <option value="APPROVED">Approve</option>
                    <option value="REVISION_REQUESTED">Request modifications</option>
                    <option value="REJECTED">Reject</option>
                    <option value="COMMENT">Add comment only</option>
                  </select>
                </label>
                <SmartForm
                  fields={[
                    {
                      name: 'reason',
                      label: 'Review comments',
                      type: 'textarea',
                      required: decision !== 'APPROVED',
                    },
                  ]}
                  submitLabel="Submit review"
                  onSubmit={async (p) => {
                    if (decision === 'COMMENT')
                      await approvalService.comment(selected.id, String(p.reason));
                    else await approvalService.review(selected.id, decision, String(p.reason));
                    await action.run(async () => undefined, 'Review recorded');
                    setSelected(null);
                  }}
                />
              </>
            )}
            <h3>Review history</h3>
            {history.data?.map((h) => (
              <div className="timeline-row" key={h.id}>
                <StatusBadge value={String(h.decision)} />
                <p>{String(h.comments)}</p>
                <small>
                  {new Date(String(h.created_at)).toLocaleString()} · reviewer{' '}
                  {String(h.reviewer_id)}
                </small>
              </div>
            ))}
          </>
        )}
      </Modal>
    </>
  );
}
export type WorkspaceMode =
  | 'registrations'
  | 'check-in'
  | 'operations'
  | 'volunteers'
  | 'announcements'
  | 'certificates'
  | 'feedback'
  | 'finance'
  | 'completion';
const titles: Record<WorkspaceMode, string> = {
  registrations: 'Every participant, accounted for.',
  'check-in': 'A warm welcome starts here.',
  operations: 'Your event-day command centre.',
  volunteers: 'The people making it happen.',
  announcements: 'Keep everyone in the loop.',
  certificates: 'Give their effort recognition.',
  feedback: 'Listen. Learn. Make it better.',
  finance: 'Every rupee, in the right place.',
  completion: 'Close the loop.',
};
const modePermission: Record<WorkspaceMode, string> = {
  registrations: 'registration.manage',
  'check-in': 'attendance.scan',
  operations: 'event.manage',
  volunteers: 'event.manage',
  announcements: 'event.manage',
  certificates: 'certificate.manage',
  feedback: 'report.read',
  finance: 'budget.manage',
  completion: 'report.read',
};
export function EventWorkspace({ mode }: { mode: WorkspaceMode }) {
  const { can } = useApp();
  const events = useRows<CampusEvent>('events', { order: 'starts_at', ascending: true });
  const [params, setParams] = useSearchParams();
  const choices =
    events.data?.filter(
      (e) => can(modePermission[mode], e) || (mode === 'finance' && can('budget.approve', e)),
    ) || [];
  const id = params.get('event') || choices[0]?.id;
  const selected = choices.find((e) => e.id === id);
  return (
    <>
      <PageHeader
        eyebrow="EVENT WORKSPACE"
        title={titles[mode]}
        description="Choose an event to open its live records and tools."
      />
      <div className="event-selector">
        <CalendarDays size={19} />
        <select
          aria-label="Choose event"
          value={id || ''}
          onChange={(e) => setParams({ event: e.target.value })}
        >
          <option value="">Select an event</option>
          {choices.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} · {e.status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        {selected && (
          <Link to={'/events/' + id}>
            View event <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <QueryState loading={events.isLoading} error={events.error}>
        {selected ? (
          <WorkspaceContent key={mode + selected.id} mode={mode} event={selected} />
        ) : (
          <Card>
            <Empty
              title="Choose your next experience."
              text="Events assigned to your role appear in the selector above."
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
function WorkspaceContent({ mode, event: e }: { mode: WorkspaceMode; event: CampusEvent }) {
  const { can, institutionId } = useApp();
  const action = useAction();
  const [search, setSearch] = useState(''),
    [form, setForm] = useState(''),
    [review, setReview] = useState<DataRow | null>(null);
  const [receipt, setReceipt] = useState('');
  const [participant, setParticipant] = useState<DataRow | null>(null);
  const participants = useQuery({
    queryKey: ['participants', e.id, search],
    queryFn: () => registrationService.participants(e.id, search),
    enabled: can('registration.manage', e) || can('attendance.scan', e) || can('report.read', e),
    refetchInterval: mode === 'operations' || mode === 'check-in' ? 15000 : false,
  });
  const table =
    mode === 'operations'
      ? 'tasks'
      : mode === 'volunteers'
        ? 'volunteers'
        : mode === 'announcements'
          ? 'announcements'
          : mode === 'certificates'
            ? 'certificates'
            : mode === 'feedback'
              ? 'feedback'
              : mode === 'finance'
                ? 'budget_entries'
                : mode === 'completion'
                  ? 'completion_reports'
                  : 'registrations';
  const q = useRows(table, { eventId: e.id });
  const resources = useRows('resources');
  const allocations = useRows('resource_allocations', { eventId: e.id });
  const history = useRows('workflow_history', { eventId: e.id, order: 'created_at' });
  const volunteers = useRows('volunteers', { eventId: e.id });
  const attendance = useRows('attendance', { eventId: e.id });
  const counts = useQuery({
    queryKey: ['event-counts', e.id],
    queryFn: () => registrationService.counts(e.id),
    enabled: can('report.read', e) || can('attendance.scan', e),
    refetchInterval: 15000,
  });
  const confirmed = counts.data?.confirmed || 0,
    checked = counts.data?.checked_in || 0;
  const memberOptions = useQuery({
    queryKey: ['member-options', institutionId],
    queryFn: () => userService.options(institutionId),
    enabled: can('event.manage', e),
  });
  const fields: Record<string, Field[]> = {
    task: [
      { name: 'title', label: 'Task', required: true },
      {
        name: 'assigned_to',
        label: 'Assign participant',
        type: 'select',
        options: memberOptions.data?.map((p) => ({
          value: String(p.user_id),
          label: String(p.name),
        })),
      },
      { name: 'due_at', label: 'Due at', type: 'datetime-local' },
      { name: 'notes', label: 'Instructions', type: 'textarea' },
    ],
    volunteer: [
      {
        name: 'user_id',
        label: 'Volunteer',
        type: 'select',
        required: true,
        options: memberOptions.data?.map((p) => ({
          value: String(p.user_id),
          label: String(p.name),
        })),
      },
      {
        name: 'status',
        label: 'Selection decision',
        type: 'select',
        required: true,
        options: ['accepted', 'rejected'].map((s) => ({ value: s, label: s })),
      },
      { name: 'duty', label: 'Duty role', required: true },
      { name: 'starts_at', label: 'Shift starts', type: 'datetime-local' },
      { name: 'ends_at', label: 'Shift ends', type: 'datetime-local' },
      { name: 'can_scan', label: 'Allow scanning for this event only', type: 'checkbox' },
      { name: 'attended', label: 'Volunteer attended duty', type: 'checkbox' },
    ],
    announcement: [
      { name: 'title', label: 'Title', required: true },
      { name: 'body', label: 'Announcement', type: 'textarea', required: true },
    ],
    budget: [
      {
        name: 'kind',
        label: 'Entry type',
        type: 'select',
        required: true,
        options: ['allocation', 'expense', 'sponsorship', 'reimbursement'].map((s) => ({
          value: s,
          label: s,
        })),
      },
      { name: 'category', label: 'Category', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'amount', label: 'Amount (INR)', type: 'number', min: 1, required: true },
    ],
    completion: [
      { name: 'summary', label: 'Event summary', type: 'textarea', required: true },
      { name: 'outcomes', label: 'Outcomes and learnings', type: 'textarea', required: true },
    ],
    resource: [
      {
        name: 'resource_id',
        label: 'Resource',
        type: 'select',
        required: true,
        options: resources.data?.map((r) => ({
          value: r.id,
          label: String(r.name) + ' (' + r.quantity + ' total)',
        })),
      },
      {
        name: 'quantity',
        label: 'Quantity (0 to release)',
        type: 'number',
        required: true,
        min: 0,
      },
    ],
    review: [
      {
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        options: ['approved', 'rejected'].map((s) => ({ value: s, label: s })),
      },
      { name: 'reason', label: 'Review reason', type: 'textarea', required: true },
    ],
    correct: [
      {
        name: 'reason',
        label: 'Why should this attendance record be removed?',
        type: 'textarea',
        required: true,
      },
    ],
  };
  const save = async (p: Record<string, unknown>) => {
    if (form === 'task') await volunteerService.task(e.id, p);
    if (form === 'volunteer') await volunteerService.apply(e.id, p);
    if (form === 'announcement')
      await notificationService.publish(institutionId, { ...p, event_id: e.id });
    if (form === 'budget') await budgetService.save(e.id, { ...p, receipt_path: receipt });
    if (form === 'completion') await reportService.complete(e.id, p);
    if (form === 'resource')
      await venueService.allocate(e.id, String(p.resource_id), Number(p.quantity));
    if (form === 'review' && review)
      await budgetService.review(review.id, String(p.decision), String(p.reason));
    if (form === 'correct' && review) await attendanceService.correct(review.id, String(p.reason));
    await action.run(async () => undefined, 'Saved successfully');
    setForm('');
  };
  const toolbar = (
    <div className="workspace-toolbar">
      <form onSubmit={(ev) => ev.preventDefault()}>
        <input
          aria-label="Find participant"
          placeholder="Search participant name or registration number…"
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
        />
      </form>
      <Button
        variant="secondary"
        disabled={action.busy}
        onClick={() =>
          action.run(
            () => exportRows(participants.data || [], 'PLANORA-Participants'),
            'CSV exported',
          )
        }
      >
        <Download size={16} />
        CSV
      </Button>
      <Button
        variant="secondary"
        disabled={action.busy}
        onClick={() =>
          action.run(
            () => exportRows(participants.data || [], 'PLANORA-Participants', 'xlsx'),
            'Spreadsheet exported',
          )
        }
      >
        XLSX
      </Button>
      {can('registration.manage', e) && (
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={() => action.run(() => registrationService.promote(e.id), 'Waitlist processed')}
        >
          Process waitlist
        </Button>
      )}
    </div>
  );
  return (
    <>
      {['operations', 'registrations', 'check-in'].includes(mode) && (
        <div className="stats-grid">
          <Metric label="Registered" value={counts.data?.registered || 0} icon={<Users />} />
          <Metric label="Checked in" value={checked} icon={<CheckCircle2 />} />
          <Metric
            label="Seats remaining"
            value={Math.max(0, e.capacity - confirmed - (counts.data?.invited || 0))}
            icon={<CalendarDays />}
          />
          <Metric
            label="Attendance"
            value={(confirmed ? Math.round((checked / confirmed) * 100) : 0) + '%'}
            icon={<Activity />}
          />
        </div>
      )}
      {mode === 'check-in' && <Scanner event={e} />}{' '}
      {['registrations', 'check-in'].includes(mode) && (
        <Card>
          {toolbar}
          <QueryState loading={participants.isLoading} error={participants.error}>
            <DataTable
              rows={participants.data || []}
              columns={[
                { key: 'name', label: 'Participant' },
                { key: 'registration_number', label: 'Registration' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge value={String(r.status)} />,
                },
                {
                  key: 'checked_in_at',
                  label: 'Check-in',
                  render: (r) =>
                    r.checked_in_at
                      ? new Date(String(r.checked_in_at)).toLocaleTimeString()
                      : 'Not checked in',
                },
              ]}
              actions={(r) => (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setParticipant(r)}>
                    Details
                  </Button>
                  {r.status === 'pending' && can('registration.manage', e) && (
                    <>
                      <Button
                        size="sm"
                        disabled={action.busy}
                        onClick={() =>
                          action.run(
                            () => registrationService.action(String(r.registration_id), 'approve'),
                            'Application approved',
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setReview(r);
                          setForm('reject-registration');
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {mode === 'check-in' &&
                    r.status === 'confirmed' &&
                    !r.checked_in_at &&
                    can('registration.manage', e) && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setReview(r);
                          setForm('manual-check-in');
                        }}
                      >
                        Check in
                      </Button>
                    )}
                  {r.checked_in_at && can('event.approve', e) && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        const a = attendance.data?.find(
                          (v) => v.registration_id === r.registration_id,
                        );
                        if (a) {
                          setReview(a);
                          setForm('correct');
                        }
                      }}
                    >
                      Correct
                    </Button>
                  )}
                </>
              )}
            />
          </QueryState>
          <small className="muted">
            Exports include up to 10,000 accessible participant records per event.
          </small>
        </Card>
      )}
      {mode === 'operations' && (
        <>
          <div className="two-col">
            <Card>
              <div className="section-title">
                <h2>Operations checklist</h2>
                <Button size="sm" variant="secondary" onClick={() => setForm('task')}>
                  <Plus size={15} />
                  Task
                </Button>
              </div>
              {q.data?.map((t) => (
                <div className="task-row" key={t.id}>
                  <div>
                    <strong>{String(t.title)}</strong>
                    <small>{String(t.notes || '')}</small>
                  </div>
                  <select
                    aria-label="Task status"
                    value={String(t.status)}
                    onChange={(ev) =>
                      action.run(
                        () => volunteerService.task(e.id, { ...t, status: ev.target.value }, t.id),
                        'Task updated',
                      )
                    }
                  >
                    {['todo', 'doing', 'done', 'blocked'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
              {!q.data?.length && (
                <Empty
                  title="Get the team ready."
                  text="Add venue setup, registration desk, technical checks and more."
                />
              )}
            </Card>
            <Card>
              <h2>Run of show</h2>
              {e.agenda.map((a, i) => (
                <div className="agenda-row" key={i}>
                  <span>{a.time}</span>
                  <strong>{a.title}</strong>
                </div>
              ))}
              <h3>Important contacts</h3>
              <p className="prose">{e.contact || 'No contacts added yet.'}</p>
              <p className="prose">{e.instructions}</p>
              <Link className="text-link" to={'/announcements?event=' + e.id}>
                Post a live notice <ArrowUpRight size={16} />
              </Link>
            </Card>
            <Card>
              <div className="section-title">
                <h2>Resource allocations</h2>
                <Button size="sm" variant="secondary" onClick={() => setForm('resource')}>
                  Allocate
                </Button>
              </div>
              {allocations.data?.map((a) => (
                <div className="summary-row" key={a.id}>
                  <span>
                    {String(
                      resources.data?.find((r) => r.id === a.resource_id)?.name || a.resource_id,
                    )}
                  </span>
                  <strong>{String(a.quantity)}</strong>
                </div>
              ))}
            </Card>
            <Card>
              <h2>Volunteer readiness</h2>
              <p>
                {volunteers.data?.filter((v) => v.status === 'accepted').length || 0} selected
                volunteers
              </p>
              {volunteers.data
                ?.filter((v) => v.status === 'accepted')
                .map((v) => (
                  <div className="summary-row" key={v.id}>
                    <span>{String(v.duty)}</span>
                    <StatusBadge value={v.attended ? 'attended' : 'assigned'} />
                  </div>
                ))}
              <Link className="text-link" to={'/volunteers?event=' + e.id}>
                Manage volunteers <ArrowUpRight size={15} />
              </Link>
            </Card>
            <Card>
              <h2>Recent arrivals</h2>
              {participants.data
                ?.filter((r) => r.checked_in_at)
                .sort((a, b) => String(b.checked_in_at).localeCompare(String(a.checked_in_at)))
                .slice(0, 6)
                .map((p) => (
                  <div className="summary-row" key={String(p.registration_id)}>
                    <span>{String(p.name)}</span>
                    <small>{new Date(String(p.checked_in_at)).toLocaleTimeString()}</small>
                  </div>
                ))}
            </Card>
            <Card>
              <h2>Event history</h2>
              {history.data?.slice(0, 6).map((h) => (
                <div className="timeline-row" key={h.id}>
                  <StatusBadge value={String(h.new_status)} />
                  <small>{new Date(String(h.created_at)).toLocaleString()}</small>
                  <p>{String(h.reason)}</p>
                </div>
              ))}
            </Card>
          </div>
          <div className="button-row">
            <Button asChild variant="secondary">
              <Link to={'/check-in?event=' + e.id}>
                <ScanLine size={16} /> Open check-in
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={'/completion?event=' + e.id}>
                <ClipboardCheck size={16} />
                Completion report
              </Link>
            </Button>
          </div>
        </>
      )}
      {mode === 'finance' && (
        <>
          <div className="stats-grid">
            {['allocation', 'expense', 'sponsorship'].map((k) => (
              <Metric
                key={k}
                label={
                  k === 'allocation'
                    ? 'Approved budget'
                    : k === 'expense'
                      ? 'Approved expenses'
                      : 'Sponsorship'
                }
                value={
                  '₹' +
                  (
                    q.data
                      ?.filter((b) => b.kind === k && b.status === 'approved')
                      .reduce((n, b) => n + Number(b.amount), 0) || 0
                  ).toLocaleString('en-IN')
                }
                icon={<Wallet />}
              />
            ))}
            <Metric
              label="Remaining budget"
              value={
                '₹' +
                (
                  q.data
                    ?.filter((b) => b.status === 'approved')
                    .reduce(
                      (n, b) =>
                        n +
                        (['allocation', 'sponsorship'].includes(String(b.kind))
                          ? Number(b.amount)
                          : b.kind === 'expense'
                            ? -Number(b.amount)
                            : 0),
                      0,
                    ) || 0
                ).toLocaleString('en-IN')
              }
              icon={<TrendingUp />}
            />
          </div>
          <p className="info">
            Reimbursement requests track repayment separately and do not double-count recorded
            expenses. Payments and transfers are not processed by PLANORA.
          </p>
        </>
      )}
      {!['registrations', 'check-in', 'operations'].includes(mode) && (
        <Card>
          <div className="section-title">
            <h2>
              {mode === 'finance'
                ? 'Budget ledger'
                : mode === 'completion'
                  ? 'Completion report'
                  : mode[0].toUpperCase() + mode.slice(1)}
            </h2>
            <div className="button-row">
              {mode === 'volunteers' && (
                <Button onClick={() => setForm('volunteer')}>
                  <Plus size={16} />
                  Assign volunteer
                </Button>
              )}
              {mode === 'announcements' && (
                <Button onClick={() => setForm('announcement')}>
                  <Plus size={16} />
                  Post update
                </Button>
              )}
              {mode === 'finance' && can('budget.manage', e) && (
                <Button onClick={() => setForm('budget')}>
                  <Plus size={16} />
                  Add entry
                </Button>
              )}
              {mode === 'certificates' && (
                <Button
                  disabled={e.status !== 'COMPLETED' || action.busy}
                  onClick={() =>
                    action.run(
                      () => certificateService.issue(e.id),
                      'Certificates issued to checked-in participants',
                    )
                  }
                >
                  Issue attendance certificates
                </Button>
              )}
              {mode === 'completion' && can('event.manage', e) && (
                <Button onClick={() => setForm('completion')}>Submit report</Button>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  action.run(() => exportRows(q.data || [], 'PLANORA-' + mode), 'Export ready')
                }
              >
                <Download size={16} />
                Export
              </Button>
            </div>
          </div>
          <QueryState loading={q.isLoading} error={q.error}>
            <DataTable
              rows={q.data || []}
              columns={columnsFor(mode)}
              actions={(r) => (
                <>
                  {mode === 'finance' && r.status === 'pending' && can('budget.approve', e) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setReview(r);
                        setForm('review');
                      }}
                    >
                      Review
                    </Button>
                  )}
                  {mode === 'finance' && r.receipt_path ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        action.run(async () => {
                          const url = await storageService.url(String(r.receipt_path), 'receipts');
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }, 'Receipt opened')
                      }
                    >
                      Receipt
                    </Button>
                  ) : null}
                  {mode === 'certificates' && !r.revoked_at && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setReview(r);
                        setForm('revoke');
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                  {mode === 'completion' && can('event.approve', e) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setReview(r);
                        setForm('completion-review');
                      }}
                    >
                      Review
                    </Button>
                  )}
                </>
              )}
            />
          </QueryState>
        </Card>
      )}
      <Modal
        title={form.replaceAll('-', ' ').replace(/^./, (s) => s.toUpperCase())}
        open={!!form}
        onOpenChange={(v) => !v && setForm('')}
      >
        {form === 'budget' && (
          <label className="field">
            Receipt / invoice
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f)
                  void action.run(
                    async () =>
                      setReceipt(await storageService.upload(institutionId, e.id, f, 'receipts')),
                    'Receipt attached',
                  );
              }}
            />
          </label>
        )}
        <SmartForm
          key={form}
          fields={
            fields[form] ||
            (form === 'completion-review'
              ? [
                  {
                    name: 'status',
                    label: 'Decision',
                    type: 'select',
                    required: true,
                    options: [
                      { value: 'approved', label: 'Approve' },
                      { value: 'revision_requested', label: 'Request revision' },
                    ],
                  },
                  { name: 'comments', label: 'Review comments', type: 'textarea', required: true },
                ]
              : [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }])
          }
          onSubmit={async (p) => {
            if (form === 'manual-check-in') {
              await attendanceService.checkIn(
                e.id,
                undefined,
                String(review?.registration_id),
                String(p.reason),
              );
            } else if (form === 'reject-registration') {
              await registrationService.action(
                String(review?.registration_id),
                'reject',
                String(p.reason),
              );
            } else if (form === 'revoke') {
              await certificateService.revoke(String(review?.id), String(p.reason));
            } else if (form === 'completion-review') {
              await reportService.complete(e.id, p);
            } else {
              await save(p);
              return;
            }
            await action.run(async () => undefined, 'Action recorded');
            setForm('');
          }}
        />
      </Modal>
      <Modal
        title="Registration details"
        open={!!participant}
        onOpenChange={(v) => !v && setParticipant(null)}
      >
        {participant && (
          <>
            <h3>{String(participant.name)}</h3>
            <p>{String(participant.registration_number)}</p>
            <StatusBadge value={String(participant.status)} />
            <h4>Registration answers</h4>
            <dl>
              {Object.entries(
                (q.data?.find((r) => r.id === participant.registration_id)?.answers ||
                  {}) as Record<string, string>,
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{e.questions.find((question) => question.id === k)?.label || k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Modal>
    </>
  );
}
function columnsFor(mode: WorkspaceMode) {
  const keys: Record<string, string[]> = {
    volunteers: ['user_id', 'status', 'duty', 'starts_at', 'attended'],
    announcements: ['title', 'body', 'created_at'],
    certificates: ['recipient_name', 'event_title', 'issued_at', 'revoked_at'],
    feedback: ['rating', 'comment', 'created_at'],
    finance: ['kind', 'category', 'description', 'amount', 'status', 'review_note'],
    completion: ['summary', 'outcomes', 'status', 'comments'],
  };
  return (keys[mode] || []).map((key) => ({
    key,
    label: key.replaceAll('_', ' ').replace(/^./, (s) => s.toUpperCase()),
    ...(key === 'status'
      ? { render: (r: DataRow) => <StatusBadge value={String(r.status)} /> }
      : {}),
  }));
}
function Scanner({ event }: { event: CampusEvent }) {
  const action = useAction();
  const [running, setRunning] = useState(false),
    [result, setResult] = useState<{
      status: string;
      name?: string;
      registration_number: string;
      checked_in_at: string;
    } | null>(null),
    [manualToken, setManualToken] = useState('');
  const scanner = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const busy = useRef(false);
  useEffect(
    () => () => {
      if (scanner.current?.isScanning) void scanner.current.stop().catch(() => undefined);
    },
    [],
  );
  const scan = async (token: string) => {
    if (busy.current) return;
    busy.current = true;
    const r = await action.run(
      () => attendanceService.checkIn(event.id, token),
      'Ticket validated',
    );
    if (r) setResult(r);
    setTimeout(() => {
      busy.current = false;
    }, 1800);
  };
  return (
    <Card className="scanner-card">
      <div>
        <div className="eyebrow">LIVE CHECK-IN</div>
        <h2>Scan. Welcome. Repeat.</h2>
        <p>Use the rear camera to scan PLANORA tickets. Check-in must be open for this event.</p>
        <div className="button-row">
          <Button
            disabled={running || event.status !== 'ONGOING'}
            onClick={() =>
              action.run(async () => {
                const { Html5Qrcode } = await import('html5-qrcode');
                const s = new Html5Qrcode('planora-scanner');
                scanner.current = s;
                await s.start(
                  { facingMode: 'environment' },
                  { fps: 8, qrbox: 220 },
                  (text) => void scan(text),
                  () => undefined,
                );
                setRunning(true);
              }, 'Camera ready')
            }
          >
            <Camera size={18} /> Start camera
          </Button>
          <Button
            variant="secondary"
            disabled={!running}
            onClick={() =>
              action.run(async () => {
                await scanner.current?.stop();
                setRunning(false);
              }, 'Camera stopped')
            }
          >
            <StopCircle size={18} />
            Stop
          </Button>
        </div>
        <div className="scan-fallback">
          <label>
            QR token fallback
            <input
              placeholder="PLANORA:…"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={!manualToken || action.busy}
            onClick={() => scan(manualToken)}
          >
            Validate token
          </Button>
        </div>
        {result && (
          <div
            role="status"
            className={
              'scan-result ' + (result.status === 'already_checked_in' ? 'duplicate' : 'success')
            }
          >
            <CheckCircle2 size={25} />
            <h3>{result.status === 'already_checked_in' ? 'Already Checked In' : 'Welcome in!'}</h3>
            <p>{result.name || result.registration_number}</p>
            <small>{new Date(result.checked_in_at).toLocaleString()}</small>
          </div>
        )}
      </div>
      <div className="scanner-surface">
        <div id="planora-scanner" />
        {!running && (
          <div className="scanner-placeholder">
            <ScanLine size={64} />
            <span>CAMERA PREVIEW</span>
            <small>Camera access starts only when you choose it.</small>
          </div>
        )}
      </div>
    </Card>
  );
}
