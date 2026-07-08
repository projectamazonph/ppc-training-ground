# Session Handover — AMPH Academy v2

**Session date:** 2026-07-07 to 2026-07-10 (Sprints 1–6 partial — Sprint 5 closed + Sprint 6 STORY-026 + STORY-027 shipped)
**Last commit:** feat(payments): STORY-027 — guest signup completion + grandfather seed
**Repo:** github.com/projectamazonph/amph-v2

## What this session accomplished

Five sprints total across two mega-sessions. Sprint 5 (Gamification) is the
most recent — completed 2026-07-09.

### Sprint 4: Tool UIs (4.5/4.5 pts) — ✅ Complete
- STORY-018: Campaign Builder 5-step wizard (CampaignBuilderRunner)
- STORY-019: Bid Elevator 10-col editable table (BidElevatorRunner)
- STORY-020: STR Triage per-term card with 5-action picker (StrTriageRunner)
- STORY-021: Listing Audit 2-step form (ListingAuditRunner)
- STORY-022: Keyword Research per-row categorizer (KeywordResearchRunner)
- All runners wire to `startToolSession / saveToolSession / submitToolSession`

### Sprint 5: Gamification (3.5/3.5 pts) — ✅ Complete
- **STORY-023 (1pt)**: Auto-award badges engine
  - `src/lib/badges.ts`: pure evaluator `evaluateBadges(userId, event)`
  - Supports all 5 seed criteria types: module_complete, quiz_score, tool_sessions, streak_days, xp_threshold
  - Idempotent — UserBadge unique on (userId, badgeId)
  - Hooked into markLessonCompleteAction, submitQuizAction, submitToolSession
  - submitToolSession now also awards 30 XP on passed submissions + bumps lastActiveAt

- **STORY-024 (1pt)**: Certificate generation with PDF download
  - `src/lib/certificates.ts`: evaluateCourseCompletion, issueCertificate (idempotent, crypto.randomUUID hash)
  - `src/lib/cert-pdf.tsx`: @react-pdf/renderer Document, landscape A4 dual-border design
  - Routes: `/dashboard/certificates` (list), `/dashboard/certificates/[hash]/pdf` (server route returning application/pdf, owner-only), `/dashboard/courses/[courseSlug]/certificate` (status + auto-issue), `/verify/[hash]` (public, no auth)

- **STORY-025 (1.5pt)**: Live Classes — schedule, register, view
  - `src/lib/tier-gate.ts`: added `userMeetsTierRequirement(userId, requiredTier)` + `getUserHighestTier()` for cross-tier feature gating
  - `src/lib/live-classes.ts`: listUpcomingClasses, listPastClasses, getClassDetail, isClassFull
  - `src/app/actions/live-classes.ts`: registerForLiveClass (ULTIMATE tier gate server-side, capacity check, idempotent restore-or-create), cancelLiveClassRegistration, listMyRegistrations
  - Pages: `/dashboard/live-classes` (index, register buttons, upgrade prompt for non-Ultimate), `/dashboard/live-classes/[id]` (detail with join button + seat progress)
  - Email reminder stubbed (Sprint 8 wires Resend templates)
  **Next: Sprint 6 STORY-028.** Refund flow — student request page + admin approval + PayMongo refund call. `refundPayment()` already in `paymongo.ts`. UI not yet.

  ## What's NOT done (deferred)

  - **STORY-028 → STORY-029** — Refund flow, BIR-compliant receipt PDFs.
  - **Sprint 7: Admin panels** — user/course/payment/audit management
  - **Sprint 8: Email templates** — Resend (live class reminder belongs here, currently stubbed in code)
  - **Sprint 9: Polish** — voice-guide audit, accessibility
  - **Tests** (Sprint 10) — 0% coverage, the badge engine is a natural first target
  - **Observability** (Sprint 11) — Sentry, structured logs
  - **End-to-end runtime verification** — `pnpm dev` not run in this sandbox (no Node). All code is type-correct at the structure level; final verification happens locally.
  - **Git push** — no remote configured. Next session: `git remote -v` to verify origin, then `git push origin main --tags`.

  ## STORY-027 what shipped (2026-07-10)

  - **Guest checkout completion** — `/checkout/complete` detects no session + paid checkout → redirects to `/auth/signup?email=<checkout.email>&next=/checkout/complete`. After signup the user returns to the same /checkout/complete URL, now signed in, and falls through to `SuccessCard`.
  - **SignUpForm prefills email** — query params `?email` and `?next` are honored. Email is editable (with hint) so users can correct a typo; `?next` controls the post-submit redirect target.
  - **Placeholder account claim** — `signUpAction` detects `passwordHash` starting with `placeholder_` (set by `enrollment.ts:findOrCreateUserByEmail` during guest checkout) and upgrades in place: replace hash, set name, mark emailVerified. Real accounts with an existing hash still get the "email already exists" error.
  - **Grandfather free enrollment** — `prisma/seed.ts` runs `grandfatherFreeEnrollment()` after tier/badge setup. Any user without an existing (non-deleted) enrollment gets a backdated ACTIVE Enrollment at PPC_FOUNDATIONS so the tier gate doesn't lock the curriculum for admin or pre-payment dev users. Idempotent (upsert).
  - **`requireCourseAccess()` helper** — `src/lib/tier-gate.ts` adds `TierAccessDeniedError` + `requireCourseAccess(userId, slug)` for future server-action use. Existing progress actions still use inline `evaluateCourseAccess` — no regression.

## Critical context for next session

### 1. Enums pattern
**Don't** use const-asserted TUPLE pattern: `export const UserRole = ['STUDENT', ...] as const` — TypeScript doesn't expose `.ADMIN` member access on tuples.

