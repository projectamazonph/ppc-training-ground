# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Project Amazon PH Academy (AMPH) — an Amazon PPC training platform for Filipino virtual assistants. Next.js 16 modular monolith, solo-developer project, single Postgres database, single Vercel deploy. Three paid course tiers, five interactive PPC practice tools (simulators), gamification (XP/badges/certificates), and an admin panel.

Read `AGENTS.md` first — it's the terse rules file this document expands on. `docs/decisions.md` has the ADRs behind every non-obvious architectural choice referenced below (e.g. "ADR-012").

## Commands

```bash
pnpm dev                    # Dev server (localhost:3000)
pnpm build                  # Production build
pnpm typecheck              # tsc --noEmit — zero errors required
pnpm lint                   # ESLint, includes local/no-ai-slop and local/no-tailwind rules
pnpm test                   # Vitest unit + integration (src/**/*.test.ts)
pnpm test:watch             # Vitest watch mode
pnpm test:coverage          # Vitest with coverage — 70% threshold on src/lib
pnpm test:e2e               # Playwright E2E (tests/e2e/) — needs `pnpm dev` reachable
pnpm test:e2e:ui             # Playwright UI mode
pnpm prisma:migrate         # prisma migrate dev (local schema changes)
pnpm prisma:deploy          # prisma migrate deploy (CI/production)
pnpm prisma:studio          # Browse the database
pnpm prisma:format          # Format schema.prisma
pnpm gen:secret             # Generate a JWT_SECRET (scripts/gen-jwt-secret.ts)
pnpm format                 # prettier --write .
```

Run a single test file: `pnpm vitest run path/to/file.test.ts` (or `pnpm vitest path/to/file.test.ts` to watch). Run a single Playwright spec: `pnpm exec playwright test tests/e2e/critical-path.spec.ts`.

Package manager is **pnpm** (pinned in `packageManager`) — a `package-lock.json` also exists in the tree but `pnpm-lock.yaml` is the one CI installs from (`pnpm install --frozen-lockfile`).

First-time setup: `pnpm install` → `pnpm gen:secret --write` → `pnpm prisma migrate dev` → `pnpm prisma db seed` → `pnpm dev`.

## Architecture

### Layering (enforced by convention, not tooling)

```
src/lib/        Pure utilities, no upward deps
   ↑
src/components/ UI primitives + tool runners, depend on lib
   ↑
src/app/        Routes, server actions, depend on components + lib
```

Lower layers must not import from higher layers (`src/lib/auth.ts` cannot import from `src/app/`).

### Route groups (`src/app/`)

- `(public)/` — landing, pricing, `auth/` (sign-in/sign-up), `checkout/`
- `(dashboard)/` — student-facing: `courses/`, `tools/`, `live-classes/`, `payments/`, `certificates/`, `dashboard/`. Despite the folder name, these routes do **not** carry a `/dashboard` URL prefix — the route group only affects layout nesting. A middleware rule redirects any incoming `/dashboard/*` request to the equivalent prefix-stripped path.
- `admin/` — gated by `requireAdmin()`, real URL prefix `/admin/*`
- `api/webhook/`, `api/paymongo/`, `api/invoices/`, `api/resend/` — the only legitimate homes for API routes (webhooks, PDF/file endpoints, third-party callbacks). Everything else is a server action.
- `actions/` — all server actions (`'use server'`), one file per domain (`auth.ts`, `checkout.ts`, `progress.ts`, `refunds.ts`, `admin-users.ts`, etc.)
- `verify/[hash]/` — public certificate verification page (no auth)

### Auth (`src/lib/auth.ts`, `src/middleware.ts`)

Two-layer JWT verification by design, not redundancy:
1. **Edge middleware** (`src/middleware.ts`) — runs on the Edge runtime, so it uses `jose` only (no Prisma, no Node `crypto`). It does coarse gating: redirects unauthenticated hits on `/admin/*` and `/dashboard/*` to `/auth/signin`, and bounces non-admins off `/admin/*`.
2. **`getSession()` / `requireAuth()` / `requireAdmin()`** (`src/lib/auth.ts`) — the authoritative check, called from Server Components and server actions. Re-verifies the JWT *and* hits the DB to confirm the account is still `ACTIVE` and not soft-deleted, so a suspend/delete takes effect immediately even though the 7-day token itself has no revocation list.

Passwords are scrypt-hashed (`scrypt$<salt>$<hash>`), not bcrypt. The auth cookie is `sameSite: 'lax'` deliberately — PayMongo's redirect back to `/checkout/complete` is a cross-site navigation, and `strict` would drop the cookie and sign the buyer out mid-checkout.

### Data layer (`src/lib/db.ts`, `prisma/schema.prisma`)

- Single Prisma client singleton with a `$use` middleware that auto-injects `deletedAt: null` into every read on any model in the `SOFT_DELETE_MODELS` set (ADR-012). **Adding a new mutable model requires adding it to that set** or soft-delete silently doesn't apply.
- Enums are **not** modeled as Prisma enums — every "enum" column is a plain `String`, and the valid values live in `src/lib/enums.ts` as const-object + union-type pairs (e.g. `UserRole`, `CourseTier`). Import enum values from `@/lib/enums`, not `@prisma/client`.
- Every mutable table carries `deletedAt`, `createdById`, `updatedById` (ADR-012). Admin "delete" always sets `deletedAt`, never calls `.delete()`.
- `orgId` does not exist yet and multi-tenancy is explicitly deferred (ADR-015) — don't add tenant-scoping.
- Money is stored as integer minor units where BIR compliance matters (`Invoice.grossAmountCentavos` etc.) and as plain peso ints elsewhere (`PricingTier.pricePhp`).
- `ProcessedWebhook` is the idempotency log for PayMongo webhook replays — check/insert against `paymongoEventId` before processing a webhook event.

