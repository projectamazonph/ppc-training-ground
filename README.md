# AMPH Academy v2

**Amazon advertising training platform for Filipino virtual assistants.**

Three courses. One outcome: the VA becomes the Amazon ads specialist clients retain at ₱60k–₱80k/month.

**Status:** 52/52 stories shipped (100%) · 12 sprints complete · Production deploy pending operator execution

---

## 📊 Codegraph

See [codegraphs/amph-v2.md](./codegraphs/amph-v2.md) for the full dependency graph.

---

## Status

| Sprint | Track | Stories | Status |
|--------|-------|---------|--------|
| **S1** | Foundation | 6 / 6 | ✅ Complete (2026-07-07) |
| **S2** | Tools (5 engines + fixtures) | 6 / 6 | ✅ Complete (2026-07-07) |
| **S3** | Curriculum + tier gating | 5 / 5 | ✅ Complete (2026-07-08) |
| **S4** | Tool UIs | 5 / 5 | ✅ Complete (2026-07-08) |
| **S5** | Gamification | 3 / 3 | ✅ Complete (2026-07-09) |
| **S6** | Payments | 4 / 4 | ✅ Complete (2026-07-10) |
| **S7** | Admin | 4 / 4 | ✅ Complete (2026-07-10) |
| **S8** | Refunds + Email | 4 / 4 | ✅ Complete (2026-07-11) |
| **S9** | Polish + Mobile | 5 / 5 | ✅ Complete (2026-07-12) |
| **S10** | Tests + CI Hardening | 5 / 5 | ✅ Complete (2026-07-13) |
| **S11** | Observability | 5 / 5 | ✅ Complete (2026-07-13) |
| **S12** | Launch | 5 / 5 | ✅ Complete (2026-07-13) |
| | **Total** | **52 / 52** | **100% shipped** |

Velocity: 57 points over 12 sprints. No slip.

### System Status

| Layer | Status |
|-------|--------|
| Architecture (16 ADRs) | ✅ Complete — `docs/decisions.md` |
| Database schema (19 models) | ✅ Complete — `prisma/schema.prisma` |
| Design system (Field Manual) | ✅ Complete — `src/styles/globals.css` |
| UI component library (9 components + admin shell) | ✅ Complete — `src/components/ui/` |
| JWT auth + RBAC + Edge middleware | ✅ Complete — `src/lib/auth.ts` + `src/middleware.ts` |
| 5 tool engines + 30 scenarios + grading | ✅ Complete — `src/engine/` |
| Tool session persistence (save/resume/submit) | ✅ Complete — `src/app/actions/tools.ts` |
| AMPH v1 content imported (31 lessons, 5 quizzes) | ✅ Complete — `scripts/import-amph-content.ts` |
| Curriculum pages (dashboard, course, lesson, quiz) | ✅ Complete — `src/app/(dashboard)/` |
| 5 tool interactive UIs | ✅ Complete — `src/components/tools/` |
| Business layer (PayMongo + webhooks) | ✅ Complete — `src/lib/paymongo.ts` |
| Admin panel (8 screens) | ✅ Complete — `src/app/admin/` |
| Refunds + transactional email (3 templates) | ✅ Complete — `src/lib/refunds.ts` + `src/lib/email/` |
| Tests (53/53 unit + integration, E2E scaffolded) | ✅ Verified by CI — `vitest.config.ts` |
| CI/CD (GitHub Actions) | ✅ Complete — tsc, lint, vitest, playwright, lighthouse, gitleaks |
| Observability (Sentry + Pino + Slack alerting) | ✅ Complete — `src/lib/logger.ts` + `src/lib/sentry.ts` |
| Production deploy automation | ✅ Complete — deploy-preview, deploy-prod, rollback workflows |
| Production deploy execution | ⏳ Operator-side pending — see `docs/sprint-12/deploy-execution.md` |

This is a **greenfield rebuild**. v1 lives at `github.com/projectamazonph/AMPH-Academy` and is frozen. No code, schema, or commits from v1 carry over. Every architectural decision is made fresh.

---

## What This Platform Is

A paid training platform where Filipino VAs learn Amazon advertising through structured courses, interactive tools (Campaign Builder, Bid Elevator, Search Term Triage), gamified learning, and downloadable resources.

