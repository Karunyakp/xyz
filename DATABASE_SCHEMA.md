# PLANORA database schema

Generated from the delivered SQL migrations using PostgreSQL introspection. 36 public tables, 2 private tables and 48 public RPC functions. This is a local schema verification, not a dump of the user's hosted project.

## Migrations

Apply in order through Supabase CLI after reviewing the target project.

- [202611140001_core.sql](supabase/migrations/202611140001_core.sql)
- [202611140002_workflows.sql](supabase/migrations/202611140002_workflows.sql)
- [202611140003_operations.sql](supabase/migrations/202611140003_operations.sql)
- [202611140004_storage_realtime.sql](supabase/migrations/202611140004_storage_realtime.sql)
- [202611140005_search.sql](supabase/migrations/202611140005_search.sql)
- [202611140006_hardening.sql](supabase/migrations/202611140006_hardening.sql)
- [202611140007_extensions.sql](supabase/migrations/202611140007_extensions.sql)
- [202611150008_academic_terms.sql](supabase/migrations/202611150008_academic_terms.sql)

## Tenant and security model

Tenant-owned public records carry an institution_id. Composite foreign keys prevent cross-tenant department, club, venue, event, membership and registration references. User profiles and global role/permission/plan/category catalogues are deliberately not tenant-owned. Private ticket hashes inherit their registration's tenant; private email jobs inherit their notification's tenant.

All public tables have RLS. Browser roles receive SELECT permissions governed by policies; mutations use explicit security-definer RPCs with an empty search_path and server-side permission checks. No browser role can directly update lifecycle, registrations, attendance, certificates or roles. Public certificate verification reveals only the specific certificate's minimum identifying fields. Service-job RPCs are granted only to service_role. Platform operators have usage/support/tenant access but do not acquire student-record access.

Permission scope is evaluated against institution, department, club and event assignments. Membership must be active in an active institution and have a verified email. External participants cannot browse private directories or internal events.

## Transaction rules

- Registration locks the event row before validating capacity, duplicate participation, eligibility and team membership. Confirmed and invited reservations consume seats.
- Cancellation promotes the FIFO waitlist by creation timestamp and ID; invitations reserve seats until acceptance or expiry. Expiry processing locks the same event.
- Venue approval locks the venue and rejects overlapping confirmed reservations. Resources lock inventory rows and validate overlapping quantities. Browser roles cannot bypass these RPC boundaries.
- Publication requires the configured distinct, independent faculty approvals matching the current event version. Edits and reschedules invalidate previous approval versions.
- Attendance has a unique registration constraint. QR tickets hold random bearer tokens while only SHA-256 hashes are stored in a private schema.
- Certificate issuance requires attendance and event completion. Budget authors cannot approve their own ledger entry.

## Table catalogue

| Table                | Purpose                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| academic_terms       | Institution semesters and academic years for report comparisons.              |
| announcements        | Institutional or event communications.                                        |
| approvals            | Immutable reviewer decisions tied to a content version.                       |
| attendance           | One attendance record per registration with scanner identity.                 |
| audit_logs           | Server-written institution/platform audit records.                            |
| budget_entries       | Allocations, expenses, sponsorship and reimbursement review ledger.           |
| certificates         | Issued achievement snapshots, public verification identifiers and revocation. |
| club_memberships     | Following, applications and club membership decisions.                        |
| clubs                | Club profiles, department associations and membership settings.               |
| completion_reports   | Event outcomes submitted for faculty review.                                  |
| departments          | Institutional academic departments.                                           |
| events               | Lifecycle aggregate, scheduling, eligibility, registration and event content. |
| feedback             | One attended-participant evaluation per completed event.                      |
| global_categories    | Platform-managed event categories.                                            |
| institutions         | Tenant identity, activation, branding and policy configuration.               |
| invitations          | Email-specific, scoped, expiring institution invitations.                     |
| memberships          | Tenant membership, activation and private academic identifiers.               |
| notifications        | Per-user inbox and read state.                                                |
| permissions          | Permission catalogue.                                                         |
| platform_admins      | Separate platform operator membership, not a college permission bypass.       |
| profiles             | Account-owned name, interests, skills and biography; no public directory.     |
| registrations        | One participant per event, answers, waitlist and reservation state.           |
| resource_allocations | Inventory quantities reserved against events.                                 |
| resources            | Shared resource inventory.                                                    |
| role_assignments     | Coexisting tenant, department, club and event responsibilities.               |
| role_permissions     | Role-to-permission mapping.                                                   |
| roles                | Role catalogue and permitted assignment scopes.                               |
| saved_events         | Private participant event bookmarks.                                          |
| subscription_plans   | Feature entitlements; financial billing is unconfigured.                      |
| support_requests     | Tenant support submissions visible to the requester and authorised operators. |
| tasks                | Operational checklist and individual assignments.                             |
| teams                | Team leader and random invitation code.                                       |
| venue_bookings       | Requested, confirmed and cancelled event venue reservations.                  |
| venues               | Venue capacity, facilities, access restrictions and maintenance.              |
| volunteers           | Applications, selection, responsibilities, shifts and volunteer attendance.   |
| workflow_history     | Event state changes with actor, timestamp and reason.                         |

## Public table columns and constraints

### academic_terms

