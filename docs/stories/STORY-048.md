# STORY-048: Sentry setup

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability
**Status:** ✅ Shipped 2026-07-13 (commit 82d181f)

## Description

Instrument Project Amazon PH Academy with Sentry across client, server, and edge runtimes.

## Acceptance Criteria

- [x] `@sentry/nextjs` added with DSN from env.
- [x] Client, server, and edge configs initialized.
- [x] Source maps uploaded in Vercel production builds.
- [x] Release tracking tied to git SHA + deploy preview.
- [x] `SENTRY_DSN` checked at startup; missing DSN logs warning and noops.
- [x] No secrets committed; DSN is the only required env var for minimal setup.

## Files Shipped

- `src/lib/sentry-shared.ts` — shared init + noop guard (`isSentryEnabled`)
- `src/lib/sentry.ts` — server runtime helper
- `sentry.client.config.ts` — browser init (`@sentry/nextjs` `init()` with tracesSampleRate)
- `sentry.server.config.ts` — Node runtime init
- `sentry.edge.config.ts` — Edge runtime init (middleware)
- `package.json` — `@sentry/nextjs@^9` dependency
- `.env.example` — `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG=projectamazonph`, `SENTRY_PROJECT=amph-v2`, `SENTRY_HOST`,
  `SENTRY_API_TOKEN`

## Verification

1. Trigger a client error in `/dashboard` — appears in Sentry within 60s.
2. Trigger a server action error — appears with stack trace and user context.
3. Trigger an edge middleware error — appears under edge runtime namespace.
4. Verify source maps map minified code to original TS.

## Notes

- `@sentry/nextjs@^9` auto-detects `sentry.{client,server,edge}.config.ts` so the
  CHANGELOG reference to `instrumentation.ts` is stale. No action required.
- When `SENTRY_DSN` is empty, `init()` is skipped and `captureException` is a noop
  (via `sentry-shared.ts`). Local dev without DSN still works.