**Tiers:**
- **PPC Foundations** — ₱2,999
- **Accelerated Mastery** — ₱5,999
- **Ultimate Transformation** — ₱9,999

**Audience:** Filipino virtual assistants who already do general VA work and want to specialize in Amazon advertising. Most earn ₱15k–₱30k/month. They want to reach ₱60k–₱80k/month.

---

## What This Platform Is NOT

- Not a generic course platform. Built for one specific niche.
- Not AI-powered. Zero external AI APIs. See `docs/decisions.md` ADR-003.
- Not a CMS. Content is hand-authored and shipped with the app.
- Not a marketplace. Ryan owns the content.
- Not multi-tenant. Single organization.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 App Router | Server components, server actions, single deploy |
| Language | TypeScript (strict) | Catch errors at compile time |
| Database | PostgreSQL (Neon, dev + prod) | Managed in prod, consistent local+prod environment |
| ORM | Prisma | Type-safe queries, migrations |
| Auth | JWT in HttpOnly cookies (jose) | Stateless, works with middleware |
| Styling | CSS Modules + design tokens | No Tailwind. Per design-brief. |
| Icons | Phosphor (light) only | One icon set across the product |
| Fonts | Space Grotesk + JetBrains Mono | Self-hosted via `next/font` |
| Payments | PayMongo | Native PHP, GCash/Maya/card/bank |
| Email | Resend + React Email | Templates as React components |
| File storage | Vercel Blob | Resources, certificates, receipts |
| Error tracking | Sentry (`@sentry/nextjs@^9`) | Errors + performance + source maps |
| Logging | Pino + AsyncLocalStorage | Structured JSON logs with request context |
| Testing | Vitest + Playwright | Unit/integration + E2E |
| CI/CD | GitHub Actions | tsc, lint, vitest, playwright, lighthouse-ci, gitleaks |
| Alerting | Slack Incoming Webhook | Error spikes + daily summaries |

