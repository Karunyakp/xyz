# PLANORA verification report

Executed in the build environment on 15 November 2026; final command results are also captured in `tests/verification-results.json`.

## Executed

| Check                           | Result                            | Scope                                                                 |
| ------------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| Dependency installation         | Passed                            | Locked npm dependency graph                                           |
| Strict TypeScript               | Passed                            | Frontend and TS/TSX tests                                             |
| ESLint                          | Passed                            | Application, tests and scripts; hook-call rules included              |
| Vitest                          | 49 passed                         | 40 major route-render checks, 8 domain tests, 1 real XLSX export test |
| Database migrations / RPC / RLS | 39 passed                         | Eight migrations in local PostgreSQL WASM, two-tenant fixtures        |
| Edge Functions                  | Passed                            | Deno type checking for all three functions                            |
| Production build                | Passed                            | Vite build; main and ExcelJS chunks emit size warnings                |
| Production dependency audit     | No known vulnerabilities reported | npm audit at verification time; not a security certification          |
| Browser visual check            | Passed for inspected state        | Unconfigured setup screen at desktop and 390px iframe viewport        |
| Hosted connectivity command     | Blocked, exit 2                   | No project environment configuration; no hosted assertions ran        |

## Database assertions

The database suite exercises: RLS coverage; student privilege escalation denial; real draft persistence; cross-tenant read/write denial; direct mutation denial; invalid lifecycle transitions; self-approval denial; faculty review and venue reservation; platform/student-data separation; required question/eligibility checks; capacity and FIFO queue order; duplicate registration prevention; cancellation promotion; expiration and acceptance; token ownership/hashing; ongoing-event/scanner scope; idempotent check-in and actor identity; manual-scan restrictions; invalid/cancelled ticket handling; independent budget approval; attendance-gated certificates and public revocation; feedback eligibility; overlapping venues; cross-tenant references; distinct multi-reviewer policy; scoped invitations; unverified membership denial; tenant suspension; audit/job grants; external data restrictions; safe member options; scoped delegation; directory/club CRUD; resource inventory; task ownership; rescheduling/version invalidation; full SQL counts; timezone validation; platform plan entitlements; and academic-term tenant access/date validation.

Test accounts and campus names are synthetic and exist only in the test database. They are not application demo data.

## Limits of these results

- PGlite executes PostgreSQL SQL, RLS, constraints and stored functions. Auth, Storage service and Realtime infrastructure are represented by minimal local schema stubs. Networked Supabase services are not under test.
- The database harness uses one connection. It does not prove multi-session lock/race behaviour under load.
- Route tests render the major components using isolated fixture context. They check renderability and basic output, not user interaction with a real backend or full responsive browser behaviour.
- Camera capture was not tested with a physical device. Only the backend QR validation path was exercised.
- No production data was created, altered, emailed or exported.
- Hosted signup, email verification/recovery, invitation delivery, storage upload/download and Realtime reconnect tests were not executed.
- No Supabase or Vercel deployment succeeded in this session, because no authenticated target project was available.

## Required staging acceptance run

1. Verify confirmation/reset callbacks and invitations with real test email accounts.
2. Create two institutions. Attempt every read and privileged mutation using the other tenant's user and IDs.
3. Use two independent sessions to compete for the last seat and overlapping venue/resource reservations.
4. Test a two-reviewer proposal, revisions, publication, registration, cancellation and waitlist expiration.
5. Upload real event media and receipts; confirm private storage denial from an unrelated user.
6. Scan a real QR in Android Chrome and iOS Safari, rescan it, try a wrong-event volunteer and use an approved manual correction.
7. Verify Realtime arrivals/tasks/notifications, disconnect/reconnect and token refresh.
8. Complete an event, issue/revoke certificates, download the PDF and verify it from a signed-out browser.
9. Test SMTP/optional email delivery, scheduler authentication, retries and error logs.
10. Validate backup restore, monitoring alerts, campus retention rules and representative peak load.