Institution semesters and academic years for report comparisons.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| name           | text                     | NO       | —                    |
| academic_year  | text                     | NO       | —                    |
| starts_on      | date                     | NO       | —                    |
| ends_on        | date                     | NO       | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `CHECK (((length(TRIM(BOTH FROM academic_year)) >= 1) AND (length(TRIM(BOTH FROM academic_year)) <= 40)))`
- `NOT NULL academic_year`
- `CHECK ((ends_on > starts_on))`
- `NOT NULL created_at`
- `NOT NULL ends_on`
- `NOT NULL id`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `UNIQUE (institution_id, name, academic_year)`
- `NOT NULL institution_id`
- `CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120)))`
- `NOT NULL name`
- `PRIMARY KEY (id)`
- `NOT NULL starts_on`

### announcements

Institutional or event communications.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | YES      | —                    |
| title          | text                     | NO       | —                    |
| body           | text                     | NO       | —                    |
| created_by     | uuid                     | NO       | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL body`
- `NOT NULL created_at`
- `FOREIGN KEY (created_by) REFERENCES auth.users(id)`
- `NOT NULL created_by`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `NOT NULL institution_id`
- `PRIMARY KEY (id)`
- `NOT NULL title`

### approvals

Immutable reviewer decisions tied to a content version.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| reviewer_id    | uuid                     | NO       | —                    |
| decision       | text                     | NO       | —                    |
| comments       | text                     | NO       | ''::text             |
| version        | timestamp with time zone | NO       | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL comments`
- `NOT NULL created_at`
- `CHECK ((decision = ANY (ARRAY['APPROVED'::text, 'REJECTED'::text, 'REVISION_REQUESTED'::text, 'COMMENT'::text])))`
- `NOT NULL decision`
- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (reviewer_id) REFERENCES auth.users(id)`
- `NOT NULL reviewer_id`
- `NOT NULL version`

### attendance

One attendance record per registration with scanner identity.

| Column          | PostgreSQL type          | Nullable | Default / generation |
| --------------- | ------------------------ | -------- | -------------------- |
| id              | uuid                     | NO       | gen_random_uuid()    |
| institution_id  | uuid                     | NO       | —                    |
| event_id        | uuid                     | NO       | —                    |
| registration_id | uuid                     | NO       | —                    |
| user_id         | uuid                     | NO       | —                    |
| checked_in_by   | uuid                     | NO       | —                    |
| checked_in_at   | timestamp with time zone | NO       | now()                |
| method          | text                     | NO       | —                    |
| note            | text                     | NO       | ''::text             |

- `NOT NULL checked_in_at`
- `FOREIGN KEY (checked_in_by) REFERENCES auth.users(id)`
- `NOT NULL checked_in_by`
- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, registration_id) REFERENCES registrations(institution_id, id)`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `CHECK ((method = ANY (ARRAY['qr'::text, 'manual'::text])))`
- `NOT NULL method`
- `NOT NULL note`
- `PRIMARY KEY (id)`
- `UNIQUE (registration_id)`
- `NOT NULL registration_id`
- `NOT NULL user_id`

### audit_logs

Server-written institution/platform audit records.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | YES      | —                    |
| actor_id       | uuid                     | YES      | —                    |
| action         | text                     | NO       | —                    |
| entity_type    | text                     | NO       | —                    |
| entity_id      | uuid                     | YES      | —                    |
| details        | jsonb                    | NO       | '{}'::jsonb          |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL action`
- `NOT NULL created_at`
- `NOT NULL details`
- `NOT NULL entity_type`
- `NOT NULL id`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `PRIMARY KEY (id)`

### budget_entries

Allocations, expenses, sponsorship and reimbursement review ledger.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| kind           | text                     | NO       | —                    |
| category       | text                     | NO       | —                    |
| description    | text                     | NO       | —                    |
| amount         | numeric                  | NO       | —                    |
| status         | text                     | NO       | 'pending'::text      |
| receipt_path   | text                     | YES      | —                    |
| created_by     | uuid                     | NO       | —                    |
| reviewed_by    | uuid                     | YES      | —                    |
| review_note    | text                     | YES      | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `CHECK ((amount > (0)::numeric))`
- `NOT NULL amount`
- `NOT NULL category`
- `NOT NULL created_at`
- `FOREIGN KEY (created_by) REFERENCES auth.users(id)`
- `NOT NULL created_by`
- `NOT NULL description`
- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `CHECK ((kind = ANY (ARRAY['allocation'::text, 'expense'::text, 'sponsorship'::text, 'reimbursement'::text])))`
- `NOT NULL kind`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))`
- `NOT NULL status`

### certificates

Issued achievement snapshots, public verification identifiers and revocation.

| Column            | PostgreSQL type          | Nullable | Default / generation                                    |
| ----------------- | ------------------------ | -------- | ------------------------------------------------------- |
| id                | uuid                     | NO       | gen_random_uuid()                                       |
| institution_id    | uuid                     | NO       | —                                                       |
| event_id          | uuid                     | NO       | —                                                       |
| user_id           | uuid                     | NO       | —                                                       |
| registration_id   | uuid                     | NO       | —                                                       |
| recipient_name    | text                     | NO       | —                                                       |
| event_title       | text                     | NO       | —                                                       |
| verification_code | text                     | NO       | replace((gen_random_uuid())::text, '-'::text, ''::text) |
| issued_by         | uuid                     | NO       | —                                                       |
| issued_at         | timestamp with time zone | NO       | now()                                                   |
| revoked_at        | timestamp with time zone | YES      | —                                                       |

