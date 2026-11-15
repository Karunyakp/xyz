# PLANORA security model

## Trust boundaries

Browser route visibility is a convenience. PostgreSQL permission checks, RLS, constraints and transaction locks are the authority. User-editable Auth metadata is used only to initialise a display name, never to infer a role.

Application tables live in `public`, with RLS on every table. Sensitive ticket hashes and email delivery state live in `planora_private`, which is not an exposed API schema. Helper functions have a fixed empty `search_path`; object names are schema-qualified. Browser access to helper functions is limited to those required by RLS/storage policies. Service-only scheduler/outbox RPCs are explicitly denied to anonymous and authenticated browser roles.

## Controls implemented

- Verified email plus active institution membership is required for tenant data access.
- Role scopes coexist; event volunteers cannot scan other events or use manual corrections.
- Platform administrators receive aggregate usage, not automatic student-record access.
- External members cannot browse internal departments, clubs, private events or campus-only announcements.
- Owners alone may appoint institution administrators; public registration cannot appoint privileged roles.
- Separate reviewer required for event and budget approvals; approval counts use distinct reviewer identities and the current proposal version.
- Event capacity and waitlist reservations are checked transactionally, including expiration and cancellation.
- Venue/resource reservations enforce availability in SQL, not merely on-screen checks.
- QR tokens comprise two cryptographically random UUID values (approximately 244 random bits), with only SHA-256 hashes stored. Rotation invalidates older screenshots of a ticket. No credentials or private profile payloads are embedded in the QR.
- Duplicate attendance is constrained at the database and reported as Already Checked In.
- Certificate verification exposes only the recipient name, event title, institution, issuance date and valid/revoked flag for an unguessable verification code.
- Storage buckets are private, with institution/event path checks, MIME restrictions, size limits and short-lived signed read URLs. Upload names are random and immutable.
- Edge invitation permission checks execute using the caller's JWT before service-role Auth operations occur.
- Invitation creation is limited to 200 per inviting user/institution/hour.
- Scheduler endpoints require a separate server secret. Notification email uses a retry outbox and provider idempotency keys.
- CSV export neutralises formula prefixes. XLSX exports string values as text; the UUID transitive dependency is pinned above the reported vulnerable range and covered by an export compatibility test.
- Vercel headers include CSP, frame denial, no-sniff, restricted camera permissions and a referrer policy.

## Operational security that still needs your deployment

Configure SMTP/domain verification, trusted redirect URLs, production secrets, Auth abuse controls, backups, database monitoring, log retention and institutional access reviews. Use a staging tenant pair to verify hosted RLS before admitting real students. Test multiple concurrent database sessions for oversubscription and booking races; the local WASM test engine is single-connection and is not evidence of contention testing.

The project does not claim a completed penetration test, legal compliance certification, third-party security audit, disaster-recovery test or production SLA. Production Auth, Storage, Realtime, camera/device behaviour and provider delivery have not been verified in the build environment.

Never commit `.env`, service-role keys, Auth JWTs, SMTP credentials, payment credentials or database connection strings. The source archive contains none of these.
