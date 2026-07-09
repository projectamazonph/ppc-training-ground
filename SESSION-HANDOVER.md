# AMPH Academy v2 — Session Handover

**Date:** 2026-07-11
**Session end state:** Sprint 8 committed (NOT pushed — no GitHub credentials on this machine), docs updated
**Project:** `/storage/emulated/0/Hermes Projects/projects/amph-v2`

---

## What Was Accomplished

**Sprint 8 — Email Infrastructure (4 pts, all done)**

Committed as `32e1784` on `main`. 5 files changed, 748 insertions.

- **`src/lib/email.tsx`** (540 lines) — Resend client singleton + `sendEmail()` helper + 3 React Email templates
  - `EnrollmentConfirmationEmail` — AMPH branded, Taglish kuya tone
  - `LiveClassReminderEmail` — class title, instructor, scheduledAt, meetingUrl, durationMinutes
  - `RefundStatusEmail` — 'requested'/'approved'/'rejected' variants with reviewer notes
- **`src/lib/enrollment.ts`** — enrollment confirmation email wired in `handleCheckoutPaid()` after enrollment creation (best-effort)
- **`src/app/actions/live-classes.ts`** — live class reminder wired in `registerForLiveClass()` after registration upsert (best-effort)
- **`src/app/actions/refunds.ts`** — refund status emails wired on all 3 flows: create/approve/reject (best-effort)
- **`src/app/api/resend/webhook/route.ts`** — email delivery tracking webhook with HMAC-SHA256 signature verification

---

## Current Project State

| | |
|---|---|
| **Stories complete** | 37 / 55 |
| **Sprints done** | S1–S8 |
| **Last commit** | `32e1784` on `main` (NOT pushed — push needs GitHub auth) |
| **TypeScript** | `pnpm typecheck` exits 0 |

---

## Sprint 8 Notes

- All email sending is **best-effort** — `.catch(() => {})` swallows errors, never blocks the calling code path
- `RefundStatusEmail` uses `RefundStatusKind = 'requested' | 'approved' | 'rejected'` (lowercase) — NOT the Prisma enum values (PENDING/APPROVED/REJECTED)
- `LiveClassReminderEmailProps.durationMinutes` — required field, fetch from `db.liveClass.durationMinutes`
- `sendRefundStatusEmail` interface: `reason?` (requested), `paymongoRefundId?` (approved), `reviewerNotes?` (rejected)
- Webhook secret verification is optional — works without `RESEND_WEBHOOK_SECRET` env var
- **Prisma `String` type edge case:** `checkout.pricingTier?.name` returns a `String` object wrapper, not `string`. Always coerce with template literal `` `${value}` `` or `value ?? 'fallback'` before passing to email functions.

---

## Resend Setup (Needed Before Production)

Add to `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=AMPH Academy <noreply@projectamazonph.com>
# Optional: for webhook signature verification
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/email.tsx` | All email templates + `sendEnrollmentConfirmationEmail`, `sendLiveClassReminderEmail`, `sendRefundStatusEmail` |
| `src/lib/enrollment.ts` | Enrollment webhook — email sent after `db.enrollment.create` |
| `src/app/actions/live-classes.ts` | Live class registration — email sent after `db.liveClassRegistration.upsert` |
| `src/app/actions/refunds.ts` | All 3 refund flows — emails sent after `revalidatePath` |
| `src/app/api/resend/webhook/route.ts` | Resend delivery tracking webhook |
| `bmad/workflow-status.yaml` | 37/37 stories complete, Sprint 8 done |

---

## Commands

```bash
# Dev
cd "/storage/emulated/0/Hermes Projects/projects/amph-v2"
pnpm dev

# Type check (required before commit)
pnpm typecheck

# Push (run on machine with GitHub auth)
git push
```

---

## Design Rules

- CSS Modules only — no Tailwind
- Server Components + Server Actions for data mutations
- `requireAdmin()` from `@/lib/auth` on every admin page
- `auditLog()` from `@/lib/admin-audit` on every admin mutation
- Always `revalidatePath` after mutations
- Zero TypeScript errors before commit
- Email sending: `.catch(() => {})` — never throw, never block