- `NOT NULL event_id`
- `NOT NULL event_title`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, registration_id) REFERENCES registrations(institution_id, id)`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `NOT NULL issued_at`
- `FOREIGN KEY (issued_by) REFERENCES auth.users(id)`
- `NOT NULL issued_by`
- `PRIMARY KEY (id)`
- `NOT NULL recipient_name`
- `UNIQUE (registration_id)`
- `NOT NULL registration_id`
- `NOT NULL user_id`
- `UNIQUE (verification_code)`
- `NOT NULL verification_code`

### club_memberships

Following, applications and club membership decisions.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| club_id        | uuid                     | NO       | —                    |
| user_id        | uuid                     | NO       | —                    |
| status         | text                     | NO       | 'following'::text    |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL club_id`
- `UNIQUE (club_id, user_id)`
- `NOT NULL created_at`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, club_id) REFERENCES clubs(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `PRIMARY KEY (id)`
- `CHECK ((status = ANY (ARRAY['following'::text, 'applied'::text, 'accepted'::text, 'rejected'::text])))`
- `NOT NULL status`
- `NOT NULL user_id`

### clubs

Club profiles, department associations and membership settings.

| Column            | PostgreSQL type | Nullable | Default / generation |
| ----------------- | --------------- | -------- | -------------------- |
| id                | uuid            | NO       | gen_random_uuid()    |
| institution_id    | uuid            | NO       | —                    |
| department_id     | uuid            | YES      | —                    |
| name              | text            | NO       | —                    |
| description       | text            | NO       | ''::text             |
| logo_path         | text            | YES      | —                    |
| accepting_members | boolean         | NO       | true                 |

- `NOT NULL accepting_members`
- `NOT NULL description`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, department_id) REFERENCES departments(institution_id, id)`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `UNIQUE (institution_id, name)`
- `NOT NULL institution_id`
- `NOT NULL name`
- `PRIMARY KEY (id)`

### completion_reports

Event outcomes submitted for faculty review.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| summary        | text                     | NO       | —                    |
| outcomes       | text                     | NO       | —                    |
| status         | text                     | NO       | 'submitted'::text    |
| submitted_by   | uuid                     | NO       | —                    |
| reviewed_by    | uuid                     | YES      | —                    |
| comments       | text                     | YES      | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL created_at`
- `UNIQUE (event_id)`
- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `NOT NULL outcomes`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)`
- `CHECK ((status = ANY (ARRAY['submitted'::text, 'approved'::text, 'revision_requested'::text])))`
- `NOT NULL status`
- `FOREIGN KEY (submitted_by) REFERENCES auth.users(id)`
- `NOT NULL submitted_by`
- `NOT NULL summary`

### departments

Institutional academic departments.

| Column         | PostgreSQL type | Nullable | Default / generation |
| -------------- | --------------- | -------- | -------------------- |
| id             | uuid            | NO       | gen_random_uuid()    |
| institution_id | uuid            | NO       | —                    |
| name           | text            | NO       | —                    |
| code           | text            | NO       | —                    |
| description    | text            | NO       | ''::text             |

- `NOT NULL code`
- `NOT NULL description`
- `NOT NULL id`
- `UNIQUE (institution_id, code)`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `NOT NULL institution_id`
- `NOT NULL name`
- `PRIMARY KEY (id)`

### events

Lifecycle aggregate, scheduling, eligibility, registration and event content.

| Column                | PostgreSQL type          | Nullable | Default / generation |
| --------------------- | ------------------------ | -------- | -------------------- |
| id                    | uuid                     | NO       | gen_random_uuid()    |
| institution_id        | uuid                     | NO       | —                    |
| department_id         | uuid                     | YES      | —                    |
| club_id               | uuid                     | YES      | —                    |
| created_by            | uuid                     | NO       | —                    |
| title                 | text                     | NO       | —                    |
| description           | text                     | NO       | ''::text             |
| objectives            | text                     | NO       | ''::text             |
| category              | text                     | NO       | 'Technical'::text    |
| event_type            | text                     | NO       | 'Workshop'::text     |
| mode                  | text                     | NO       | 'offline'::text      |
| status                | text                     | NO       | 'DRAFT'::text        |
| starts_at             | timestamp with time zone | NO       | —                    |
| ends_at               | timestamp with time zone | NO       | —                    |
| registration_deadline | timestamp with time zone | NO       | —                    |
| timezone              | text                     | NO       | 'Asia/Kolkata'::text |
| venue_id              | uuid                     | YES      | —                    |
| online_url            | text                     | NO       | ''::text             |
| capacity              | integer                  | NO       | —                    |
| waitlist_enabled      | boolean                  | NO       | true                 |
| manual_approval       | boolean                  | NO       | false                |
| is_team               | boolean                  | NO       | false                |
| team_min              | integer                  | NO       | 2                    |
| team_max              | integer                  | NO       | 5                    |
| allow_external        | boolean                  | NO       | false                |
| eligible_departments  | _uuid                    | NO       | '{}'::uuid[]         |
| eligible_years        | _int4                    | NO       | '{}'::integer[]      |
| questions             | jsonb                    | NO       | '[]'::jsonb          |
| agenda                | jsonb                    | NO       | '[]'::jsonb          |
| faqs                  | jsonb                    | NO       | '[]'::jsonb          |
| rules                 | text                     | NO       | ''::text             |
| instructions          | text                     | NO       | ''::text             |
| contact               | text                     | NO       | ''::text             |
| cover_path            | text                     | YES      | —                    |
| attachments           | jsonb                    | NO       | '[]'::jsonb          |
| estimated_budget      | numeric                  | NO       | 0                    |
| fee                   | numeric                  | NO       | 0                    |
| featured              | boolean                  | NO       | false                |
| created_at            | timestamp with time zone | NO       | now()                |
| updated_at            | timestamp with time zone | NO       | now()                |
| search_vector         | tsvector                 | YES      | Generated column     |

- `NOT NULL agenda`
- `NOT NULL allow_external`
- `NOT NULL attachments`
- `CHECK ((capacity > 0))`
- `NOT NULL capacity`
- `NOT NULL category`
- `CHECK ((ends_at > starts_at))`
- `CHECK ((registration_deadline <= starts_at))`
- `CHECK ((team_max >= team_min))`
- `NOT NULL contact`
- `NOT NULL created_at`
- `NOT NULL created_by`
- `NOT NULL description`
- `NOT NULL eligible_departments`
- `NOT NULL eligible_years`
- `NOT NULL ends_at`
- `CHECK ((estimated_budget >= (0)::numeric))`
- `NOT NULL estimated_budget`
- `NOT NULL event_type`
- `NOT NULL faqs`
- `NOT NULL featured`
- `CHECK ((fee = (0)::numeric))`
- `NOT NULL fee`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, club_id) REFERENCES clubs(institution_id, id)`
- `FOREIGN KEY (institution_id, created_by) REFERENCES memberships(institution_id, user_id)`
- `FOREIGN KEY (institution_id, department_id) REFERENCES departments(institution_id, id)`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, venue_id) REFERENCES venues(institution_id, id)`
- `NOT NULL instructions`
- `NOT NULL is_team`
- `NOT NULL manual_approval`
- `CHECK ((mode = ANY (ARRAY['online'::text, 'offline'::text, 'hybrid'::text])))`
- `NOT NULL mode`
- `NOT NULL objectives`
- `NOT NULL online_url`
- `PRIMARY KEY (id)`
- `NOT NULL questions`
- `NOT NULL registration_deadline`
- `NOT NULL rules`
- `NOT NULL starts_at`
- `CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING_APPROVAL'::text, 'REVISION_REQUESTED'::text, 'APPROVED'::text, 'REJECTED'::text, 'PUBLISHED'::text, 'REGISTRATION_OPEN'::text, 'REGISTRATION_CLOSED'::text, 'ONGOING'::text, 'COMPLETED'::text, 'CANCELLED'::text])))`
- `NOT NULL status`
- `NOT NULL team_max`
- `CHECK ((team_min >= 2))`
- `NOT NULL team_min`
- `NOT NULL timezone`
- `CHECK (((length(title) >= 3) AND (length(title) <= 180)))`
- `NOT NULL title`
- `NOT NULL updated_at`
- `NOT NULL waitlist_enabled`

