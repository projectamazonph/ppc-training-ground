# Code Audit — 2026-07-15

**Scope:** full independent code audit of `main` @ `2539838` (includes the five
2026-07-15 hotfix commits implementing `.omo/plans/full-system-fix-plan.md`).
**Method:** manual source review of auth, payments, webhooks, server actions,
tenant isolation, Prisma schema/migrations, and config.
**Reviewer:** Claude (agent audit), commissioned by Ryan.

**Verdict: NOT launch-ready.** Four launch blockers found — two of them
introduced by the 2026-07-15 hotfix commits. Auth/RBAC architecture is
fundamentally sound. Fix status for each finding is tracked at the bottom.

> Good news first: the "PayMongo webhook HMAC not verified" blocker carried in
> `security-audit-2026-07-13.md` and `SESSION-HANDOVER.md` is **stale** — the
> verification in `src/lib/webhook-signature.ts` is implemented and correct
> (raw body, HMAC-SHA256, timing-safe compare, test+live signatures).

---

## Critical — launch blockers

### C1. Every checkout charges 100× the displayed price

`PricingTier.pricePhp` stores **centavos** (`prisma/seed.ts:62` —
`pricePhp: 299900, // PHP 2,999.00 in centavos`; the pricing page divides by
100 for display). But `src/app/actions/checkout.ts` computed
`amountCentavos = Math.round(tier.pricePhp * 100)` and sent that to PayMongo —
a **₱299,900 charge for a ₱2,999 course**. The unit confusion cascades with a
*different* wrong assumption at each layer:

- Payments page formats `Payment.amountPhp` (centavos) as whole pesos → ₱29,990,000
- `receipts.tsx` multiplied by 100 **again** for the BIR invoice → ₱29.99M gross
- `refunds.ts` multiplied by 100 for the PayMongo refund → refund > payment, always rejected

**Resolution:** centavos is the canonical unit for every DB money field
(`pricePhp`, `amountPhp`, `finalAmountPhp`, `netAmountPhp`, `refundAmountPhp`,
`minPurchasePhp`, `RefundRequest.amountPhp`, invoice `*Centavos`). All ×100
conversions removed; display goes through `formatCentavos()` in `src/lib/format.ts`.
The `*Php` field names are misleading — renaming them is a recommended
follow-up migration.

### C2. Invoice numbering regression — only the first invoice per year can issue

Hotfix `0b8855c` (fix-plan item 1.3) changed the *query* in
`nextInvoiceSequence` to look for `"<year>-"`-prefixed numbers, but
`issueInvoiceForPayment` still *stored* the dashless format `"000012026"`.
The query never matches → sequence always 1 → second invoice of the year hits
the `@unique` constraint → error swallowed in the webhook → **every payment
after the first silently gets no BIR receipt**.

**Resolution:** canonical stored format is now `"2026-00001"`. PDF rendering
parses both formats (legacy dashless rows keep working). Sequence generation
retries on unique-constraint collision (concurrent payments).

### C3. Prisma migrations locked to SQLite; production is PostgreSQL

`prisma/migrations/migration_lock.toml` said `provider = "sqlite"` and the
init migration used SQLite dialect (`DATETIME`). `prisma migrate deploy` — the
exact command in the production runbook and CI — fails with a provider
mismatch against Neon Postgres.

**Resolution:** migration history regenerated for PostgreSQL (squashed init,
2026-07-16, via `prisma migrate diff --from-empty --to-schema-datamodel`).
**Operator action:** existing dev databases need `prisma migrate reset` (or
`migrate resolve`) once. If CI's `prisma migrate deploy` step was green with
the SQLite lock file, that CI step was not doing what it claims — verify.

### C4. Guest checkout: customer pays, gets nothing, event never retried

Two compounding flaws in `src/lib/enrollment.ts`:

1. Payment was created with `userId: checkout.userId ?? ''` — an empty-string
   FK when a guest checks out. Postgres rejects it and the transaction rolls
   back.
2. `markWebhookProcessed` ran **before** the work, outside the transaction, so
   PayMongo's retry is treated as a duplicate and skipped.

Net result: money taken, no Payment, no Enrollment, no retry. (The 2026-07-15
transaction hotfix also called `findOrCreateUserByEmail` with the global `db`
client *inside* the transaction — the user row escapes the rollback, and the
fix plan explicitly warned about this.)

**Resolution:** the user is resolved (with the tx client) *before* the Payment
is created; the ProcessedWebhook idempotency row is created *inside the same
transaction* as the work, so a failed handler rolls back cleanly and the retry
gets a clean slate. Repeat purchase of an already-enrolled course reactivates
the enrollment instead of crashing into `@@unique([userId, courseId])`.

---

## High severity

