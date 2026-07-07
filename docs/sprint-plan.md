# Sprint Plan — PPC Training Ground (v2 Build)

**Date:** 2026-07-07
**Owner:** Ryan Roland Dabao
**Status:** Approved

11 sprints. Solo developer. ~6 story points/sprint. ~11 weeks total.

| Sprint | Track | Goal |
|--------|-------|------|
| S1 | Foundation | Next.js scaffold + design system + auth + admin layout |
| S2 | Tools | Campaign Builder + Bid Elevator + STR Triage engines + fixtures |
| S3 | Curriculum | Course + Module + Lesson + Quiz + Progress |
| S4 | Gamification | Badges + Certificates + Live Classes |
| S5 | Payments | Xendit integration + Checkout + Enrollment + Tier gating |
| S6 | Admin | Full admin panel (users, courses, content, payments, audit) |
| S7 | Refunds + Email | Refund flow + email templates + receipts |
| S8 | Polish | Voice guide applied to all UI copy + lesson content audit |
| S9 | Tests | Vitest unit/integration + Playwright E2E |
| S10 | Observability | Sentry + structured logs + Lighthouse CI |
| S11 | Launch | Production deploy + backup drill + launch comms |

Velocity target: 6 pts/sprint. Slip-trigger: 3 consecutive sprints at < 5 pts → drop velocity to 5.

---

## Sprint 1: Foundation (6 pts)

**Goal:** Next.js app runs. Design system live. Admin can sign in.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-001: Scaffold Next.js 16 | 1 | App Router, TypeScript strict, CSS Modules. No Tailwind. |
| STORY-002: Field Manual design tokens | 1 | CSS variables in `globals.css`. Color, type, spacing, radius, motion. |
| STORY-003: Shared component library | 1.5 | `src/components/ui/`: Button, Card, Input, Badge, Modal, Toast, Icon. Phosphor only. |
| STORY-004: Prisma + initial migration | 1 | `schema.prisma` from `docs/db-schema.md`. First migration applied. |
| STORY-005: Auth (JWT + jose) | 1 | Sign up, sign in, sign out, middleware. HttpOnly cookies. |
| STORY-006: Admin layout + RBAC | 0.5 | `/admin/*` gated. Empty dashboard. |

**Done when:** `pnpm dev` runs, design system is enforced, admin can sign in.

---

## Sprint 2: Interactive Tools (6 pts)

**Goal:** All three tools work with fixtures.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-007: Campaign Builder engine | 1.5 | Scoring, scenario validation. Fixtures: kitchen, electronics, garden, fitness, beauty. |
| STORY-008: Bid Elevator engine | 1 | 10 scenarios. Decision scoring. Budget tracking. |
| STORY-009: STR Triage engine | 1 | 20 search terms. Action validation. |
| STORY-010: Tool UI (campaign + bid + str) | 1.5 | Three pages at `/dashboard/tools/*`. Reuse design system. |
| STORY-011: ToolSession persistence | 1 | Save and resume sessions. Submit and grade. |

**Done when:** A student can run all three tools, get a score, save progress.

---

## Sprint 3: Curriculum (6 pts)

**Goal:** Student can browse courses, read lessons, take quizzes.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-012: Course + Module + Lesson pages | 1.5 | Browse, view, MDX rendering. Soft-publish respected. |
| STORY-013: Quiz system | 1.5 | Quiz UI, attempt tracking, scoring, retry logic. |
| STORY-014: Progress tracking | 1 | ModuleProgress + LessonProgress. XP awarded. |
| STORY-015: Course + module + lesson seed | 1 | 8 modules total, ~40 lessons, all quizzes. |
| STORY-016: Tier gating on content | 1 | `requireTier()` helper applied to lesson routes. |

**Done when:** Student with Foundations can read Foundations content. Quiz attempts saved.

---

## Sprint 4: Gamification (6 pts)

**Goal:** Badges, certificates, live classes all work.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-017: Badge system | 1.5 | Auto-award on criteria. Manual award by admin. Display. |
| STORY-018: Certificate generation | 1.5 | Auto-issue on course completion. PDF generation. Verification URL. |
| STORY-019: Live Classes (student view) | 1.5 | Schedule, registration, reminders (email stub). Recordings. |
| STORY-020: Gamification fixtures | 1 | 20+ badges seeded. |
| STORY-021: XP, level, streak logic | 1 | XP awarded per action. Level up. Streak tracking. |

**Done when:** Student completes a course, gets a badge and certificate.

---

## Sprint 5: Payments (6 pts)

**Goal:** Customer can buy. Admin sees transactions.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-022: PricingTier seed + UI | 1 | Three tiers on `/pricing`. |
| STORY-023: Xendit integration | 1.5 | Invoice creation, webhook handler, signature verification. |
| STORY-024: Checkout flow | 1.5 | Email capture, tier selection, redirect to Xendit, return handling. |
| STORY-025: Enrollment creation | 1 | On webhook, create Enrollment. Send welcome email. |
| STORY-026: Payment admin list | 1 | `/admin/payments` table. |

