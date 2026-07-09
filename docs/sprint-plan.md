# Sprint Plan — AMPH Academy v2

**Date:** 2026-07-12
**Owner:** Ryan Roland Dabao
**Status:** Active (37/55 stories shipped across 8 sprints; Sprint 9 in progress)

Solo developer. Originally 11 sprints at 6 pts/sprint = 11 weeks. Actual: 8 sprints delivered in 5 days (high velocity from greenfield through backend completion); Sprint 9 (Polish + Mobile) in progress.

| Sprint | Track | Goal | Status | Points |
|--------|-------|------|--------|--------|
| S1 | Foundation | Next.js scaffold + design system + auth + admin layout | ✅ Complete | 6 / 6 |
| S2 | Tools | Campaign Builder + Bid Elevator + STR Triage + Listing Audit + Keyword Research engines + fixtures + UI shell | ✅ Complete | 6 / 6 |
| S3 | Curriculum | Content import + curriculum pages + quiz system + tier gating UI | ✅ Complete | 6 / 6 |
| S4 | Tool UIs | Replace Sprint 2 stub runners with real interactive UIs | ✅ Complete | 4.5 / 4.5 |
| S5 | Gamification | Badges auto-award + Certificates + Live Classes | ✅ Complete | 3.5 / 3.5 |
| S6 | Payments | PayMongo Checkout + Enrollment + Receipt PDFs | ✅ Complete | 4 / 4 |
| S7 | Admin | Full admin panel (users, courses, tools, analytics) | ✅ Complete | 4 / 4 |
| S8 | Refunds + Email | Refund flow + Resend templates + webhook tracking | ✅ Complete (commit 1414754) | 4 / 4 |
| S9 | Polish + Mobile | Token audit + Tailwind purge + responsive helpers + BottomNav + 12 pages mobile-first | ✅ Complete | 5 / 5 |
| S10 | Tests + CI Hardening | Fix CI (SQLite), Vitest unit+integration, Playwright E2E, coverage enforcement | 🔄 In Progress | 5 / 5 planned |
| S11 | Observability | Sentry + structured logs + Lighthouse CI | Backlog | — |
| S12 | Launch | Production deploy + backup drill + launch comms | Backlog | — |

Velocity: S1=6, S2=6, S3=6, S4=4.5, S5=3.5, S6=4, S7=4, S8=4, S9=5 planned. Slip-trigger (3 consecutive sprints at <5) not triggered.

---

## Sprint 1: Foundation (6 pts) — ✅ Complete 2026-07-07

**Goal:** Next.js app runs. Design system live. Admin can sign in.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-001: Scaffold Next.js 16 | 1 | App Router, TypeScript strict, CSS Modules. No Tailwind. |
| STORY-002: Field Manual design tokens | 1 | CSS variables in `globals.css`. Color, type, spacing, radius, motion. Dark mode override block. |
| STORY-003: Shared component library | 1.5 | `src/components/ui/`: Button, Card, Input, Badge, Modal, Toast, Icon, NavSidebar, TopBar. Phosphor only. |
| STORY-004: Prisma + initial migration | 1 | `schema.prisma` from `docs/db-schema.md`. First migration applied. |
| STORY-005: Auth (JWT + jose) | 1 | Sign up, sign in, sign out, middleware. HttpOnly cookies. Edge middleware + Server Component re-verify. |
| STORY-006: Admin layout + RBAC | 0.5 | `/admin/*` gated. Empty dashboard. |

**Done when:** `pnpm dev` runs, design system is enforced, admin can sign in.

---

## Sprint 2: Interactive Tools (6 pts) — ✅ Complete 2026-07-07