### feedback

One attended-participant evaluation per completed event.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| user_id        | uuid                     | NO       | —                    |
| rating         | integer                  | NO       | —                    |
| comment        | text                     | NO       | ''::text             |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL comment`
- `NOT NULL created_at`
- `NOT NULL event_id`
- `UNIQUE (event_id, user_id)`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `PRIMARY KEY (id)`
- `CHECK (((rating >= 1) AND (rating <= 5)))`
- `NOT NULL rating`
- `NOT NULL user_id`

### global_categories

Platform-managed event categories.

| Column  | PostgreSQL type | Nullable | Default / generation |
| ------- | --------------- | -------- | -------------------- |
| id      | uuid            | NO       | gen_random_uuid()    |
| name    | text            | NO       | —                    |
| enabled | boolean         | NO       | true                 |

- `NOT NULL enabled`
- `NOT NULL id`
- `UNIQUE (name)`
- `NOT NULL name`
- `PRIMARY KEY (id)`

### institutions

Tenant identity, activation, branding and policy configuration.

| Column     | PostgreSQL type          | Nullable | Default / generation                                                                                                                                               |
| ---------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id         | uuid                     | NO       | gen_random_uuid()                                                                                                                                                  |
| name       | text                     | NO       | —                                                                                                                                                                  |
| slug       | text                     | NO       | —                                                                                                                                                                  |
| logo_path  | text                     | YES      | —                                                                                                                                                                  |
| status     | text                     | NO       | 'active'::text                                                                                                                                                     |
| plan       | text                     | NO       | 'starter'::text                                                                                                                                                    |
| settings   | jsonb                    | NO       | '{"timezone": "Asia/Kolkata", "approval_count": 1, "waitlist_hours": 24, "allowed_domains": [], "approval_required": true, "external_registration": false}'::jsonb |
| created_at | timestamp with time zone | NO       | now()                                                                                                                                                              |

- `NOT NULL created_at`
- `NOT NULL id`
- `CHECK (((length(name) >= 2) AND (length(name) <= 160)))`
- `NOT NULL name`
- `PRIMARY KEY (id)`
- `NOT NULL plan`
- `NOT NULL settings`
- `CHECK ((slug ~ '^[a-z0-9-]+$'::text))`
- `UNIQUE (slug)`
- `NOT NULL slug`
- `CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])))`
- `NOT NULL status`

### invitations

Email-specific, scoped, expiring institution invitations.

| Column         | PostgreSQL type          | Nullable | Default / generation         |
| -------------- | ------------------------ | -------- | ---------------------------- |
| id             | uuid                     | NO       | gen_random_uuid()            |
| institution_id | uuid                     | NO       | —                            |
| email          | text                     | NO       | —                            |
| role           | text                     | NO       | —                            |
| scope_type     | text                     | NO       | 'institution'::text          |
| scope_id       | uuid                     | NO       | —                            |
| department_id  | uuid                     | YES      | —                            |
| invited_by     | uuid                     | NO       | —                            |
| expires_at     | timestamp with time zone | NO       | (now() + '7 days'::interval) |
| accepted_at    | timestamp with time zone | YES      | —                            |
| created_at     | timestamp with time zone | NO       | now()                        |

- `NOT NULL created_at`
- `NOT NULL email`
- `NOT NULL expires_at`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, department_id) REFERENCES departments(institution_id, id)`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (invited_by) REFERENCES auth.users(id)`
- `NOT NULL invited_by`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (role) REFERENCES roles(key)`
- `NOT NULL role`
- `NOT NULL scope_id`
- `NOT NULL scope_type`

