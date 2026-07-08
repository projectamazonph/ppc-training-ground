# Session Handoff — AMPH Academy v2

**Session date:** 2026-07-07 to 2026-07-10 (Sprints 1–6 partial — Sprint 5 closed + Sprint 6 STORY-026 + STORY-027 shipped)
**Last commit:** d482aa9 feat(payments): STORY-027 — guest signup completion + grandfather seed
**Repo:** github.com/projectamazonph/amph-v2 (PUSHED to main)
**Project path:** /storage/emulated/0/Hermes Projects/projects/amph-v2

## Current state — pick up here

- **Sprint 6 (Payments):** 2/4 stories complete = **50%**
- **Project total:** 27/55 stories = **49%**
- **Pushed commits on main:** d482aa9, 532af3d, be1f6ce, fdfa8af, d2a4231, dcd819d, 1bc2c62
- **TypeScript:** 0 errors (`pnpm typecheck`)
- **AI-slop scan:** clean
- **Dual-vault sync:** done this session (was blocked previously)

## Resume command for next session

```
cd "/storage/emulated/0/Hermes Projects/projects/amph-v2"
git log --oneline -5
pnpm typecheck                          # expect 0
cat SESSION-HANDOVER.md
grep "status:" bmad/sprint-status.yaml | head -10
```

## What STORY-027 shipped (commit d482aa9)

### Guest checkout completion flow (Q1=B)
- `/checkout/complete` detects no session + PAID checkout → redirects to `/auth/signup?email=<checkout.email>&next=/checkout/complete`
- After signup the user returns to `/checkout/complete`, now signed in, falls through to `SuccessCard`
- `/auth/signup` reads `?email` and `?next`; `SignUpForm` pre-fills email (editable, with hint) and honors `?next=` for post-submit redirect

### Placeholder account claim
- `signUpAction` detects `passwordHash` starting with `placeholder_` (set by `enrollment.ts:findOrCreateUserByEmail` during guest checkout) and upgrades in place: replace hash, set name, mark `emailVerified`
- Real accounts with existing hash still get "email already exists" error
- Marker is intentional string prefix; survives user.update without breaking the upgrade path

### Grandfather (Q2=A)
- `prisma/seed.ts` runs `grandfatherFreeEnrollment()` after tier/badge setup
- Any user without an existing (non-deleted) enrollment gets a backdated ACTIVE Enrollment at PPC_FOUNDATIONS
- Idempotent — uses `upsert` on `userId_courseId` composite unique
- Backdated to `2026-07-01T00:00:00Z` so the timeline reflects "before payments" rather than "right now at seed time"
- Prints `✓ grandfather: N user(s) → free PPC Foundations` for visibility

### Helper for future stories
- `src/lib/tier-gate.ts` adds `TierAccessDeniedError` (carries `reason`, `userTier`, `requiredTier`) and `requireCourseAccess(userId, slug)` that throws on denial
- Existing progress actions continue to use inline `evaluateCourseAccess` — no regression
- Return type narrowed via `Extract<..., { allowed: true }>` so callers can destructure `userTier`/`requiredTier` safely

## Three blocking questions answered (for STORY-027 handoff)

- **Q1=B** — guest checkout bounces to `/auth/signup` with prefilled email
- **Q2=A** — pre-existing users grandfathered with FREE PPC enrollment at seed
- **Q3=A** — pushed forward into STORY-027 from STORY-026

## Next session: open work

### Sprint 6 remaining (2 stories, 2 pts)
1. **STORY-028** — Refund flow: student request page + admin approval + PayMongo `refundPayment()` call
   - Library ready: `refundPayment()` exists in `src/lib/paymongo.ts`
   - UI needed: `/dashboard/payments` request form, `/admin/payments` approval queue
   - Soft-delete pattern: Payment.status → REFUNDED, Enrollment.status → REFUNDED, set `cancelledAt` + `cancellationReason: 'Refund processed'`
   - Webhook handler `handlePaymentRefunded()` already in `src/lib/enrollment.ts`

2. **STORY-029** — BIR-compliant receipt PDFs
   - `@react-pdf/renderer` template (similar pattern to `src/lib/cert-pdf.tsx`)
   - Sequential numbering: `BS #{number}-#{yyyy}` format
   - Store in Vercel Blob; downloadable from `/dashboard/payments`
   - `Invoice` table already in Sprint 6 migration `20260708042743_sprint6_payments_foundation`

