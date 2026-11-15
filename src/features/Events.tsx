import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  CalendarDays,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../app/context';
import { useAction, useRows } from '../app/hooks';
import { eventService, registrationService, storageService, volunteerService } from '../services';
import { eventCalendar } from '../services/exportService';
import type { EventFilters } from '../services';
import {
  categories,
  transitions,
  type CampusEvent,
  type Registration,
  safeUrl,
} from '../domain/models';
import {
  Button,
  Card,
  PageHeader,
  QueryState,
  Empty,
  Badge,
  StatusBadge,
  Modal,
  SmartForm,
} from '../components/ui';
export const eventTime = (e: CampusEvent) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: e.timezone,
  }).format(new Date(e.starts_at));
function Cover({ event }: { event: CampusEvent }) {
  const image = useQuery({
    queryKey: ['cover', event.cover_path],
    queryFn: () => storageService.url(event.cover_path!),
    enabled: !!event.cover_path,
    staleTime: 600000,
  });
  return (
    <div className={'event-cover category-' + (categories.indexOf(event.category) % 5)}>
      {image.data ? (
        <img src={image.data} alt="" />
      ) : (
        <>
          <div className="cover-lines" />
          <div className="cover-type">
            {event.category.toUpperCase()}
            <span>{event.event_type}</span>
          </div>
          <div className="cover-symbol">
            {event.category === 'Cultural' ? '✳' : event.category === 'Sports' ? '↗' : '✦'}
          </div>
        </>
      )}
      <Badge>{event.mode === 'online' ? 'Online' : event.category}</Badge>
    </div>
  );
}
export function EventCard({ event }: { event: CampusEvent }) {
  return (
    <Link to={'/events/' + event.id} className="event-card">
      <Cover event={event} />
      <div className="event-card-body">
        <div className="event-meta">
          <span>{format(new Date(event.starts_at), 'EEE, d MMM').toUpperCase()}</span>
          <span>FREE</span>
        </div>
        <h3>{event.title}</h3>
        <p>
          <MapPin size={14} />
          {event.mode === 'online'
            ? 'Online event'
            : event.mode === 'hybrid'
              ? 'Campus + online'
              : 'On campus'}
          <span>·</span>
          {event.event_type}
        </p>
        <div className="event-card-foot">
          <StatusBadge value={event.status} />
          <span className="round-arrow">
            <ArrowUpRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  );
}
export function EventList({ managed = false }: { managed?: boolean }) {
  const { institutionId, can } = useApp();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<EventFilters>({
    managed,
    club_id: params.get('club') || undefined,
  });
  const [search, setSearch] = useState('');
  const [more, setMore] = useState(false);
  const categoryRows = useRows('global_categories');
  const categoryOptions =
    categoryRows.data?.filter((c) => c.enabled).map((c) => String(c.name)) || categories;
  const departments = useRows('departments');
  const clubs = useRows('clubs');
  const result = useQuery({
    queryKey: ['events', institutionId, filters],
    queryFn: () => eventService.list(institutionId, filters),
    enabled: !!institutionId,
  });
  const update = (key: keyof EventFilters, value: unknown) =>
    setFilters((f) => ({ ...f, [key]: value, page: 0 }));
  return (
    <>
      <PageHeader
        eyebrow={managed ? 'ORGANISER WORKSPACE' : 'FIND YOUR NEXT THING'}
        title={managed ? 'Your events, in motion.' : 'Good things are happening.'}
        description={
          managed
            ? 'From the first idea to the final applause. Manage every step here.'
            : 'A new skill. A new community. A story worth telling.'
        }
        action={
          can('event.create') ? (
            <Button asChild>
              <Link to="/create-event">
                <Plus size={17} /> Create event
              </Link>
            </Button>
          ) : (
            <Badge tone="green">
              <span className="tiny-dot" /> Campus experiences
            </Badge>
          )
        }
      />
      <div className="filter-bar">
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            update('search', search);
          }}
        >
          <Search size={19} />
          <input
            aria-label="Search events"
            placeholder="Search events, experiences, possibilities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm" variant="ghost">
            Search
          </Button>
        </form>
        <Button variant="secondary" onClick={() => setMore(!more)}>
          <SlidersHorizontal size={17} />
          Filters
        </Button>
      </div>
      <div className="category-tabs">
        <button
          className={!filters.category ? 'selected' : ''}
          onClick={() => update('category', undefined)}
        >
          All experiences
        </button>
        {categoryOptions.slice(0, 7).map((c) => (
          <button
            key={c}
            className={filters.category === c ? 'selected' : ''}
            onClick={() => update('category', c)}
          >
            {c}
          </button>
        ))}
      </div>
      {more && (
        <Card className="filter-grid">
          <label>
            Category
            <select
              value={filters.category || ''}
              onChange={(e) => update('category', e.target.value || undefined)}
            >
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={filters.from?.slice(0, 10) || ''}
              onChange={(e) =>
                update('from', e.target.value ? new Date(e.target.value).toISOString() : undefined)
              }
            />
          </label>
          <label>
            Until
            <input
              type="date"
              value={filters.to?.slice(0, 10) || ''}
              onChange={(e) =>
                update(
                  'to',
                  e.target.value
                    ? new Date(new Date(e.target.value).getTime() + 86400000).toISOString()
                    : undefined,
                )
              }
            />
          </label>
          <label>
            Department
            <select
              value={filters.department_id || ''}
              onChange={(e) => update('department_id', e.target.value || undefined)}
            >
              <option value="">All departments</option>
              {departments.data?.map((d) => (
                <option value={d.id} key={d.id}>
                  {String(d.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Club
            <select
              value={filters.club_id || ''}
              onChange={(e) => update('club_id', e.target.value || undefined)}
            >
              <option value="">All clubs</option>
              {clubs.data?.map((c) => (
                <option value={c.id} key={c.id}>
                  {String(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select
              value={filters.mode || ''}
              onChange={(e) => update('mode', e.target.value || undefined)}
            >
              <option value="">Any format</option>
              <option value="online">Online</option>
              <option value="offline">On campus</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label>
            Participation
            <select
              onChange={(e) =>
                update('is_team', e.target.value === '' ? undefined : e.target.value === 'team')
              }
            >
              <option value="">Individual + team</option>
              <option value="team">Team</option>
              <option value="individual">Individual</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status || ''}
              onChange={(e) => update('status', e.target.value || undefined)}
            >
              <option value="">All visible events</option>
              {Object.keys(transitions).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Event type
            <input
              value={filters.event_type || ''}
              onChange={(e) => update('event_type', e.target.value || undefined)}
              placeholder="Workshop, Seminar…"
            />
          </label>
          <label className="check-field">
            <span>Only events I’m eligible for</span>
            <input
              type="checkbox"
              checked={!!filters.eligible}
              onChange={(e) => update('eligible', e.target.checked)}
            />
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setFilters({ managed });
              setSearch('');
            }}
          >
            Reset filters
          </Button>
        </Card>
      )}
      <div className="section-title">
        <h2>{filters.category || 'All experiences'}</h2>
        <span>{result.data?.count ?? '…'} events</span>
      </div>
      <QueryState loading={result.isLoading} error={result.error}>
        {result.data?.events.length ? (
          <div className="event-grid">
            {result.data.events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Card>
            <Empty
              title="A little quiet here."
              text="Try a different search, or check back for new campus experiences."
            />
          </Card>
        )}
      </QueryState>
      <div className="pagination">
        <Button
          variant="secondary"
          disabled={!filters.page}
          onClick={() => setFilters((f) => ({ ...f, page: (f.page || 0) - 1 }))}
        >
          <ChevronLeft size={16} /> Previous
        </Button>
        <span>Page {(filters.page || 0) + 1}</span>
        <Button
          variant="secondary"
          disabled={((filters.page || 0) + 1) * 12 >= (result.data?.count || 0)}
          onClick={() => setFilters((f) => ({ ...f, page: (f.page || 0) + 1 }))}
        >
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </>
  );
}
export function Home() {
  const { context, institutionId, session } = useApp();
  const upcoming = useQuery({
    queryKey: ['home-events', institutionId],
    queryFn: () => eventService.list(institutionId, { from: new Date().toISOString() }),
    enabled: !!institutionId,
  });
  const registrations = useRows<Registration>('registrations', { userId: session?.user.id });
  const announcements = useRows('announcements', { order: 'created_at', limit: 3 });
  const following = useRows('club_memberships', { userId: session?.user.id });
  const events = upcoming.data?.events || [];
  const featured = events.find((e) => e.featured) || events[0];
  const registered = events.filter((e) =>
    registrations.data?.some((r) => r.event_id === e.id && r.status === 'confirmed'),
  );
  const selected = events.filter(
    (e) =>
      context?.profile.interests.includes(e.category) ||
      following.data?.some((f) => f.club_id === e.club_id),
  );
  const today = events.filter(
    (e) => format(new Date(e.starts_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
  );
  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), 'EEEE, d MMMM yyyy').toUpperCase()}
        title={`Hey ${context?.profile.full_name.split(' ')[0] || 'there'}, make today count.`}
        description="Your campus is full of possibilities. Find yours."
        action={
          <Button asChild variant="secondary">
            <Link to="/explore">
              <Search size={17} /> Find an experience
            </Link>
          </Button>
        }
      />
      <div className="home-hero">
        <section className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-dot" /> YOUR NEXT GREAT CAMPUS MEMORY
          </div>
          <h2>
            Step out.
            <br />
            Show up.
            <br />
            <em>Be part of it.</em>
          </h2>
          <p>
            Big ideas, good people and experiences
            <br />
            that stay with you.
          </p>
          <Button asChild>
            <Link to="/explore">
              Explore what’s on <ArrowUpRight size={18} />
            </Link>
          </Button>
          <div className="hero-bottom">
            DISCOVER SOMETHING THAT MOVES YOU <ArrowRight size={17} />
          </div>
        </section>
        {featured ? (
          <Link to={'/events/' + featured.id} className="hero-event">
            <Cover event={featured} />
            <div className="hero-event-info">
              <Badge tone="green">IN THE SPOTLIGHT</Badge>
              <h2>{featured.title}</h2>
              <p>{eventTime(featured)}</p>
              <span>
                Take a closer look <ArrowUpRight size={19} />
              </span>
            </div>
          </Link>
        ) : (
          <section className="hero-art">
            <div className="big-asterisk">✳</div>
            <h3>
              A campus full
              <br />
              of possibility.
            </h3>
            <p>Published events will appear here.</p>
          </section>
        )}
      </div>
      <div className="home-columns">
        <section>
          <div className="section-title">
            <div>
              <div className="eyebrow">ON THE HORIZON</div>
              <h2>Find your next experience</h2>
            </div>
            <Link to="/explore">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <QueryState loading={upcoming.isLoading} error={upcoming.error}>
            {events.length ? (
              <div className="event-grid two">
                {events.slice(0, 4).map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            ) : (
              <Card>
                <Empty
                  title="Your next chapter is on its way."
                  text="Events appear here after your institution publishes them."
                />
              </Card>
            )}
          </QueryState>
          {selected.length > 0 && (
            <>
              <div className="section-title">
                <h2>
                  <Sparkles size={20} /> For your interests & clubs
                </h2>
              </div>
              <div className="event-grid two">
                {selected.slice(0, 2).map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </>
          )}
        </section>
        <aside className="home-aside">
          <Card>
            <div className="section-title">
              <h3>Your next stop</h3>
              <TicketIcon />
            </div>
            {registered[0] ? (
              <>
                <div className="date-tile">
                  {format(new Date(registered[0].starts_at), 'dd')}
                  <small>{format(new Date(registered[0].starts_at), 'MMM')}</small>
                </div>
                <h3>{registered[0].title}</h3>
                <p>{eventTime(registered[0])}</p>
                <Button asChild variant="secondary">
                  <Link to="/my-events">
                    View my ticket <ArrowUpRight size={16} />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p>Great experiences start with showing up.</p>
                <Link className="text-link" to="/explore">
                  Find your first event <ArrowRight size={15} />
                </Link>
              </>
            )}
          </Card>
          <Card className="passport-promo">
            <div className="passport-stamp">P.</div>
            <div className="eyebrow">YOUR EVENT PASSPORT</div>
            <h3>
              Every experience
              <br />
              leaves a mark.
            </h3>
            <p>Build a record of what you learned, created and contributed.</p>
            <Link to="/passport">
              Open your passport <ArrowUpRight size={17} />
            </Link>
          </Card>
          <Card>
            <h3>Campus notes</h3>
            {announcements.data?.length ? (
              announcements.data.map((a) => (
                <div className="note" key={a.id}>
                  <small>{format(new Date(String(a.created_at)), 'd MMM')}</small>
                  <strong>{String(a.title)}</strong>
                  <p>{String(a.body)}</p>
                </div>
              ))
            ) : (
              <p className="muted">Announcements from your campus will appear here.</p>
            )}
          </Card>
          {today.length > 0 && (
            <Card>
              <h3>Happening today</h3>
              {today.map((e) => (
                <Link className="list-link" key={e.id} to={'/events/' + e.id}>
                  {e.title}
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </Card>
          )}
          <Card>
            <h3>Closing soon</h3>
            {events
              .filter(
                (e) =>
                  e.status === 'REGISTRATION_OPEN' &&
                  new Date(e.registration_deadline).getTime() - Date.now() < 3 * 86400000,
              )
              .slice(0, 3)
              .map((e) => (
                <Link className="list-link" key={e.id} to={'/events/' + e.id}>
                  {e.title}
                  <Clock size={15} />
                </Link>
              ))}
            <p className="muted">Registration deadlines are shown on each event.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
function TicketIcon() {
  return <CalendarDays size={20} />;
}
export function EventDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { institutionId, session, can } = useApp();
  const event = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventService.get(id),
    enabled: !!id,
  });
  const regs = useRows<Registration>('registrations', { eventId: id, userId: session?.user.id });
  const venue = useRows('venues');
  const clubs = useRows('clubs');
  const [registerOpen, setRegisterOpen] = useState(false),
    [transition, setTransition] = useState(''),
    [reschedule, setReschedule] = useState(false);
  const action = useAction();
  const e = event.data;
  const registration = regs.data?.[0];
  return (
    <QueryState loading={event.isLoading} error={event.error}>
      {e && (
        <>
          <Link className="back-link" to="/explore">
            <ChevronLeft size={16} /> Back to experiences
          </Link>
          <div className="detail-cover">
            <Cover event={e} />
            <div className="detail-cover-overlay">
              <Badge>{e.category}</Badge>
              <h1>{e.title}</h1>
              <p>
                Hosted by{' '}
                {String(clubs.data?.find((c) => c.id === e.club_id)?.name || 'Your institution')}
              </p>
            </div>
          </div>
          <div className="detail-grid">
            <article>
              <div className="detail-toolbar">
                <StatusBadge value={e.status} />
                <div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      action.run(() => eventService.saveBookmark(e.id), 'Saved events updated')
                    }
                  >
                    <Bookmark size={17} /> Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      action.run(
                        () => navigator.clipboard.writeText(window.location.href),
                        'Event link copied',
                      )
                    }
                  >
                    <Share2 size={17} /> Share
                  </Button>
                  <Button variant="ghost" onClick={() => eventCalendar(e)}>
                    <CalendarDays size={17} /> Calendar
                  </Button>
                </div>
              </div>
              <Card>
                <h2>About this experience</h2>
                <p className="prose">{e.description}</p>
                {e.objectives && (
                  <>
                    <h3>What you’ll take away</h3>
                    <p className="prose">{e.objectives}</p>
                  </>
                )}
                {e.agenda.length > 0 && (
                  <>
                    <h3>The programme</h3>
                    {e.agenda.map((a, i) => (
                      <div className="agenda-row" key={i}>
                        <span>{a.time}</span>
                        <strong>{a.title}</strong>
                      </div>
                    ))}
                  </>
                )}
                {e.rules && (
                  <>
                    <h3>Good to know</h3>
                    <p className="prose">{e.rules}</p>
                  </>
                )}
                {e.instructions && (
                  <>
                    <h3>Before you arrive</h3>
                    <p className="prose">{e.instructions}</p>
                  </>
                )}
                <h3>Eligibility</h3>
                <p>
                  {e.allow_external
                    ? 'Open to eligible members and invited external participants.'
                    : 'Institution members only.'}{' '}
                  {e.eligible_departments.length > 0
                    ? 'Restricted to the configured departments.'
                    : ''}{' '}
                  {e.eligible_years.length > 0
                    ? 'Academic years: ' + e.eligible_years.join(', ')
                    : ''}
                </p>
                {e.is_team && (
                  <p>
                    Teams of {e.team_min}–{e.team_max}. Each member registers with the team code and
                    receives their own ticket. All required members must be confirmed before
                    check-in.
                  </p>
                )}
                {e.faqs.length > 0 && (
                  <>
                    <h3>Frequently asked</h3>
                    {e.faqs.map((f, i) => (
                      <details key={i}>
                        <summary>{f.question}</summary>
                        <p>{f.answer}</p>
                      </details>
                    ))}
                  </>
                )}
                {e.attachments.map((a, i) => (
                  <Button
                    key={i}
                    variant="secondary"
                    onClick={() =>
                      action.run(async () => {
                        const url = await storageService.url(a.path);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }, 'Attachment opened')
                    }
                  >
                    {a.name}
                    <ArrowUpRight size={15} />
                  </Button>
                ))}
              </Card>
              {(can('event.manage', e) || can('event.approve', e)) && (
                <Card>
                  <h3>Event workflow</h3>
                  <div className="button-row">
                    {transitions[e.status]
                      .filter((s) =>
                        ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(s)
                          ? can('event.approve', e)
                          : can('event.manage', e),
                      )
                      .map((s) => (
                        <Button
                          disabled={action.busy}
                          key={s}
                          variant="secondary"
                          onClick={() => setTransition(s)}
                        >
                          {s.replaceAll('_', ' ')}
                        </Button>
                      ))}
                    {can('event.manage', e) && (
                      <>
                        <Button asChild variant="secondary">
                          <Link to={'/operations?event=' + e.id}>Operations</Link>
                        </Button>
                        {['DRAFT', 'REVISION_REQUESTED', 'REJECTED'].includes(e.status) && (
                          <Button asChild variant="secondary">
                            <Link to={'/events/' + e.id + '/edit'}>Edit event</Link>
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          onClick={() => nav('/create-event?clone=' + e.id)}
                        >
                          Clone
                        </Button>
                        {!['CANCELLED', 'COMPLETED', 'ONGOING'].includes(e.status) && (
                          <Button variant="secondary" onClick={() => setReschedule(true)}>
                            Reschedule
                          </Button>
                        )}
                        {!['CANCELLED', 'COMPLETED'].includes(e.status) && (
                          <Button variant="danger" onClick={() => setTransition('CANCELLED')}>
                            Cancel event
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <p className="muted">
                    Changes and decisions are recorded in the approval history.
                  </p>
                </Card>
              )}
            </article>
            <aside>
              <Card className="registration-card">
                <div className="price">
                  Free<span>Every great idea starts somewhere.</span>
                </div>
                <div className="detail-fact">
                  <CalendarDays />
                  <div>
                    <strong>{eventTime(e)}</strong>
                    <small>{e.timezone}</small>
                  </div>
                </div>
                <div className="detail-fact">
                  <MapPin />
                  <div>
                    <strong>
                      {String(
                        venue.data?.find((v) => v.id === e.venue_id)?.name ||
                          (e.mode === 'online' ? 'Online event' : 'Campus venue'),
                      )}
                    </strong>
                    <small>
                      {String(venue.data?.find((v) => v.id === e.venue_id)?.building || e.mode)}
                    </small>
                  </div>
                </div>
                <div className="detail-fact">
                  <Users />
                  <div>
                    <strong>{e.capacity} participant capacity</strong>
                    <small>
                      {e.is_team ? 'Team experience' : 'Individual registration'}
                      {e.waitlist_enabled ? ' · Waitlist enabled' : ''}
                    </small>
                  </div>
                </div>
                <div className="detail-fact">
                  <Clock />
                  <div>
                    <strong>Register by</strong>
                    <small>{new Date(e.registration_deadline).toLocaleString()}</small>
                  </div>
                </div>
                {registration ? (
                  <>
                    <StatusBadge value={registration.status} />
                    <Button asChild>
                      <Link to="/my-events">
                        View registration <ArrowUpRight size={16} />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={
                      e.status !== 'REGISTRATION_OPEN' ||
                      new Date(e.registration_deadline) <= new Date()
                    }
                    onClick={() => setRegisterOpen(true)}
                  >
                    Register for this experience <ArrowRight size={17} />
                  </Button>
                )}
                <p className="tiny">
                  {e.manual_approval
                    ? 'Applications are reviewed by the organiser.'
                    : 'Your place is confirmed when registration succeeds.'}
                </p>
                {e.online_url && safeUrl(e.online_url) && (
                  <a
                    className="text-link"
                    href={safeUrl(e.online_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join online <ArrowUpRight size={14} />
                  </a>
                )}
              </Card>
              <Card>
                <h3>Be part of the team</h3>
                <p>Help make this experience happen.</p>
                <Button
                  disabled={action.busy}
                  variant="secondary"
                  onClick={() =>
                    action.run(
                      () => volunteerService.apply(e.id),
                      'Volunteer application submitted',
                    )
                  }
                >
                  Apply to volunteer <CheckCircle2 size={16} />
                </Button>
              </Card>
              {e.contact && (
                <Card>
                  <h3>Have a question?</h3>
                  <p className="prose">{e.contact}</p>
                </Card>
              )}
            </aside>
          </div>
          <Modal
            title="Save your place"
            description={e.title}
            open={registerOpen}
            onOpenChange={setRegisterOpen}
          >
            <SmartForm
              fields={[
                ...e.questions.map((q) => ({
                  name: q.id,
                  label: q.label,
                  type: q.type,
                  required: q.required,
                  options: q.options?.map((v) => ({ value: v, label: v })),
                })),
                ...(e.is_team
                  ? [
                      { name: '_team_name', label: 'Create a team name' },
                      {
                        name: '_team_code',
                        label: 'Or join with a team code',
                        hint: 'Enter one: a new team name or an existing team code.',
                      },
                    ]
                  : []),
              ]}
              submitLabel="Submit registration"
              onSubmit={async (p) => {
                const { _team_name, _team_code, ...answers } = p;
                const r = await registrationService.register(
                  id,
                  answers as Record<string, string>,
                  String(_team_name || ''),
                  String(_team_code || ''),
                );
                setRegisterOpen(false);
                await action.run(async () => r, 'Registration ' + r.status);
                nav('/my-events');
              }}
            />
          </Modal>
          <Modal
            title={transition.replaceAll('_', ' ')}
            open={!!transition}
            onOpenChange={(v) => !v && setTransition('')}
          >
            <SmartForm
              fields={[
                {
                  name: 'reason',
                  label: 'Reason / review comments',
                  type: 'textarea',
                  required: ['REJECTED', 'REVISION_REQUESTED', 'CANCELLED'].includes(transition),
                },
              ]}
              submitLabel="Confirm transition"
              onSubmit={async (p) => {
                await eventService.transition(id, transition, String(p.reason || ''));
                setTransition('');
                await action.run(async () => undefined, 'Event updated');
              }}
            />
          </Modal>
          <Modal
            title="Reschedule event"
            description="Rescheduling returns the event to draft for a fresh review and notifies registered participants."
            open={reschedule}
            onOpenChange={setReschedule}
          >
            <SmartForm
              fields={[
                { name: 'start', label: 'New start', type: 'datetime-local', required: true },
                { name: 'end', label: 'New end', type: 'datetime-local', required: true },
                {
                  name: 'deadline',
                  label: 'New registration deadline',
                  type: 'datetime-local',
                  required: true,
                },
                { name: 'reason', label: 'Reason', type: 'textarea', required: true },
              ]}
              onSubmit={async (p) => {
                await eventService.reschedule(
                  id,
                  String(p.start),
                  String(p.end),
                  String(p.deadline),
                  String(p.reason),
                );
                setReschedule(false);
                await action.run(async () => undefined, 'Event rescheduled for review');
              }}
            />
          </Modal>
          <small className="muted">Institution workspace: {institutionId.slice(0, 8)}</small>
        </>
      )}
    </QueryState>
  );
}
