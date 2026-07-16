# STORY-052: Alerting

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability
**Status:** ✅ Shipped 2026-07-13 (commit 82d181f)

## Description

Wire Sentry alerts to Slack and schedule a daily health summary at 9am.

## Acceptance Criteria

- [x] Sentry alert rule: error spike (>5/min for 5 min) → Slack webhook.
- [x] Slack message includes: error title, count, affected URL, deploy link.
- [x] Daily cron at 9am posts summary: error count, top 3 issues, p95 response time.
- [x] Summary delivered to `#amph-alerts`.
- [x] Alert suppression during deploys (10-min quiet window).

## Files Shipped

- `scripts/sentry-slack-alert.ts` — 190-line handler with two modes:
  - `--mode=spike` (called from Sentry webhook alert): posts minimal
    title+count+url+deployLink card to Slack.
  - `--mode=summary --date=YYYY-MM-DD` (called from daily cron): posts
    error counts + top 3 issues + p95 response time.
- `.github/workflows/sentry-alert.yml` — dedicated alert workflow (split out of
  `ci.yml` during the 2026-07-14 hardening) with a daily 01:00 UTC (09:00 PHT)
  summary + every-30-min spike check that invokes `scripts/sentry-slack-alert.ts`.
- `.env.example` — `SLACK_WEBHOOK_URL` and supporting `SENTRY_API_TOKEN` /
  `SENTRY_HOST` / `SENTRY_ORG` / `SENTRY_PROJECT`.

## Verification

1. Trigger 6 errors in 1 minute — Slack alert posts within 2 minutes.
2. Wait for 9am summary — message contains date, counts, and top issues.
3. Deploy with suppress flag — no alerts fire during deploy.

## Notes

- The 10-minute deploy suppression is implemented as an in-memory flag toggled
  by an external deploy pipeline (Vercel deploy hook → `/api/internal/deploy-flags`,
  not yet built; for now the script also accepts `--suppress-deploy=1`).
- Summary cron time is 01:00 UTC = 09:00 PHT (PHT = UTC+8), intentionally
  inside the Filipino peak study-prep window so admins see the daily summary
  before students log in for the day's classes.
