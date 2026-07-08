# AMPH Academy v2

**Amazon advertising training platform for Filipino virtual assistants.**

Three courses. One outcome: the VA becomes the Amazon ads specialist clients retain at ₱60k–₱80k/month.

---

## Status

| Sprint | Status | Stories |
|---|---|---|
| **Sprint 1** — Foundation | ✅ Complete (2026-07-07) | 6 / 6 |
| **Sprint 2** — Tools (5 engines + fixtures) | ✅ Complete (2026-07-07) | 6 / 6 |
| **Sprint 3** — Curriculum + tier gating | ✅ Complete (2026-07-08) | 5 / 5 |
| **Sprint 4** — Tool UIs | ✅ Complete (2026-07-08) | 5 / 5 |
| **Sprint 5** — Gamification | ✅ Complete (2026-07-09) | 3 / 3 |
| Sprint 6 — Payments | ⏳ In progress (2/4) | 2 / 4 |
| Sprint 7 — Admin | Backlog | 0 / 4 |
| Sprint 8 — Refunds + Email | Backlog | 0 / 3 |
| Sprint 9 — Polish | Backlog | 1 / 5 (no-ai-slop done) |
| Sprint 10 — Tests | Backlog | 0 / 5 |
| Sprint 11 — Observability | Backlog | 0 / 5 |
| Sprint 12 — Launch | Backlog | 0 / 4 |
| **Total** | **27 / 55 stories (49%)** | |

| Layer | Status |
|-------|--------|
| Architecture (16 ADRs) | ✅ Complete — `docs/decisions.md` |
| Database schema (25 models) | ✅ Complete — `prisma/schema.prisma` |
| Design system (Field Manual) | ✅ Complete — `src/styles/globals.css` |
| UI component library (7 components + admin shell) | ✅ Complete — `src/components/ui/` |
| JWT auth + RBAC | ✅ Complete — `src/lib/auth.ts` + `src/middleware.ts` |
| 5 tool engines + 30 scenarios + grading | ✅ Complete — `src/engine/` |
| Tool session persistence (save/resume/submit) | ✅ Complete — `src/app/actions/tools.ts` |
| AMPH v1 content imported (31 lessons, 5 quizzes) | ✅ Complete — `scripts/import-amph-content.ts` |
| Curriculum pages (dashboard, course, lesson, quiz) | ✅ Complete — `src/app/(dashboard)/` |
| Voice + copy guide | ✅ Spec complete — `docs/voice-guide.md` |
| 5 tool interactive UIs | ✅ Complete — `src/components/tools/` (5 client runners + shared `ToolResult`) |
| Business layer (PayMongo) | ⏳ Spec complete, code in Sprint 6 — `docs/business-layer.md` |
| Admin panel (full surface) | ⏳ Layout only, full panels in Sprint 7 — `docs/admin-backend.md` |
| Tests | ❌ Not started (Sprint 10) |
| Observability | ❌ Not started (Sprint 11) |

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
| Database | PostgreSQL (prod) / SQLite (dev) | Managed in prod, fast local iteration |
| ORM | Prisma | Type-safe queries, migrations |
| Auth | JWT in HttpOnly cookies (jose) | Stateless, works with middleware |
| Styling | CSS Modules + design tokens | No Tailwind. Per design-brief. |
| Icons | Phosphor (light) only | One icon set across the product |
| Fonts | Space Grotesk + JetBrains Mono | Self-hosted via `next/font` |
| Payments | PayMongo | Native PHP, GCash/Maya/card/bank |
| Email | Resend + React Email | Templates as React components |
| File storage | Vercel Blob | Resources, certificates, receipts |
| Error tracking | Sentry | Errors + performance |
| Testing | Vitest + Playwright | Unit/integration + E2E |
| CI | GitHub Actions | tsc, eslint, vitest, playwright, gitleaks, lighthouse-ci |

