# STORY-046: Playwright E2E — Critical Path

**Sprint:** 10
**Points:** 1
**Epic:** Testing

## Goal

End-to-end test of the core student journey: signup → enroll → lesson → quiz. Verifies the full flow works in a real browser against the running app.

## Why

Unit tests verify logic in isolation. E2E tests verify the actual user experience — that the pages render, forms submit, navigation works, and data persists across requests.

## Acceptance Criteria

- [ ] Playwright test file at `tests/e2e/critical-path.spec.ts`
- [ ] Test covers: signup → pricing page → checkout → enrollment confirmation → course list → lesson → quiz → results
- [ ] `pnpm test:e2e` passes against local dev server
- [ ] Test uses test fixtures (seed data) not production data
- [ ] Screenshots on failure (Playwright default)
- [ ] Runs on Chromium only (no multi-browser needed)

## Files to Create

- `tests/e2e/critical-path.spec.ts`
- `tests/fixtures/seed.ts` (optional — test data setup)

## Files to Read

- `playwright.config.ts` (from STORY-043)
- `src/app/(public)/auth/signup/page.tsx` — signup form structure
- `src/app/(public)/pricing/page.tsx` — pricing cards
- `src/app/(dashboard)/dashboard/page.tsx` — post-login landing
- `src/app/(dashboard)/courses/[courseSlug]/page.tsx` — course detail
- `src/app/(dashboard)/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx` — lesson view

## Test Flow

```
1. Navigate to /auth/signup
2. Fill signup form (test user)
3. Submit → redirect to /dashboard
4. Navigate to /pricing
5. Click a pricing tier → redirect to checkout
6. (Mock PayMongo — skip actual payment in E2E)
7. Navigate to /dashboard/courses/ppc-foundations
8. Click first lesson → lesson page renders
9. Mark lesson complete
10. Navigate to quiz → answer questions → submit
11. Results page shows pass/fail
```

## Verification

```bash
pnpm test:e2e 2>&1 | tail -20
# All tests pass, screenshots in test-results/ on failure
```

## Pitfalls

- PayMongo checkout requires real payment — mock or use test mode in E2E
- Dev server must be running before Playwright starts — `playwright.config.ts` webServer handles this
- Signup may require email verification — either disable in test env or use a test bypass
- Test user email must be unique per run — use `Date.now()` suffix
