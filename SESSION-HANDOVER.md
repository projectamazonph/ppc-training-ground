# AMPH Academy v2 — Session Handover

**Date:** 2026-07-12
**Session end state:** Sprint 9 PLANNED (5 stories, 5 pts), BMAD state files updated, all sprint docs synced. NO code work landed in this session — Sprint 8 was already committed in the prior session (commit `1414754`).
**Project:** `/storage/emulated/0/Hermes Projects/projects/amph-v2`

---

## What Was Accomplished

**Sprint 9 Planning (this session)**

Closed out documentation for Sprints 5–8 (which had been recorded as "backlog" in `docs/sprint-plan.md` even though the code shipped) and authored the Sprint 9 plan + 5 story files.

- **`docs/sprint-plan.md`** — Updated header date + status (37/42 stories, 88% of plan). Added ✅ Complete markers on Sprints 5, 6, 7, 8. Re-scoped Sprint 9 from "voice/empty-states/a11y audit" to "Polish + Mobile". Updated "Done So Far" footer.
- **`docs/sprint-9/PLAN.md`** — New file. Sprint goal, capacity reasoning, story table, dependency graph, out-of-scope list, DoD checklist, Sprint 10 order-of-operations handoff.
- **`docs/stories/STORY-038.md`** through **`STORY-042.md`** — Per-story artifacts with goal, why-first/last ordering, acceptance criteria, files-touched, code shape excerpts, pitfalls, verification commands, DoD.
- **`bmad/sprint-status.yaml`** — Flipped Sprint 8 from `in_progress` → completed (STORIES 034–037 moved to `completed_stories`). Added Sprint 9 with STORIES 038–042 in `planned_stories`. Velocity tracking updated.
- **`bmad/workflow-status.yaml`** — Bumped `total: 42`, `completed: 37`, `in_progress: 5`, `estimated_stories: 42`. Added 5 Sprint 9 story slugs to `story_list`. Added `sprint_9_notes`. Refreshed `last_updated: 2026-07-12T00:00:00Z`.
- **`README.md`** — Sprint Status section updated with all 8 sprints complete (37/42 stories), Next pointer to Sprint 9.

**State on disk**

| | |
|---|---|
| **Stories complete** | 37 / 42 |
| **Sprints done** | S1–S8 |
| **Current sprint** | S9 (planned, 5 stories, 0 completed) |
| **Last commit** | `1414754` on `main` (NOT pushed — push needs GitHub auth on a desktop machine) |
| **TypeScript** | `pnpm typecheck` exits 0 |

---

## Sprint 9 Quick Reference

- **Goal:** Mobile-first refactor of student-facing surface. Every page renders correctly at 390px + 1280px using Field Manual tokens.
- **Capacity:** 5 pts
- **Stories:** STORY-038 (audit) → STORY-039 (tokens + helpers) → STORY-040 (BottomNav) → STORY-041 (marketing+auth mobile) → STORY-042 (student flow mobile)
- **Source-of-truth prototypes:** `/workspace/amph-v2-stitch/generated/mobile/*.html` (24 screens, Field Manual tokens, mobile-first). Two prototypes still need generation: `landing-mobile.html` (from Stitch `9b9f7eb...`) and `dashboard-mobile.html` (from Stitch `663ad1dc...`). Both are first-tasks inside STORY-041 and STORY-042 respectively.
- **Plan:** `docs/sprint-9/PLAN.md`
- **Stories:** `docs/stories/STORY-038.md` through `STORY-042.md`

---

## Current Project State

| | |
|---|---|
| **Stories complete** | 37 / 55 |
| **Sprints done** | S1–S8 |
| **Last commit** | `ef3493f` on `main` (pushed) |
| **TypeScript** | `pnpm tsc --noEmit` exits 0 |
| **Lint** | `pnpm lint` — works in CI, broken locally due to space-in-path (cosmetic only) |

Files fixed:
- `src/app/actions/admin-courses.ts` — `updateCourseAction`, `addModuleAction` now call `adminGuard()`
- `src/app/actions/admin-users.ts` — `updateUserAction`, `suspendUserAction`, `reactivateUserAction`, `deleteUserAction` now call `adminGuard()`
- `src/app/actions/admin-scenarios.ts` — guard added so future actions are protected from the start
- `package.json` — fixed broken `lint` script (ESLint v9 flat config conflict with `eslint .`)

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
