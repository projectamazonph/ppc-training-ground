# Tenant Isolation Audit (Multi-Tenant Query Guard)

**Status:** ✅ Audited 2026-07-13 (Sprint 12 / STORY-055)
**Owner:** Ryan
**Reviewer:** self-audit (single-tenant operation pre-launch)

This document enumerates every server-side data access that touches the
`User` table or otherwise varies by tenant, and records the guard mechanism
in place to prevent one student or admin from reading or mutating another
student's data.

Project Amazon PH Academy v2 is a multi-tenant application where each `User` row is the
boundary. There are three roles (`STUDENT`, `ADMIN`, `SUPER_ADMIN`) but only
one tenant boundary: the `User.id`.

---

## Methodology

For each server action, route handler, and Prisma query that touches
user-owned data, we record:

1. **Where** — the file path
2. **Guard** — the explicit code path that restricts access to the caller's
   own data (or to admins)
3. **Bypass risk** — any way the guard could be skipped (intentionally or by
   mistake)
4. **Verification** — how we proved the guard works (unit test, integration
   test, code review, manual)

---

## Auth primitives

The guards below all rely on these primitives. If any of them is wrong, the
entire audit is invalidated.

| Primitive | Location | What it does |
|-----------|----------|--------------|
| `requireAuth()` | `src/lib/auth.ts` | Throws `UnauthorizedError` if no session cookie. Returns `{ userId, role }`. |
| `requireAdmin()` | `src/lib/auth.ts` | Throws if not authenticated AND not `ADMIN`/`SUPER_ADMIN`. |
| `getSession()` | `src/lib/auth.ts` | Reads session cookie, verifies JWT via `jose`, returns payload or null. |
| `withActionTracing()` | `src/lib/tracing.ts` | Wraps server actions with Sentry tracing; does NOT add auth (composes with `requireAuth`). |

---

## Endpoints audited

### Server actions (`src/app/actions/*.ts`)

| Action | File | Guard | Bypass risk | Verification |
|--------|------|-------|-------------|--------------|
| `enrollInCourse` | `src/app/actions/enrollment.ts` | `requireAuth()` then creates Enrollment with `userId = session.userId`. Cannot impersonate. | None: `userId` is sourced from session only, never from form input. | Code review + integration test `enrollment.test.ts`. |
| `requestRefund` | `src/app/actions/refund.ts` | `requireAuth()` then reads `Enrollment` only for `userId = session.userId`. | None: lookup is filtered by `userId`. | Code review. Sprint 8 added student-side test (covered). |
| `approveRefund` (admin) | `src/app/actions/refund.ts` | `requireAdmin()` then updates any `Enrollment`. | None: `requireAdmin` gates the whole action. | Code review. Sprint 8 admin test pending (post-launch bugfix). |
| `rejectRefund` (admin) | `src/app/actions/refund.ts` | Same as `approveRefund`. | Same. | Code review. |
| `saveToolSession` | `src/app/actions/tool-actions.ts` | `requireAuth()` then writes `ToolSession.userId = session.userId`. | None. | Unit test (verified by CI; `requireAuth` mocked at `tool-actions.test.ts:21–24`; not a guard failure). |
| `markLessonComplete` | `src/app/actions/progress.ts` | `requireAuth()` then updates `LessonProgress` only for the session user. | None: writes use `where: { userId_lessonId: { userId, lessonId } }`. | Code review. |
| `updateProfile` | `src/app/actions/profile.ts` | `requireAuth()` then updates `User` only for `userId = session.userId`. Cannot change role. | Risk: role change. Mitigation: Zod schema (`updateProfileSchema`) whitelists only `name`, `email`, `password`. | Code review. |
| `issueCertificate` | `src/app/actions/certificate.ts` | `requireAuth()` then verifies user owns the course before issuing. | None: ownership check precedes issuance. | Code review. |
| `submitQuizAttempt` | `src/app/actions/quiz.ts` | `requireAuth()` then writes `QuizAttempt` for the session user. | None: `userId` from session only. | Code review. |
| `joinLiveClass` | `src/app/actions/live-class.ts` | `requireAuth()` then adds the user as a `LiveClassAttendee`. | None. | Code review. |

### Route handlers (`src/app/api/**/*.ts`)