### H1. No rate limiting; sync scrypt blocks the event loop
`signInAction` allowed unlimited credential stuffing; `scryptSync` blocks the
Node event loop, so a burst of bogus sign-ins is also a cheap DoS.
**Resolution:** in-memory sliding-window rate limiting on sign-in, sign-up,
and checkout (per-instance; swap for Upstash/Vercel KV for multi-instance
prod — noted in code). `scryptSync` → async `scrypt` is a recommended
follow-up.

### H2. Suspension doesn't end sessions
JWTs live 7 days and `getSession()` never checked `User.status`/`deletedAt` —
a suspended user kept full access until token expiry.
**Resolution:** `getSession()` now returns null (→ redirect to sign-in) unless
the user exists, is `ACTIVE`, and is not soft-deleted.

### H3. Receipts written to `public/receipts/`
(a) On Vercel the bundle FS is read-only → invoice rendering 500s in prod.
(b) Where it works, BIR receipts (customer name + email) are statically served
with **no auth** to anyone with the invoice id.
**Resolution:** PDFs now render to `os.tmpdir()` and are served only through
the authed, owner-checked `/api/invoices/[id]/pdf` route (re-rendered on cache
miss). Vercel Blob (private) remains the durable-storage swap point.

### H4. Double-refund race
`approveRefundAction` checked PENDING non-atomically and marked APPROVED with
an unguarded `update` — two admins approving concurrently would both call
PayMongo's refund API.
**Resolution:** the PENDING→APPROVED transition is now an atomic
`updateMany({ where: { status: PENDING } })`; losers of the race bail out.

### H5. Email-verification gate with no verification flow
Hotfix `e4922ad` blocked sign-in for unverified users — but no verification
email is ever sent and no verify endpoint exists. New signups are auto-stamped
verified (check is a no-op for them); **any user created before the commit is
permanently locked out** with a message pointing at an email that never comes.
The fix plan's own risk table required a backfill first.
**Resolution:** the sign-in block is reverted until a real verification flow
ships. `emailVerified` stamping is kept so a future flow has clean data.

---

## Medium severity

### M1. Resend webhook could never verify a real event
- Body was read twice (`verifySignature` consumed it, `POST` re-read → throw → 400).
- Wrong scheme: Resend signs via **Svix** (`svix-id`/`svix-timestamp`/
  `svix-signature`, base64, secret `whsec_`-prefixed) — not a hex HMAC in a
  `resend-signature` header.
- Stray `'use server'` directive on a route-handler file.
**Resolution:** single body read; proper Svix verification (timestamp
tolerance 5 min, timing-safe compare, multiple `v1,` candidates); directive
removed.

### M2. Internal error messages leak to clients
`createSafeAction` returned raw `e.message` (incl. Prisma errors); the new
root `error.tsx` rendered `error.message`.
**Resolution:** only plain `Error` (intentional, user-facing) messages pass
through; subclassed errors (Prisma, TypeError, …) become generic. `error.tsx`
shows a generic message + digest.

### M3. Live-class capacity still racy after hotfix
Count-then-create inside a READ COMMITTED transaction — two concurrent
registrations both pass the check.
**Resolution:** transaction now runs at `Serializable` with retry on
serialization failure (P2034).

### M4. Limited-use discount codes burn on abandoned checkouts
`currentUses` was incremented at checkout-session creation (before payment)
and never released.
**Resolution:** increment moved into the paid-webhook transaction.

### M5. `sameSite: 'strict'` breaks the PayMongo return flow
The redirect back from PayMongo to `/checkout/complete` is a cross-site
navigation; with `strict`, the session cookie isn't sent and buyers land
apparently signed out. The fix plan itself flagged this exact flow for testing.
**Resolution:** reverted to `lax` (Next server actions already enforce Origin
checks for CSRF). Related: middleware no longer deletes the session cookie when
a non-admin merely visits `/admin` (was a full logout on a stray click).

### M6. `handlePaymentRefunded` unit mismatch
Stored PayMongo's centavo amount into `refundAmountPhp` — consistent now that
centavos is canonical everywhere (see C1).

### M7. Dead `x-user-*` header forwarding in middleware
Headers were set on the *response* (nothing consumes them; `getSession()`
re-verifies the cookie). **Resolution:** removed.

---

## Verified-OK (no action)

- **Auth primitives:** scrypt + `timingSafeEqual`, jose with pinned HS256,
  HttpOnly cookies, JWT_SECRET length check.
- **PayMongo webhook signature verification** — correct (update stale docs).
- **Authorization coverage:** every `(dashboard)` page calls `requireAuth`;
  every admin page + layout calls `requireAdmin`; tool/refund/invoice actions
  do ownership checks with non-leaky "not found" responses. No IDOR found.
- **Certificates:** `randomUUID` verification hash, PII-scoped public page.
- Security headers baseline, audit logging on admin actions, soft-delete
  discipline, no secrets in repo.

## Still open (tracked, not fixed in this pass)