### memberships

Tenant membership, activation and private academic identifiers.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| user_id        | uuid                     | NO       | —                    |
| department_id  | uuid                     | YES      | —                    |
| kind           | text                     | NO       | 'student'::text      |
| status         | text                     | NO       | 'active'::text       |
| student_number | text                     | YES      | —                    |
| academic_year  | integer                  | YES      | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `CHECK (((academic_year >= 1) AND (academic_year <= 8)))`
- `NOT NULL created_at`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, department_id) REFERENCES departments(institution_id, id)`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `NOT NULL institution_id`
- `UNIQUE (institution_id, user_id)`
- `CHECK ((kind = ANY (ARRAY['student'::text, 'staff'::text, 'external'::text])))`
- `NOT NULL kind`
- `PRIMARY KEY (id)`
- `CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))`
- `NOT NULL status`
- `FOREIGN KEY (user_id) REFERENCES auth.users(id)`
- `NOT NULL user_id`

### notifications

Per-user inbox and read state.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| user_id        | uuid                     | NO       | —                    |
| title          | text                     | NO       | —                    |
| body           | text                     | NO       | ''::text             |
| link           | text                     | YES      | —                    |
| read_at        | timestamp with time zone | YES      | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL body`
- `NOT NULL created_at`
- `NOT NULL id`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `PRIMARY KEY (id)`
- `NOT NULL title`
- `NOT NULL user_id`

### permissions

Permission catalogue.

| Column | PostgreSQL type | Nullable | Default / generation |
| ------ | --------------- | -------- | -------------------- |
| key    | text            | NO       | —                    |

- `NOT NULL key`
- `PRIMARY KEY (key)`

### platform_admins

Separate platform operator membership, not a college permission bypass.

| Column  | PostgreSQL type | Nullable | Default / generation |
| ------- | --------------- | -------- | -------------------- |
| user_id | uuid            | NO       | —                    |

- `PRIMARY KEY (user_id)`
- `FOREIGN KEY (user_id) REFERENCES auth.users(id)`
- `NOT NULL user_id`

### profiles

Account-owned name, interests, skills and biography; no public directory.

| Column      | PostgreSQL type          | Nullable | Default / generation |
| ----------- | ------------------------ | -------- | -------------------- |
| id          | uuid                     | NO       | —                    |
| full_name   | text                     | NO       | ''::text             |
| avatar_path | text                     | YES      | —                    |
| interests   | _text                    | NO       | '{}'::text[]         |
| skills      | _text                    | NO       | '{}'::text[]         |
| bio         | text                     | NO       | ''::text             |
| created_at  | timestamp with time zone | NO       | now()                |

- `NOT NULL bio`
- `NOT NULL created_at`
- `NOT NULL full_name`
- `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `NOT NULL id`
- `NOT NULL interests`
- `PRIMARY KEY (id)`
- `NOT NULL skills`

### registrations

One participant per event, answers, waitlist and reservation state.

| Column                | PostgreSQL type          | Nullable | Default / generation                                                                             |
| --------------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| id                    | uuid                     | NO       | gen_random_uuid()                                                                                |
| institution_id        | uuid                     | NO       | —                                                                                                |
| event_id              | uuid                     | NO       | —                                                                                                |
| user_id               | uuid                     | NO       | —                                                                                                |
| team_id               | uuid                     | YES      | —                                                                                                |
| status                | text                     | NO       | —                                                                                                |
| registration_number   | text                     | NO       | ('PL-'::text \|\| upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 16))) |
| answers               | jsonb                    | NO       | '{}'::jsonb                                                                                      |
| invitation_expires_at | timestamp with time zone | YES      | —                                                                                                |
| created_at            | timestamp with time zone | NO       | now()                                                                                            |
| updated_at            | timestamp with time zone | NO       | now()                                                                                            |

- `NOT NULL answers`
- `NOT NULL created_at`
- `NOT NULL event_id`
- `UNIQUE (event_id, user_id)`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `UNIQUE (institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, team_id) REFERENCES teams(institution_id, id)`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `PRIMARY KEY (id)`
- `UNIQUE (registration_number)`
- `NOT NULL registration_number`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'waitlisted'::text, 'invited'::text, 'cancelled'::text, 'rejected'::text, 'expired'::text])))`
- `NOT NULL status`
- `NOT NULL updated_at`
- `NOT NULL user_id`

### resource_allocations

Inventory quantities reserved against events.

| Column         | PostgreSQL type | Nullable | Default / generation |
| -------------- | --------------- | -------- | -------------------- |
| id             | uuid            | NO       | gen_random_uuid()    |
| institution_id | uuid            | NO       | —                    |
| event_id       | uuid            | NO       | —                    |
| resource_id    | uuid            | NO       | —                    |
| quantity       | integer         | NO       | —                    |

