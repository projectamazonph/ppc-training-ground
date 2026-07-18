# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Project Amazon PH Academy (AMPH) — an Amazon PPC training platform for Filipino virtual assistants. Next.js 16 modular monolith, solo-developer project, single Postgres database, single Vercel deploy. Three paid course tiers, five interactive PPC practice tools (simulators), gamification (XP/badges/certificates), and an admin panel.

Read `AGENTS.md` first — it's the terse rules file this document expands on. `docs/decisions.md` has the ADRs behind every non-obvious architectural choice referenced below (e.g. "ADR-012").

## Curriculum & content

The learning content is planned and audited in `docs/`. The legacy MDX lessons and the quiz fixture live in `content/curriculum/` (`modules/` + `quiz-questions.json`), and `scripts/import-amph-content.ts` reads from that repo-relative path. The P0 legacy-product references (AdCraft, AI Mentor, Formula Calculator, "three simulations") flagged in `docs/CONTENT-AUDIT-2026-07-16.md` have been rewritten across all modules (0-8) to describe the real v2 platform and its five tools — see `SESSION-HANDOVER.md` for the rewrite history. Full lesson rewrites to the 10-block production standard (Release 2) are still open.

Key content docs:
- `docs/CONTENT-AUDIT-2026-07-16.md` — content audit: critical P0/P1 issues, release plan (P0 #3, legacy references, is resolved; see status note in the doc).
- `docs/CURRICULUM-REDESIGN.md` — target 3-course model, module map, assessments, production order.
- `docs/VIDEO-EXPLAINER-SCRIPTS.md` — 8 short video explainer scripts for the Foundations launch. All 8 have been produced as HyperFrames video builds under `videos/*-explainer/`.
- `docs/stitch-prompts.md` — the "Field Manual" design-system spec (24 Stitch AI screen prompts). Landing page and all authenticated-area pages were audited and aligned to this spec; see `SESSION-HANDOVER.md`.
- `docs/0-1-welcome-to-amph.md` — Module 0 lesson 1 (welcome / work loop).
- `docs/1-1-read-ppc-data-before-you-change-it.md` — Module 1 lesson 1 (Big Six metrics decision lesson).

When writing or importing lessons, follow the lesson-production standard in `docs/CURRICULUM-REDESIGN.md` and the voice rules in `docs/voice-guide.md`.

## Architecture notes

- **Route protection:** `src/lib/route-guards.ts` holds pure, unit-tested route-classification functions (`isAdminRoute`, `isStudentRoute`, `isProtectedRoute`, `legacyDashboardRedirectTarget`). `src/middleware.ts` is a thin Edge-runtime wrapper around these; page/layout-level `requireAuth()` remains the authoritative check. The `(dashboard)` route group (`/dashboard`, `/courses`, `/tools`, `/payments`, `/certificates`, `/live-classes`) shares a sidebar+top-bar shell via `src/app/(dashboard)/layout.tsx`, mirroring the existing `/admin` shell. `SiteHeader` (client component) hides the public marketing header on all protected routes via `isProtectedRoute`.
- **Tool registry:** `src/engine/registry.ts`'s `TOOL_REGISTRY` is the single source of truth for each tool's scenario list and count — pages should read from it rather than re-importing and re-summing raw per-engine scenario arrays (a past bug: Campaign Builder's registry once wired the wrong `BTV_SCENARIOS` import and produced a duplicate scenario).

## Commands

- `pnpm dev` — start the Next.js dev server.
- `pnpm build` / `pnpm start` — production build and serve.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm lint` — ESLint.
- `pnpm test` / `pnpm test:coverage` — Vitest unit/integration tests (coverage gate: 70% on `src/lib/**/*.ts`).
- `pnpm test:e2e` — Playwright end-to-end tests.
- `pnpm prisma:generate` / `pnpm prisma:migrate` / `pnpm prisma:studio` — Prisma client, migrations, and studio.