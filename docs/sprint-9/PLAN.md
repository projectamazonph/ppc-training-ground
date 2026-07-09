# Sprint 9 — Polish + Mobile-First Refactor

**Date:** 2026-07-12 (Sprint 8 closed 2026-07-11, commit `1414754`)
**Sprint:** 9 of 12
**Status:** Planned

---

## Sprint Goal

Replace the visual reset and add mobile-first responsiveness across the entire student-facing surface. Every page must render correctly at 390px (iPhone) and at 1280px (laptop) using Field Manual tokens, CSS Modules (no Tailwind), and no breakpoints past 1280px. Prerequisite for Sprint 10 (tests at both viewports) and Sprint 12 (mobile Lighthouse perf budget).

## Why now

Sprints 1–8 shipped backend, curriculum, payments, admin, refunds, and email. The visual layer is functional but inconsistently token-driven — per-component CSS Modules with no shared responsive system. AMPH's audience is overwhelmingly mobile (Filipino VAs on phones between gigs). Sprint 9 closes that gap.

## Capacity & Velocity Context

| Sprint | Points | Story pattern |
|---|---|---|
| S1 | 6 | Greenfield scaffold |
| S2 | 6 | 5 engines |
| S3 | 6 | Content + curriculum |
| S4 | 4.5 | 5 tool UIs |
| S5 | 3.5 | Gamification |
| S6 | 4 | Payments |
| S7 | 4 | Admin (4 × 1pt) |
| S8 | 4 | Email (4 × 1pt) |
| **S9** | **5** | Polish + Mobile (5 × 1pt) |

Recent trend: 4 × 1pt stories per sprint. Sprint 9 adds 1 buffer point because mobile-first refactor spans 12 pages.

---

## Stories (5 × 1pt = 5pts)

| ID | Title | Epic |
|---|---|---|
| STORY-038 | Design-system audit + Tailwind purge pass | Polish |
| STORY-039 | Responsive breakpoint infrastructure + design tokens module | Mobile |
| STORY-040 | Mobile BottomNav shared component for student app | Mobile |
| STORY-041 | Marketing + auth cluster: mobile-first refactor | Mobile |
| STORY-042 | Student app shell + course flow + tools index: mobile-first refactor | Mobile |

### Dependency graph

```
STORY-038 ──→ STORY-039 ──→ STORY-040 ──→ STORY-041
                                  └──────→ STORY-042
```

- **STORY-038** must land first: it identifies which existing components carry leaked patterns the new system must replace.
- **STORY-039** establishes the tokens module + helper classes every subsequent story consumes.
- **STORY-040** is the shared component the dashboard/course/tools flows all consume.
- **STORY-041** and **STORY-042** are independent clusters — can ship in parallel.

---

## Out of Scope (deferred to later sprints)

- **Admin mobile-first refactor** — Admin stays desktop-first. Ryan uses a laptop. Sprint 9 only ensures admin tables collapse to cards on narrow viewports via `.table-mobile` from STORY-039.
- **Tool interactive UIs on mobile** — Campaign Builder, Bid Elevator, STR Triage, Keyword Research, Listing Audit get responsive collapse this sprint. Full mobile stepper/swipe patterns are Sprint 10 work when tests are wired.
- **Lighthouse perf budget enforcement** — Sprint 12.
- **Visual regression snapshots** — Sprint 10.

---

## Definition of Done (Sprint 9)

- [ ] All 5 stories in `bmad/sprint-status.yaml` marked `completed`
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0 (with new rules from STORY-038 active)
- [ ] `pnpm build` exits 0
- [ ] Manual smoke test: every student page renders correctly at 390px in Chrome DevTools
- [ ] Manual smoke test: same pages render correctly at 1280px without layout regression
- [ ] BottomNav screenshots attached to PRs
- [ ] `docs/sprint-plan.md` updated with Sprint 9 row
- [ ] `README.md` Status table reflects Sprint 9 completion
- [ ] `SESSION-HANDOVER.md` updated with Sprint 9 closing notes + Sprint 10 order of operations
- [ ] Memoria T1 semantic memory stored
- [ ] Git commit on `main` with SHA recorded in SESSION-HANDOVER

---

## Sprint 10 Order of Operations (Handoff Preview)

1. `pnpm typecheck` — confirm Sprint 9 left a clean baseline
2. Wire Vitest + Playwright with 3 viewports: 375×812, 768×1024, 1280×800
3. Write 6 critical-journey E2E tests
4. Add axe accessibility checks
5. Lighthouse CI with mobile-first thresholds (LCP <2.5s)

---

## Commands

```bash
cd "/storage/emulated/0/Hermes Projects/projects/amph-v2"
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```