- `NOT NULL event_id`
- `UNIQUE (event_id, resource_id)`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, resource_id) REFERENCES resources(institution_id, id)`
- `PRIMARY KEY (id)`
- `CHECK ((quantity > 0))`
- `NOT NULL quantity`
- `NOT NULL resource_id`

### resources

Shared resource inventory.

| Column         | PostgreSQL type | Nullable | Default / generation |
| -------------- | --------------- | -------- | -------------------- |
| id             | uuid            | NO       | gen_random_uuid()    |
| institution_id | uuid            | NO       | —                    |
| name           | text            | NO       | —                    |
| quantity       | integer         | NO       | —                    |
| description    | text            | NO       | ''::text             |

- `NOT NULL description`
- `NOT NULL id`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `NOT NULL institution_id`
- `NOT NULL name`
- `PRIMARY KEY (id)`
- `CHECK ((quantity > 0))`
- `NOT NULL quantity`

### role_assignments

Coexisting tenant, department, club and event responsibilities.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| user_id        | uuid                     | NO       | —                    |
| role           | text                     | NO       | —                    |
| scope_type     | text                     | NO       | —                    |
| scope_id       | uuid                     | NO       | —                    |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL created_at`
- `NOT NULL id`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `UNIQUE (institution_id, user_id, role, scope_type, scope_id)`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (role) REFERENCES roles(key)`
- `NOT NULL role`
- `NOT NULL scope_id`
- `CHECK ((scope_type = ANY (ARRAY['institution'::text, 'department'::text, 'club'::text, 'event'::text])))`
- `NOT NULL scope_type`
- `NOT NULL user_id`

### role_permissions

Role-to-permission mapping.

| Column     | PostgreSQL type | Nullable | Default / generation |
| ---------- | --------------- | -------- | -------------------- |
| role       | text            | NO       | —                    |
| permission | text            | NO       | —                    |

- `FOREIGN KEY (permission) REFERENCES permissions(key)`
- `NOT NULL permission`
- `PRIMARY KEY (role, permission)`
- `FOREIGN KEY (role) REFERENCES roles(key)`
- `NOT NULL role`

### roles

Role catalogue and permitted assignment scopes.

| Column | PostgreSQL type | Nullable | Default / generation |
| ------ | --------------- | -------- | -------------------- |
| key    | text            | NO       | —                    |
| label  | text            | NO       | —                    |
| scopes | _text           | NO       | —                    |

- `NOT NULL key`
- `NOT NULL label`
- `PRIMARY KEY (key)`
- `NOT NULL scopes`

### saved_events

Private participant event bookmarks.

| Column         | PostgreSQL type | Nullable | Default / generation |
| -------------- | --------------- | -------- | -------------------- |
| institution_id | uuid            | NO       | —                    |
| event_id       | uuid            | NO       | —                    |
| user_id        | uuid            | NO       | —                    |

- `NOT NULL event_id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `PRIMARY KEY (event_id, user_id)`
- `NOT NULL user_id`

### subscription_plans

Feature entitlements; financial billing is unconfigured.

| Column   | PostgreSQL type | Nullable | Default / generation |
| -------- | --------------- | -------- | -------------------- |
| id       | uuid            | NO       | gen_random_uuid()    |
| name     | text            | NO       | —                    |
| features | jsonb           | NO       | '{}'::jsonb          |
| active   | boolean         | NO       | true                 |

- `NOT NULL active`
- `NOT NULL features`
- `NOT NULL id`
- `UNIQUE (name)`
- `NOT NULL name`
- `PRIMARY KEY (id)`

### support_requests

Tenant support submissions visible to the requester and authorised operators.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| created_by     | uuid                     | NO       | —                    |
| subject        | text                     | NO       | —                    |
| body           | text                     | NO       | —                    |
| status         | text                     | NO       | 'open'::text         |
| created_at     | timestamp with time zone | NO       | now()                |

- `NOT NULL body`
- `NOT NULL created_at`
- `FOREIGN KEY (created_by) REFERENCES auth.users(id)`
- `NOT NULL created_by`
- `NOT NULL id`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `NOT NULL institution_id`
- `PRIMARY KEY (id)`
- `CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))`
- `NOT NULL status`
- `NOT NULL subject`

### tasks

Operational checklist and individual assignments.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| title          | text                     | NO       | —                    |
| assigned_to    | uuid                     | YES      | —                    |
| due_at         | timestamp with time zone | YES      | —                    |
| status         | text                     | NO       | 'todo'::text         |
| notes          | text                     | NO       | ''::text             |

- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, assigned_to) REFERENCES memberships(institution_id, user_id)`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `NOT NULL notes`
- `PRIMARY KEY (id)`
- `CHECK ((status = ANY (ARRAY['todo'::text, 'doing'::text, 'done'::text, 'blocked'::text])))`
- `NOT NULL status`
- `NOT NULL title`

### teams

Team leader and random invitation code.

| Column         | PostgreSQL type | Nullable | Default / generation                                    |
| -------------- | --------------- | -------- | ------------------------------------------------------- |
| id             | uuid            | NO       | gen_random_uuid()                                       |
| institution_id | uuid            | NO       | —                                                       |
| event_id       | uuid            | NO       | —                                                       |
| name           | text            | NO       | —                                                       |
| leader_id      | uuid            | NO       | —                                                       |
| join_code      | text            | NO       | replace((gen_random_uuid())::text, '-'::text, ''::text) |

- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `UNIQUE (institution_id, id)`
- `FOREIGN KEY (institution_id, leader_id) REFERENCES memberships(institution_id, user_id)`
- `NOT NULL institution_id`
- `UNIQUE (join_code)`
- `NOT NULL join_code`
- `NOT NULL leader_id`
- `NOT NULL name`
- `PRIMARY KEY (id)`

### venue_bookings

Requested, confirmed and cancelled event venue reservations.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| venue_id       | uuid                     | NO       | —                    |
| starts_at      | timestamp with time zone | NO       | —                    |
| ends_at        | timestamp with time zone | NO       | —                    |
| status         | text                     | NO       | 'requested'::text    |

- `CHECK ((ends_at > starts_at))`
- `NOT NULL ends_at`
- `UNIQUE (event_id)`
- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, venue_id) REFERENCES venues(institution_id, id)`
- `PRIMARY KEY (id)`
- `NOT NULL starts_at`
- `CHECK ((status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'cancelled'::text])))`
- `NOT NULL status`
- `NOT NULL venue_id`

