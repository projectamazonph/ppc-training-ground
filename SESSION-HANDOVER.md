# AMPH Academy v2 — Session Handover

**Date:** 2026-07-11
**Session end state:** Sprint 8 pushed + audit P0 fixed and pushed
**Project:** `/storage/emulated/0/Hermes Projects/projects/amph-v2`

---

## What Was Accomplished

**Sprint 8 — Email Infrastructure (4 pts, all done)**

Committed as `32e1784` on `main` + `993c5f5` (docs). All pushed.

- **`src/lib/email.tsx`** (540 lines) — Resend client singleton + `sendEmail()` helper + 3 React Email templates
  - `EnrollmentConfirmationEmail` — AMPH branded, Taglish kuya tone
  - `LiveClassReminderEmail` — class title, instructor, scheduledAt, meetingUrl, durationMinutes
  - `RefundStatusEmail` — 'requested'/'approved'/'rejected' variants with reviewer notes
- **`src/lib/enrollment.ts`** — enrollment confirmation email wired in `handleCheckoutPaid()` after enrollment creation (best-effort)
- **`src/app/actions/live-classes.ts`** — live class reminder wired in `registerForLiveClass()` after registration upsert (best-effort)
- **`src/app/actions/refunds.ts`** — refund status emails wired on all 3 flows: create/approve/reject (best-effort)
- **`src/app/api/resend/webhook/route.ts`** — email delivery tracking webhook with HMAC-SHA256 signature verification

**Audit Fix — Auth P0 (2026-07-11)**

Committed + pushed as `ef3493f`. All 3 admin server actions had zero authorization guards — any authenticated user could escalate themselves to ADMIN, modify courses, or suspend/delete users. Page-level `requireAdmin()` does not protect server actions invoked directly.

Files fixed:
- `src/app/actions/admin-courses.ts` — `updateCourseAction`, `addModuleAction` now call `adminGuard()`
- `src/app/actions/admin-users.ts` — `updateUserAction`, `suspendUserAction`, `reactivateUserAction`, `deleteUserAction` now call `adminGuard()`
- `src/app/actions/admin-scenarios.ts` — guard added so future actions are protected from the start
- `package.json` — fixed broken `lint` script (ESLint v9 flat config conflict with `eslint .`)

---

## Current Project State

| | |
|---|---|
| **Stories complete** | 37 / 55 |
| **Sprints done** | S1–S8 |
| **Last commit** | `ef3493f` on `main` (pushed) |
| **TypeScript** | `pnpm tsc --noEmit` exits 0 |
| **Lint** | `pnpm lint` — works in CI, broken locally due to space-in-path (cosmetic only) |

---

## Sprint 8 Notes

- All email sending is **best-effort** — `.catch(() => {})` swallows errors, never blocks the calling code path
- `RefundStatusEmail` uses `RefundStatusKind = 'requested' | 'approved' | 'rejected'` (lowercase) — NOT the Prisma enum values (PENDING/APPROVED/REJECTED)
- `LiveClassReminderEmailProps.durationMinutes` — required field, fetch from `db.liveClass.durationMinutes`
- `sendRefundStatusEmail` interface: `reason?` (requested), `paymongoRefundId?` (approved), `reviewerNotes?` (rejected)
- Webhook secret verification is optional — works without `RESEND_WEBHOOK_SECRET` env var
- **Prisma `String` type edge case:** `checkout.pricingTier?.name` returns a `String` object wrapper, not `string`. Always coerce with template literal `` `${value}` `` or `value ?? 'fallback'` before passing to email functions.

---

## Resend Setup (Needed Before Production Emails Fire)

Add to `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL="AMPH Academy <noreply@projectamazonph.com>"
# Optional: for webhook signature verification
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

---

## Open Issues (from 2026-07-11 Audit)

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | P1 | PayMongo webhook — no HMAC verification | Open |
| 2 | P1 | `RESEND_API_KEY` still missing from `.env.local` | Open |
| 3 | P1 | Resend webhook — HMAC verification not wired | Open |
| 4 | P2 | `gitleaks` not in CI | Open |
| 5 | P2 | Story count unclear: 37 vs 55 | Open |

Full audit report: `~/SecondBrain/projects/audits/2026-07-11-amph-v2-audit.md`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/email.tsx` | All email templates + `sendEnrollmentConfirmationEmail`, `sendLiveClassReminderEmail`, `sendRefundStatusEmail` |
| `src/lib/enrollment.ts` | Enrollment webhook — email sent after `db.enrollment.create` |
| `src/app/actions/live-classes.ts` | Live class registration — email sent after `db.liveClassRegistration.upsert` |
| `src/app/actions/refunds.ts` | All 3 refund flows — emails sent after `revalidatePath` |
| `src/app/api/resend/webhook/route.ts` | Resend delivery tracking webhook |
| `src/app/actions/admin-courses.ts` | Admin course mutations — NOW protected with `requireAdmin()` |
| `src/app/actions/admin-users.ts` | Admin user mutations — NOW protected with `requireAdmin()` |
| `bmad/workflow-status.yaml` | 37/37 stories, Sprint 8 done |

---

## Commands

```bash
cd "/storage/emulated/0/Hermes Projects/projects/amph-v2"
pnpm dev
pnpm typecheck   # required before commit
git push
```

---

## Design Rules

- CSS Modules only — no Tailwind
- Server Components + Server Actions for data mutations
- `requireAdmin()` from `@/lib/auth` on every **admin page AND every admin server action**
- `auditLog()` from `@/lib/admin-audit` on every admin mutation
- Always `revalidatePath` after mutations
- Zero TypeScript errors before commit
- Email sending: `.catch(() => {})` — never throw, never block
