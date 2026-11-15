# PLANORA implementation status

Release source prepared 15 November 2026. Product name: **PLANORA**. Archive: **Planora-Complete-Source.zip**.

## Read this first

This is a substantial executable source application with a real Supabase implementation. It is not a completed live deployment. The connected project claimed in the request was not exposed by this chat's available tools; no project URL, publishable key or management credentials were supplied. The Supabase dashboard was reached and displayed a sign-in page. No live Supabase migrations, Auth settings or production deployment were changed.

All stored business data in the application comes from Supabase. No demo records or fake analytics are substituted when the backend is missing. The configuration screen is intentional and the blocked hosted work is explicit.

## Capability matrix

| Area               | Implemented in source                                                                                                    | Verification / boundary                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Authentication     | Email/password signup/sign-in, verification callback, reset, session handling, profile                                   | SDK wiring; hosted delivery/callback tests blocked by project access     |
| Membership         | Tenant onboarding through approved domains or invitations; activation/deactivation, academic fields                      | Database tests cover verified membership and denial paths                |
| Scoped RBAC        | Institution, department, club and event roles; coexisting responsibilities; platform isolation                           | Local RLS/RPC tests across two tenants and multiple users                |
| Student discovery  | Backend search and pagination, filters, detail pages, saved events, calendar, registered events                          | Route rendering and domain tests; hosted interaction test pending        |
| Personalisation    | Interests/followed-club matching against upcoming events                                                                 | Deterministic rules; no claim of a trained recommendation model          |
| Clubs              | Directory, following, applications, decisions, branding, scoped coordinators                                             | Persistent tables/RPC/UI; applications tested locally                    |
| Event authoring    | Seven-step wizard, media/attachments/gallery files, custom questions, agenda, FAQs, draft/edit/clone                     | Strict validation, real save RPC and private storage integration         |
| Workflow           | Proposal/review/revisions/rejection/approval/publication/open/close/ongoing/completion/cancellation                      | Local tests cover gates, independent reviewers and invalid transitions   |
| Rescheduling       | Fresh draft/review version, booking release, participant notices                                                         | Local tests verify prior approvals no longer match                       |
| Registration       | Unique records, eligibility, questions, per-participant capacity, teams, manual review, cancellation                     | Local transaction/security tests                                         |
| Team participation | Create/join code, per-member consent and tickets, maximum size, minimum confirmed members at check-in                    | Per-member seat model; not atomic all-or-nothing team waitlist promotion |
| Waitlist           | FIFO, reserved invitations, expiration, acceptance, promotion                                                            | Local workflow tests; background operation requires deployed scheduler   |
| QR attendance      | Camera scanner, token input, duplicate handling, organiser manual fallback, faculty corrections                          | Backend tests pass; physical camera/device test not executed             |
| Event operations   | Live counts, recent arrivals, agenda, contacts, task statuses, resource allocation, volunteer readiness                  | Database/query/UI implementation; hosted Realtime not verified           |
| Volunteers         | Application, selection, duties, shifts, attendance, event-only scanner role                                              | Task and permission tests locally                                        |
| Faculty            | Approval queue, reasons/comments/history, required distinct reviewers, conflict visibility, completion review            | Database tests; institutional coordinator assignments available          |
| Administration     | Users, departments, clubs, venues/resources, invites/import/export, role delegation, audits/settings                     | Source/UI/RPC coverage and local CRUD/permission tests                   |
| Venues/resources   | Venue fields, maintenance, hourly availability, requested/confirmed bookings, exact conflict rejection, inventory        | Local booking/resource tests; concurrency load tests still required      |
| Finance            | Estimated budgets, allocation/expense/sponsorship/reimbursement entries, receipts, reviews, totals                       | Separate approval test; no money movement or payment collection          |
| Communications     | In-app notices, notifications, read status, Auth invitation email, optional outbox email                                 | In-app persistence implemented; SMTP/Resend/scheduler need configuration |
| Certificates       | Attendance/completion-gated issuance, PDF download, verification, revocation                                             | Issuance/revocation and public verification tests locally                |
| Reports            | Date ranges, totals/rates, categories/departments/clubs/months/finance, exports, completion reports                      | SQL aggregates, saved academic terms and side-by-side period comparisons |
| Platform           | Tenant create/suspend, usage aggregates, plans, event/registration/active-event entitlements, global categories, support | Entitlement and tenant isolation tests locally                           |
| Deployment         | Vercel SPA config, security headers, Supabase CLI configuration, 8 migrations, 3 Edge Functions                          | Build passes; Vercel/Supabase deployment not executed                    |

## Exact incomplete or constrained items

1. **Live connection and migration application:** blocked by missing authenticated access to the intended Supabase project. Local migration execution is complete; hosted migration execution is not.
2. **Hosted authentication, RLS integration, Storage, Realtime and role dashboards end-to-end:** require that project plus real staging users. Route-render tests and PostgreSQL tests do not establish these cloud integration results.
3. **Email delivery and unattended expiry:** require verified SMTP/domain configuration, optional Resend credentials and an authenticated scheduler. These were not provided or configured. In-app notices and user-triggered waitlist processing are implemented.
4. **Vercel deployment:** no connected Vercel account/project or production origin was available. Deployment source/configuration/instructions are included; no production URL is claimed.
5. **Payments and SaaS billing:** intentionally disabled, as requested when provider credentials/institutional requirements are absent. Plan entitlements work independently; actual charging, refunds and reconciliation do not.
6. **Physical QR/device acceptance and multi-session concurrency/load testing:** not executed in this environment. Browser inspection covered the unconfigured desktop and 390px setup screens. Major workspaces have server-render smoke tests, not full browser interaction tests.
7. **Platform health:** usage/tenant/support views exist. Infrastructure uptime, database load and function-error telemetry remain in Supabase/Vercel monitoring; an integrated telemetry feed was not implemented because no monitoring backend is configured.
8. **Team waitlist semantics:** seats are independently held per person, with team completeness checked before admission. Atomic group-wide waitlist promotion is not implemented; it was not assumed where the brief did not specify seat semantics.
9. **Large-data administration:** event discovery is paginated, but most operational directories are bounded (normally 500, audit/availability up to 1,000, participant/user exports up to 10,000). Full institution-scale cursor pagination and bulk streaming exports remain necessary above these limits.
10. **Certificate typography:** the supplied PDF template uses standard PDF fonts. Complex-script typography and a visual certificate-template editor are not included.

These limitations mean the project should be treated as an implementation ready for staging integration and review, not as an independently certified production ERP. The archive is the complete source of what was actually built.