### Sprint 7 (after S6 finishes)
- Admin panels (4 stories): user mgmt, course mgmt, payment audit log, settings
- Spec at `docs/admin-backend.md`

### Known Sprint 9 cleanup
- ESLint v9 doesn't read legacy `.eslintrc.json` — flat config migration needed
- `next lint` deprecated in Next 16

## What's NOT done (deferred)

- Sprint 7: Admin panels — user/course/payment/audit management
- Sprint 8: Email templates — Resend (live class reminder currently stubbed)
- Sprint 9: Polish — voice-guide audit, accessibility, ESLint v9 migration
- Sprint 10: Tests — 0% coverage, badge engine is natural first target
- Sprint 11: Observability — Sentry, structured logs
- Sprint 12: Launch
- **End-to-end runtime verification** — `pnpm dev` not runnable in this sandbox (no Node in Termux). All code type-correct at structure level; smoke test on real machine before declaring done.

## Critical context for next session

### Path convention
- Project at `/storage/emulated/0/Hermes Projects/projects/amph-v2/` (not `/root/workspace` despite workspace tag)
- All terminal commands `cd` into project path first

### Enums pattern
- `export const X = { A: 'A', B: 'B' } as const; export type X = (typeof X)[keyof typeof X]`
- SQLite + Prisma String column, NOT Prisma enum (SQLite doesn't support)
- New enums go in `src/lib/enums.ts`

### PayMongo flow
- Webhook → `markWebhookProcessed(eventId, ...)` idempotency check
- → `handleCheckoutPaid(event)` creates Payment, finds-or-creates user (placeholder), creates ACTIVE Enrollment
- → Email reminder stubbed; Sprint 8 wires Resend templates
- Secret in `.env.local`: `PAYMONGO_WEBHOOK_SECRET`

### Database
- `DATABASE_URL="file:./dev.db"` (relative to project root)
- `pnpm prisma migrate deploy` to apply migrations
- `npx tsx prisma/seed.ts` to seed (idempotent; re-runs grandfather safely)
- Default admin: `ryan@projectamazonph.com` / `ChangeMe123!`

### Tier gate helpers (post STORY-027)
- `evaluateCourseAccess(userId, slug)` → structured `TierGateResult`
- `userCanAccessCourse(userId, slug)` → boolean
- `getUserHighestTier(userId)` → `CourseTier | null` (cross-tier features)
- `userMeetsTierRequirement(userId, requiredTier)` → `{ allowed, userTier }`
- `requireCourseAccess(userId, slug)` → throws `TierAccessDeniedError` on denial

### The no-ai-slop rule
- `eslint-rules/no-ai-slop.js` — runs (when ESLint is migrated to v9 flat config)
- Banned phrases: leverage, delve, seamless, robust, comprehensive, empower, revolutionize, etc.
- Manual scan substitute: `grep -rniE "leverage|delve|seamless|robust|comprehensive|empower" src/`

### Things I tried that didn't work (avoid repeating)
- **`replace_all=true` on multi-line blocks** — duplicates content. Use unique anchors.
- **Const-asserted TUPLE pattern for enums** — no `.MEMBER` access; use const OBJECT pattern.
- **`npx tsx` with JSDoc glob comments** (`*/*.mdx`) — esbuild errors.
- **Running `pnpm dev` in sandbox** — no Node, can't verify end-to-end.

## State files reference

- `bmad/project.yaml` — BMAD config (level 3, English)
- `bmad/workflow-status.yaml` — phase tracking, story list (now 27 stories)
- `bmad/sprint-status.yaml` — Sprint 6 = 2/4 = 50%
- `docs/sprint-plan.md` — 12-sprint roadmap
- `docs/decisions.md` — 16 ADRs
- `docs/db-schema.md` — schema spec
- `docs/design-brief.md` — Field Manual design system
- `docs/voice-guide.md` — copy rules + jargon buster
- `docs/business-layer.md` — PayMongo integration spec
- `docs/admin-backend.md` — admin panel routes + RBAC pattern

## Second Brain entity

`/root/storage/Documents/SecondBrain/wiki/entities/amph-v2.md` updated with Sprint 6 partial section. Dual-vault synced to `/sdcard/Documents/SecondBrain/wiki/entities/amph-v2.md` this session.

## Memoria state

T1 snapshot stored at id `019f413871a17b718befd83abed04e70`. Covers STORY-027 closure, Q1/Q2/Q3 answers, file paths, next steps.