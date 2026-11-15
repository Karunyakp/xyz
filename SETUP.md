# PLANORA setup and deployment

## 1. Extract and install

Extract the archive, enter the `Planora` directory and install Node.js 22.12+ or 24 LTS.

```bash
npm ci
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Set these values in the local `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_APP_URL=http://localhost:5173
```

Use the publishable key from the intended Supabase project. A legacy anon key also works with the SDK, but never use a secret/service-role key here. Vite embeds browser variables at build time. Restart the development server after changes.

## 2. Select and migrate the intended Supabase project

The migration files create common public table names such as `events` and `profiles`. Use a dedicated PLANORA project, or first review any existing schema for collisions. These migrations are not an automatic merge of an unrelated application's database. Back up an existing database before applying structural changes.

Install/use the official Supabase CLI in an authenticated local terminal:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Review the project reference and dry-run output before the push. Do not paste access tokens, database passwords or service-role keys into chat. Supply them through the CLI's secure prompts or your local secrets manager.

All eight migration files must apply, in filename order. Migrations create 36 public tables, 2 private tables, 48 public RPC functions, scoped role data, indexes, private buckets and Realtime publication entries. The public tables have RLS enabled. Operational writes go through permission-checked RPCs.

For a fresh, disposable local Supabase stack, Docker and the CLI can instead run:

```bash
npx supabase start
npx supabase db reset
```

`db reset` is for a disposable local development database. It is not the production upgrade command.

## 3. Configure Authentication

In the selected project's Auth configuration:

- Enable email/password sign-in and email confirmation.
- Set Site URL to your frontend origin.
- Allow these exact redirect paths for each environment: `/auth/callback` and `/reset-password`.
- For local development, allow `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password`.
- Configure your institution's SMTP sender for actual email delivery and verify its sending domain.
- Keep the service-role key server-only. Auth user metadata never grants application roles.

PLANORA uses the Supabase PKCE flow. During local testing, complete email callbacks in the browser where you began the flow. Test confirmation and recovery links using the deployed domain before onboarding users.

New signups receive a profile only. They receive **no administrator privileges**. Institution membership is acquired through a controlled invitation or a verified email domain configured by an institution administrator. Domain self-onboarding grants only the student role.

## 4. Bootstrap the first platform administrator

Create and verify your personal PLANORA account through the application. The initial platform administrator must be assigned using your trusted Supabase SQL editor; public signup cannot do it.

Replace the example email with the exact verified account you own. This inserts only when an email-confirmed account matches:

```sql
insert into public.platform_admins(user_id)
select id
from auth.users
where lower(email) = lower('YOUR_VERIFIED_ADMIN_EMAIL')
  and email_confirmed_at is not null
on conflict do nothing;
```

Refresh or sign back in. Open the Platform console. To create an institution, provide its name, unique slug and the verified owner's Auth user UUID from your trusted project dashboard. The platform administrator can be the first institution owner if explicitly selected. Platform administration alone does not grant access to student records.

The owner should then:

1. Configure institutional branding, approved email domains and approval policy.
2. Create departments, clubs, venues and resources.
3. Invite another verified faculty account; do not approve your own proposals.
4. Assign department/club/event roles to the appropriate members.
5. Configure student academic details before using department/year eligibility filters.

## 5. Deploy Edge Functions

These functions use the caller's JWT or a dedicated scheduler secret in their own handlers. Gateway `verify_jwt` is disabled intentionally so the handlers can validate each authentication mode explicitly; it does **not** make invitation or scheduler operations public.

```bash
npx supabase functions deploy invite-member
npx supabase functions deploy process-waitlists
npx supabase functions deploy deliver-notifications
```

Set function secrets in your Supabase dashboard/secret manager:

| Variable         | Required for                              | Value                                                    |
| ---------------- | ----------------------------------------- | -------------------------------------------------------- |
| `APP_ORIGIN`     | Invitations and notification email        | Exact frontend origin, no trailing slash                 |
| `CRON_SECRET`    | Scheduled functions                       | Random server-only secret with at least 32 characters    |
| `RESEND_API_KEY` | Optional announcement/notification emails | Your configured provider key                             |
| `EMAIL_FROM`     | Optional emails                           | Verified sender, e.g. `PLANORA <events@your-domain.edu>` |

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to its function runtime. Do not duplicate these in browser variables. Invitation email uses Supabase Auth's configured email delivery; it does not require Resend.

For an existing Auth account, the invitation remains stored even if Supabase's invite-user email operation declines to send. That user can sign in and choose **Accept pending institution invitations** in Profile, or **Accept my invitations** on the onboarding screen. The UI reports whether email delivery occurred.

## 6. Schedule waitlist expiry and optional emails

Use your authenticated scheduler, Supabase Cron plus Vault, or another server-side scheduler. Configure these HTTPS POST jobs:

| Interval                            | Endpoint path                         | Header                                |
| ----------------------------------- | ------------------------------------- | ------------------------------------- |
| Every minute                        | `/functions/v1/process-waitlists`     | `Authorization: Bearer <CRON_SECRET>` |
| Every minute, when email is enabled | `/functions/v1/deliver-notifications` | Same dedicated scheduler secret       |

The origin is your selected Supabase project URL. Keep the secret in server-side secret storage, never in an unauthenticated web cron URL or browser bundle. Test each job manually from your scheduler before enabling its interval. PLANORA has not configured any external scheduler on your behalf.

Cancellation and new registrations also process the waitlist atomically. A scheduler is needed to release expired invitations promptly while there is no user traffic. Email additionally requires **Enable optional notification email delivery** in institution settings. In-app notifications work independently of Resend.

## 7. Start and validate

```bash
npm run dev
npm run check
npm run test:edge
```

For the read-only hosted smoke check, Node can load your local environment file:

```bash
node --env-file=.env scripts/verify-live.mjs
```

Optional `PLANORA_TEST_JWT` may be supplied through the terminal environment to test authenticated context retrieval. Do not commit it. This smoke test does not replace the staged user/role checklist in `TEST_REPORT.md`.

## 8. Deploy to Vercel

1. Import this source into your own Vercel project through your Git repository or deploy using Vercel CLI from `Planora/`.
2. Select Vite, build command `npm run build`, output directory `dist`, install command `npm ci`, Node.js 22.x or 24.x.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_APP_URL` for the intended deployment environment.
4. Set `VITE_APP_URL` to the final HTTPS origin. Rebuild after changing it.
5. Update Supabase Auth Site URL and redirect allowlist to this origin and the two callback paths.
6. Update Edge Function `APP_ORIGIN` to exactly the same origin and deploy functions if their code changed.
7. Deploy and test a complete event using two independent faculty/admin accounts and student accounts from two institutions.

`vercel.json` includes SPA rewrites and security headers. If using a Supabase custom domain, adjust the `connect-src` and `img-src` CSP entries to that exact domain. Do not broadly disable CSP to make a custom domain work.

## 9. Run a real launch rehearsal

Use a staging project and two institutions. Create a venue, propose and approve an event, publish/open registration, fill capacity, cancel a seat, accept the promoted waitlist invitation, open check-in, scan a real QR from another device, repeat the scan, complete the event, issue and verify a certificate, submit feedback, and confirm cross-tenant denial. Test email confirmation/reset/invitation delivery and delayed scheduler retries.

Use HTTPS for camera access outside localhost. Test iOS Safari and Android Chrome with actual cameras. Backups, retention, monitoring, institutional policies, SMTP deliverability and capacity/load tests are deployment responsibilities, not established by a successful local build.
