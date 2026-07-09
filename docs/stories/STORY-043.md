# STORY-043: CI Environment Fix + Playwright Config

**Sprint:** 10
**Points:** 1
**Epic:** Infrastructure

## Goal

Fix the CI pipeline so it actually runs against this codebase, and add Playwright configuration for E2E testing.

## Why First

CI is currently broken — it provisions a PostgreSQL service but the project uses SQLite. No tests can be validated in CI until this is fixed. Playwright has no config file, so `pnpm test:e2e` fails.

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` — PostgreSQL service removed entirely
- [ ] CI uses SQLite in-memory for Prisma (`DATABASE_URL="file:memory:"` or `file:./test.db`)
- [ ] `DATABASE_URL` env var in CI points to SQLite, not PostgreSQL
- [ ] `playwright.config.ts` exists at project root with:
  - `baseURL: 'http://localhost:3000'`
  - Chromium-only (no Firefox/Safari needed at this stage)
  - Web server: `pnpm dev` with `url` check
  - Timeout: 30s per test
  - Retries: 1 on CI
  - Reporter: `html` (local) + `list` (CI)
- [ ] `pnpm test:e2e` does not error on missing config

## Files to Touch

- `.github/workflows/ci.yml` — remove postgres service, fix DATABASE_URL
- `playwright.config.ts` — new file

## Verification

```bash
# CI config validated
cat .github/workflows/ci.yml | grep -c postgres  # should be 0

# Playwright config exists and is valid
npx playwright test --list 2>&1 | head -5

# Full CI dry-run (local)
pnpm test && pnpm lint && pnpm typecheck
```

## Pitfalls

- CI DATABASE_URL must use `file:./test.db` not `file:memory:` — Prisma SQLite in-memory needs `?connection_limit=1` and doesn't work well with migrations in CI
- `playwright.config.ts` `baseURL` must match what `pnpm dev` serves (port 3000)
- Don't remove the `gitleaks` step — it's already working