**Done when:** End-to-end test purchase (sandbox) succeeds.

---

## Sprint 6: Admin Backend (6 pts)

**Goal:** Admin can manage everything.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-027: User management | 1 | List, view, edit, suspend, soft-delete. |
| STORY-028: Course + Module + Lesson admin | 1.5 | CRUD with MDX editor. Publish workflow. |
| STORY-029: Resource upload | 1 | Vercel Blob. Upload, edit, publish. |
| STORY-030: Tool scenario admin | 1 | Manage Campaign Builder packs, Bid scenarios, STR datasets. |
| STORY-031: Audit log + analytics | 1.5 | Audit log viewer + analytics dashboards. |

**Done when:** Admin can run the entire business from the panel.

---

## Sprint 7: Refunds + Email (5 pts)

**Goal:** Refunds work. All transactional emails send.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-032: Self-service refund request | 1 | Within 7 days, user can request refund. |
| STORY-033: Admin refund approval | 1 | Approve/reject. Xendit refund API. Status updates. |
| STORY-034: Receipt PDF | 1 | `@react-pdf/renderer`. BIR-compliant. |
| STORY-035: Email templates | 1 | Welcome, receipt, refund, certificate, class reminder (5 templates). |
| STORY-036: Resend integration | 1 | Domain auth, sender config, delivery tracking. |

**Done when:** Refund full cycle works. Emails deliver.

---

## Sprint 8: Polish + Voice (5 pts)

**Goal:** All copy passes voice guide. ESLint rule enforced. Lesson content audited.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-037: ESLint no-ai-slop rule | 1 | Custom rule + CI enforcement. Fix all hits. |
| STORY-038: UI copy audit | 1.5 | Top 30 pages reviewed against voice-guide. |
| STORY-039: Lesson content audit | 1.5 | All 40 lessons reviewed. Rewrites where flagged. |
| STORY-040: Empty states | 0.5 | Every list/empty view has CTA. |
| STORY-041: Accessibility audit | 0.5 | axe-core scan. Fix all critical issues. |

**Done when:** Voice guide is mechanical (lint-enforced). Lessons pass audit.

---

## Sprint 9: Tests (6 pts)

**Goal:** 70%+ coverage on `src/lib` and `src/app/actions`.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-042: Vitest setup | 1 | Config, coverage, CI integration. |
| STORY-043: Unit tests for `src/lib` | 2 | Auth, db, validation, utils, billing. |
| STORY-044: Integration tests for actions | 1.5 | All admin and business layer actions. |
| STORY-045: Playwright setup | 1 | Critical path E2E: signup → enroll → access lesson → quiz → badge. |
| STORY-046: Coverage enforcement | 0.5 | CI fails below threshold. |

**Done when:** Coverage ≥ 70%. All critical paths E2E tested.

---

## Sprint 10: Observability (5 pts)

**Goal:** Errors caught. Performance tracked.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-047: Sentry setup | 1 | Client, server, edge. Source maps. Release tracking. |
| STORY-048: Structured logging | 1 | Pino. Request ID propagation. Replace console.log. |
| STORY-049: Server action tracing | 1 | Wrap actions in Sentry transactions. |
| STORY-050: Lighthouse CI | 1 | Performance budgets enforced in CI. |
| STORY-051: Alerting | 1 | Error spike alerts to Slack. |

**Done when:** Sentry live. Lighthouse CI blocks PRs. Alerts work.

---

## Sprint 11: Launch (4 pts)

**Goal:** Production-ready. Documentation complete.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-052: Deploy runbook | 1 | `docs/runbooks/deploy.md` with rollback. |
| STORY-053: Backup drill | 1 | Restore from backup to staging. Smoke test. |
| STORY-054: Security audit | 1 | OWASP ZAP. Fix high/critical. |
| STORY-055: Launch checklist + comms | 1 | Internal checklist. Email to existing v1 users. |

**Done when:** v2 deployed. Backup verified. Security clean.

---

## Sprint Status File

`bmad/sprint-status.yaml` tracks current sprint, completed stories, burndown. Updated after each story completion.

## Story Status

Each story lives in `docs/stories/STORY-NNN-name.md` with status: pending → in_progress → completed.

## Velocity Adjustment

- 3 consecutive sprints < 5 pts → velocity target drops to 5
- 3 consecutive sprints > 7 pts → velocity target rises to 7

## Dependencies

```
S1 (Foundation)
  ↓
S2 (Tools) ──→ S3 (Curriculum) ──→ S4 (Gamification)
                                          ↓
              S5 (Payments) ──→ S6 (Admin) ──→ S7 (Refunds + Email)
                                                            ↓
                                                    S8 (Polish)
                                                            ↓
                                                    S9 (Tests) ──→ S10 (Observability)
                                                                      ↓
                                                              S11 (Launch)
```

S2 can parallelize with S3 after S1 completes (different code areas). S6 (Admin) can parallelize with S5 (Payments) since admin UI is separate from checkout flow.