# Audit remediation — 2026-07-17 (integrity + security on `main`)

Second-pass deep audit response. This branch fixes the audit findings **that
apply to `main`'s actual code** and are verifiable in CI without a live
PayMongo account or a concurrent-Postgres test harness. It is scoped
deliberately — see "Not in this pass" below.

## Important: `main` ≠ PR #33

The audit was written against PR #33 (`fix/audit-2026-07-17-full-remediation`).
This branch is cut from `main`, which differs materially, so several of the
audit's most severe findings **do not exist here**:

- **No Source-based payment flow.** `main` handles `checkout_session.payment.*`
  and `payment.refunded`; `source.chargeable` is acknowledged-and-skipped.
  → **C1, C2, C4, and the Source parts of C3 are N/A on `main`.**
- **`main` had no claim token at all.** Guest-checkout account claiming keyed
  only on a `placeholder_` password prefix, so *anyone* who signed up with a
  guest's email silently took over the account. That is worse than C6 describes
  and is fixed here (C5/C6).
- **H2** (form-action redirect not wired) is N/A — `markLessonCompleteAction`
  calls `redirect()` directly.

## Fixed in this pass

| ID | Finding | Fix |
|----|---------|-----|
| C5/C6 | Guest account claiming (takeover risk / race) | Added `User.claimTokenHash` + `claimTokenExpiresAt`. Guest checkout mints a single-use token (only the SHA-256 hash stored) and emails a dedicated claim link **after** the fulfillment transaction commits. Signup requires the token and consumes it with a guarded `updateMany` (id + placeholder + token hash + not-expired), so two concurrent claims can't both set a password. `src/lib/claim-token.ts`, `auth.ts`, `enrollment.ts`, `email.tsx`, signup page/form, checkout-complete page. |
| C7 | Duplicate active refund requests under concurrency | Partial unique index `RefundRequest_active_per_payment_key` (one PENDING/APPROVED per payment). `createRefundRequestAction` maps the P2002 to a friendly error. |
| C8 | Refund counted twice | `RefundRequest.paymongoRefundId` is now unique. `Payment.refundAmountPhp` is **derived** from the sum of PROCESSED refund requests by both the admin path and the webhook, so they converge instead of adding. |
| C9 | Successful provider refund reported as failed | `approveRefundAction` splits provider call from local reconciliation. Only a provider failure marks the request FAILED; a DB failure after provider success returns a `PROCESSING` state (money moved; webhook reconciles) and never re-triggers a refund. |
| C10 | Lesson/quiz XP raceable; attempt numbers collide | New `XpLedger` with unique `(userId, eventKey)`. `awardXpOnce` inserts the ledger row first and increments XP in one transaction — a duplicate event aborts and grants nothing. Quiz `attemptNumber` now retries on unique conflict instead of `count + 1`. |
| H1 | Quiz-gated lessons manually completable | `markLessonCompleteAction` refuses manual completion when the lesson has a published quiz; the lesson page hides the manual button for those lessons. |
| H3 | Tool submissions can brick / diverge | `submitToolSession` grades first (bad scenario/state leaves the session IN_PROGRESS and retriable), then atomically claims IN_PROGRESS→terminal + awards XP via the ledger. Already-terminal sessions re-grade from stored state and never re-mutate. `saveToolSession` rejects edits after submission. |
| H4 | Discount limit exceeded concurrently | Blind `increment` replaced with a guarded `updateMany` (`currentUses < maxUses`, null = unlimited); zero affected rows fails the fulfillment transaction. |
| H6 | Mixed-case emails lock users out | Emails canonicalized (trim + lowercase) at signup/signin/checkout via the Zod schema and in `findOrCreateUserByEmail`. Migration backfills existing rows to lowercase (collision-safe). |
| H7 | Certificate integrity/concurrency | Completion counts only **published, non-deleted** lessons. Partial unique index `Certificate_active_per_user_course_key`; issuance returns the winner on P2002. |
| H9 | Sentry tracing silently disabled | Replaced the removed-in-v8 `startTransaction` adapter with `startSpan`; the duration timer now starts per invocation, not at module load. |

### Schema / migration

`prisma/migrations/20260717000000_audit_integrity_fixes/` adds the claim-token
columns, the `XpLedger` table, the unique `paymongoRefundId`, the two partial
unique indexes, and the email backfill. The partial indexes cannot be expressed
in `schema.prisma`, so they live in raw SQL in that migration.

**Before deploying:** if any payment already has two active refund requests, or
any (user, course) already has two active certificates, dedupe those rows first
— the `CREATE UNIQUE INDEX` will otherwise fail. Pre-launch data is expected to
be clean.

## Not in this pass (deferred, and why)

- **H5 — repeat-purchase entitlement.** Correctly revoking access after
  refunding an *unlinked* repeat purchase needs the one-to-many /
  entitlement-ledger redesign the audit calls for. Doing it blind here (a
  `Payment.enrollmentId` unique → one-to-many migration) is too risky without a
  live environment. Documented for a dedicated change.
- **H6 hard enforcement (citext / normalized unique column).** This pass
  canonicalizes at the app layer and backfills data; enforcing
  case-insensitive uniqueness at the DB level (citext extension or a normalized
  column + unique index) should follow once the backfill is confirmed clean.
- **Claim-link regeneration** (resend/expire-and-reissue) — the happy path and
  atomic consume are in; a self-serve "resend my claim link" flow is a
  follow-up.
- **Payment-architecture items (C1–C4)** — N/A on `main` (no Source flow).

## Verification

- `pnpm tsc --noEmit` — clean.
- `pnpm test` — 218 passing (added: `xp.test.ts`, claim-token auth tests;
  updated: `enrollment.test.ts` for the new atomic discount + derived-refund
  behavior).
- `pnpm lint` — 0 errors.
- `pnpm test:coverage` — thresholds met (86% lines on `src/lib`).

These are unit-level guarantees. The audit's required **release tests** (real
PayMongo events, concurrent-Postgres races, backup restore) still need a live
environment and are not exercised here.