### venues

Venue capacity, facilities, access restrictions and maintenance.

| Column         | PostgreSQL type | Nullable | Default / generation |
| -------------- | --------------- | -------- | -------------------- |
| id             | uuid            | NO       | gen_random_uuid()    |
| institution_id | uuid            | NO       | —                    |
| name           | text            | NO       | —                    |
| building       | text            | NO       | ''::text             |
| room           | text            | NO       | ''::text             |
| floor          | text            | NO       | ''::text             |
| capacity       | integer         | NO       | —                    |
| equipment      | _text           | NO       | '{}'::text[]         |
| restrictions   | text            | NO       | ''::text             |
| maintenance    | boolean         | NO       | false                |

- `NOT NULL building`
- `CHECK ((capacity > 0))`
- `NOT NULL capacity`
- `NOT NULL equipment`
- `NOT NULL floor`
- `NOT NULL id`
- `FOREIGN KEY (institution_id) REFERENCES institutions(id)`
- `UNIQUE (institution_id, id)`
- `NOT NULL institution_id`
- `NOT NULL maintenance`
- `NOT NULL name`
- `PRIMARY KEY (id)`
- `NOT NULL restrictions`
- `NOT NULL room`

### volunteers

Applications, selection, responsibilities, shifts and volunteer attendance.

| Column         | PostgreSQL type          | Nullable | Default / generation |
| -------------- | ------------------------ | -------- | -------------------- |
| id             | uuid                     | NO       | gen_random_uuid()    |
| institution_id | uuid                     | NO       | —                    |
| event_id       | uuid                     | NO       | —                    |
| user_id        | uuid                     | NO       | —                    |
| status         | text                     | NO       | 'applied'::text      |
| duty           | text                     | NO       | ''::text             |
| starts_at      | timestamp with time zone | YES      | —                    |
| ends_at        | timestamp with time zone | YES      | —                    |
| attended       | boolean                  | NO       | false                |

- `NOT NULL attended`
- `NOT NULL duty`
- `NOT NULL event_id`
- `UNIQUE (event_id, user_id)`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `FOREIGN KEY (institution_id, user_id) REFERENCES memberships(institution_id, user_id)`
- `PRIMARY KEY (id)`
- `CHECK ((status = ANY (ARRAY['applied'::text, 'accepted'::text, 'rejected'::text])))`
- `NOT NULL status`
- `NOT NULL user_id`

### workflow_history

Event state changes with actor, timestamp and reason.

| Column          | PostgreSQL type          | Nullable | Default / generation |
| --------------- | ------------------------ | -------- | -------------------- |
| id              | uuid                     | NO       | gen_random_uuid()    |
| institution_id  | uuid                     | NO       | —                    |
| event_id        | uuid                     | NO       | —                    |
| previous_status | text                     | YES      | —                    |
| new_status      | text                     | NO       | —                    |
| actor_id        | uuid                     | YES      | —                    |
| reason          | text                     | NO       | ''::text             |
| created_at      | timestamp with time zone | NO       | now()                |

- `FOREIGN KEY (actor_id) REFERENCES auth.users(id)`
- `NOT NULL created_at`
- `NOT NULL event_id`
- `NOT NULL id`
- `FOREIGN KEY (institution_id, event_id) REFERENCES events(institution_id, id)`
- `NOT NULL institution_id`
- `NOT NULL new_status`
- `PRIMARY KEY (id)`
- `NOT NULL reason`

## Private tables

### planora_private.ticket_secrets

registration_id UUID primary/foreign key → registrations; token_hash TEXT unique; issued_at TIMESTAMPTZ. No token plaintext persists. Requesting a fresh ticket rotates the hash and invalidates the previous QR. The participant receives the bearer value only from issue_ticket.

### planora_private.email_outbox

id UUID primary key; notification_id UUID unique foreign key → notifications; status TEXT; attempts INTEGER; locked_at TIMESTAMPTZ; provider_id TEXT; last_error TEXT; created_at TIMESTAMPTZ. The application roles have no direct table access. The delivery function claims/retries bounded jobs and preserves provider idempotency.

## RPC signatures

Use the service layer in src/services rather than calling RPCs from components. Argument types below are introspected, including defaults.