**Design system:** Field Manual. Dense, scannable, utilitarian. Off-white surface (#FAFAF7), orange accent (#FF6B35), type-led hierarchy. See `docs/design-brief.md`.

**Auth pattern:** Defense-in-depth. Edge middleware verifies JWT and gates `/admin/*` + `/dashboard/*`. Server Components and server actions re-verify via `getSession()` + `jose`. Never trust headers blindly.

**Soft-delete pattern:** `src/lib/db.ts` Prisma middleware auto-injects `deletedAt: null` on every `find*` / `count` / `aggregate` query. Bypass only when caller genuinely needs deleted records.

**Observability pattern:** Sentry for error tracking with source-map upload, Pino structured logging with redaction, `withActionTracing` HOC for server actions, Lighthouse CI with performance budgets, Slack alerts for error spikes.

---

## Repository Structure

```
amph-v2/
├── src/
│   ├── app/
│   │   ├── (public)/              Public pages (auth, pricing)
│   │   │   └── auth/
│   │   │       ├── signin/        Sign-in page + form
│   │   │       └── signup/        Sign-up page + form
│   │   ├── (dashboard)/           Student dashboard, courses, tools, quizzes
│   │   ├── admin/                 Admin panel (RBAC-gated)
│   │   │   ├── layout.tsx         requireAdmin() + sidebar/topbar
│   │   │   └── page.tsx           Dashboard with stats
│   │   ├── api/
│   │   │   └── paymongo/webhook/  HMAC-verified PayMongo webhook handler
│   │   ├── actions/               Server actions (auth, progress, tools, refunds, etc.)
│   │   ├── layout.tsx             Root layout: fonts + header nav
│   │   └── page.tsx               Landing page
│   ├── components/
│   │   ├── ui/                    Shared UI primitives (Field Manual)
│   │   │   ├── Button.tsx         Primary/secondary/ghost/danger × sm/md/lg
│   │   │   ├── Card.tsx           Default/interactive/outlined + sub-components
│   │   │   ├── Input.tsx          Label + error/hint + left/right icon
│   │   │   ├── Badge.tsx          Default/success/warning/danger/info
│   │   │   ├── Modal.tsx          Native <dialog> with focus trap
│   │   │   ├── Toast.tsx          Provider + auto-dismiss + stack ≤3
│   │   │   ├── Icon.tsx           Phosphor wrapper (28 named icons)
│   │   │   ├── NavSidebar.tsx     Admin nav with active state
│   │   │   ├── TopBar.tsx         Admin top bar with sign-out
│   │   │   ├── BottomNav.tsx      Student mobile nav (4-slot, safe-area-inset)
│   │   │   └── index.ts           Barrel export
│   │   └── tools/                 5 interactive tool runners + shared ToolResult
│   ├── lib/
│   │   ├── db.ts                  Prisma singleton + soft-delete middleware
│   │   ├── auth.ts                JWT (jose) + scrypt + requireAuth/requireAdmin
│   │   ├── logger.ts             Pino structured logger with AsyncLocalStorage
│   │   ├── sentry.ts             Sentry client init + captureException wrapper
│   │   ├── sentry-shared.ts      Shared Sentry noop guard for non-browser
│   │   ├── tracing.ts            withActionTracing HOC + trace() export
│   │   ├── middleware-context.ts  ALS-based request context for edge middleware
│   │   ├── tier-gate.ts          Enrollment + tier-gated access control
│   │   ├── badges.ts             Badge auto-award engine (5 criteria types)
│   │   ├── certificates.ts       PDF certificate generation + UUID verification
│   │   ├── paymongo.ts           PayMongo API + HMAC webhook verification
│   │   ├── refunds.ts            Refund flow engine (7-day window)
│   │   ├── receipts.tsx          BIR-compliant receipt PDFs with VAT
│   │   └── validation.ts         Zod schemas + createSafeAction wrapper
│   ├── engine/                    5 tool engines + 30 scenarios + grading
│   ├── engine/registry.ts        Tool registry mapping slugs to engines
│   ├── middleware.ts              Edge JWT verification + RBAC gating
│   └── styles/
│       └── globals.css            Field Manual design tokens + dark mode
├── prisma/
│   ├── schema.prisma              19 models
│   └── seed.ts                    Admin user + 3 pricing tiers + 5 badges
├── scripts/
│   ├── gen-jwt-secret.ts          HS256 secret generator
│   ├── import-amph-content.ts     AMPH v1 → v2 content importer
│   ├── sentry-slack-alert.ts      Sentry error spike + daily summary → Slack
│   ├── smoke-prod.sh              Production smoke test (bash + curl + grep)
│   ├── backup-prod.sh             pg_dump → gzip → Vercel Blob
│   └── restore-prod.sh            Download backup → pg_restore → assert counts
├── eslint-rules/
│   └── no-ai-slop.js              Custom rule banning 30+ AI-generated patterns
├── docs/
│   ├── sprint-plan.md             12 sprints, 52 stories — complete
│   ├── decisions.md               16 ADRs
│   ├── voice-guide.md             Copy rules + jargon buster
│   ├── api-reference.md           Full API & schema reference
│   ├── sprint-11/PLAN.md          Observability sprint (SHIPPED)
│   ├── sprint-12/PLAN.md          Launch sprint (SHIPPED)
│   ├── sprint-12/deploy-execution.md   Operator deploy checklist
│   ├── sprint-12/launch-comms.md       Social copy + email template + retro
│   ├── runbooks/
│   │   ├── production-deploy.md   17-env-var deploy runbook
│   │   └── db-backup-restore.md   Backup + restore drill runbook
│   ├── security/
│   │   ├── tenant-isolation.md    10 server actions + 8 route handlers audit
│   │   └── security-audit-2026-07-13.md  npm audit, gitleaks, headers, auth
│   ├── stories/                   STORY-001 through STORY-057 acceptance docs
│   └── bmad/                      BMAD state files (sprint + workflow YAMLs)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 tsc + lint + vitest + playwright + lighthouse + gitleaks
│   │   ├── sentry-alert.yml       30-min spike + 01:00 UTC daily summary → Slack
│   │   ├── db-backup.yml          Daily 02:00 UTC pg_dump → Vercel Blob
│   │   ├── deploy-preview.yml     Vercel preview per PR + smoke test + PR comment
│   │   ├── deploy-prod.yml        Manual-gated prod deploy + Sentry release + smoke
│   │   └── rollback.yml           Instant Vercel rollback (requires ROLLBACK confirm)
│   └── dependabot.yml             Daily npm + weekly Actions updates
├── sentry.client.config.ts        Sentry browser init
├── sentry.server.config.ts        Sentry Node.js init
├── sentry.edge.config.ts          Sentry Edge Runtime init
├── .lighthouserc.json             Performance budgets (perf ≥0.85, a11y ≥0.95, etc.)
├── AGENTS.md                      Agent conventions
├── SESSION-HANDOVER.md            Project status + secrets + decisions log
├── CHANGELOG.md                   Full changelog (S1–S12 + post-launch)
├── package.json
├── tsconfig.json                  Strict + noUncheckedIndexedAccess + noImplicitOverride
├── next.config.ts                 Security headers + CSP-ready
├── .eslintrc.json                 Loads local/no-ai-slop rule
├── .env.example                   All required env vars documented
└── README.md
```

---

## Development

### First-time setup

```bash
# Clone
git clone https://github.com/projectamazonph/amph-v2.git
cd amph-v2

# Install
pnpm install

# Generate JWT secret (writes to .env.local automatically)
pnpm gen:secret --write

# Set up database
pnpm prisma migrate dev    # creates prisma/dev.db and applies schema
pnpm prisma db seed        # seeds admin + pricing tiers + badges

# Start dev server
pnpm dev
```

Open http://localhost:3000.

### Default admin account

After seeding, sign in at `/auth/signin`:

- **Email:** `ryan@projectamazonph.com` (override via `ADMIN_EMAIL` env var)
- **Password:** `ChangeMe123!` (override via `ADMIN_PASSWORD` env var)

**Change the password after first sign-in.** Real production deployments must use a different seeded credential.

### Day-to-day commands

```bash
pnpm dev              # Next.js dev server
pnpm build            # Production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint + no-ai-slop rule
pnpm test             # Vitest unit + integration
pnpm test:e2e         # Playwright E2E
pnpm test:coverage    # Coverage report (70% threshold)
pnpm prisma:studio    # Browse the database
pnpm gen:secret       # Print a new JWT secret
pnpm gen:secret --write  # Append to .env.local
pnpm sentry:sourcemaps   # Upload source maps to Sentry
```

### Verifying Sprint 1 works

1. Visit http://localhost:3000 — landing page renders with header nav (Sign in / Get started)
2. Click **Sign in** → enter the default admin credentials
3. After sign-in you're routed to `/admin` — dashboard renders with 4 stat cards (Users, Courses, Badges, Pricing tiers)
4. Click **Sign out** in the top-right → cleared cookie, redirected to home
5. While signed out, try navigating to `/admin` directly → redirected to `/auth/signin?redirect=/admin`

---

## Architecture Highlights

### Zero AI features (ADR-003)

No `openai`, `anthropic`, `langchain`, or any LLM API. No mentor chat. No AI mistake analysis. Static "Common Mistakes" sections replace dynamic AI explanations. Content is hand-authored and shipped with the app.

### Defense-in-depth auth

```
Edge Middleware                 Server Components / Actions
     │                                    │
     ▼                                    ▼
jwtVerify(token)                   getSession() → jose.verify()
  ├─ no token → /auth/signin        ├─ no session → redirect('/auth/signin')
  ├─ bad token → clear + redirect   ├─ bad session → redirect('/auth/signin')
  └─ OK → forward with headers      └─ role !== ADMIN → redirect('/')
                                    └─ OK → return user
```

Both layers verify independently. The Edge middleware runs on every request to `/admin/*` and `/dashboard/*` via the `matcher` config. Server actions also call `requireAuth()` or `requireAdmin()` for defense in depth.

### Soft-delete middleware (ADR-012)

Every mutable table has a `deletedAt DateTime?` column. The Prisma middleware in `src/lib/db.ts` auto-injects `deletedAt: null` on every read query (`findUnique`, `findFirst`, `findMany`, `count`, `aggregate`, `groupBy`). Soft-deleted records are invisible to app code by default.

### Observability stack

- **Sentry** (`@sentry/nextjs@^9`): client/server/edge configs, source maps, release tracking
- **Pino** structured logging: `src/lib/logger.ts` with AsyncLocalStorage child-context, PII redaction
- **Server-action tracing**: `withActionTracing` HOC in `src/lib/tracing.ts`
- **Lighthouse CI**: performance budgets enforced in CI (perf ≥0.85, a11y ≥0.95, LCP ≤4000ms, TBT ≤300ms)
- **Slack alerting**: error spike + daily summary via `sentry-alert.yml` cron (01:00 UTC / 09:00 PHT)

### CI/CD pipeline

- **ci.yml**: tsc → lint → vitest → playwright → lighthouse-ci → gitleaks (push/PR only, no schedule)
- **sentry-alert.yml**: 30-min spike monitoring + 01:00 UTC daily summary
- **db-backup.yml**: daily 02:00 UTC pg_dump → Vercel Blob
- **deploy-preview.yml**: Vercel preview per PR + smoke test + PR comment
- **deploy-prod.yml**: manual-gated prod deploy + Sentry release + smoke + Slack
- **rollback.yml**: instant Vercel rollback (requires typing `ROLLBACK` to confirm)
- **dependabot.yml**: daily grouped npm updates, weekly Actions updates

### CSS Modules + tokens (no Tailwind)

Every component imports a `.module.css` file that uses `var(--token)` references. Tokens live in `src/styles/globals.css`. The `no-ai-slop` ESLint rule scans all source for AI-generated copy patterns.

---

## Sprint History

All 52 stories shipped across 12 sprints (57 points). No slip.

| Sprint | Track | Key Deliverables |
|--------|-------|------------------|
| S1 | Foundation | Next.js scaffold, Field Manual design system, JWT auth, Prisma schema (19 models), admin layout |
| S2 | Tools | 5 engine cores (Campaign Builder, Bid Elevator, STR Triage, Listing Audit, Keyword Research) + 30 scenarios + grading |
| S3 | Curriculum | Content import (31 lessons, 5 quizzes), curriculum pages, quiz system, tier gating |
| S4 | Tool UIs | 5 interactive runners: Campaign Builder wizard, Bid Elevator table, STR Triage grid, Listing Audit form, Keyword Research categorizer |
| S5 | Gamification | Auto-awarded badges (5 criteria), PDF certificates with verification UUID, live classes with tier-gated registration |
| S6 | Payments | PayMongo checkout + webhook, enrollment management, refund engine, BIR-compliant receipt PDFs |
| S7 | Admin | 8 admin screens: dashboard, user CRUD, course/module/lesson management, tool scenarios, analytics, refunds, badges |
| S8 | Refunds + Email | Admin refund approval UI, 3 Resend React Email templates, webhook handler with HMAC verification |
| S9 | Polish + Mobile | Design-system audit, responsive breakpoints, BottomNav component, mobile-first page refactor |
| S10 | Tests + CI Hardening | 53/53 unit + integration tests, Playwright E2E scaffolded, 70% coverage threshold, CI pipeline aligned to PostgreSQL |
| S11 | Observability | Sentry setup, Pino structured logging, server-action tracing, Lighthouse CI, Slack alerting |
| S12 | Launch | Deploy runbook, backup drill scripts, security audit, production deploy automation, launch communications |

See `docs/sprint-plan.md` for the full roadmap and `bmad/sprint-status.yaml` for current state.

---

## Contributing

Read `AGENTS.md` first. Conventions there are enforced by ESLint and CI.

The five rules:

1. Zero AI features.
2. One icon set: Phosphor (light) only.
3. One font pairing: Space Grotesk + JetBrains Mono.
4. Server actions for mutations. API routes for webhooks/uploads only.
5. Every admin action logs to AuditLog.

The voice:

- Direct, plain-spoken, Filipino VA audience.
- No jargon without definition.
- No AI-slop phrases (enforced by ESLint).
- See `docs/voice-guide.md` for the full rules.

---

## License

Proprietary. © 2026 Project Amazon PH. All rights reserved.

## Contact

Ryan Roland Dabao — Project Amazon PH
[Email protected]