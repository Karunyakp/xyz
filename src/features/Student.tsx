import { SecureImage } from '../components/SecureImage';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
} from 'date-fns';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Ticket,
  Medal,
  CalendarDays,
  Star,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { useApp } from '../app/context';
import { useRows, useAction } from '../app/hooks';
import {
  authService,
  certificateService,
  clubService,
  notificationService,
  reportService,
  ticketService,
  userService,
  registrationService,
  volunteerService,
} from '../services';
import { certificatePdf } from '../services/exportService';
import type { CampusEvent, Registration, DataRow } from '../domain/models';
import {
  Button,
  Card,
  PageHeader,
  Empty,
  QueryState,
  StatusBadge,
  Modal,
  SmartForm,
  Badge,
  Metric,
} from '../components/ui';
import { eventTime } from './Events';
export function MyEvents() {
  const { session } = useApp();
  const regs = useRows<Registration>('registrations', {
    userId: session?.user.id,
    order: 'created_at',
  });
  const events = useRows<CampusEvent>('events', { order: 'starts_at' });
  const attendance = useRows('attendance', { userId: session?.user.id });
  const teams = useRows('teams');
  const [tab, setTab] = useState('All');
  const [ticket, setTicket] = useState<{ token: string; title: string; number: string } | null>(
    null,
  );
  const [cancel, setCancel] = useState('');
  const [feedback, setFeedback] = useState('');
  const action = useAction();
  const filtered =
    regs.data?.filter(
      (r) =>
        tab === 'All' ||
        (tab === 'Attended'
          ? attendance.data?.some((a) => a.registration_id === r.id)
          : tab === 'Upcoming'
            ? events.data?.some((e) => e.id === r.event_id && new Date(e.starts_at) > new Date()) &&
              r.status === 'confirmed'
            : r.status === tab.toLowerCase()),
    ) || [];
  return (
    <>
      <PageHeader
        eyebrow="YOUR CAMPUS PLANS"
        title="You’re on the list."
        description="All your registrations, tickets and moments in one place."
      />
      <div className="category-tabs">
        {[
          'All',
          'Upcoming',
          'Confirmed',
          'Pending',
          'Waitlisted',
          'Invited',
          'Attended',
          'Cancelled',
        ].map((t) => (
          <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <QueryState loading={regs.isLoading} error={regs.error}>
        {filtered.length ? (
          <div className="registration-list">
            {filtered.map((r) => {
              const e = events.data?.find((v) => v.id === r.event_id);
              return (
                <Card className="registration-row" key={r.id}>
                  <div className="date-tile">
                    {e ? format(new Date(e.starts_at), 'dd') : '—'}
                    <small>{e ? format(new Date(e.starts_at), 'MMM') : ''}</small>
                  </div>
                  <div className="registration-main">
                    <StatusBadge value={r.status} />
                    <h3>
                      <Link to={'/events/' + r.event_id}>{e?.title || 'Event registration'}</Link>
                    </h3>
                    <p>{e ? eventTime(e) : r.registration_number}</p>
                    <small>{r.registration_number}</small>
                    {r.team_id && (
                      <details>
                        <summary>Team details</summary>
                        <p>
                          {String(teams.data?.find((t) => t.id === r.team_id)?.name || 'Your team')}
                        </p>
                        <code>
                          {String(teams.data?.find((t) => t.id === r.team_id)?.join_code || '')}
                        </code>
                        <p>Share this code with your team. Each member registers independently.</p>
                      </details>
                    )}
                    {r.invitation_expires_at && (
                      <p className="text-amber">
                        Accept by {new Date(r.invitation_expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="registration-actions">
                    {r.status === 'confirmed' &&
                      !attendance.data?.some((a) => a.registration_id === r.id) && (
                        <Button
                          disabled={action.busy}
                          onClick={async () => {
                            const t = await action.run(
                              () => ticketService.issue(r.id),
                              'Ticket ready',
                            );
                            if (t)
                              setTicket({
                                token: t,
                                title: e?.title || 'Your event',
                                number: r.registration_number,
                              });
                          }}
                        >
                          <Ticket size={16} /> Show QR ticket
                        </Button>
                      )}
                    {r.status === 'invited' && (
                      <Button
                        disabled={action.busy}
                        onClick={() =>
                          action.run(
                            () => registrationService.action(r.id, 'accept'),
                            'Your seat is confirmed',
                          )
                        }
                      >
                        Accept seat
                      </Button>
                    )}
                    {!['cancelled', 'rejected', 'expired'].includes(r.status) &&
                      !attendance.data?.some((a) => a.registration_id === r.id) && (
                        <Button variant="ghost" onClick={() => setCancel(r.id)}>
                          Cancel registration
                        </Button>
                      )}
                    {attendance.data?.some((a) => a.registration_id === r.id) && (
                      <Badge tone="green">
                        <CheckCircle2 size={14} /> Checked in
                      </Badge>
                    )}
                    {e?.status === 'COMPLETED' &&
                      attendance.data?.some((a) => a.registration_id === r.id) && (
                        <Button variant="secondary" onClick={() => setFeedback(e.id)}>
                          <Star size={15} /> Give feedback
                        </Button>
                      )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <Empty
              title="Your next experience is waiting."
              text="Find an event that feels like you and save your place."
              action={
                <Button asChild>
                  <Link to="/explore">
                    Explore events <ArrowUpRight size={16} />
                  </Link>
                </Button>
              }
            />
          </Card>
        )}
      </QueryState>
      <Modal title="Your event ticket" open={!!ticket} onOpenChange={(v) => !v && setTicket(null)}>
        <div className="ticket-view">
          <Badge tone="green">CONFIRMED</Badge>
          <h2>{ticket?.title}</h2>
          {ticket && <QRCodeSVG value={ticket.token} size={240} level="M" />}
          <strong>{ticket?.number}</strong>
          <p>
            Show this QR at the event check-in desk. Opening a new ticket replaces your previous
            code.
          </p>
        </div>
      </Modal>
      <Modal
        title="Cancel your registration?"
        open={!!cancel}
        onOpenChange={(v) => !v && setCancel('')}
      >
        <p>
          Your seat will be released to the waitlist. You cannot register again for this event using
          the same account.
        </p>
        <Button
          variant="danger"
          disabled={action.busy}
          onClick={async () => {
            await action.run(
              () => registrationService.action(cancel, 'cancel'),
              'Registration cancelled',
            );
            setCancel('');
          }}
        >
          Confirm cancellation
        </Button>
      </Modal>
      <Modal
        title="How was your experience?"
        open={!!feedback}
        onOpenChange={(v) => !v && setFeedback('')}
      >
        <SmartForm
          fields={[
            {
              name: 'rating',
              label: 'Rating',
              type: 'select',
              required: true,
              options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n + ' / 5' })),
            },
            { name: 'comment', label: 'What went well? What could improve?', type: 'textarea' },
          ]}
          onSubmit={async (p) => {
            await reportService.feedback(feedback, Number(p.rating), String(p.comment));
            setFeedback('');
            await action.run(async () => undefined, 'Thank you for your feedback');
          }}
        />
      </Modal>
    </>
  );
}
export function CalendarPage() {
  const { institutionId } = useApp();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const events = useQuery({
    queryKey: ['calendar', institutionId, format(month, 'yyyy-MM')],
    queryFn: async () => {
      const { rows } = await import('../services/repository');
      return rows<CampusEvent>('events', institutionId, {
        order: 'starts_at',
        ascending: true,
        limit: 1000,
      });
    },
    enabled: !!institutionId,
  });
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  const dayEvents = events.data?.filter((e) => isSameDay(new Date(e.starts_at), selected)) || [];
  return (
    <>
      <PageHeader
        eyebrow="MAKE SPACE FOR WHAT MATTERS"
        title="Your campus calendar."
        description="Plan your week around the experiences you don’t want to miss."
      />
      <Card>
        <div className="section-title">
          <h2>{format(month, 'MMMM yyyy')}</h2>
          <div className="button-row">
            <Button
              variant="ghost"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMonth(new Date());
                setSelected(new Date());
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <QueryState loading={events.isLoading} error={events.error}>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div className="calendar-day-name" key={d}>
                {d}
              </div>
            ))}
            {days.map((d) => (
              <button
                key={d.toISOString()}
                className={
                  'calendar-cell ' +
                  (!isSameMonth(d, month) ? 'outside ' : '') +
                  (isSameDay(d, selected) ? 'selected' : '')
                }
                onClick={() => setSelected(d)}
              >
                <span>{format(d, 'd')}</span>
                {events.data
                  ?.filter((e) => isSameDay(new Date(e.starts_at), d))
                  .slice(0, 2)
                  .map((e) => (
                    <small key={e.id}>{e.title}</small>
                  ))}
              </button>
            ))}
          </div>
        </QueryState>
      </Card>
      <div className="section-title">
        <h2>{format(selected, 'EEEE, d MMMM')}</h2>
        <span>{dayEvents.length} events</span>
      </div>
      {dayEvents.length ? (
        dayEvents.map((e) => (
          <Link className="calendar-event" key={e.id} to={'/events/' + e.id}>
            <CalendarDays />
            <div>
              <h3>{e.title}</h3>
              <p>{eventTime(e)}</p>
            </div>
            <StatusBadge value={e.status} />
            <ArrowUpRight />
          </Link>
        ))
      ) : (
        <Card>
          <Empty
            title="A little breathing room."
            text="No visible events are scheduled for this day."
          />
        </Card>
      )}
    </>
  );
}
export function Clubs() {
  const { session } = useApp();
  const clubs = useRows('clubs');
  const memberships = useRows('club_memberships', { userId: session?.user.id });
  const action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="FIND YOUR PEOPLE"
        title="There’s a community for you."
        description="Follow your interests. Join a club. Start something together."
      />
      <QueryState loading={clubs.isLoading} error={clubs.error}>
        {clubs.data?.length ? (
          <div className="club-grid">
            {clubs.data.map((c, i) => (
              <Card className="club-card" key={c.id}>
                <div className={'club-monogram color-' + (i % 4)}>
                  {c.logo_path ? (
                    <SecureImage path={String(c.logo_path)} alt={String(c.name)} />
                  ) : (
                    String(c.name).slice(0, 2).toUpperCase()
                  )}
                </div>
                <h2>{String(c.name)}</h2>
                <p>{String(c.description)}</p>
                <div className="club-actions">
                  <Button
                    variant="secondary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        () =>
                          clubService.action(
                            c.id,
                            memberships.data?.some((m) => m.club_id === c.id)
                              ? 'unfollow'
                              : 'following',
                          ),
                        'Club preferences updated',
                      )
                    }
                  >
                    {memberships.data?.some((m) => m.club_id === c.id) ? 'Unfollow' : 'Follow club'}
                  </Button>
                  {Boolean(c.accepting_members) && (
                    <Button
                      disabled={action.busy}
                      onClick={() =>
                        action.run(
                          () => clubService.action(c.id, 'applied'),
                          'Membership application submitted',
                        )
                      }
                    >
                      Apply to join
                    </Button>
                  )}
                </div>
                <Link className="text-link" to={'/explore?club=' + c.id}>
                  Discover club events <ArrowUpRight size={16} />
                </Link>
                {memberships.data
                  ?.filter((m) => m.club_id === c.id)
                  .map((m) => (
                    <StatusBadge key={m.id} value={String(m.status)} />
                  ))}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Empty
              title="Communities are coming."
              text="Your institution’s clubs will appear here."
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
export function Opportunities() {
  const { session } = useApp();
  const volunteers = useRows('volunteers', { userId: session?.user.id }),
    tasks = useRows('tasks', { order: 'due_at', ascending: true }),
    events = useRows<CampusEvent>('events');
  const action = useAction();
  return (
    <>
      <PageHeader
        eyebrow="GIVE SOMETHING BACK"
        title="Be behind the moments."
        description="Your volunteer assignments and tasks, all in one place."
      />
      <div className="section-title">
        <h2>Your assignments</h2>
        <Link to="/explore">
          Find an event to volunteer <ArrowUpRight size={15} />
        </Link>
      </div>
      <QueryState loading={volunteers.isLoading} error={volunteers.error}>
        {volunteers.data?.length ? (
          <div className="two-col">
            {volunteers.data.map((v) => (
              <Card key={v.id}>
                <StatusBadge value={String(v.status)} />
                <h3>{events.data?.find((e) => e.id === v.event_id)?.title}</h3>
                <p>{String(v.duty || 'Assignment details will be provided by your organiser.')}</p>
                {v.starts_at ? <p>{new Date(String(v.starts_at)).toLocaleString()}</p> : null}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Empty
              title="Make an experience happen."
              text="Apply to volunteer from any published event’s detail page."
            />
          </Card>
        )}
      </QueryState>
      <div className="section-title">
        <h2>Your task list</h2>
      </div>
      {tasks.data
        ?.filter((t) => t.assigned_to === session?.user.id)
        .map((t) => (
          <Card className="task-row" key={t.id}>
            <div>
              <h3>{String(t.title)}</h3>
              <p>{String(t.notes || '')}</p>
              {t.due_at ? <small>Due {new Date(String(t.due_at)).toLocaleString()}</small> : null}
            </div>
            <select
              aria-label={'Status for ' + String(t.title)}
              value={String(t.status)}
              onChange={(e) =>
                action.run(
                  () =>
                    volunteerService.task(
                      String(t.event_id),
                      { status: e.target.value, notes: t.notes },
                      t.id,
                    ),
                  'Task updated',
                )
              }
            >
              {['todo', 'doing', 'done', 'blocked'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Card>
        ))}
    </>
  );
}
export function Passport() {
  const { session, institution } = useApp();
  const certs = useRows('certificates', { userId: session?.user.id });
  const attendance = useRows('attendance', { userId: session?.user.id });
  const volunteers = useRows('volunteers', { userId: session?.user.id });
  return (
    <>
      <PageHeader
        eyebrow="MORE THAN A TRANSCRIPT"
        title="Your experiences. Your story."
        description="A record of the things you showed up for, the skills you built and the people you helped."
      />
      <div className="stats-grid three">
        <Metric
          label="Events attended"
          value={attendance.data?.length || 0}
          icon={<CalendarDays />}
        />
        <Metric
          label="Certificates earned"
          value={certs.data?.filter((c) => !c.revoked_at).length || 0}
          icon={<Medal />}
        />
        <Metric
          label="Volunteer contributions"
          value={volunteers.data?.filter((v) => v.attended).length || 0}
          icon={<Users />}
        />
      </div>
      <div className="section-title">
        <h2>Your certificates</h2>
      </div>
      <QueryState loading={certs.isLoading} error={certs.error}>
        {certs.data?.length ? (
          <div className="two-col">
            {certs.data.map((c) => (
              <Card className="certificate-card" key={c.id}>
                <Medal size={32} />
                <div className="eyebrow">CERTIFICATE OF PARTICIPATION</div>
                <h2>{String(c.event_title)}</h2>
                <p>{String(c.recipient_name)}</p>
                <StatusBadge value={c.revoked_at ? 'revoked' : 'issued'} />
                <div className="button-row">
                  <Button
                    variant="secondary"
                    disabled={!!c.revoked_at}
                    onClick={() =>
                      certificatePdf(
                        c as unknown as Parameters<typeof certificatePdf>[0],
                        institution?.name || '',
                      )
                    }
                  >
                    <Download size={16} /> Download PDF
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to={'/verify/' + c.verification_code}>
                      Verify <ArrowUpRight size={15} />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Empty
              title="Your story is just beginning."
              text="Attend an event and your organiser can issue a verified certificate here."
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
export function Notifications() {
  const { session } = useApp();
  const notices = useRows('notifications', { userId: session?.user.id, order: 'created_at' });
  const action = useAction();
  return (
    <>
      <PageHeader eyebrow="IN THE LOOP" title="Your campus, keeping you posted." />
      <QueryState loading={notices.isLoading} error={notices.error}>
        {notices.data?.length ? (
          notices.data.map((n) => (
            <Card className={'notification-row ' + (!n.read_at ? 'unread' : '')} key={n.id}>
              <span className="notification-dot" />
              <div>
                <h3>{String(n.title)}</h3>
                <p>{String(n.body)}</p>
                <small>{new Date(String(n.created_at)).toLocaleString()}</small>
              </div>
              {n.link ? (
                <Link className="text-link" to={String(n.link)}>
                  View <ArrowUpRight size={14} />
                </Link>
              ) : null}
              {!n.read_at && (
                <Button
                  variant="ghost"
                  disabled={action.busy}
                  onClick={() => action.run(() => notificationService.read(n.id), 'Marked as read')}
                >
                  Mark read
                </Button>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <Empty
              title="You’re all caught up."
              text="Updates and announcements will arrive here."
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
export function Profile() {
  const { context, refresh, session } = useApp();
  const p = context?.profile;
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE ABOUT YOU"
        title="Make yourself known."
        description="Your personal information stays within your authorised campus workspace."
      />
      <div className="two-col">
        <Card>
          <h2>Your profile</h2>
          <SmartForm
            initial={p}
            fields={[
              { name: 'full_name', label: 'Full name', required: true },
              { name: 'bio', label: 'About you', type: 'textarea' },
              {
                name: 'interests',
                label: 'Interests',
                type: 'list',
                hint: 'Comma-separated event categories; for example Technical, Sports, Cultural.',
              },
              { name: 'skills', label: 'Skills', type: 'list' },
            ]}
            onSubmit={async (p) => {
              await userService.profile(p);
              await refresh();
            }}
          />
        </Card>
        <Card>
          <h2>Account & academic information</h2>
          <Button
            variant="secondary"
            onClick={async () => {
              await authService.accept();
              await refresh();
            }}
          >
            Accept pending institution invitations
          </Button>
          <p>{session?.user.email}</p>
          {context?.memberships.map((m) => (
            <div key={m.institution_id}>
              <p>
                Membership: {m.kind} · {m.status}
              </p>
              <p>Student number: {m.student_number || 'Not assigned'}</p>
              <p>Academic year: {m.academic_year || 'Not assigned'}</p>
              <small>Contact your institution administrator to correct academic details.</small>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
export function VerifyCertificate() {
  const { code = '' } = useParams();
  const q = useQuery({
    queryKey: ['verify', code],
    queryFn: () => certificateService.verify(code),
    retry: false,
  });
  return (
    <div className="verify-page">
      <Link className="brand" to="/">
        <img src="/logo.svg" alt="" />
        PLANORA
      </Link>
      <Card>
        <Medal size={42} />
        <h1>Certificate verification</h1>
        <QueryState loading={q.isLoading} error={q.error}>
          {q.data ? (
            <>
              <StatusBadge value={q.data.valid ? 'verified' : 'revoked'} />
              <h2>{q.data.recipient_name}</h2>
              <p>{q.data.event_title}</p>
              <p>{q.data.institution}</p>
              <small>Issued {new Date(q.data.issued_at).toLocaleDateString()}</small>
            </>
          ) : (
            <Empty
              title="Certificate not found"
              text="Check the verification code on your certificate."
            />
          )}
        </QueryState>
      </Card>
    </div>
  );
}
export function Support() {
  const { institutionId } = useApp();
  const requests = useRows<DataRow>('support_requests');
  const action = useAction();
  return (
    <>
      <PageHeader eyebrow="WE’RE HERE TO HELP" title="A little help goes a long way." />
      <div className="two-col">
        <Card>
          <h2>Contact support</h2>
          <SmartForm
            fields={[
              { name: 'subject', label: 'What do you need help with?', required: true },
              { name: 'body', label: 'Tell us a little more', type: 'textarea', required: true },
            ]}
            submitLabel="Submit support request"
            onSubmit={async (p) => {
              await reportService.support(institutionId, String(p.subject), String(p.body));
              await action.run(async () => undefined, 'Support request submitted');
            }}
          />
        </Card>
        <Card>
          <h2>Your requests</h2>
          {requests.data?.map((r) => (
            <div className="note" key={r.id}>
              <StatusBadge value={String(r.status)} />
              <h3>{String(r.subject)}</h3>
              <p>{String(r.body)}</p>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