**Design system:** Field Manual. Dense, scannable, utilitarian. Off-white surface (#FAFAF7), orange accent (#FF6B35), type-led hierarchy. See `docs/design-brief.md`.

**Auth pattern:** Defense-in-depth. Edge middleware verifies JWT and gates `/admin/*` + `/dashboard/*`. Server Components and server actions re-verify via `getSession()` + `jose`. Never trust headers blindly.

**Soft-delete pattern:** `src/lib/db.ts` Prisma middleware auto-injects `deletedAt: null` on every `find*` / `count` / `aggregate` query. Bypass only when caller genuinely needs deleted records.

---

## Repository Structure

```
amph-v2/
├── src/
│   ├── app/
│   │   ├── (public)/             Public pages (auth pages live here)
│   │   │   └── auth/
│   │   │       ├── signin/        Sign-in page + form
│   │   │       └── signup/        Sign-up page + form
│   │   ├── actions/              Server actions
│   │   │   └── auth.ts           signup/signin/signout actions
│   │   ├── admin/                Admin panel (RBAC-gated)
│   │   │   ├── layout.tsx        requireAdmin() + sidebar/topbar
│   │   │   └── page.tsx          Dashboard with stats
│   │   ├── layout.tsx            Root layout: fonts + header nav
│   │   └── page.tsx              Landing page
│   ├── components/
│   │   └── ui/                   Shared UI primitives (Field Manual)
│   │       ├── Button.tsx        Primary/secondary/ghost/danger × sm/md/lg
│   │       ├── Card.tsx          Default/interactive/outlined + sub-components
│   │       ├── Input.tsx         Label + error/hint + left/right icon
│   │       ├── Badge.tsx         Default/success/warning/danger/info
│   │       ├── Modal.tsx         Native <dialog> with focus trap
│   │       ├── Toast.tsx         Provider + auto-dismiss + stack ≤3
│   │       ├── Icon.tsx          Phosphor wrapper (28 named icons)
│   │       ├── NavSidebar.tsx    Admin nav with active state
│   │       ├── TopBar.tsx        Admin top bar with sign-out
│   │       └── index.ts          Barrel export
│   ├── lib/
│   │   ├── db.ts                 Prisma singleton + soft-delete middleware
│   │   ├── auth.ts               JWT (jose) + scrypt + requireAuth/requireAdmin
│   │   └── validation.ts         Zod schemas + createSafeAction wrapper
│   ├── middleware.ts             Edge JWT verification + RBAC gating
│   └── styles/
│       └── globals.css           Field Manual design tokens + dark mode
├── prisma/
│   ├── schema.prisma             25 models per docs/db-schema.md
│   └── seed.ts                   Admin user + 3 pricing tiers + 5 badges
├── scripts/
│   └── gen-jwt-secret.ts         HS256 secret generator
├── eslint-rules/
│   └── no-ai-slop.js             Custom rule banning 30+ AI-generated patterns
├── docs/                         Specifications (the plan)
│   ├── build-spec.md             Why greenfield
│   ├── product-brief.md          Audience + value prop
│   ├── decisions.md              16 ADRs
│   ├── design-brief.md           Field Manual design system
│   ├── voice-guide.md            Copy rules + jargon buster
│   ├── db-schema.md              Schema specification
│   ├── admin-backend.md          Admin panel routes + RBAC
│   ├── business-layer.md         PayMongo integration
│   ├── ai-removal.md             Zero AI commitment
│   ├── sprint-plan.md            11 sprints, 55 stories
│   └── bmad/                     BMAD state files
├── .omh/plans/                   Consensus plans (ralplan output)
├── .github/workflows/ci.yml      tsc + lint + vitest + playwright + lighthouse + gitleaks
├── AGENTS.md                     Agent conventions
├── package.json
├── tsconfig.json                 Strict + noUncheckedIndexedAccess + noImplicitOverride
├── next.config.ts                Security headers + CSP-ready
├── .eslintrc.json                Loads local/no-ai-slop rule
├── .env.example                  All required env vars documented
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
pnpm test             # Vitest unit + integration (Sprint 9)
pnpm test:e2e         # Playwright E2E (Sprint 9)
pnpm test:coverage    # Coverage report (Sprint 9)
pnpm prisma:studio    # Browse the database
pnpm gen:secret       # Print a new JWT secret
pnpm gen:secret --write  # Append to .env.local
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

### CSS Modules + tokens (no Tailwind)

Every component imports a `.module.css` file that uses `var(--token)` references. Tokens live in `src/styles/globals.css`. The `no-ai-slop` ESLint rule scans all source for AI-generated copy patterns.

---

## Sprint Status

Sprints 1-5 shipped the foundation, all 5 tool engines + 30 scenarios, content import, curriculum pages, quiz system, tier gating, the 5 interactive tool UIs, and the full gamification stack: auto-awarded badges, PDF certificates with public verification, and live classes with tier-gated registration. Sprint 6 — Payments started 2026-07-09: STORY-026 (PayMongo checkout + webhook + public pricing) shipped, STORY-027 (guest signup completion + grandfather free PPC enrollment) shipped 2026-07-10.

- Next.js 16 scaffold with TypeScript strict
- Field Manual design system (60+ tokens, full dark mode)
- 7 UI primitives + admin shell components
- Full 25-model Prisma schema migrated and seeded
- JWT auth with HttpOnly cookies, 7-day TTL
- Edge middleware with RBAC for `/admin/*` and `/dashboard/*`
- 5 tool engines with 30 scenarios (Campaign Builder SP/SB/SD/BTV, Bid Elevator, STR Triage, Listing Audit, Keyword Research)
- Tool session persistence (save/resume/submit/grade)
- AMPH v1 content imported (1 course, 9 modules, 31 lessons, 5 quizzes, 30 questions) with $USD→₱PHP currency refactor
- Curriculum pages: dashboard, course detail, lesson reader, quiz
- Tier-gated course access (enroll-aware): TierLock screen on lesson/quiz pages, lock icons on course index, server actions enforce the gate
- 5 interactive tool UIs: Listing Audit form, Keyword Research categorizer, Bid Elevator table, STR Triage triager, Campaign Builder 5-step wizard (BTV-aware)
- 1 admin + 3 pricing tiers + 5 badges seeded

**Next: Sprint 6 STORY-028 + STORY-029.** STORY-028: refund flow (student request + admin approval + PayMongo refund call). STORY-029: BIR-compliant receipt PDFs.

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