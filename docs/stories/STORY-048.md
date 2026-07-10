# STORY-048: Sentry setup

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability

## Description

Instrument AMPH Academy with Sentry across client, server, and edge runtimes.

## Acceptance Criteria

- [ ] `@sentry/nextjs` added with DSN from env.
- [ ] Client, server, and edge configs initialized.
- [ ] Source maps uploaded in Vercel production builds.
- [ ] Release tracking tied to git SHA + deploy preview.
- [ ] `SENTRY_DSN` checked at startup; missing DSN logs warning and noops.
- [ ] No secrets committed; DSN is the only required env var for minimal setup.

## Verification

1. Trigger a client error in `/dashboard` — appears in Sentry within 60s.
2. Trigger a server action error — appears with stack trace and user context.
3. Trigger an edge middleware error — appears under edge runtime namespace.
4. Verify source maps map minified code to original TS.
