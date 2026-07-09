# STORY-045: Server Action Integration Tests

**Sprint:** 10
**Points:** 1
**Epic:** Testing

## Goal

Write integration tests for server actions — the primary API surface of the app. Uses Vitest with mocked Prisma to test the action pipeline end-to-end (input validation → business logic → DB call → response).

## Why

Server actions handle all mutations: auth, enrollment, tools, admin. They're the most critical code path and currently have zero test coverage.

## Acceptance Criteria

- [ ] Tests exist for key server actions in: `src/app/actions/auth.ts`, `src/app/actions/enrollment.ts`, `src/app/actions/tools.ts`
- [ ] Tests verify: input validation, business logic branches, DB interaction (mocked), error handling
- [ ] `pnpm test` passes with all action tests green
- [ ] No real DB or external API calls — Prisma fully mocked
- [ ] Test files at: `src/app/actions/__tests__/<module>.test.ts`

## Files to Create

- `src/app/actions/__tests__/auth-actions.test.ts
- `src/app/actions/__tests__/enrollment-actions.test.ts
- `src/app/actions/__tests__/tool-actions.test.ts

## Files to Read

- `src/app/actions/auth.ts` — signup, signin, signout server actions
- `src/app/actions/enrollment.ts` — enrollment creation, tier gating
- `src/app/actions/tools.ts` — tool session start/save/submit
- `src/lib/db.ts` — Prisma client instance (mock this)

## Test Strategy

- Mock `@/lib/db` to return controlled Prisma results
- Test each action with: valid input → success, invalid input → validation error, DB error → graceful failure
- For auth actions: mock JWT sign/verify, test cookie setting
- For tool actions: mock `db.toolSession.create/update`, test session lifecycle

## Verification

```bash
pnpm test -- --reporter=verbose 2>&1 | grep -E "actions|PASS|FAIL"
```

## Pitfalls

- Server actions use `'use client'` boundary but are callable from tests via direct import
- `revalidatePath` calls will warn in test env — suppress with `vi.mock('next/cache')`
- Auth actions set cookies via `cookies().set()` — mock `next/headers` cookies helper