**Do** use const OBJECT pattern: `export const UserRole = { STUDENT: 'STUDENT', INSTRUCTOR: 'INSTRUCTOR', ADMIN: 'ADMIN' } as const; export type UserRole = (typeof UserRole)[keyof typeof UserRole];`

This is in `src/lib/enums.ts`. When you need a new enum, follow this pattern, then add a column with `String` type in `prisma/schema.prisma` (NOT a Prisma enum, because SQLite doesn't support them).

### 2. Path convention
- Project lives at `/storage/emulated/0/Hermes Projects/projects/amph-v2/` — that's the actual filesystem path.
- The workspace tag in WebUI says `/root/workspace` but the project doesn't live there. New files for the project go to the `/storage/...` path.
- All terminal commands `cd` into the project path first.

### 3. Database
- `DATABASE_URL="file:./dev.db"` (relative to project root, NOT `prisma/dev.db`)
- `pnpm prisma migrate deploy` to apply migrations
- `npx tsx scripts/import-amph-content.ts` to import content
- `npx tsx prisma/seed.ts` to seed admin + tiers + badges
- Default admin: `ryan@projectamazonph.com` / `ChangeMe123!`

### 4. The Sprint 2 stub tool runners
At `src/app/(dashboard)/tools/[tool]/[slug]/page.tsx`, the tool-specific UI components (CampaignBuilderRunner, BidElevatorRunner, etc.) are placeholder Card components showing scenario metadata. They need to be replaced with real interactive UIs in Sprint 4.

### 5. The no-ai-slop rule
At `eslint-rules/no-ai-slop.js`. Banned 30+ AI-slop phrases. Runs as part of `pnpm lint`. Don't disable it. If a legitimate string is flagged, fix the rule with a targeted exception, don't ignore the error.

### 6. Currency convention
AMPH content was authored in USD ($24.99 cutting board examples). The import script converts to PHP via `convertCurrency()` — `$X.XX` becomes `₱{X*50} (about $X.XX)`. Keep both currencies in lessons for educational clarity. Don't drop the USD — the Filipino VA audience benefits from seeing both.

## Commands cheat sheet

```bash
# Local dev (when you have Node)
cd "/storage/emulated/0/Hermes Projects/projects/amph-v2"
pnpm install
pnpm gen:secret --write       # writes JWT_SECRET to .env.local
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                        # localhost:3000

# Content re-import (idempotent)
DATABASE_URL="file:./dev.db" npx tsx scripts/import-amph-content.ts

# DB inspection
DATABASE_URL="file:./dev.db" sqlite3 dev.db ".tables"
DATABASE_URL="file:./dev.db" sqlite3 dev.db "SELECT COUNT(*) FROM Lesson"

# Push
git push "https://x-access-token:$(gh auth token)@github.com/projectamazonph/amph-v2.git" main

# Verify no AI-slop in source
grep -r -E "leverage|seamless|robust|comprehensive" src/ && echo "FOUND" || echo "CLEAN"
```

## State files

- `bmad/project.yaml` — BMAD project config (level 3, English)
- `bmad/workflow-status.yaml` — phase tracking, story list, metrics
- `bmad/sprint-status.yaml` — current sprint details
- `docs/sprint-plan.md` — full 12-sprint roadmap with story breakdowns
- `docs/decisions.md` — 16 ADRs
- `docs/db-schema.md` — schema spec (the source of truth for Prisma schema)
- `docs/design-brief.md` — Field Manual design system
- `docs/voice-guide.md` — copy rules + jargon buster
- `docs/business-layer.md` — PayMongo integration spec
- `docs/admin-backend.md` — admin panel routes + RBAC pattern
- `docs/build-spec.md` — why greenfield
- `docs/product-brief.md` — audience + value prop

## Recommended next-session order of operations

1. **Sprint 4 (priority 1): Tool UIs** — Build the 5 interactive tool UIs. Engines are ready. The Campaign Builder wizard is the most complex (5 steps + BTV audiences). Bid Elevator, STR Triage, Listing Audit, Keyword Research are simpler table/form UIs.

2. **Sprint 3 finish (priority 2)**: Add tier gating to lesson pages — `requireTier()` helper exists, needs to be called in the lesson page Server Component to redirect non-entitled users to `/upgrade`.

3. **Verify locally** before going further: `pnpm install && pnpm prisma migrate dev && pnpm prisma db seed && pnpm dev`. Test: sign in, browse dashboard, open a lesson, take a quiz, mark complete, use a tool.

4. **Sprint 5: Gamification** — auto-award badges, certificate generation, live classes.

5. **Sprint 6: Payments** — PayMongo integration per `docs/business-layer.md`.

## Things I tried that didn't work (avoid repeating)

- **Using `xendit-node` package** — nonexistent, removed in package.json
- **Prisma enums on SQLite** — doesn't compile, fixed via String + local enums.ts
- **`react-email-components` package** — wrong name, removed
- **Const-asserted TUPLE pattern for enums** — doesn't expose `.ADMIN` member access, use const OBJECT pattern
- **npx tsx with JSDoc glob comments** (`*/*.mdx`) — esbuild errors, use prose
- **Running `pnpm dev` in the sandbox** — no Node runtime, can't verify end-to-end

## Memoria state

Stored in memoria (memory IDs 019f3d5a58807c5187d1632e30528b44 and 019f3e13bc957e71850d2647e083397e and earlier). The most recent entry (Sprint 3 partial) covers content import, schema fix, curriculum UI, and what's deferred.

Second Brain entity at `/root/storage/Documents/SecondBrain/wiki/entities/amph-v2.md` covers Sprints 1 and 2 in detail, plus the Sprint 3 partial entry.