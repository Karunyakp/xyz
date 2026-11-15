import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, asUser } from './db-harness.mjs';
let passed = 0,
  failed = 0;
const results = [];
const db = await createTestDatabase();
async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'passed' });
    console.log('PASS', name);
  } catch (e) {
    failed++;
    results.push({ name, status: 'failed', error: e.message });
    console.error('FAIL', name, e.message);
  }
}
const ids = Object.fromEntries(
  [
    'owner',
    'faculty',
    'student',
    'second',
    'third',
    'other',
    'volunteer',
    'platform',
    'unverified',
    'external',
    'faculty2',
  ].map((k) => [k, randomUUID()]),
);
const a = randomUUID(),
  b = randomUUID(),
  dept = randomUUID(),
  venue = randomUUID();
await db.query(
  "insert into public.institutions(id,name,slug,settings) values ($1,'College A','college-a',$3),($2,'College B','college-b',$3)",
  [
    a,
    b,
    JSON.stringify({
      timezone: 'Asia/Kolkata',
      allowed_domains: ['college.test'],
      approval_required: true,
      approval_count: 1,
      external_registration: false,
      waitlist_hours: 24,
    }),
  ],
);
for (const [name, id] of Object.entries(ids)) {
  await db.query(
    'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ($1,$2,$3,$4)',
    [
      id,
      name + '@college.test',
      name === 'unverified' ? null : new Date().toISOString(),
      JSON.stringify({ full_name: name }),
    ],
  );
  if (!['platform', 'unverified'].includes(name))
    await db.query(
      'insert into public.memberships(institution_id,user_id,kind) values ($1,$2,$3)',
      [name === 'other' ? b : a, id, name === 'external' ? 'external' : 'student'],
    );
}
for (const [name, role] of [
  ['owner', 'owner'],
  ['faculty', 'faculty'],
  ['faculty2', 'faculty'],
  ['student', 'student'],
  ['second', 'student'],
  ['third', 'student'],
  ['other', 'student'],
]) {
  const i = name === 'other' ? b : a;
  await db.query(
    "insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values($1,$2,$3,'institution',$1)",
    [i, ids[name], role],
  );
}
await db.query('insert into public.platform_admins values($1)', [ids.platform]);
await db.query(
  "insert into public.departments(id,institution_id,name,code) values($1,$2,'Computer Science','CSE')",
  [dept, a],
);
await db.query(
  "insert into public.venues(id,institution_id,name,capacity) values($1,$2,'Auditorium',100)",
  [venue, a],
);
const call = async (user, fn, args = {}) => {
  const entries = Object.entries(args);
  const placeholders = entries.map(([k], i) => `${k} => $${i + 1}`).join(',');
  return (
    await asUser(
      db,
      ids[user] || user,
      `select public.${fn}(${placeholders}) as result`,
      entries.map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v)),
    )
  ).rows[0].result;
};
const eventData = {
  title: 'Secure campus workshop',
  description: 'A practical campus workshop with reliable attendance and scoped permissions.',
  starts_at: new Date(Date.now() + 3600000).toISOString(),
  ends_at: new Date(Date.now() + 7200000).toISOString(),
  registration_deadline: new Date(Date.now() + 1800000).toISOString(),
  capacity: 1,
  venue_id: venue,
  department_id: dept,
  category: 'Technical',
  mode: 'offline',
  questions: [{ id: 'motivation', label: 'Why attend?', type: 'text', required: true }],
};
let event, reg1, reg2, reg3, token;
await test('All migrations apply to local PostgreSQL with all tables under RLS', async () => {
  const r = await db.query(
    "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
  );
  assert.equal(r.rows.length, 0);
});
await test('Students cannot create events or grant themselves roles', async () => {
  await assert.rejects(
    () => call('student', 'save_event', { i: a, p: eventData }),
    /Permission denied/,
  );
  await assert.rejects(
    () => call('student', 'manage_member', { i: a, u: ids.student, p: { role: 'admin' } }),
    /Permission denied/,
  );
});
await test('Organiser creates a real draft and receives event-scoped access', async () => {
  event = await call('owner', 'save_event', { i: a, p: eventData });
  assert.ok(event);
  assert.equal(
    (await asUser(db, ids.owner, 'select status from public.events where id=$1', [event])).rows[0]
      .status,
    'DRAFT',
  );
});
await test('Drafts and records are invisible across tenants', async () => {
  assert.equal(
    (await asUser(db, ids.student, 'select * from public.events where id=$1', [event])).rows.length,
    0,
  );
  assert.equal((await asUser(db, ids.other, 'select * from public.events')).rows.length, 0);
  assert.equal(
    (await asUser(db, ids.other, 'select * from public.memberships where institution_id=$1', [a]))
      .rows.length,
    0,
  );
});
await test('Direct status writes and cross-tenant RPC writes are rejected', async () => {
  await assert.rejects(
    () => asUser(db, ids.owner, "update public.events set status='PUBLISHED' where id=$1", [event]),
    /permission denied/,
  );
  await assert.rejects(
    () => call('other', 'save_event', { i: a, p: eventData }),
    /Permission denied/,
  );
});
await test('Publishing before approval and self-approval are rejected', async () => {
  await assert.rejects(
    () => call('owner', 'transition_event', { event_id: event, target: 'PUBLISHED' }),
    /Invalid lifecycle/,
  );
  await call('owner', 'transition_event', { event_id: event, target: 'PENDING_APPROVAL' });
  await assert.rejects(
    () => call('owner', 'transition_event', { event_id: event, target: 'APPROVED' }),
    /independent reviewer/,
  );
});
await test('Faculty approval reserves venue and permits publish and open', async () => {
  assert.equal(
    await call('faculty', 'transition_event', { event_id: event, target: 'APPROVED' }),
    'APPROVED',
  );
  assert.equal(
    (await db.query('select status from public.venue_bookings where event_id=$1', [event])).rows[0]
      .status,
    'confirmed',
  );
  await call('owner', 'transition_event', { event_id: event, target: 'PUBLISHED' });
  await call('owner', 'transition_event', { event_id: event, target: 'REGISTRATION_OPEN' });
});
await test('Platform admin has tenant aggregates but no private student records', async () => {
  assert.equal((await asUser(db, ids.platform, 'select * from public.memberships')).rows.length, 0);
  assert.equal(
    (await asUser(db, ids.platform, 'select * from public.registrations')).rows.length,
    0,
  );
  const metrics = await call('platform', 'platform_metrics');
  assert.equal(metrics.length, 2);
});
await test('Required custom answers and external eligibility enforced server-side', async () => {
  await assert.rejects(
    () => call('student', 'register_event', { event_id: event }),
    /Required answer/,
  );
  await assert.rejects(
    () => call('external', 'register_event', { event_id: event, answers: { motivation: 'Learn' } }),
    /eligibility/,
  );
});
await test('Capacity confirms one participant and waitlists overflow in FIFO order', async () => {
  reg1 = await call('student', 'register_event', {
    event_id: event,
    answers: { motivation: 'Learn' },
  });
  reg2 = await call('second', 'register_event', {
    event_id: event,
    answers: { motivation: 'Learn' },
  });
  reg3 = await call('third', 'register_event', {
    event_id: event,
    answers: { motivation: 'Learn' },
  });
  assert.equal(reg1.status, 'confirmed');
  assert.equal(reg2.status, 'waitlisted');
  assert.equal(reg3.status, 'waitlisted');
});
await test('Duplicate registrations and cross-tenant registration blocked', async () => {
  await assert.rejects(
    () => call('student', 'register_event', { event_id: event, answers: { motivation: 'Again' } }),
    /already have/,
  );
  await assert.rejects(
    () => call('other', 'register_event', { event_id: event, answers: { motivation: 'Learn' } }),
    /eligibility/,
  );
});
await test('Cancellation reserves the released seat for next queued student', async () => {
  await call('student', 'registration_action', { registration_id: reg1.id, action: 'cancel' });
  const r = await db.query('select status from public.registrations where id=$1', [reg2.id]);
  assert.equal(r.rows[0].status, 'invited');
  assert.equal(
    (await db.query('select status from public.registrations where id=$1', [reg3.id])).rows[0]
      .status,
    'waitlisted',
  );
});
await test('Expired seat invitations are released and the next student is invited', async () => {
  await db.query(
    "update public.registrations set invitation_expires_at=now()-interval '1 second' where id=$1",
    [reg2.id],
  );
  await call('owner', 'process_waitlist', { event_id: event });
  assert.equal(
    (await db.query('select status from public.registrations where id=$1', [reg2.id])).rows[0]
      .status,
    'expired',
  );
  assert.equal(
    (await db.query('select status from public.registrations where id=$1', [reg3.id])).rows[0]
      .status,
    'invited',
  );
  await call('third', 'registration_action', { registration_id: reg3.id, action: 'accept' });
});
await test('Ticket tokens are hashed and only a participant can issue their own', async () => {
  await assert.rejects(
    () => call('second', 'issue_ticket', { registration_id: reg3.id }),
    /Confirmed registration/,
  );
  token = await call('third', 'issue_ticket', { registration_id: reg3.id });
  assert.match(token, /^PLANORA:[a-f0-9]{64}$/);
  const h = (
    await db.query(
      'select token_hash from planora_private.ticket_secrets where registration_id=$1',
      [reg3.id],
    )
  ).rows[0].token_hash;
  assert.notEqual(h, token);
  await assert.rejects(
    () => asUser(db, ids.third, 'select * from planora_private.ticket_secrets'),
    /permission denied/,
  );
});
await test('Check-in requires an ongoing event and an assigned scanner role', async () => {
  await assert.rejects(() => call('owner', 'check_in', { event_id: event, token }), /ongoing/);
  await call('owner', 'transition_event', { event_id: event, target: 'REGISTRATION_CLOSED' });
  await call('owner', 'transition_event', { event_id: event, target: 'ONGOING' });
  await assert.rejects(
    () => call('student', 'check_in', { event_id: event, token }),
    /cannot scan/,
  );
  await db.query(
    "insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values($1,$2,'volunteer','event',$3)",
    [a, ids.volunteer, event],
  );
});
await test('QR check-in is idempotent and records scanner identity', async () => {
  const r = await call('volunteer', 'check_in', { event_id: event, token });
  assert.equal(r.status, 'checked_in');
  const again = await call('volunteer', 'check_in', { event_id: event, token });
  assert.equal(again.status, 'already_checked_in');
  const rows = (
    await db.query('select * from public.attendance where registration_id=$1', [reg3.id])
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].checked_in_by, ids.volunteer);
});
await test('Volunteer cannot manually check in or inspect another event', async () => {
  await assert.rejects(
    () =>
      call('volunteer', 'check_in', {
        event_id: event,
        registration_id: reg1.id,
        reason: 'Manual fallback',
      }),
    /Manual check-in requires/,
  );
  await assert.rejects(
    () => call('volunteer', 'check_in', { event_id: randomUUID(), token }),
    /cannot scan/,
  );
});
await test('Check-in cannot use invalid tokens or cancelled registrations', async () => {
  await assert.rejects(
    () => call('owner', 'check_in', { event_id: event, token: 'PLANORA:bad' }),
    /Invalid ticket/,
  );
  await assert.rejects(
    () => call('third', 'registration_action', { registration_id: reg3.id, action: 'cancel' }),
    /Checked-in/,
  );
});
await test('Budget approval requires a separate reviewer; ledger is tenant-private', async () => {
  const entry = await call('owner', 'save_budget', {
    event_id: event,
    p: { kind: 'expense', category: 'Equipment', description: 'Microphone hire', amount: 1200 },
  });
  await assert.rejects(
    () =>
      call('owner', 'review_budget', { entry_id: entry, decision: 'approved', reason: 'Reviewed' }),
    /different reviewer/,
  );
  await call('faculty', 'review_budget', {
    entry_id: entry,
    decision: 'approved',
    reason: 'Receipt verified',
  });
  assert.equal(
    (await asUser(db, ids.student, 'select * from public.budget_entries')).rows.length,
    0,
  );
});
await test('Certificates only issue to attended, completed events and verify publicly', async () => {
  await assert.rejects(
    () => call('owner', 'issue_certificates', { event_id: event }),
    /Complete the event/,
  );
  await db.query(
    "update public.events set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',registration_deadline=now()-interval '3 hours' where id=$1",
    [event],
  );
  await call('owner', 'transition_event', { event_id: event, target: 'COMPLETED' });
  assert.equal(await call('owner', 'issue_certificates', { event_id: event }), 1);
  assert.equal(await call('owner', 'issue_certificates', { event_id: event }), 0);
  const c = (await db.query('select * from public.certificates where event_id=$1', [event]))
    .rows[0];
  await db.exec('set role anon');
  assert.equal(
    (await db.query('select public.verify_certificate($1) as value', [c.verification_code])).rows[0]
      .value.valid,
    true,
  );
  await db.exec('reset role');
  await call('owner', 'revoke_certificate', {
    certificate_id: c.id,
    reason: 'Testing revocation audit',
  });
  assert.equal(
    (await call('student', 'verify_certificate', { code: c.verification_code })).valid,
    false,
  );
});
await test('Feedback requires actual attendance and completion', async () => {
  await assert.rejects(
    () =>
      call('student', 'submit_feedback', {
        event_id: event,
        rating_value: 5,
        comment_text: 'Great',
      }),
    /checked-in/,
  );
  await call('third', 'submit_feedback', {
    event_id: event,
    rating_value: 5,
    comment_text: 'Useful practical session',
  });
});
await test('Overlapping venue bookings are rejected transactionally', async () => {
  const next = await call('owner', 'save_event', {
    i: a,
    p: { ...eventData, title: 'Conflict proposal' },
  });
  await call('owner', 'transition_event', { event_id: next, target: 'PENDING_APPROVAL' });
  await assert.rejects(
    () => call('faculty', 'transition_event', { event_id: next, target: 'APPROVED' }),
    /Venue conflict/,
  );
});
await test('Cross-tenant foreign keys reject venue and department references', async () => {
  const badVenue = randomUUID();
  await db.query(
    "insert into public.venues(id,institution_id,name,capacity) values($1,$2,'Other campus',100)",
    [badVenue, b],
  );
  await assert.rejects(
    () => call('owner', 'save_event', { i: a, p: { ...eventData, venue_id: badVenue } }),
    /foreign key/,
  );
});
await test('Two-reviewer institutional policy rejects early publication', async () => {
  await db.query(
    "update public.institutions set settings=jsonb_set(settings,'{approval_count}','2') where id=$1",
    [a],
  );
  const v = await call('owner', 'save_event', {
    i: a,
    p: { ...eventData, title: 'Two reviewers', mode: 'online', venue_id: null },
  });
  await call('owner', 'transition_event', { event_id: v, target: 'PENDING_APPROVAL' });
  assert.equal(
    await call('faculty', 'transition_event', { event_id: v, target: 'APPROVED' }),
    'PENDING_APPROVAL',
  );
  await assert.rejects(
    () => call('owner', 'transition_event', { event_id: v, target: 'PUBLISHED' }),
    /Invalid lifecycle/,
  );
  await assert.rejects(
    () => call('faculty', 'transition_event', { event_id: v, target: 'APPROVED' }),
    /already approved/,
  );
  assert.equal(
    await call('faculty2', 'transition_event', { event_id: v, target: 'APPROVED' }),
    'APPROVED',
  );
});
await test('Invitation roles are validated by scope and cannot target another tenant', async () => {
  await assert.rejects(
    () =>
      call('student', 'create_invitation', {
        i: a,
        p: { email: 'bad@college.test', role: 'admin' },
      }),
    /Permission denied/,
  );
  await assert.rejects(
    () =>
      call('owner', 'create_invitation', {
        i: a,
        p: {
          email: 'bad@college.test',
          role: 'faculty',
          scope_type: 'department',
          scope_id: randomUUID(),
        },
      }),
    /Scope must belong/,
  );
});
await test('Unverified email cannot obtain institution membership', async () => {
  await assert.rejects(
    () => call('unverified', 'join_institution', { slug_value: 'college-a' }),
    /Verified account/,
  );
});
await test('Direct inserts into attendance, roles and certificates are denied', async () => {
  for (const table of ['attendance', 'role_assignments', 'certificates'])
    await assert.rejects(
      () => asUser(db, ids.owner, `insert into public.${table} default values`),
      /permission denied/,
    );
});
await test('Tenant suspension removes access even with an existing role assignment', async () => {
  await db.query("update public.institutions set status='suspended' where id=$1", [a]);
  assert.equal((await asUser(db, ids.owner, 'select * from public.events')).rows.length, 0);
  await assert.rejects(
    () => call('owner', 'save_event', { i: a, p: eventData }),
    /Permission denied/,
  );
  await db.query("update public.institutions set status='active' where id=$1", [a]);
});
await test('Audit logs exist and browser callers cannot invoke scheduler jobs', async () => {
  assert.ok(Number((await db.query('select count(*) from public.audit_logs')).rows[0].count) > 10);
  await assert.rejects(() => call('student', 'run_waitlist_jobs'), /permission denied/);
});

