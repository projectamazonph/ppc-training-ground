# Sprint 10 — Test Infrastructure & CI Hardening

**Date:** 2026-07-12
**Sprint:** 10 of 12
**Goal:** Establish real test coverage and fix CI so it actually runs against this codebase.
**Capacity:** 5 stories, ~5 pts (matches S9 velocity)

---

## Context

Sprints 1–9 shipped 42 stories with zero real tests. The existing CI pipeline (`.github/workflows/ci.yml`) is configured for PostgreSQL but the project uses SQLite. Vitest is installed with a config but only a trivial smoke test exists. Playwright is installed but has no config file. The CI references `scripts/check-coverage.js` and `.lighthouserc.json` — neither exists.

This sprint fixes the foundation: make CI work, add real tests, enforce coverage.

---

## Stories

| # | Story | Pts | Why |
|---|-------|-----|-----|
| STORY-043 | CI environment fix + Playwright config | 1 | CI is broken — PostgreSQL service is wrong (project uses SQLite). No `playwright.config.ts`. CI can't run. |
| STORY-044 | Vitest unit tests — `src/lib` core | 1.5 | Zero tests on auth, validation, tier-gate, enums, format, pricing, badges. These are the most critical business logic. |
| STORY-045 | Server action integration tests | 1 | Auth actions, tool session actions, enrollment actions — all untested. Uses Vitest with mocked Prisma. |
| STORY-046 | Playwright E2E — critical path | 1 | Signup → enroll → lesson → quiz. The core student journey has no automated verification. |
| STORY-047 | Coverage enforcement + CI polish | 0.5 | `scripts/check-coverage.js` (referenced by CI but missing), 70% threshold, CI passes clean. |

**Total: 5 pts**

---

## Dependency Graph

```
STORY-043 (CI fix)
    ├── STORY-044 (unit tests) — needs CI passing to validate
    ├── STORY-045 (integration tests) — needs CI passing
    └── STORY-046 (E2E) — needs Playwright config from 043

STORY-047 (coverage enforcement) — last, after all tests exist
```

**Critical path:** 043 → 044/045/046 (parallel) → 047

---

## Out of Scope

- TypeScript `TS7006: implicit 'any'` errors in admin/course pages (pre-existing, not in sprint scope)
- Sentry / observability (Sprint 11)
- Production deploy (Sprint 12)
- Email sending reliability (already best-effort with `.catch(() => {})`)

---

## DoD Checklist

- [ ] `pnpm test` passes (all unit + integration tests green)
- [ ] `pnpm test:e2e` passes (Playwright critical path)
- [ ] `pnpm test:coverage` shows ≥70% line coverage on `src/lib/`
- [ ] CI workflow runs clean on GitHub Actions (no PostgreSQL, SQLite in-memory)
- [ ] `scripts/check-coverage.js` exists and enforces threshold
- [ ] `.github/workflows/ci.yml` — PostgreSQL service removed, replaced with SQLite test setup
- [ ] All commits lint-clean (`pnpm lint` exits 0)

---

## Sprint 11/12 Handoff

After Sprint 10:
- **Sprint 11 (Observability):** Sentry + structured logging + Lighthouse CI. All testable because CI is working.
- **Sprint 12 (Launch):** Deploy + security audit + launch comms. Tests provide confidence gate.
