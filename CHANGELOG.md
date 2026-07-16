# Changelog

All notable changes to Project Amazon PH Academy v2 are documented here.

## [Unreleased]

### 2026-07-14 — CI/CD hardening + type-safety hotfix (post-Sprint-12)
- Type-safety hotfix `8012071` — fixed pre-existing TS7006 implicit-any errors in
  admin/course pages; `pnpm typecheck` (`tsc --noEmit`) now passes clean (0 errors)
- CI config fix (P0): removed `on.schedule` from `ci.yml` — the `*/30 * * * *`
  trigger was running the full quality/e2e/lighthouse pipeline ~48×/day; CI now
  triggers only on push/PR to `main`
- Split Sentry→Slack alert out of `ci.yml` into its own scheduled workflow
  `.github/workflows/sentry-alert.yml` (preserves 30-min spike + daily summary cadence)
- Added `.github/dependabot.yml` — daily grouped npm updates, weekly GitHub Actions
  updates (supply-chain hygiene)
- Added deploy automation (manual-gated, not auto):
  - `deploy-preview.yml` — Vercel preview per PR + smoke test + PR comment
  - `deploy-prod.yml` — gated prod deploy (workflow_dispatch / Release) + Sentry
    release + smoke + Slack
  - `rollback.yml` — manual instant Vercel rollback (requires typing `ROLLBACK` to confirm)
- Stale-doc cleanup: removed the "3 broken Vitest mocks in tool-actions.test.ts"
  Sprint 13 item — the mocks (`requireAuth`) are present and the tests pass post-hotfix

### Sprint 12 — Launch (2026-07-13)
- Production deploy runbook: `docs/runbooks/production-deploy.md` with
  17-env-var checklist, Vercel CLI + dashboard deploy/rollback paths,
  post-deploy verification (Sentry, Slack, Lighthouse) (STORY-053)
- Production smoke script: `scripts/smoke-prod.sh` — pure bash + curl + grep;
  asserts 4 routes return 2xx, 6 security headers present, no `X-Powered-By`
  leak; exit codes 0/1/2 (STORY-053)
- Runbooks index: `docs/runbooks/README.md` (STORY-053)
- DB backup runbook: `docs/runbooks/db-backup-restore.md` — pg_dump strategy,
  Vercel Blob storage, restore drill procedure, emergency-restore decision
  tree (STORY-054)
- DB backup script: `scripts/backup-prod.sh` — pg_dump → gzip → Vercel Blob
  PUT; requires `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` (STORY-054)
- Restore drill script: `scripts/restore-prod.sh` — downloads backup, runs
  pg_restore into scratch DB, asserts row counts on 6 tables within tolerance
  (1% for content, 5% for write-heavy ToolSession) (STORY-054)
- `db-backup` GitHub Actions cron: `.github/workflows/db-backup.yml` — daily
  02:00 UTC, Slack notification on failure (STORY-054)
- Tenant isolation audit: `docs/security/tenant-isolation.md` — 10 server
  actions + 8 route handlers + Prisma query grep, all guarded (STORY-055)
- Pre-launch security audit: `docs/security/security-audit-2026-07-13.md` —
  7 sections covering npm audit, gitleaks, security headers, multi-tenant
  audit, auth primitives, 5 open issues tracked (STORY-055)
- Production deploy operator checklist: `docs/sprint-12/deploy-execution.md` —
  copy-paste commands, post-deploy verification gates, rollback (STORY-056)
- Launch communications: `docs/sprint-12/launch-comms.md` — Facebook/LinkedIn
  copy, Resend broadcast React Email template outline, internal Slack
  celebration post, retro template, pre-launch checklist (STORY-057)
- Sprint 12 acceptance docs: `docs/stories/STORY-053.md` through
  `docs/stories/STORY-057.md`
- BMad state updated: `sprint.number: 12`, `completed_stories: 52/52`,
  `sprint_12_notes` paragraph added, `story_list` extended with STORY-053
  through STORY-057
- `SESSION-HANDOVER.md` rewritten to mark Sprint 12 closed, list the 17
  production env vars, surface the 5 operator-side actions, and document the
  6 Sprint 13 candidates

### Sprint 11 — Observability (2026-07-13)
- Sentry setup: `@sentry/nextjs` wired in, sentry.{client,server,edge}.config.ts
  + instrumentation.ts, source-map upload via `pnpm sentry:sourcemaps` (STORY-048)
- Structured logging: Pino-based logger (`src/lib/logger.ts`) with redaction
  of PII fields; all `console.*` in critical paths replaced with structured
  `log.*` (STORY-049)
- Server-action tracing: `withActionTracing()` wrapper around server actions;
  per-request logger context via `src/lib/middleware-context.ts` (STORY-050)
- Lighthouse CI: `.lighthouserc.json` with assertions for
  performance/a11y/best-practices/SEO; CI job blocks merges on failure (STORY-051)
- Alerting to Slack: `scripts/sentry-slack-alert.ts` posts error spike +
  daily summary to Slack Incoming Webhook; cron job in CI (STORY-052)

### Sprint 10 — Tests + CI Hardening (2026-07-13)
- Vitest config + 11 test files (auth, progress, tools, badges, validation,
  enums, tier-gate, format, pricing, smoke, …)
- Playwright E2E config scaffolded
- `scripts/check-coverage.js` added
- CI workflow: tsc, lint, vitest, playwright, lighthouse-ci, gitleaks
- 53/53 tests passing (verified by CI)

### Sprint 9 — Polish + Mobile (2026-07-12)
- Design-system audit + token purge pass (STORY-038)
- Responsive breakpoint infrastructure: `--bp-sm/md/lg/xl`, `--side-pad`,
  `--max-width` tokens (STORY-039)
- BottomNav shared component: 4-slot, mobile-only, safe-area-inset (STORY-040)
- Marketing + auth cluster: mobile-first refactor (landing page rewrite,
  pricing grid, auth/checkout padding) (STORY-041)
- Student app shell refactor: dashboard stats grid, tools grid,
  certificates/payments token fixes, BottomNav on dashboard/tools (STORY-042)
- All pages verified at 390px and 1280px; lint clean; 7 commits

### Sprint 8 — Refunds + Email (2026-07-11, commit `1414754`)
- Refund flow: student request → admin approve/reject → PayMongo refund API
  + email (STORY-034)
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
- Campaign Builder 5-step wizard (SP/SB/SD/BTW-aware) (STORY-018)
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
- Campaign Builder engine + SP/SB/SD/BTW scenario packs (STORY-007)
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