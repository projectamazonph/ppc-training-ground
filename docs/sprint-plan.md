# Sprint Plan — AMPH Academy v2

**Date:** 2026-07-08
**Owner:** Ryan Roland Dabao
**Status:** Active (22/22 stories shipped across 4 sprints)

Solo developer. Originally 11 sprints at 6 pts/sprint = 11 weeks. Actual: 4 sprints of high-velocity delivery (Sprint 1: 6 pts, Sprint 2: 6 pts, Sprint 3: 6 pts, Sprint 4: 4.5 pts).

| Sprint | Track | Goal | Status | Points |
|--------|-------|------|--------|--------|
| S1 | Foundation | Next.js scaffold + design system + auth + admin layout | ✅ Complete | 6 / 6 |
| S2 | Tools | Campaign Builder + Bid Elevator + STR Triage + Listing Audit + Keyword Research engines + fixtures + UI shell | ✅ Complete | 6 / 6 |
| S3 | Curriculum | Content import + curriculum pages + quiz system + tier gating UI | ✅ Complete | 6 / 6 |
| S4 | Tool UIs | Replace Sprint 2 stub runners with real interactive UIs | ✅ Complete | 4.5 / 4.5 |
| S5 | Gamification | Badges auto-award + Certificates + Live Classes | ⏳ Next | — |
| S6 | Payments | PayMongo Checkout + Enrollment + Tier gating | Backlog | — |
| S7 | Admin | Full admin panel (users, courses, content, payments, audit) | Backlog | — |
| S8 | Refunds + Email | Refund flow + Resend templates + receipts | Backlog | — |
| S9 | Polish | Voice guide applied to all UI copy + lesson content audit | Backlog | — |
| S10 | Tests | Vitest unit/integration + Playwright E2E | Backlog | — |
| S11 | Observability | Sentry + structured logs + Lighthouse CI | Backlog | — |
| S12 | Launch | Production deploy + backup drill + launch comms | Backlog | — |

Velocity: S1=6, S2=6, S3=6, S4=4.5. Slip-trigger (3 consecutive sprints at <5) not triggered.

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

## Sprint 5: Gamification (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-023: Auto-award badges | 1 | When user completes a module/quiz/tool session with a passing score, check badge criteria from `Badge.criteria` JSON and award matching badges. |
| STORY-024: Certificate generation | 1 | When user completes a course, generate a `Certificate` with a unique `verificationHash`. PDF download (BIR-compliant fields). |
| STORY-025: Live Classes | 1.5 | Schedule live classes (`LiveClass`), registration (`LiveClassRegistration`), email reminder (Resend), recording URL. Tier-gated (Ultimate only for live). |

---

## Sprint 6: Payments (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-026: PayMongo Checkout | 1.5 | Create Checkout Session (preferred) or Source. Hosted payment page. Webhook handler with signature verification + idempotency. |
| STORY-027: Enrollment + tier gating | 1 | On successful payment, create `Enrollment` with `tier` + `pricingTierId`. Apply `requireTier()` to lesson pages. |
| STORY-028: Refund flow | 1 | Self-service refund request (within 7 days). Admin approval → PayMongo refund API. |
| STORY-029: Receipt PDF | 0.5 | `@react-email/render` + `@react-pdf/renderer`. BIR-compliant with sequential numbering. Stored in Vercel Blob. |

---

## Sprint 7: Admin (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-030: User management | 1 | List + view + edit + suspend + soft-delete. Every mutation logs to `AuditLog`. |
| STORY-031: Course/Module/Lesson admin | 1.5 | CRUD with MDX editor. Publish workflow. Bulk operations. |
| STORY-032: Tool scenario admin | 0.5 | Manage Campaign Builder packs, Bid scenarios, STR datasets, Listing audit scenarios, Keyword research candidates. |
| STORY-033: Analytics dashboards | 1 | Enrollments funnel, engagement (DAU/WAU/MAU), content (module completion rates), revenue (MRR, refunds, tier mix). |

---

## Sprint 8: Refunds + Email (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-034: Refund UI (admin) | 0.5 | Admin sees pending refund requests, approves/rejects with reason, triggers PayMongo refund. |
| STORY-035: Email templates | 1 | 5 Resend templates: payment success, refund processed, certificate issued, live class reminder (24h, 1h). React Email components. |
| STORY-036: Resend integration | 0.5 | Domain auth, sender config, delivery tracking. |

---

## Sprint 9: Polish (backlog)

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-037: ESLint no-ai-slop | 1 | (DONE in Sprint 1 — 30+ patterns banned, rule at `eslint-rules/no-ai-slop.js`.) |
| STORY-038: UI copy audit | 1 | Review top 30 pages against `voice-guide.md`. Rewrite non-compliant copy. |
| STORY-039: Lesson content audit | 1 | Review all 31 lessons for tone, jargon, examples. Rewrite flagged content. |
| STORY-040: Empty states | 0.5 | Every list/empty view has CTA per voice guide. |
| STORY-041: Accessibility audit | 0.5 | axe-core scan. Fix critical issues. |

---

## Sprint 10: Tests (backlog)

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

## Done So Far (22/22 in Sprints 1-4, ~55 originally planned but consolidated)

Sprints 1-4 shipped the foundation, all 5 tool engines + 30 scenarios, content import, curriculum pages, quiz system, tier gating, and the 5 interactive tool UIs. Roughly 40% of the original 55-story plan.

The remaining 33 stories (Sprints 5-12) are organized into 8 thematic sprints. Each sprint is 1 week of work at the current ~6-pt velocity.

## Notes on Scope Changes from Original Plan

- **Story renumbering**: Sprint 3's import story was originally going to be STORY-013, but Listing Audit and Keyword Research in Sprint 2 already took that number. Renumbered to STORY-013 (import), 014-017 (schema fix, curriculum pages, quiz, tier gating). All renumbered references in the workflow-status story_list updated.
- **Sprint 3 closing story added**: STORY-017 (tier gating, 0.5 pt) was deferred from the partial Sprint 3 and shipped first thing in the Sprint 4 session, bringing Sprint 3 to 6/6.
- **Sprint 4 shipped a slightly smaller scope than planned** (4.5 vs 6 pts): the 5 tool UIs all landed but the wizard was tight against its 1.5-pt estimate, so the next-sprint target (Sprint 5 Gamification) starts at 0, not 1.5.
- **Sprint consolidation**: Original 11 sprints × 6 pts = 66 pts. New plan: 12 sprints × ~6 pts = ~72 pts, with stories compressed where engines shared patterns.