### Server actions vs API routes

Server actions are the default for all mutations (ADR-005). Use `createSafeAction()` (`src/lib/validation.ts`) to wrap a Zod schema + handler: it parses input, catches thrown errors, and returns `ActionResult<T>` (`{success, data}` or `{success: false, error, fieldErrors?}`). Only plain `new Error(message)` thrown inside a handler surfaces its message to the client — anything else (Prisma errors, `TypeError`, etc.) is logged and replaced with a generic message, so don't rely on non-`Error` throws reaching the UI.

API routes exist only for: PayMongo webhooks, file/invoice serving, Resend callbacks. New third-party integrations follow the same pattern.

### Tier gating (`src/lib/tier-gate.ts`)

Three course tiers rank `PPC_FOUNDATIONS < ACCELERATED_MASTERY < ULTIMATE_TRANSFORMATION`. A user needs only their single highest-tier **active** enrollment — it covers everything below it. Courses with no `pricingTierId` are free/always-accessible. Gating happens twice: visually via `<TierLock>` in pages, and authoritatively via `requireCourseAccess()` / `userCanAccessCourse()` in server actions, so a direct POST can't bypass the UI lock.

### Admin panel (`src/app/admin/`)

Every route: search + filter + pagination. Every mutation calls `auditLog()` (`src/lib/admin-audit.ts`), which itself calls `requireAdmin()` — so audit logging doubles as the authorization check. No admin mutation should skip it.

### Interactive tools (`src/engine/`, `src/components/tools/`)

Five simulators (Campaign Builder, Bid Elevator, STR Triage, Listing Audit, Keyword Research), each an `src/engine/<tool>/` folder of scenario data + scoring logic, wired together through `src/engine/registry.ts` (`TOOL_REGISTRY`, keyed by `ToolSlug`). Each engine pairs with an `src/components/tools/<Tool>Runner.tsx` + `.module.css`. Scoring is deterministic rule-based code (no ML/AI) — see ADR-003. `src/engine/scoring.ts` holds shared scoring helpers.

### Design system ("Field Manual")

Enforced by custom ESLint rules in `eslint-rules/no-tailwind.js`, wired into `eslint.config.mjs`:
- No Tailwind utility classes in `className` (`no-tailwind-classname`), no Tailwind CDN/config imports (`no-tailwind-imports`).
- No inline hex colors in `style` props outside `src/styles/tokens.css` — use CSS custom properties (`var(--accent)`, etc.); exceptions carved out for PDF generators (`cert-pdf`, `receipt-pdf`) and the email template file, which can't consume CSS custom properties.
- Styling is CSS Modules (`Component.module.css` next to `Component.tsx`) + design tokens in `src/styles/globals.css` / `src/styles/tokens.css`.
- Icons: Phosphor (light weight) only. Fonts: Space Grotesk + JetBrains Mono only.

`eslint-rules/no-ai-slop.js` bans a specific phrase list (see the file for the current list) in string literals, JSX text, and JSX attributes — catches AI-slop copy in both code and user-facing content. Full voice rules in `docs/voice-guide.md`.

### Observability

Sentry (`sentry.{client,server,edge}.config.ts`) for error tracking; `src/lib/logger.ts` (Pino + `AsyncLocalStorage`) for structured logging — no `console.log` in committed code. `src/lib/tracing.ts` exports `trace()`, a wrapper used around key async functions (e.g. `auth.getSession`) for span-style logging. `scripts/sentry-slack-alert.ts` posts Sentry error spikes to Slack (see `.env.example` for `ALERT_THRESHOLD` / `WINDOW_MINUTES`).

## Testing conventions

- Vitest unit/integration tests live in `__tests__/` subdirectories next to the code under test (e.g. `src/lib/__tests__/tier-gate.test.ts`, `src/app/actions/__tests__/checkout-actions.test.ts`), not as flat `foo.test.ts` siblings.
- `src/__tests__/setup.ts` mocks `server-only`, `next/headers`, and `next/navigation` globally for the Vitest environment.
- Coverage gate is 70% (lines/functions/branches/statements) on `src/lib/**` only (`vitest.config.ts`); `scripts/check-coverage.js` re-checks the threshold in CI as a second gate after `vitest run --coverage`.
- Playwright E2E specs live in `tests/e2e/`, run against a real `pnpm dev` server with a seeded database.

## CI (`.github/workflows/ci.yml`)

Three jobs, `e2e` and `lighthouse` both gated on `quality` passing: typecheck → lint → gitleaks secret scan → `prisma format --check` + `prisma validate` → `prisma generate` → `prisma migrate deploy` → `test:coverage` → coverage threshold script → `build` → Sentry source-map upload. Note `pnpm test:coverage` is used deliberately instead of `pnpm test -- --coverage`, because pnpm forwards the literal `--` and Vitest then reads `--coverage` as a filename filter and silently skips coverage output.

## Conventions not to violate

- Zero external AI/LLM dependencies anywhere in the codebase (ADR-003) — no `openai`, `anthropic`, `langchain`, mentor chat, or AI-generated content. This is a hard product rule, not a style preference.
- TypeScript strict, no `any`.
- Server Components by default; `'use client'` only when interactivity requires it.
- `kebab-case.ts` for non-component files, `PascalCase.tsx` for components.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`), one concern per commit, story ID references where applicable (`feat(admin): user list table (STORY-027)`).
