# Changelog

All notable changes to AMPH Academy v2 are documented here.

## [Unreleased]

### Sprint 11 — Observability (2026-07-13)
- Sentry setup: `@sentry/nextjs` wired in, sentry.{client,server,edge}.config.ts + instrumentation.ts, source-map upload via `pnpm sentry:sourcemaps` (STORY-048)
- Structured logging: Pino-based logger (`src/lib/logger.ts`) with redaction of PII fields; all `console.*` in critical paths replaced with structured `log.*` (STORY-049)
- Server-action tracing: `withActionTracing()` wrapper around server actions; per-request logger context via `src/lib/middleware-context.ts` (STORY-050)
- Lighthouse CI: `.lighthouserc.json` with assertions for performance/a11y/best-practices/SEO; CI job blocks merges on failure (STORY-051)
- Alerting to Slack: `scripts/sentry-slack-alert.ts` posts error spike + daily summary to Slack Incoming Webhook; cron job in CI (STORY-052)

### Sprint 10 — Tests + CI Hardening (2026-07-13, in progress)
- Vitest config + 11 test files (auth, progress, tools, badges, validation, enums, tier-gate, format, pricing, smoke ×2)
- Playwright E2E config scaffolded
- `scripts/check-coverage.js` added
- CI workflow: tsc, lint, vitest, playwright, lighthouse-ci, gitleaks
- 50/53 tests passing; 3 broken mocks in `tool-actions.test.ts`

### Sprint 9 — Polish + Mobile (2026-07-12)
- Design-system audit + token purge pass (STORY-038)
- Responsive breakpoint infrastructure: `--bp-sm/md/lg/xl`, `--side-pad`, `--max-width` tokens (STORY-039)
- BottomNav shared component: 4-slot, mobile-only, safe-area-inset (STORY-040)
- Marketing + auth cluster mobile-first refactor: landing page rewrite, pricing grid, auth/checkout padding (STORY-041)
- Student app shell refactor: dashboard stats grid, tools grid, certificates/payments token fixes, BottomNav on dashboard/tools (STORY-042)
- All pages verified at 390px and 1280px; lint clean; 7 commits

### Sprint 8 — Refunds + Email (2026-07-11, commit `1414754`)
- Refund flow: student request → admin approve/reject → PayMongo refund API + email (STORY-034)
- Email reminders: enrollment confirmation, live class reminder, refund status (STORY-035)
- Resend webhook handler for transactional email delivery tracking (STORY-036)
- 3 Resend React Email templates: enrollment, live class reminder, refund (STORY-037)

### Sprint 7 — Admin (2026-07-10)
- Admin dashboard stats upgrade + user management CRUD with pagination/search (STORY-030)
- Course / Module / Lesson admin CRUD with MDX editor (STORY-031)
- Tool scenario admin — manage all 5 tool scenario packs (STORY-032)
- Analytics dashboards: enrollments funnel, revenue MRR, engagement (STORY-033)

### Sprint 6 — Payments (2026-07-10)
- PayMongo Checkout + webhook (STORY-026)
- Enrollment + tier gating server actions (STORY-027)
- Refund flow engine (STORY-028)
- BIR-compliant receipt PDFs (STORY-029)

### Sprint 5 — Gamification (2026-07-09)
- Auto-awarded badge engine (5 criteria types, idempotent) (STORY-023)
- PDF certificate generation with public verification UUID (STORY-024)
- Live Classes with tier-gated registration + capacity check (STORY-025)

### Sprint 4 — Tool UIs (2026-07-08)
- Campaign Builder 5-step wizard (SP/SB/SD/BTV-aware) (STORY-018)
- Bid Elevator table with live bid suggestions (STORY-019)
- STR Triage triager with prioritized keyword queue (STORY-020)
- Listing Audit form with scored checklist (STORY-021)
- Keyword Research categorizer with tag export (STORY-022)

### Sprint 3 — Curriculum + Tier Gating (2026-07-08)
- AMPH v1 content imported: 1 course, 9 modules, 31 lessons, 5 quizzes, 30 questions (STORY-013)
- Prisma schema fix: enums migrated from native to String (STORY-014)
- Curriculum pages: dashboard, course detail, lesson reader, quiz (STORY-015)
- Quiz system with progress-linked scoring (STORY-016)
- Tier gating: enroll-aware access control on lesson/quiz/tool pages (STORY-017)

### Sprint 2 — Tools (2026-07-07)
- Campaign Builder engine + SP/SB/SD/BTV scenario packs (STORY-007)
- Bid Elevator engine + 6 scenarios (STORY-008)
- STR Triage engine + 7 scenarios (STORY-009)
- Tool UI shell with shared ToolResult component (STORY-010)
- ToolSession persistence: save/resume/submit/grade (STORY-011)
- Listing Audit + Keyword Research engines (STORY-012)

### Sprint 1 — Foundation (2026-07-07)
- Next.js 16 scaffold with TypeScript strict (STORY-001)
- Field Manual design tokens (60+ CSS custom properties, dark mode) (STORY-002)
- Shared component library: 7 primitives + admin shell (STORY-003)
- Prisma PostgreSQL schema with 31 models (STORY-004)
- JWT auth with HttpOnly cookies, scrypt password hashing, jose verification (STORY-005)
- Admin layout + RBAC: requireAuth/requireAdmin guards (STORY-006)