| Function                  | Arguments                                                                                                                               | Result                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accept_invitations        |                                                                                                                                         | integer                                                                                                                                                                                |
| allocate_resource         | event_id uuid, resource_id uuid, amount integer                                                                                         | void                                                                                                                                                                                   |
| analytics                 | i uuid, from_date timestamp with time zone, to_date timestamp with time zone                                                            | jsonb                                                                                                                                                                                  |
| assign_coordinator        | i uuid, u uuid, r text, scope_type text, scope_id uuid                                                                                  | void                                                                                                                                                                                   |
| check_in                  | event_id uuid, token text DEFAULT NULL::text, registration_id uuid DEFAULT NULL::uuid, reason text DEFAULT ''::text                     | jsonb                                                                                                                                                                                  |
| claim_notification_emails |                                                                                                                                         | TABLE(id uuid, email text, title text, body text, link text)                                                                                                                           |
| club_action               | club_id uuid, action text, member_id uuid DEFAULT NULL::uuid                                                                            | void                                                                                                                                                                                   |
| completion_report         | event_id uuid, p jsonb                                                                                                                  | void                                                                                                                                                                                   |
| coordinators              | i uuid, c uuid                                                                                                                          | TABLE(name text, role text)                                                                                                                                                            |
| correct_attendance        | attendance_id uuid, reason text                                                                                                         | void                                                                                                                                                                                   |
| create_invitation         | i uuid, p jsonb                                                                                                                         | uuid                                                                                                                                                                                   |
| create_support            | i uuid, subject_value text, body_value text                                                                                             | void                                                                                                                                                                                   |
| eligible_event_ids        | i uuid                                                                                                                                  | uuid[]                                                                                                                                                                                 |
| event_counts              | event_id uuid                                                                                                                           | jsonb                                                                                                                                                                                  |
| finish_notification_email | job_id uuid, provider_id text DEFAULT NULL::text, error_text text DEFAULT NULL::text                                                    | void                                                                                                                                                                                   |
| institution_users         | i uuid, query_text text DEFAULT ''::text                                                                                                | TABLE(user_id uuid, name text, email text, kind text, status text, department_id uuid, student_number text, academic_year integer)                                                     |
| issue_certificates        | event_id uuid                                                                                                                           | integer                                                                                                                                                                                |
| issue_ticket              | registration_id uuid                                                                                                                    | text                                                                                                                                                                                   |
| join_institution          | slug_value text                                                                                                                         | uuid                                                                                                                                                                                   |
| manage_member             | i uuid, u uuid, p jsonb                                                                                                                 | void                                                                                                                                                                                   |
| member_options            | i uuid                                                                                                                                  | TABLE(user_id uuid, name text)                                                                                                                                                         |
| my_context                |                                                                                                                                         | jsonb                                                                                                                                                                                  |
| participant_directory     | event_id uuid, query_text text DEFAULT ''::text                                                                                         | TABLE(registration_id uuid, user_id uuid, name text, registration_number text, status text, team_id uuid, checked_in_at timestamp with time zone, created_at timestamp with time zone) |
| platform_action           | action text, p jsonb                                                                                                                    | uuid                                                                                                                                                                                   |
| platform_metrics          |                                                                                                                                         | jsonb                                                                                                                                                                                  |
| process_waitlist          | event_id uuid                                                                                                                           | integer                                                                                                                                                                                |
| publish_announcement      | i uuid, p jsonb                                                                                                                         | uuid                                                                                                                                                                                   |
| read_notification         | notification_id uuid                                                                                                                    | void                                                                                                                                                                                   |
| register_event            | event_id uuid, answers jsonb DEFAULT '{}'::jsonb, team_name text DEFAULT NULL::text, team_code text DEFAULT NULL::text                  | jsonb                                                                                                                                                                                  |
| registration_action       | registration_id uuid, action text, reason text DEFAULT ''::text                                                                         | text                                                                                                                                                                                   |
| reschedule_event          | event_id uuid, new_start timestamp with time zone, new_end timestamp with time zone, new_deadline timestamp with time zone, reason text | void                                                                                                                                                                                   |
| review_budget             | entry_id uuid, decision text, reason text                                                                                               | void                                                                                                                                                                                   |
| review_comment            | event_id uuid, comment_text text                                                                                                        | void                                                                                                                                                                                   |
| revoke_certificate        | certificate_id uuid, reason text                                                                                                        | void                                                                                                                                                                                   |
| run_waitlist_jobs         |                                                                                                                                         | integer                                                                                                                                                                                |
| save_academic_term        | i uuid, p jsonb, record_id uuid DEFAULT NULL::uuid                                                                                      | uuid                                                                                                                                                                                   |
| save_budget               | event_id uuid, p jsonb                                                                                                                  | uuid                                                                                                                                                                                   |
| save_directory            | i uuid, kind text, p jsonb, record_id uuid DEFAULT NULL::uuid                                                                           | uuid                                                                                                                                                                                   |
| save_event                | i uuid, p jsonb, event_id uuid DEFAULT NULL::uuid                                                                                       | uuid                                                                                                                                                                                   |
| save_settings             | i uuid, p jsonb                                                                                                                         | void                                                                                                                                                                                   |
| save_task                 | event_id uuid, p jsonb, task_id uuid DEFAULT NULL::uuid                                                                                 | uuid                                                                                                                                                                                   |
| set_branding              | i uuid, path text, club_id uuid DEFAULT NULL::uuid                                                                                      | void                                                                                                                                                                                   |
| submit_feedback           | event_id uuid, rating_value integer, comment_text text                                                                                  | void                                                                                                                                                                                   |
| toggle_saved              | event_id uuid                                                                                                                           | boolean                                                                                                                                                                                |
| transition_event          | event_id uuid, target text, reason text DEFAULT ''::text                                                                                | text                                                                                                                                                                                   |
| update_profile            | p jsonb                                                                                                                                 | void                                                                                                                                                                                   |
| verify_certificate        | code text                                                                                                                               | jsonb                                                                                                                                                                                  |
| volunteer_action          | event_id uuid, p jsonb                                                                                                                  | void                                                                                                                                                                                   |

## Storage and Realtime

Private buckets: event-media (10 MiB), receipts (10 MiB), branding (2 MiB). Event paths are institution/event/random.ext; branding paths begin with institution. Read/insert policies use the tenant and scoped permissions; signed read URLs expire. No public bucket is created.

Realtime is enabled for selected operational tables by migration 004. It invalidates query caches; PostgreSQL RLS remains the access boundary. Auth, Storage APIs and Realtime delivery require hosted integration testing.

## Regeneration

Run npm run generate:types, then node scripts/generate-schema-doc.mjs. After deployment, also generate authoritative Supabase CLI types as documented in SETUP.md. SQL migrations are the source of truth.
