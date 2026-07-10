# STORY-051: Lighthouse CI

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability

## Description

Add Lighthouse CI to enforce performance and accessibility budgets on student-facing pages on every PR.

## Acceptance Criteria

- [ ] `@lhci/cli` installed and configured.
- [ ] `lighthouserc.js` targets: performance ≥90, accessibility ≥95, best-practices ≥90, SEO ≥90.
- [ ] CI job runs on PR against `/dashboard`, `/courses/*`, `/tools/*`, `/pricing`, `/`.
- [ ] CI fails when budget breached.
- [ ] Results uploaded as artifact.

## Verification

1. Open a PR with a performance regression — CI fails with Lighthouse diff.
2. Open a PR with no regression — CI passes and artifact is available.
