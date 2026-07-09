# STORY-044: Vitest Unit Tests — `src/lib` Core

**Sprint:** 10
**Points:** 1.5
**Epic:** Testing

## Goal

Write unit tests for the core business logic in `src/lib/`. Target ≥70% line coverage on this directory.

## Why

Zero tests exist on auth, validation, tier-gate, enums, format, pricing, and badges. These modules contain the most critical business logic — auth guards, payment validation, tier access control.

## Acceptance Criteria

- [ ] Tests exist for: `auth.ts`, `validation.ts`, `tier-gate.ts`, `enums.ts`, `format.ts`, `pricing.ts`, `badges.ts`
- [ ] `pnpm test:coverage` shows ≥70% line coverage on `src/lib/`
- [ ] All tests pass (`pnpm test` exits 0)
- [ ] No external API calls — all Prisma/HTTP mocked
- [ ] Test files colocated: `src/lib/__tests__/<module>.test.ts`

## Files to Create

- `src/lib/__tests__/auth.test.ts`
- `src/lib/__tests__/validation.test.ts`
- `src/lib/__tests__/tier-gate.test.ts`
- `src/lib/__tests__/enums.test.ts`
- `src/lib/__tests__/format.test.ts`
- `src/lib/__tests__/pricing.test.ts`
- `src/lib/__tests__/badges.test.ts`

## Files to Read (for test design)

- `src/lib/auth.ts` — `requireAdmin()`, `requireTier()`, JWT verify, cookie helpers
- `src/lib/validation.ts` — Zod schemas, input sanitization
- `src/lib/tier-gate.ts` — `evaluateTierAccess()`, enrollment check
- `src/lib/enums.ts` — const objects (tool types, statuses, tiers)
- `src/lib/format.ts` — peso formatting, date formatting, slug generation
- `src/lib/pricing.ts` — tier price lookup, discount calculation
- `src/lib/badges.ts` — `checkAndAwardBadges()`, award logic

## Test Strategy

- **auth.ts:** Mock `jose.jwtVerify`, test `requireAdmin()` returns user or throws, test cookie parse
- **validation.ts:** Test Zod schemas reject invalid input, accept valid input
- **tier-gate.ts:** Mock Prisma enrollment lookup, test access grants/denials
- **enums.ts:** Test const objects have expected keys/values (smoke)
- **format.ts:** Test peso format, date format, slug generation
- **pricing.ts:** Test tier price lookup returns correct values
- **badges.ts:** Mock Prisma, test badge award triggers on threshold

## Verification

```bash
pnpm test:coverage -- --reporter=verbose 2>&1 | tail -30
# Should show src/lib/ at ≥70%
```

## Pitfalls

- `src/lib/auth.ts` uses `jose` for JWT — mock `jose.jwtVerify` not the real crypto
- `tier-gate.ts` imports from `@/lib/db` — mock the db module, don't hit real SQLite
- `badges.ts` calls `db.userBadge.create` — mock to avoid unique constraint errors