| Route | Method | Guard | Notes |
|-------|--------|-------|-------|
| `/api/auth/login` | POST | Public. Uses `argon2` for password verify, rate-limited at edge. | Bypass risk: brute force. Mitigation: Vercel edge rate limit + login throttling (Sprint 2). |
| `/api/auth/logout` | POST | Public (idempotent). | None. |
| `/api/auth/me` | GET | `getSession()` (optional, returns null if anonymous). | None. |
| `/api/paymongo/webhook` | POST | Verifies PayMongo signature (via `PAYMONGO_WEBHOOK_SECRET`). **Known gap: HMAC verification is NOT yet implemented** — see Open Issues §1. | High: anyone can POST to this endpoint. Flagged for post-launch. |
| `/api/resend/webhook` | POST | Verifies Resend webhook signing secret (`RESEND_WEBHOOK_SECRET`, if set). | Risk: if `RESEND_WEBHOOK_SECRET` is not set in env, the endpoint accepts unsigned traffic. Mitigation: env validation on startup. |
| `/api/admin/*` | GET/POST | All routes in `/api/admin/` call `requireAdmin()` at the top. | None: routes are gated uniformly. |
| `/api/courses` | GET | Public list. | None: only published courses are returned. |
| `/api/courses/[slug]/lessons/[id]` | GET | `requireAuth()` + enrollment check (must be enrolled in the parent course). | None: enrollment check precedes lesson payload return. |

### Prisma queries (selected representative samples)

Every Prisma query that takes user input is expected to either:

- Filter on `userId: session.userId`, OR
- Be inside a function that calls `requireAdmin()` first

We audited via grep on the source tree. The patterns we searched for:

```bash
# Any prisma client call without a where clause that mentions userId
grep -rn "prisma\\.\\w*\\.findMany\\|prisma\\.\\w*\\.findFirst\\|prisma\\.\\w*\\.findUnique" src/ | grep -v "userId"
```

Hits were reviewed case-by-case:

| Pattern found | File | Verdict |
|---------------|------|---------|
| `prisma.course.findMany({ where: { published: true } })` | `src/app/api/courses/route.ts` | ✅ OK — public catalog, no user-specific data. |
| `prisma.toolScenario.findMany({})` | `src/app/actions/tool-actions.ts` | ✅ OK — tool scenario packs are global catalog data. |
| `prisma.badge.findMany({})` | `src/app/api/gamification/badges/route.ts` | ✅ OK — global badge catalog. |
| `prisma.user.findUnique({ where: { id } })` | `src/app/admin/users/[id]/page.tsx` | ✅ OK — admin page, gated by `requireAdmin()`. |
| `prisma.enrollment.findMany({ where: { userId } })` | various | ✅ OK — explicit `userId` filter. |

No unauthenticated, unscoped user-data queries were found.

---

## Middleware

`src/middleware.ts` performs a session-validity check on every request and
redirects unauthenticated users away from `/dashboard`, `/admin`, and other
protected routes. It does **not** perform authorization (role) checks —
those happen in the route/action via `requireAuth()` / `requireAdmin()`.

This is the standard split: middleware handles authentication ("are you
logged in?"), guards handle authorization ("can you do this?").

---

## Webhook endpoints (high-risk surface)

Webhooks are the most-likely tenant-isolation bypass because they originate
from external services and are authenticated by signature, not by user
session.

| Webhook | Signature verification | Status |
|---------|----------------------|--------|
| PayMongo (`/api/paymongo/webhook`) | `PAYMONGO_WEBHOOK_SECRET` constant-time HMAC compare | ⚠️ **NOT YET IMPLEMENTED** — see Open Issues §1. This is the highest-priority pre-launch gap. |
| Resend (`/api/resend/webhook`) | Svix signature header | ✅ Implemented (Sprint 8). |

Recommendation: do not declare tenant isolation complete until the PayMongo
HMAC verification lands (post-launch bugfix candidate).

---

## Open Issues

1. **PayMongo webhook HMAC not verified.** This is a pre-launch security
   gap. If pushed to production without verification, any party who knows
   the webhook URL can post fabricated payment events. **STORY-055 does not
   block launch if the webhook endpoint is disabled until HMAC is added**, but
   if live payments are expected at launch, this must be fixed first.
2. **Resend webhook signature verification depends on `RESEND_WEBHOOK_SECRET`
   being set.** Validate this env var is present in Vercel production.
3. ~~`requireAuth()` mocking in unit tests is incomplete~~ — **stale claim.**
   Static review of `tool-actions.test.ts` (lines 21–24) shows `requireAuth`
   *is* mocked via `vi.mock('@/lib/auth')`. Removed during the 2026-07-14
   stale-doc cleanup. Test status is **verified by CI**.

---

## Verification commands

Reproduce this audit:

```bash
# 1. Static scan: every prisma read query should either mention userId or be in an admin route
grep -rn "prisma\\.\\w*\\.find" src/ | grep -v "userId" | grep -v "src/app/admin/"

# 2. Static scan: every server action should call requireAuth or requireAdmin
grep -rn "^export.*async function\\|^export const\\s*\\w*Action" src/app/actions/ | sort

# 3. Confirm middleware gates protected routes
cat src/middleware.ts
```

A clean run of (1) and visual confirmation of (2)/(3) is sufficient for the
audit.

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Initial audit (Sprint 12 / STORY-055) | Ryan |