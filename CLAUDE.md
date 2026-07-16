# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Project Amazon PH Academy (AMPH) — an Amazon PPC training platform for Filipino virtual assistants. Next.js 16 modular monolith, solo-developer project, single Postgres database, single Vercel deploy. Three paid course tiers, five interactive PPC practice tools (simulators), gamification (XP/badges/certificates), and an admin panel.

Read `AGENTS.md` first — it's the terse rules file this document expands on. `docs/decisions.md` has the ADRs behind every non-obvious architectural choice referenced below (e.g. "ADR-012").

## Curriculum & content

The learning content is planned and audited in `docs/`. The 31 legacy MDX lessons and the quiz fixture now live in `content/curriculum/` (`modules/` + `quiz-questions.json`), and `scripts/import-amph-content.ts` reads from that repo-relative path. This legacy content still describes a different product (AdCraft, AI Mentor, three simulations) — see the P0 findings in `docs/CONTENT-AUDIT-2026-07-16.md` — and must be rewritten to match v2 before the next content release ships.

Key content docs:
- `docs/CONTENT-AUDIT-2026-07-16.md` — content audit: critical P0/P1 issues, release plan.
- `docs/CURRICULUM-REDESIGN.md` — target 3-course model, module map, assessments, production order.
- `docs/VIDEO-EXPLAINER-SCRIPTS.md` — 8 short video explainer scripts for the Foundations launch.
- `docs/0-1-welcome-to-amph.md` — Module 0 lesson 1 (welcome / work loop).
- `docs/1-1-read-ppc-data-before-you-change-it.md` — Module 1 lesson 1 (Big Six metrics decision lesson).

When writing or importing lessons, follow the lesson-production standard in `docs/CURRICULUM-REDESIGN.md` and the voice rules in `docs/voice-guide.md`.

## Commands