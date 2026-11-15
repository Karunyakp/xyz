import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createTestDatabase } from '../tests/db-harness.mjs';
const snapshot = JSON.parse(await readFile('scripts/schema-snapshot.json', 'utf8'));
const db = await createTestDatabase();
const constraints = (
  await db.query(
    `select c.conrelid::regclass::text as table_name, c.conname, pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' order by 1,2`,
  )
).rows;
const funcs = (
  await db.query(
    `select p.proname, pg_get_function_arguments(p.oid) as arguments, pg_get_function_result(p.oid) as result from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`,
  )
).rows;
const purposes = {
  academic_terms: 'Institution semesters and academic years for report comparisons.',
  institutions: 'Tenant identity, activation, branding and policy configuration.',
  profiles: 'Account-owned name, interests, skills and biography; no public directory.',
  platform_admins: 'Separate platform operator membership, not a college permission bypass.',
  memberships: 'Tenant membership, activation and private academic identifiers.',
  roles: 'Role catalogue and permitted assignment scopes.',
  permissions: 'Permission catalogue.',
  role_permissions: 'Role-to-permission mapping.',
  role_assignments: 'Coexisting tenant, department, club and event responsibilities.',
  departments: 'Institutional academic departments.',
  clubs: 'Club profiles, department associations and membership settings.',
  club_memberships: 'Following, applications and club membership decisions.',
  venues: 'Venue capacity, facilities, access restrictions and maintenance.',
  resources: 'Shared resource inventory.',
  events: 'Lifecycle aggregate, scheduling, eligibility, registration and event content.',
  approvals: 'Immutable reviewer decisions tied to a content version.',
  workflow_history: 'Event state changes with actor, timestamp and reason.',
  venue_bookings: 'Requested, confirmed and cancelled event venue reservations.',
  resource_allocations: 'Inventory quantities reserved against events.',
  teams: 'Team leader and random invitation code.',
  registrations: 'One participant per event, answers, waitlist and reservation state.',
  attendance: 'One attendance record per registration with scanner identity.',
  saved_events: 'Private participant event bookmarks.',
  volunteers: 'Applications, selection, responsibilities, shifts and volunteer attendance.',
  tasks: 'Operational checklist and individual assignments.',
  announcements: 'Institutional or event communications.',
  notifications: 'Per-user inbox and read state.',
  budget_entries: 'Allocations, expenses, sponsorship and reimbursement review ledger.',
  feedback: 'One attended-participant evaluation per completed event.',
  certificates: 'Issued achievement snapshots, public verification identifiers and revocation.',
  completion_reports: 'Event outcomes submitted for faculty review.',
  invitations: 'Email-specific, scoped, expiring institution invitations.',
  audit_logs: 'Server-written institution/platform audit records.',
  support_requests: 'Tenant support submissions visible to the requester and authorised operators.',
  global_categories: 'Platform-managed event categories.',
  subscription_plans: 'Feature entitlements; financial billing is unconfigured.',
};
const clean = (value) =>
  String(value ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
const migrations = (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
let out = `# PLANORA database schema\n\nGenerated from the delivered SQL migrations using PostgreSQL introspection. ${snapshot.tables.length} public tables, 2 private tables and ${funcs.length} public RPC functions. This is a local schema verification, not a dump of the user's hosted project.\n\n## Migrations\n\nApply in order through Supabase CLI after reviewing the target project.\n\n${migrations.map((f) => '- [' + f + '](supabase/migrations/' + f + ')').join('\n')}\n\n## Tenant and security model\n\nTenant-owned public records carry an institution_id. Composite foreign keys prevent cross-tenant department, club, venue, event, membership and registration references. User profiles and global role/permission/plan/category catalogues are deliberately not tenant-owned. Private ticket hashes inherit their registration's tenant; private email jobs inherit their notification's tenant.\n\nAll public tables have RLS. Browser roles receive SELECT permissions governed by policies; mutations use explicit security-definer RPCs with an empty search_path and server-side permission checks. No browser role can directly update lifecycle, registrations, attendance, certificates or roles. Public certificate verification reveals only the specific certificate's minimum identifying fields. Service-job RPCs are granted only to service_role. Platform operators have usage/support/tenant access but do not acquire student-record access.\n\nPermission scope is evaluated against institution, department, club and event assignments. Membership must be active in an active institution and have a verified email. External participants cannot browse private directories or internal events.\n\n## Transaction rules\n\n- Registration locks the event row before validating capacity, duplicate participation, eligibility and team membership. Confirmed and invited reservations consume seats.\n- Cancellation promotes the FIFO waitlist by creation timestamp and ID; invitations reserve seats until acceptance or expiry. Expiry processing locks the same event.\n- Venue approval locks the venue and rejects overlapping confirmed reservations. Resources lock inventory rows and validate overlapping quantities. Browser roles cannot bypass these RPC boundaries.\n- Publication requires the configured distinct, independent faculty approvals matching the current event version. Edits and reschedules invalidate previous approval versions.\n- Attendance has a unique registration constraint. QR tickets hold random bearer tokens while only SHA-256 hashes are stored in a private schema.\n- Certificate issuance requires attendance and event completion. Budget authors cannot approve their own ledger entry.\n\n## Table catalogue\n\n| Table | Purpose |\n| --- | --- |\n${snapshot.tables.map((t) => '| ' + t.name + ' | ' + purposes[t.name] + ' |').join('\n')}\n\n## Public table columns and constraints\n`;
for (const t of snapshot.tables) {
  out += `\n### ${t.name}\n\n${purposes[t.name]}\n\n| Column | PostgreSQL type | Nullable | Default / generation |\n| --- | --- | --- | --- |\n`;
  out +=
    t.columns
      .map(
        (c) =>
          `| ${c.column_name} | ${c.data_type === 'ARRAY' ? c.udt_name : c.data_type} | ${c.is_nullable} | ${clean(c.column_default || (c.is_generated !== 'NEVER' ? 'Generated column' : null))} |`,
      )
      .join('\n') + '\n\n';
  const own = constraints.filter(
    (c) => c.table_name === t.name || c.table_name === 'public.' + t.name,
  );
  out += own.map((c) => '- `' + clean(c.definition) + '`').join('\n') + '\n';
}
out += `\n## Private tables\n\n### planora_private.ticket_secrets\n\nregistration_id UUID primary/foreign key → registrations; token_hash TEXT unique; issued_at TIMESTAMPTZ. No token plaintext persists. Requesting a fresh ticket rotates the hash and invalidates the previous QR. The participant receives the bearer value only from issue_ticket.\n\n### planora_private.email_outbox\n\nid UUID primary key; notification_id UUID unique foreign key → notifications; status TEXT; attempts INTEGER; locked_at TIMESTAMPTZ; provider_id TEXT; last_error TEXT; created_at TIMESTAMPTZ. The application roles have no direct table access. The delivery function claims/retries bounded jobs and preserves provider idempotency.\n\n## RPC signatures\n\nUse the service layer in src/services rather than calling RPCs from components. Argument types below are introspected, including defaults.\n\n| Function | Arguments | Result |\n| --- | --- | --- |\n${funcs.map((f) => '| ' + f.proname + ' | ' + clean(f.arguments) + ' | ' + clean(f.result) + ' |').join('\n')}\n\n## Storage and Realtime\n\nPrivate buckets: event-media (10 MiB), receipts (10 MiB), branding (2 MiB). Event paths are institution/event/random.ext; branding paths begin with institution. Read/insert policies use the tenant and scoped permissions; signed read URLs expire. No public bucket is created.\n\nRealtime is enabled for selected operational tables by migration 004. It invalidates query caches; PostgreSQL RLS remains the access boundary. Auth, Storage APIs and Realtime delivery require hosted integration testing.\n\n## Regeneration\n\nRun npm run generate:types, then node scripts/generate-schema-doc.mjs. After deployment, also generate authoritative Supabase CLI types as documented in SETUP.md. SQL migrations are the source of truth.\n`;
await writeFile('DATABASE_SCHEMA.md', out);
await db.close();
console.log(
  `Documented ${snapshot.tables.length} tables, ${constraints.length} constraints and ${funcs.length} RPCs.`,
);