await test('External members cannot discover internal events or campus announcements', async () => {
  assert.equal((await asUser(db, ids.external, 'select * from public.events')).rows.length, 0);
  assert.equal((await asUser(db, ids.external, 'select * from public.departments')).rows.length, 0);
  await call('owner', 'publish_announcement', {
    i: a,
    p: { title: 'Internal notice', body: 'Campus-only operations' },
  });
  assert.equal(
    (await asUser(db, ids.external, 'select * from public.announcements')).rows.length,
    0,
  );
});
await test('Active member options contain names but no private academic or contact fields', async () => {
  await assert.rejects(() => call('student', 'member_options', { i: a }), /Permission denied/);
  const r = await asUser(db, ids.owner, 'select * from public.member_options($1)', [a]);
  assert.ok(r.rows.length > 0);
  assert.deepEqual(Object.keys(r.rows[0]).sort(), ['name', 'user_id']);
});
await test('Scoped responsibility delegation cannot create an administrator', async () => {
  await call('owner', 'assign_coordinator', {
    i: a,
    u: ids.second,
    r: 'organiser',
    scope_type: 'event',
    scope_id: event,
  });
  await assert.rejects(
    () =>
      call('second', 'assign_coordinator', {
        i: a,
        u: ids.third,
        r: 'admin',
        scope_type: 'institution',
        scope_id: a,
      }),
    /institution administration/,
  );
  await assert.rejects(
    () =>
      call('second', 'assign_coordinator', {
        i: a,
        u: ids.third,
        r: 'faculty',
        scope_type: 'event',
        scope_id: event,
      }),
    /Only institution administrators/,
  );
});
await test('Directory CRUD is permission checked and tenant scoped', async () => {
  const c = await call('owner', 'save_directory', {
    i: a,
    kind: 'clubs',
    p: { name: 'Engineering Society', description: 'Hands-on projects', department_id: dept },
  });
  await call('owner', 'save_directory', {
    i: a,
    kind: 'clubs',
    record_id: c,
    p: { name: 'Engineering Society', description: 'Updated description', department_id: dept },
  });
  await assert.rejects(
    () =>
      call('student', 'save_directory', {
        i: a,
        kind: 'resources',
        p: { name: 'Projector', quantity: 2 },
      }),
    /Permission denied/,
  );
  await assert.rejects(
    () => call('external', 'club_action', { club_id: c, action: 'applied' }),
    /Permission denied/,
  );
  await call('student', 'club_action', { club_id: c, action: 'applied' });
  const m = (await db.query('select id from public.club_memberships where club_id=$1', [c]))
    .rows[0];
  await call('owner', 'club_action', { club_id: c, action: 'accepted', member_id: m.id });
  assert.equal(
    (await db.query('select status from public.club_memberships where id=$1', [m.id])).rows[0]
      .status,
    'accepted',
  );
});
await test('Resource allocations enforce inventory across overlapping events', async () => {
  const resource = await call('owner', 'save_directory', {
    i: a,
    kind: 'resources',
    p: { name: 'Camera kit', quantity: 1 },
  });
  const x = await call('owner', 'save_event', {
    i: a,
    p: { ...eventData, title: 'Resource event one', mode: 'online', venue_id: null },
  });
  const y = await call('owner', 'save_event', {
    i: a,
    p: { ...eventData, title: 'Resource event two', mode: 'online', venue_id: null },
  });
  await call('owner', 'allocate_resource', { event_id: x, resource_id: resource, amount: 1 });
  await assert.rejects(
    () => call('owner', 'allocate_resource', { event_id: y, resource_id: resource, amount: 1 }),
    /Insufficient/,
  );
  await call('owner', 'allocate_resource', { event_id: x, resource_id: resource, amount: 0 });
  await call('owner', 'allocate_resource', { event_id: y, resource_id: resource, amount: 1 });
});
await test('Assigned volunteer can complete their own task, not another task', async () => {
  const t = await call('owner', 'save_task', {
    event_id: event,
    p: { title: 'Registration desk setup', assigned_to: ids.volunteer },
  });
  await call('volunteer', 'save_task', { event_id: event, task_id: t, p: { status: 'done' } });
  await assert.rejects(
    () => call('student', 'save_task', { event_id: event, task_id: t, p: { status: 'done' } }),
    /Permission denied/,
  );
  assert.equal(
    (await db.query('select status from public.tasks where id=$1', [t])).rows[0].status,
    'done',
  );
});
await test('Rescheduling returns event to draft and invalidates its approval version', async () => {
  const v = await call('owner', 'save_event', {
    i: a,
    p: { ...eventData, title: 'Reschedule test', mode: 'online', venue_id: null },
  });
  await call('owner', 'transition_event', { event_id: v, target: 'PENDING_APPROVAL' });
  await call('faculty', 'transition_event', { event_id: v, target: 'APPROVED' });
  await call('faculty2', 'transition_event', { event_id: v, target: 'APPROVED' });
  const before = (await db.query('select updated_at from public.events where id=$1', [v])).rows[0]
    .updated_at;
  await call('owner', 'reschedule_event', {
    event_id: v,
    new_start: new Date(Date.now() + 86400000).toISOString(),
    new_end: new Date(Date.now() + 90000000).toISOString(),
    new_deadline: new Date(Date.now() + 80000000).toISOString(),
    reason: 'Speaker availability changed',
  });
  const after = (await db.query('select status,updated_at from public.events where id=$1', [v]))
    .rows[0];
  assert.equal(after.status, 'DRAFT');
  assert.ok(after.updated_at >= before);
  assert.equal(
    Number(
      (
        await db.query(
          `select count(*) from public.approvals a join public.events e on e.id=a.event_id where e.id=$1 and a.version=e.updated_at and a.decision='APPROVED'`,
          [v],
        )
      ).rows[0].count,
    ),
    0,
  );
  await assert.rejects(
    () => call('owner', 'transition_event', { event_id: v, target: 'PUBLISHED' }),
    /Invalid lifecycle/,
  );
});
await test('Live counts use full database totals and unrecognised timezones fail validation', async () => {
  const counts = await call('owner', 'event_counts', { event_id: event });
  assert.equal(counts.registered, 3);
  assert.equal(counts.checked_in, 1);
  await assert.rejects(
    () => call('owner', 'save_event', { i: a, p: { ...eventData, timezone: 'Invalid/Zone' } }),
    /Unknown timezone/,
  );
});

