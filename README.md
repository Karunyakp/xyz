# PLANORA

PLANORA is a multi-tenant campus event and operations application built with React, TypeScript and Supabase. The source includes real database-backed workflows, scoped permissions, private storage policies, Edge Functions, automated tests and a Vercel deployment configuration.

**Delivery status:** source implementation and local verification are complete for the capabilities listed in `IMPLEMENTATION_STATUS.md`. The application has **not** been connected to, migrated into or deployed against your hosted Supabase project. No authenticated Supabase connection or project credentials were available in the build session; the dashboard also required sign-in. Do not interpret the archive name as a claim of completed hosted deployment or production certification.

The running application displays a configuration screen until the Supabase URL and publishable key are supplied. It does not populate a fake campus or pretend that registrations succeeded.

## Start here

1. Extract `Planora-Complete-Source.zip`. It contains a single `Planora/` project directory.
2. Open a terminal in `Planora/`. Use Node.js 22.12+ or 24 LTS.
3. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

4. Copy `.env.example` to `.env` and configure the three browser variables. Never put a service-role key in a `VITE_` variable.
5. Follow **SETUP.md** to link your intended Supabase project, inspect/apply migrations, configure Auth, bootstrap the first platform administrator and deploy the Edge Functions.
6. Start the frontend:

   ```bash
   npm run dev
   ```

7. Run the local checks and production build:

   ```bash
   npm run check
   npm run test:edge
   npm run build
   ```

8. Deploy `dist/` through Vercel using the exact environment and redirect configuration in **SETUP.md**.

## What is included

- Student discovery, backend search, category/date/department/club/format/team/eligibility filters, calendar, event details, bookmarks, registrations, tickets, club applications, volunteer tasks, passport and certificates.
- Seven-step event creation, editing, cloning, rescheduling, audited lifecycle transitions and independent faculty reviews with configurable approval count.
- Individual and per-member team registration, custom questions, transactional capacity, FIFO waitlist invitations with deadlines, cancellation and manual application reviews.
- Random QR ticket tokens stored only as hashes; assigned-event scanning, duplicate protection, manual organiser fallback and audited faculty corrections.
- Event-day operations, task lists, volunteer selection/duty/scanner permissions, agenda, notices, contacts, resource allocation and venue availability.
- Budget allocations, expenses, sponsorships, reimbursement tracking, receipt uploads, independent reviews and financial reporting.
- Institution/department/club/user management, branding, invitations and CSV/XLSX invitation import, scoped role assignment, tenant suspension, plan entitlements, support requests and audit records.
- Aggregate analytics, academic terms, semester/year comparisons, date filters, CSV/XLSX exports, certificate PDF generation and public verification/revocation.
- Supabase Auth, PostgreSQL RLS, private Storage and Realtime subscriptions; privileged Edge Functions for invitations and optional scheduled notification/waitlist delivery.

All registration fees are zero. Real payments are intentionally disabled until a provider is configured and tested. See `src/infrastructure/payments.ts`.

## Project map

| Path                   | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| `src/app/`             | Session/tenant context, protected routes, layouts and query hooks                 |
| `src/features/`        | Student, organiser, faculty, institution and platform workspaces                  |
| `src/components/`      | Shared accessible components, Radix dialogs, buttons, tables and venue calendar   |
| `src/domain/`          | Domain types, validation, permissions and workflow display rules                  |
| `src/services/`        | Application services, repository queries, exports and use-case entry points       |
| `src/infrastructure/`  | Supabase connection, generated database types and payment interface               |
| `supabase/migrations/` | Ordered schema, RLS, RPC, storage, Realtime and hardening migrations              |
| `supabase/functions/`  | Three Deno Edge Functions and shared authentication/CORS helpers                  |
| `tests/`               | Database security/workflow tests, route-render tests, validation and export tests |
| `scripts/`             | Type/schema generation and read-only hosted connectivity verification             |

## Verification commands

| Command                  | What it actually verifies                                                          |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `npm run typecheck`      | Strict TypeScript for frontend and TypeScript tests                                |
| `npm run lint`           | ESLint and React hook call rules                                                   |
| `npm test`               | Domain boundaries, route rendering with isolated fixtures and real XLSX generation |
| `npm run test:db`        | All migrations and security/workflow assertions against local PostgreSQL WASM      |
| `npm run test:edge`      | Deno type checks for every Edge Function                                           |
| `npm run build`          | Optimised Vite production build                                                    |
| `npm run test:live`      | Read-only hosted connectivity check; exits 2 when unconfigured                     |
| `npm run generate:types` | Regenerates the local schema snapshot from migrations                              |

PGlite supplies real PostgreSQL semantics for the database tests; `auth.users`, `auth.uid()`, Storage metadata and the Realtime publication are deliberately emulated in the harness. These are **not** hosted integration tests and **not** multi-connection concurrency/load tests. Test fixtures are confined to tests and never used by the application.

The ZIP excludes dependencies, build output, caches, Git history and real environment files. The lockfile and all migrations are included. Read `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `SECURITY.md`, `TEST_REPORT.md` and `IMPLEMENTATION_STATUS.md` before a campus rollout.
