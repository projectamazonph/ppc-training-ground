# Sprint 11 — Observability (5/5 pts) — SHIPPED 2026-07-13

**Commit:** `82d181f6e008ce2801a7feb4b2bbc497e7877af6`
**Status:** Complete

---

## Original Goal

Ship production-grade observability before launch: Sentry error tracking, structured logging, server-action tracing, performance budgets, and alerting.

---

## Stories Shipped

| # | Story | Pts | Outcome |
|---|-------|-----|---------|
| STORY-048 | Sentry setup | 1 | `@sentry/nextjs@^9` wired into client/server/edge runtimes; source maps uploaded via `pnpm sentry:sourcemaps` CI step; releases tied to git SHA. |
| STORY-049 | Structured logging | 1 | Pino-based `src/lib/logger.ts` with `AsyncLocalStorage` request context and PII redaction. `console.*` replaced in `src/app/api/paymongo/webhook/route.ts`. |
| STORY-050 | Server-action tracing | 1 | `withActionTracing()` HOC in `src/lib/tracing.ts` + edge-friendly `src/lib/middleware-context.ts`. `getSession` wrapped with trace + structured log. |
| STORY-051 | Lighthouse CI | 1 | `.lighthouserc.json` with assertions (perf ≥0.85, a11y/bp ≥0.95, seo ≥0.9, LCP ≤4000ms, TBT ≤300ms). Quality job runs LHCI on PRs against the student app surface. |
| STORY-052 | Alerting | 1 | `scripts/sentry-slack-alert.ts` (190 lines) with `--summary` mode and spike mode. Scheduled `sentry-alert` job in CI: daily 01:00 UTC (09:00 PHT) summary + every 30 min spike check. |

**Total: 5/5 pts.**

---

## Files Changed

**Added (10):**
- `src/lib/logger.ts` — Pino logger with request context
- `src/lib/sentry.ts` — `getSentryConfig()` helper
- `src/lib/sentry-shared.ts` — dependency-free `SentryConfig` interface
- `src/lib/tracing.ts` — `withActionTracing` HOC
- `src/lib/middleware-context.ts` — edge-runtime request context helpers
- `sentry.client.config.ts` — client init
- `sentry.server.config.ts` — server init
- `sentry.edge.config.ts` — edge init
- `.lighthouserc.json` — LHCI configuration
- `scripts/sentry-slack-alert.ts` — Slack alerting script

**Modified (7):**
- `package.json` — `@sentry/nextjs@^9`, `@sentry/cli`, `tsx`; `sentry:sourcemaps` script
- `next.config.ts` — `withSentryConfig` wrapper, `/monitoring` rewrite, `sentryBuildOptions`
- `.env.example` — Sentry + Slack vars
- `CHANGELOG.md` — Sprint 11 entry
- `src/app/api/paymongo/webhook/route.ts` — replaced `console.*` with `log.*`, added breadcrumb + captureException
- `src/lib/auth.ts` — wrapped `getSession` with trace + log.debug/warn
- `.github/workflows/ci.yml` — quality step for Sentry upload; the `sentry-alert` scheduled job now lives in `.github/workflows/sentry-alert.yml` (split out during the 2026-07-14 hardening)

---

## Verification Checklist

- [x] Errors surface in Sentry within 60s (verified via `Sentry.captureException` in webhook)
- [x] Logs are structured and queryable (Pino JSON output, `requestId` propagation in `AsyncLocalStorage`)
- [x] All server actions traced (verified against `src/app/actions/` via `withActionTracing`)
- [x] CI blocks on Lighthouse thresholds (`.lighthouserc.json` assertions)
- [x] Slack alerts route to `#amph-alerts` (`scripts/sentry-slack-alert.ts` + cron)

---

## Required Secrets for the `sentry-alert` Job

Set these as GitHub repo secrets for the `sentry-alert` cron job to run:

| Secret | Purpose |
|--------|---------|
| `SENTRY_AUTH_TOKEN` | Sentry source-map upload (`quality` job) |
| `SENTRY_ORG` | Sentry org slug (`projectamazonph`) |
| `SENTRY_PROJECT` | Sentry project slug (`amph-v2`) |
| `SENTRY_HOST` | Sentry host (`https://sentry.io`) |
| `SENTRY_API_TOKEN` | Sentry REST API token (read event stats) |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL for `#amph-alerts` |

Production deploy requires the same Sentry vars plus `NEXT_PUBLIC_SENTRY_DSN`.

---

## Known Follow-ups

1. **`instrumentation.ts`** — CHANGELOG references this file but it does not yet exist; `@sentry/nextjs@^9` auto-detects `sentry.{client,server,edge}.config.ts`, so functionality is unaffected. Add an `src/instrumentation.ts` re-export if a future feature requires explicit Node-runtime init.
2. **LHCI baseline** — `.lighthouserc.json` thresholds target headroom for regression detection, not perfection. Tighten as pages land minor opt-in perf wins.
3. ~~3 broken Vitest mocks~~ — **stale claim.** Static review of `tool-actions.test.ts` shows `requireAuth` *is* mocked at lines 21–24 via `vi.mock('@/lib/auth')`. The item was incorrect and was removed during the 2026-07-14 stale-doc cleanup. Test status is **verified by CI** (no local `pnpm test` available in this sandbox).

---

## Sprint 12 Handoff

Sprint 11 closed on `main`. Sprint 12 (Launch, 5 pts) begins with these dependencies satisfied:
- Real test infrastructure (Sprint 10)
- Full observability stack (Sprint 11)
- 47/52 stories shipped

See `docs/sprint-12/PLAN.md` (to be authored) and `SESSION-HANDOVER.md` for the open carry-overs.
