# Pre-Launch Security Audit — 2026-07-13

**Status:** ✅ Audit complete (Sprint 12 / STORY-055)
**Method:** automated + manual review
**Reviewer:** Ryan (self-audit; pre-launch single-operator)

This document records the results of the pre-launch security audit run
against `main` at commit `4911b19b` (the Sprint 11 close), then re-run
against the current `main` after STORY-053 / STORY-054 commits.

---

## 1. Dependency audit (`npm audit --audit-level=high`)

**Tool:** `npm audit --audit-level=high`
**Result:** see `npm-audit-2026-07-13.json` (CI artifact, attached to the
GitHub Actions run that produces it). Reproduce locally with:

```bash
npm ci
npm audit --audit-level=high --json > npm-audit-2026-07-13.json
```

**Expected outcome for STORY-055 acceptance:** zero high/critical findings.

**As of this commit (2026-07-13):** zero high/critical findings.
(Dependencies pinned in Sprints 1–11: `@prisma/client@^5.22.0`, `next@^16`,
`@sentry/nextjs@^9`, `jose@^5.9.6`, `pino@^9.5.0`, `zod@^3.23.8`. No known
advisories at audit time.)

> If you re-run `npm audit` and it reports high/critical findings, **block
> the deploy** and triage each finding. The audit is part of the CI gate and
> the deploy runbook's pre-flight checklist.

---

## 2. Secret scan (`gitleaks`)

**Tool:** `gitleaks detect --source . --redact --no-banner` (or via
`gitleaks/gitleaks-action` in CI — already wired in `.github/workflows/ci.yml`).

**Result:** clean. No secrets in history.

**How we keep it clean going forward:**

- `.env.example` contains only placeholder values; no real keys.
- All Sprint 11 secret additions are documented in `.env.example` with
  placeholder values like `sntrys_...`.
- The `sentry-slack-alert.ts` script reads its token from
  `SENTRY_API_TOKEN` env var, never a hardcoded value.
- `JWT_SECRET` is generated at runtime via `scripts/gen-jwt-secret.ts`,
  not committed.

---

## 3. Security headers (`next.config.ts`)

**Tool:** `curl -I <url>` on each route in the smoke-test script.

**Headers expected (configured in `next.config.ts`):**

| Header | Expected value |
|--------|---------------|
| `X-DNS-Prefetch-Control` | `off` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

**Forbidden header:**

| Header | Expected |
|--------|----------|
| `X-Powered-By` | absent (`poweredByHeader: false` in config) |

**Verification:** STORY-053's `scripts/smoke-prod.sh` asserts all 7 of the
above against `/`, `/pricing`, `/courses`, `/dashboard`. The script returns
exit 1 if any header is missing, mismatched, or if `X-Powered-By` leaks.

> **Note:** `Content-Security-Policy` is **not** configured in
> `next.config.ts`. Sprint 12 STORY-055 acceptance in the PLAN asks to verify
> CSP. We deliberately defer CSP to a post-launch story because (a) the
> Sentry tunnel rewrite `/monitoring` and the Resend image URLs need careful
> `img-src` and `connect-src` allow-listing that we have not yet finalized,
> and (b) the existing 5 headers are already a strong baseline.
> Tracked as **post-launch candidate #S13-001**.

---

## 4. Multi-tenant query audit

See [`tenant-isolation.md`](./tenant-isolation.md) for the full endpoint-by-endpoint audit.

**Summary:**

- 10 server actions audited, 10 guarded, 0 unguarded.
- 8 route handlers audited, 7 guarded, 1 known gap (PayMongo HMAC).
- Prisma query grep scan: all hits reviewed, no unscoped user-data access.
- Middleware: session check only; auth/role checks delegated to actions.
- Webhooks: Resend verified; PayMongo **NOT** verified (post-launch fix).

---

## 5. Authentication / Authorization primitives

Verified by reading `src/lib/auth.ts`:

- ✅ `getSession()` reads the `amph_session` cookie, verifies via `jose`,
  returns `{ userId, role, exp }` or null.
- ✅ `requireAuth()` throws if no session; returns the payload otherwise.
- ✅ `requireAdmin()` throws if not in role ADMIN/SUPER_ADMIN.
- ✅ `withActionTracing()` wraps actions for Sentry tracing; does NOT
  substitute for `requireAuth` (composition is explicit at every call site).

---

## 6. Open issues (must be tracked)

> **2026-07-15 update:** issue #1 below is **stale** — PayMongo HMAC
> verification IS implemented in `src/lib/webhook-signature.ts` (raw body,
> timing-safe compare) and wired in the webhook route. Superseded by
> [`code-audit-2026-07-15.md`](./code-audit-2026-07-15.md), which found
> different launch blockers.

| # | Issue | Severity | Blocks launch? |
|---|-------|----------|----------------|
| 1 | ~~PayMongo webhook HMAC not verified~~ — **stale**, verified implemented 2026-07-15 | High | ~~Conditional~~ No |
| 2 | CSP header missing | Medium | No (defer to S13) |
| 3 | Resend webhook `RESEND_WEBHOOK_SECRET` env var must be set in Vercel prod | Medium | Conditional — block if unset |
| 4 | ~~3 broken Vitest mocks~~ — **stale claim** (removed 2026-07-14; `requireAuth` *is* mocked at `tool-actions.test.ts:21–24`). Test status **verified by CI**. | Low | No (post-launch bugfix) |
| 5 | Pre-existing TS7006 errors in admin/course pages | Low | No (out of scope) |

---

## 7. Sign-off

This audit is complete. The only blocker-class issue is #1 (PayMongo HMAC).
If live payments are scheduled for launch day, fix #1 first; otherwise it
becomes the first post-launch bugfix.

— Ryan, 2026-07-13