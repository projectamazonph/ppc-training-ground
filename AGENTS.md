# AGENTS.md — Project Amazon PH Academy v2

Conventions for AI coding assistants and developers working on this codebase.

---

## The Five Rules

1. **Zero AI features.** No `openai`, `anthropic`, `langchain`, or any LLM API. No mentor chat, no AI mistake analysis. ADR-003.
2. **One icon set.** Phosphor (light) only. No Heroicons, no Lucide.
3. **One font pairing.** Space Grotesk + JetBrains Mono. No Inter, no system fonts in product UI.
4. **Server actions for mutations.** Reserve API routes for webhooks, file uploads, third-party.
5. **Every admin action logs to AuditLog.** No exceptions.

## The Voice

Direct, plain-spoken, Filipino VA audience. No jargon without definition. No AI-slop phrases. See `docs/voice-guide.md`. The ESLint rule `local/no-ai-slop` enforces banned phrases in CI.

## The Design System

Field Manual. Dense, scannable, utilitarian. Off-white surface. Orange accent (#FF6B35). Type-led hierarchy. No glassmorphism, no gradient orbs, no decorative blurs. See `docs/design-brief.md`.

## The Database

PostgreSQL (dev + production). Schema uses no SQLite-specific features. Every mutable table has `deletedAt`, `createdById`, `updatedById`. See `docs/db-schema.md`.

## The Business Layer

PayMongo for payments (one-time, Philippine peso, GCash/Maya/card/bank). Three pricing tiers. Refund window 7 days. Tax-compliant receipts. See `docs/business-layer.md`.

## The Admin Panel

`/admin/*` gated by `requireAdmin()`. Every route has search, filter, pagination. Every mutation is audited. See `docs/admin-backend.md`.

## The Curriculum

Lessons are planned and audited in `docs/`. Source content now lives in `content/curriculum/` (31 legacy MDX lessons in `modules/`, quiz fixture in `quiz-questions.json`); `scripts/import-amph-content.ts` reads from that repo-relative path. That legacy content still describes a different product (AdCraft, AI Mentor, three simulations) and needs a rewrite pass before the next release (remaining P0 findings in `docs/CONTENT-AUDIT-2026-07-16.md`). Target structure: three courses (PPC Foundations, Accelerated Mastery, Ultimate Transformation) per `docs/CURRICULUM-REDESIGN.md`. Audio-visual scripts: `docs/VIDEO-EXPLAINER-SCRIPTS.md`. Sample lessons: `docs/0-1-welcome-to-amph.md`, `docs/1-1-read-ppc-data-before-you-change-it.md`. Follow the lesson-production standard and the voice rules when authoring content.

## Code Style

- TypeScript strict. No `any`. Define types or use `unknown` with narrowing.
- Server components by default. `'use client'` only when needed.
- No `console.log` in committed code. Use the structured logger (`src/lib/logger.ts`).
- No comments that restate the code. Comment the why, not the what.
- File names: `kebab-case.ts` for non-component files, `PascalCase.tsx` for components.

## Testing

- Vitest for unit + integration.
- Playwright for E2E.
- Tests live next to the code they test: `foo.ts` → `foo.test.ts`.
- Coverage thresholds enforced in CI: 70% on `src/lib` and `src/app/actions`.

## Commits

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- One concern per commit. Don't mix refactor + feature.
- Reference story IDs: `feat(admin): user list table (STORY-027)`.
- Always `git commit` after work. Never leave uncommitted changes.

## Branching

- `main` — production-ready
- `feat/*` — feature branches
- `fix/*` — bugfix branches
- Branch off `main`, PR back to `main`.
- Squash merge.

## CI Requirements (build fails if any of these fail)

- `pnpm tsc --noEmit` — zero type errors
- `pnpm lint` — zero ESLint errors (includes no-ai-slop)
- `pnpm test` — all tests pass
- `pnpm test:coverage` — coverage above threshold
- `pnpm test:e2e` — Playwright suite passes
- `pnpm build` — production build succeeds
- Lighthouse CI — performance budget met
- `gitleaks detect` — no secrets in diff

## File Dependency Chain

```
src/lib/        ← Pure utilities, no deps
   ↑
src/components/ ← UI primitives, depend on lib
   ↑
src/app/        ← Routes, depend on components + lib
   ↑
tests/          ← Mirror src structure
```

Lower layers must not import from higher layers. `src/lib/auth.ts` cannot import from `src/app/`.

## Don't Do

- Don't add dependencies without updating `package.json` and `pnpm-lock.yaml`.
- Don't use `fetch` directly in components. Use server actions.
- Don't store secrets in code. Use env vars.
- Don't commit `.env*` files. `.env.example` is allowed.
- Don't use emojis in code or commit messages.
- Don't use em-dashes. Use periods, commas, parentheses.
- Don't write generic AI-slop copy. The ESLint rule catches most, but read `voice-guide.md` for the full rules.
- Don't ship code without tests for new features (admin and business layer are mandatory).
- Don't ignore the AuditLog. Every admin mutation logs.

## On Errors

When something breaks:

1. Read the actual error. Don't guess.
2. Reproduce in the smallest possible test.
3. Fix root cause, not symptom.
4. Add a test that would have caught this.
5. Commit fix + test together.

## Memoria Protocol

This repo uses Memoria for cross-agent context. Tag memories with:
- `project:amph-v2`
- `phase:1` (analysis), `2` (planning), `3` (solutioning), `4` (implementation), `5` (enrichment)
- `agent:dusk` (this instance)

Other agents (Atlas on phone OpenClaw, Vader on phone Hermes) share the same memoria server. Leave notes for them on handoffs.