**Goal:** Five tools with full engines, scenarios, scoring, and persistence.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-007: Campaign Builder engine | 1 | SP/SB/SD/BTV support. CampaignStructure mirrors Amazon Campaign Manager. 5 SP scenarios + 5 BTV scenarios. BTV has separate scoring rubric (CPM, audience-based). |
| STORY-008: Bid Elevator engine | 1 | Synthetic keyword performance. 10 scenarios (high ACoS cuts, scale-up, defense, discovery, broad cleanup, rebalance). |
| STORY-009: STR Triage engine | 1 | 20 search terms across 2 scenarios. Actions: keep/pause/negate-exact/negate-phrase/optimize-bid. |
| STORY-010: Tool UI shell | 1.5 | `/dashboard/tools` index, scenario picker, dynamic `/tools/[tool]/[slug]` runner. Full interactive UIs deferred to S4. |
| STORY-011: ToolSession persistence | 1 | `startToolSession`, `saveToolSession`, `submitToolSession`, `loadToolSession`, `listRecentSessions`. All 5 tool types wired. |
| STORY-012: Listing Audit + Keyword Research | 0.5 | Engine + 5 scenarios each. Scoring rubric. (User added mid-sprint.) |

**Done when:** All engines grade correctly, scenarios load, sessions persist. Interactive UIs are stubbed (S4).

---

## Sprint 3: Curriculum (6/6 pts) — ✅ Complete 2026-07-08

**Goal:** Import AMPH-Academy v1 content + build curriculum pages + quiz system + tier-based access.

| Story | Pts | Status | Description |
|-------|-----|--------|-------------|
| STORY-013: Content import | 1 | ✅ | `scripts/import-amph-content.ts`. 1 course, 9 modules, 31 lessons (MDX, $→₱), 5 quizzes, 30 questions. Idempotent upsert. |
| STORY-014: Schema fix (enums→String) | 0.5 | ✅ | Prisma SQLite doesn't support enums. Migrated 20 enums to String + `src/lib/enums.ts` const objects. |
| STORY-015: Curriculum pages | 1 | ✅ | `/dashboard`, `/dashboard/courses/[slug]`, `/dashboard/courses/[slug]/lessons/[slug]`. MDX render in `src/lib/mdx.ts`. Progress tracking. |
| STORY-016: Quiz system | 0.5 | ✅ | Server-side scoring, pass/fail result, bonus XP, auto-complete on pass. |
| STORY-017: Tier gating (enroll-aware access) | 0.5 | ✅ | `src/lib/tier-gate.ts` evaluates course pricing-tier vs user's highest ACTIVE enrollment. `TierLock` component renders lock screen on lesson/quiz pages. Course index shows lock icon for each lesson under a locked course. Server actions `startLessonAction`, `markLessonCompleteAction`, `submitQuizAction` all enforce the gate. Tier-less courses stay free/always-accessible. Course import script now attaches the PPC Foundations tier by default. |

**Done when:** Student can read lesson, take quiz, see progress, accumulate XP. Tier gating on paid content. **Verified:** users without an enrollment see the lock screen on lesson + quiz pages with upgrade CTAs; users with an ACTIVE enrollment at-or-above the required tier pass through to lesson content. Server actions reject unauthorized POSTs.

---

## Sprint 4: Tool UIs (4.5/4.5 pts) — ✅ Complete 2026-07-08

**Goal:** Replace Sprint 2 stub runners with real interactive UIs for all 5 tools.