| # | Item | Priority |
|---|------|----------|
| O1 | Rename `*Php` money fields to `*Centavos` (schema migration) | Post-launch |
| O2 | Async `scrypt` (event-loop) | Sprint 13 |
| O3 | Distributed rate limiting (Upstash/KV) for multi-instance prod | Sprint 13 |
| O4 | Real email-verification flow (send + verify endpoint + backfill) | Sprint 13 |
| O5 | CSP header (pre-existing S13-001) | Sprint 13 |
| O6 | Durable receipt storage on private Vercel Blob | Sprint 13 |
| O7 | Verify CI's `migrate deploy` step actually ran (was green with SQLite lock?). Migration history now regenerated for Postgres (2026-07-16) — re-run CI to confirm. | Now |
| O8 | Update `security-audit-2026-07-13.md` + `SESSION-HANDOVER.md` — PayMongo HMAC is done | Now |

## Process note

Three of the five 2026-07-15 hotfix commits introduced or half-implemented
fixes that were worse than what they replaced (C2, C4, H5). Each fix-plan item
should land with the concurrency/integration test the plan itself prescribes
before the next item starts.

## Verification addendum — 2026-07-16

Independently re-verified this doc's resolutions against the code (not just
the prose) after commit `1eb2223`, since prior "Resolution" notes in this same
process had been wrong before (see process note above). Findings:

- **C1, C2, C4, H4, M1** — confirmed correct by reading the actual diff, not
  just the commit message.
- **C3 — the "Resolution" note was false when first written.** `schema.prisma`
  said `postgresql` but `migration_lock.toml` and every migration's SQL were
  still SQLite dialect, untouched by any hotfix commit. Regenerated for real
  via `prisma migrate diff --from-empty --to-schema-datamodel` (squashed init,
  Postgres types e.g. `TIMESTAMP(3)` throughout). `prisma validate` now passes.
- **`@prisma/client` had never been generated** against the current schema in
  this environment, which cascaded into ~55 spurious `tsc` errors unrelated to
  any hotfix. Not a code bug — `npx prisma generate` resolves it, and it's
  worth confirming CI always runs this before `tsc`/tests.
- **2 real `tsc` errors** (`enrollment.ts`, `receipts.tsx`) from
  `.split(...)[1]` under `noUncheckedIndexedAccess` — one fixed with an
  explicit `?? ''` fallback, the other cleared once the Prisma client was
  regenerated (was a stale-client artifact, not a code issue).
- **4 of the "165 tests" were still failing after `1eb2223`**, both pre-existing
  test bugs unrelated to the hotfix content itself:
  - `admin-audit.test.ts` — two assertions read `call.metadata` /
    `call.ipAddress` directly instead of `call.data.metadata` /
    `call.data.ipAddress` (the third test in the same file got the nesting
    right — just a copy-paste miss). Source (`admin-audit.ts`) was already
    correct.
  - `progress-actions.test.ts` — never mocked `@/lib/auth`, so the real
    `requireAuth()` ran against a `cookies()` mock that always returns no
    token and a `redirect()` mock that (unlike `auth.test.ts`'s) doesn't
    throw — so it fell through and returned `null` instead of stopping.
    Fixed by mocking `requireAuth` directly, matching the pattern already
    used in `admin-audit.test.ts` for `requireAdmin`.

**Current state:** `tsc --noEmit` clean, `prisma validate` clean, `vitest run`
165/165 passing. All four launch blockers (C1–C4) confirmed resolved in code.
Items O1–O6 remain open as before (post-launch/Sprint 13 follow-ups); O7 can
now be marked done — migrations are Postgres-native.

### Pre-deployment audit — 2026-07-16 (later the same day)

Two further launch blockers found and fixed during the final deploy audit:

- **`next build` failed outright.** `src/lib/email.tsx` constructed the Resend
  client at module scope; the SDK constructor throws when `RESEND_API_KEY` is
  unset, and the PayMongo webhook route pulls this module in during page-data
  collection — so any build without the key (CI, fresh clones) died. Fixed
  with a lazy singleton; the send-time key guard already existed.
- **CI has been failing at the pnpm setup step — no quality gate has actually
  run on recent pushes.** `pnpm/action-setup@v4` refuses the conflict between
  `version: 9` (ci.yml, sentry-alert.yml) and `packageManager: pnpm@11.13.0`
  (package.json). Every recent run died in ~32 s before typecheck/tests/build.
  Removed the workflow pins so `packageManager` is authoritative. **This
  definitively answers O7:** CI was never green with the SQLite lock file —
  it wasn't running `migrate deploy` (or anything else) at all.
- Also fixed: `lint` script still invoked `next lint`, which Next 16 removed
  (ESLint 9 flat config was already present — now `eslint .`, 0 errors), and
  the production-deploy runbook falsely claimed migrations run via
  `postinstall` and expected "5 migrations found" (now 1 squashed baseline).

Verified after fixes: `next build` completes, `eslint .` 0 errors,
`vitest` 165/165, `tsc` clean. CI green-ness must be confirmed on the next
push — it has no recent green baseline.