await test('Platform plan entitlements actually disable creation and registrations', async () => {
  const plan = (await db.query("select id from public.subscription_plans where name='starter'"))
    .rows[0];
  await call('platform', 'platform_action', {
    action: 'update_plan',
    p: { id: plan.id, features: { events_enabled: false } },
  });
  await assert.rejects(
    () => call('owner', 'save_event', { i: a, p: eventData }),
    /Event creation is disabled/,
  );
  await call('platform', 'platform_action', {
    action: 'update_plan',
    p: { id: plan.id, features: { events_enabled: true, registration_enabled: true } },
  });
});
await test('Academic terms are tenant-scoped, validated and managed only by administrators', async () => {
  const term = await call('owner', 'save_academic_term', {
    i: a,
    p: {
      name: 'Semester 1',
      academic_year: '2026–2027',
      starts_on: '2026-08-01',
      ends_on: '2027-01-01',
    },
  });
  assert.ok(term);
  assert.equal((await asUser(db, ids.other, 'select * from public.academic_terms')).rows.length, 0);
  assert.equal(
    (await asUser(db, ids.external, 'select * from public.academic_terms')).rows.length,
    0,
  );
  assert.equal(
    (await asUser(db, ids.student, 'select * from public.academic_terms')).rows.length,
    1,
  );
  await assert.rejects(
    () => call('student', 'save_academic_term', { i: a, p: { name: 'Invalid' } }),
    /Permission denied/,
  );
  await assert.rejects(
    () =>
      call('owner', 'save_academic_term', {
        i: a,
        p: {
          name: 'Invalid dates',
          academic_year: '2026',
          starts_on: '2026-12-01',
          ends_on: '2026-01-01',
        },
      }),
    /check constraint/,
  );
  await assert.rejects(
    () =>
      call('owner', 'save_academic_term', {
        i: a,
        record_id: randomUUID(),
        p: { name: 'Other', academic_year: '2026', starts_on: '2026-01-01', ends_on: '2026-02-01' },
      }),
    /Term not found/,
  );
});
await db.close();
console.log(
  `\n${passed} passed, ${failed} failed. Local PostgreSQL WASM; Auth/Storage/Realtime infrastructure is stubbed, not hosted Supabase.`,
);
await (
  await import('node:fs/promises')
).writeFile(
  'tests/database-results.json',
  JSON.stringify(
    { engine: 'PGlite PostgreSQL WASM', hostedSupabase: false, passed, failed, results },
    null,
    2,
  ),
);
if (failed) process.exitCode = 1;