| Story | Pts | Status | Description |
|-------|-----|--------|-------------|
| STORY-021: Listing Audit form | 0.5 | ✅ | `src/components/tools/ListingAuditRunner.tsx`. 2-step form: flag issues with checkboxes per field (title/bullets/description/images/aplus/pricing/reviews) → revise the listing (title + bullets with add/remove, description, image count, A+ toggle, price, review count, rating). |
| STORY-022: Keyword Research categorizer | 0.5 | ✅ | `src/components/tools/KeywordResearchRunner.tsx`. Per-candidate row with relevance/volume/competition metric chips + optional notes + 3-button priority picker (PRIMARY/SECONDARY/NEGATIVE). Live count summary at top. Submit blocked until every candidate is classified. |
| STORY-019: Bid Elevator table | 1 | ✅ | `src/components/tools/BidElevatorRunner.tsx`. Per-keyword row in a 10-column table: keyword + match + current bid + impression/click/order/spend/sales/ACoS + editable new bid input. Highlights rows where ACoS exceeds target. Summary card shows projected daily spend, budget headroom, count of bids changed. Warning when total new bids exceed the daily budget. |
| STORY-020: STR Triage triager | 1 | ✅ | `src/components/tools/StrTriageRunner.tsx`. Per-term card: search term + matched keyword + match type + 8-cell performance grid + 5-action picker (keep/optimize-bid/pause/negate-exact/negate-phrase). Conditional subfields: optimize-bid reveals new-bid input; negate-* reveals negative-keyword input. Live count summary at top. Submit blocked while any term is pending. |
| STORY-018: Campaign Builder wizard | 1.5 | ✅ | `src/components/tools/CampaignBuilderRunner.tsx`. 5-step wizard with stepper indicator: campaign settings (name, type as card picker filtered by scenario's allowedCampaignTypes, start/end date, daily budget) → bidding (strategy from allowedBidStrategies + default bid) → ad group → targets (keywords + product targets as add/remove rows) OR audiences (BTV swap) → review (full draft display with warnings). Per-step validation gates Next button. BTV scenario switches the targets step to an audiences step and resets the bid strategy to CPM_FIXED. Reuses `startToolSession` + `saveToolSession` + `submitToolSession`; engine unchanged. |

**Done when:** All 5 tools accept student input, validate against scenario constraints, and submit for grading via the existing server actions. **Verified:** `pnpm typecheck` shows zero new TS errors attributable to Sprint 4 (baseline 36 unchanged). All new files pass the no-ai-slop rule. Engine + scoring + scenarios + session persistence (Sprint 2) unchanged.

---

## Sprint 5: Gamification (3.5/3.5 pts) — ✅ Complete 2026-07-09

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-023: Auto-award badges | 1 | When user completes a module/quiz/tool session with a passing score, check badge criteria from `Badge.criteria` JSON and award matching badges. |
| STORY-024: Certificate generation | 1 | When user completes a course, generate a `Certificate` with a unique `verificationHash`. PDF download (BIR-compliant fields). |
| STORY-025: Live Classes | 1.5 | Schedule live classes (`LiveClass`), registration (`LiveClassRegistration`), email reminder (Resend), recording URL. Tier-gated (Ultimate only for live). |

---

## Sprint 6: Payments (4/4 pts) — ✅ Complete 2026-07-10

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-026: PayMongo Checkout | 1.5 | Create Checkout Session (preferred) or Source. Hosted payment page. Webhook handler with signature verification + idempotency. |
| STORY-027: Enrollment + tier gating | 1 | On successful payment, create `Enrollment` with `tier` + `pricingTierId`. Apply `requireTier()` to lesson pages. |
| STORY-028: Refund flow (engine only — UI in S8) | 1 | Self-service refund request (within 7 days). Admin approval → PayMongo refund API. |
| STORY-029: Receipt PDF | 0.5 | `@react-email/render` + `@react-pdf/renderer`. BIR-compliant with sequential numbering. Stored in Vercel Blob. |

---

## Sprint 7: Admin (4/4 pts) — ✅ Complete 2026-07-10

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-030: Admin dashboard + user management | 1 | List + view + edit + suspend + soft-delete. Every mutation logs to `AuditLog`. |
| STORY-031: Course/Module/Lesson admin | 1.5 | CRUD with MDX editor. Publish workflow. Bulk operations. |
| STORY-032: Tool scenario admin | 0.5 | Manage Campaign Builder packs, Bid scenarios, STR datasets, Listing audit scenarios, Keyword research candidates. |
| STORY-033: Analytics dashboards | 1 | Enrollments funnel, engagement (DAU/WAU/MAU), content (module completion rates), revenue (MRR, refunds, tier mix). |

---

## Sprint 8: Refunds + Email (4/4 pts) — ✅ Complete 2026-07-11 (commit 1414754)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-034: Refund UI (admin) | 1 | Admin sees pending refund requests, approves/rejects with reason, triggers PayMongo refund. |
| STORY-035: Email reminders | 1 | Resend templates: enrollment confirmation, live class reminder, refund status (requested/approved/rejected). React Email components. |
| STORY-036: Resend webhook | 1 | Webhook handler with HMAC-SHA256 signature verification for delivery tracking. |
| STORY-037: Outbound templates | 1 | `EnrollmentConfirmationEmail`, `LiveClassReminderEmail`, `RefundStatusEmail` as React Email components. |

---

## Sprint 9: Polish + Mobile (5/5 pts planned) — 🔄 In Progress

**Goal:** Replace visual reset and add mobile-first responsiveness across the entire student-facing surface. Every page must render correctly at 390px (iPhone) and 1280px (laptop) using Field Manual tokens, CSS Modules (no Tailwind), and no breakpoints past 1280px.

See [docs/sprint-9/PLAN.md](./sprint-9/PLAN.md) for the full plan. Per-story details in `docs/stories/STORY-038.md` through `STORY-042.md`.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-038: Design-system audit + token purge | 1 | Audit components/pages for Tailwind leakage + inline hex + non-Field-Manual fonts. Add ESLint rules (`no-tailwind-classname`, `no-inline-hex-color`, `no-restricted-syntax`). Codemod for 1:1 rewrites. |
| STORY-039: Responsive breakpoint infrastructure | 1 | `src/styles/tokens.css` with breakpoint vars (640/768/1024/1280), side-pad clamp, max-content/reading/form widths. Helper classes: `.stack-mobile`, `.cards-mobile`, `.table-mobile`. `prefers-reduced-motion` block. |
| STORY-040: Mobile BottomNav shared component | 1 | `src/components/ui/BottomNav.tsx` — fixed bottom on `<1024px`, hidden on desktop. 4 slots (Home/Courses/Tools/Profile) with Phosphor light-weight icons. Safe-area inset handling. |
| STORY-041: Marketing + auth cluster mobile-first | 1 | 5 pages (`/`, `/pricing`, `/auth/signin`, `/auth/signup`, `/checkout/complete`) re-authored mobile-first using Stack/Card helpers. Source-of-truth prototypes at `/workspace/amph-v2-stitch/generated/mobile/`. |
| STORY-042: Student app + course flow + tools index mobile-first | 1 | 7 pages (`/dashboard`, course detail, lesson, quiz, tools, certificates, payments) re-authored. BottomNav wired on dashboard/course/tools. `.table-mobile` on Payments. |

---

## Sprint 10: Tests + CI Hardening (5/5 pts planned) — 🔄 In Progress

**Goal:** Fix CI pipeline (PostgreSQL→SQLite), establish real test coverage, Playwright E2E, enforce 70% threshold.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-043: CI fix + Playwright config | 1 | Remove PostgreSQL from CI, use SQLite. Add `playwright.config.ts`. |
| STORY-044: Vitest unit tests — `src/lib` | 1.5 | Auth, validation, tier-gate, enums, format, pricing, badges. ≥70% line coverage. |
| STORY-045: Server action integration tests | 1 | Auth, enrollment, tool session actions. Mocked Prisma. |
| STORY-046: Playwright E2E — critical path | 1 | Signup → enroll → lesson → quiz. Chromium only. |
| STORY-047: Coverage enforcement + CI polish | 0.5 | `scripts/check-coverage.js`, 70% threshold, CI passes clean. |

**Done when:** `pnpm test` + `pnpm test:e2e` + `pnpm lint` all pass. CI green on GitHub.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-042: Vitest setup | 1 | Configure Vitest. Coverage reporting. CI integration. |
| STORY-043: Unit tests for `src/lib` | 2 | Auth, db, validation, utils, mdx, enums. Target 70% coverage. |
| STORY-044: Integration tests for actions | 1.5 | All server actions (auth, progress, tools, admin). |
| STORY-045: Playwright setup | 1 | Configure. Critical path E2E: signup → enroll → lesson → quiz → badge. |
| STORY-046: Coverage enforcement | 0.5 | CI fails below 70% threshold. |

---

## Sprint 11: Observability (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-047: Sentry setup | 1 | Client, server, edge configs. Source maps. Release tracking. |
| STORY-048: Structured logging | 1 | Pino. Request ID propagation. Replace `console.log`. |
| STORY-049: Server action tracing | 1 | Wrap actions in Sentry transactions. |
| STORY-050: Lighthouse CI | 1 | Performance budgets enforced in CI. |
| STORY-051: Alerting | 1 | Slack alerts on Sentry error spike. Daily summary at 9am. |

---

## Sprint 12: Launch (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-052: Deploy runbook | 1 | `docs/runbooks/deploy.md` with rollback procedure. |
| STORY-053: Backup drill | 1 | Restore from production backup to staging. Smoke test. |
| STORY-054: Security audit | 1 | OWASP ZAP. Fix high/critical. |
| STORY-055: Launch checklist + comms | 1 | Internal checklist. Email to existing v1 users. |

---

## Done So Far (37/55 in Sprints 1–8, 67% of plan)

Sprints 1–8 shipped: Foundation, Tools (5 engines + 30 scenarios), Curriculum (31 lessons + 5 quizzes imported from v1), Tool UIs (5 interactive runners), Gamification (badges + certificates + live classes), Payments (PayMongo checkout + enrollment + receipts), Admin Panel (8 screens: dashboard + users + courses + tool scenarios + analytics + refunds + settings + badges), Refunds (student request + admin approval + PayMongo refund API), Email (3 Resend templates + webhook handler).

Sprint 9 (Polish + Mobile) is in progress with 5 stories at 5 pts.

The remaining 13 stories (Sprints 10–12) cover Tests, Observability, and Launch. Each sprint is approximately 1 week of work at the current ~5-pt velocity.

## Notes on Scope Changes from Original Plan

- **Sprint consolidation**: Original 11 sprints × 6 pts = 66 pts. Actual: 12 sprints × ~6 pts = ~72 pts. Backend landed in S1–S8 (37 stories); polish/mobile/launch occupies S9–S12 (18 stories).
- **Sprint 9 re-scoped**: Originally planned as "voice audit + lesson content review + empty states + accessibility". Re-scoped to "mobile-first refactor" because (a) AMPH audience is mobile-first, (b) S8 sprint noted voice-guide was already enforced by `eslint-rules/no-ai-slop.js` since Sprint 1, (c) Sprint 10 (Tests) needs mobile-first pages to exist before it can run 3-viewport Playwright suites.
- **Sprint 4 shipped a slightly smaller scope than planned** (4.5 vs 6 pts): the 5 tool UIs all landed but the wizard was tight against its 1.5-pt estimate, so the next-sprint target (Sprint 5 Gamification) starts at 0, not 1.5.
- **Story renumbering**: Sprint 3's import story was originally going to be STORY-013, but Listing Audit and Keyword Research in Sprint 2 already took that number. Renumbered to STORY-013 (import), 014-017 (schema fix, curriculum pages, quiz, tier gating). All renumbered references in the workflow-status story_list updated.
- **Sprint 8 point split**: Originally planned 4 stories × 0.5/1pt = ~3pt. Actual 4 stories × 1pt = 4pt (one extra point of work surfaced during implementation: webhook signature verification added scope).