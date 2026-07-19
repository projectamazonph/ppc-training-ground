# Launch deploy — stripped build (manual enrollments)

This branch is the **minimum-friction launch build**: PayMongo (payments) and
Resend (email) are stripped out entirely. You collect payments yourself
(GCash / bank transfer / Messenger) and grant course access from the admin
panel. Everything else — courses, lessons, the five practice tools,
gamification, certificates, live classes, admin — is intact.

## What was removed

- **PayMongo**: checkout flow (`/pricing` buy buttons, `/checkout/complete`),
  webhook route, refunds (student request flow + admin review pages),
  receipts/invoice PDFs, the `paymongo` npm package.
- **Resend**: all email sending. `src/lib/email.ts` is now a no-op stub that
  logs instead of sending; the `resend` npm package and webhook route are gone.
- Dashboard "Payments" page and nav entry.

The Prisma schema was **not** changed — `Payment`, `CheckoutSession`,
`RefundRequest` tables still exist (empty), so no migration surgery is needed
and the payment stack can be restored later from the main repo's history.

## What was added

- **`/admin/enroll`** — enter a student email + pricing tier; the student is
  enrolled in every course on that tier.
  - Existing account → access appears on their dashboard immediately.
  - New email → a placeholder account is created and you get a **one-time
    claim link** (shown once, expires in 7 days). Send it to the student
    yourself (Messenger/email); they use it to set their password.
- Admin dashboard now shows recent enrollments instead of payments, with an
  "Enroll Student" quick action. Each user's admin detail page links to a
  pre-filled enroll form.
- `/pricing` keeps the tier cards but the CTA is now "create an account +
  message us to pay" instead of a checkout button.

## Deploy steps (Vercel + hosted Postgres)

1. **Database**: create a Postgres instance (Neon, Supabase, or Vercel
   Postgres). Copy the connection string.
2. **Env vars** (Vercel → Project → Settings → Environment Variables):
   - `DATABASE_URL` — from step 1
   - `JWT_SECRET` — `openssl rand -base64 32`
   - `NEXT_PUBLIC_APP_URL` — your production URL (needed for correct claim
     links from /admin/enroll)
   - Optional: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
3. **Migrate + import + seed** (locally, pointing at the production DB) —
   order matters: the curriculum import must run before the seed's
   course-dependent steps (live classes) can complete:
   ```bash
   DATABASE_URL="..." ADMIN_EMAIL="you@..." ADMIN_PASSWORD="..." ./scripts/setup-db.sh
   ```
   or step by step:
   ```bash
   DATABASE_URL="..." pnpm prisma:deploy                 # schema
   DATABASE_URL="..." pnpm tsx scripts/import-amph-content.ts  # courses/modules/lessons/quizzes
   DATABASE_URL="..." ADMIN_EMAIL="you@..." ADMIN_PASSWORD="..." pnpm prisma db seed  # admin, tiers, badges, live classes
   ```
4. **Deploy**: import the repo in Vercel, pick this branch, deploy. No other
   configuration is required.
5. **Smoke test**: sign in at `/auth/signin` with the admin account →
   `/admin/enroll` → enroll a test email → open the claim link in an
   incognito window → set a password → dashboard shows the courses.

## Day-to-day enrollment workflow

1. Student pays you via GCash/bank transfer and messages you their email.
2. Admin → **Enroll Student** → paste email, pick tier, submit.
3. New student? Copy the claim link and send it to them. Existing student?
   Tell them to refresh their dashboard.
4. Refunds/disputes: handle in chat; suspend the user or leave the
   enrollment — there is no in-app refund flow in this build.
