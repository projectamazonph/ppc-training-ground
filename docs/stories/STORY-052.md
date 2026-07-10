# STORY-052: Alerting

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability

## Description

Wire Sentry alerts to Slack and schedule a daily health summary at 9am.

## Acceptance Criteria

- [ ] Sentry alert rule: error spike (>5/min for 5 min) → Slack webhook.
- [ ] Slack message includes: error title, count, affected URL, deploy link.
- [ ] Daily cron at 9am posts summary: error count, top 3 issues, p95 response time.
- [ ] Summary delivered to `#amph-alerts`.
- [ ] Alert suppression during deploys (10-min quiet window).

## Verification

1. Trigger 6 errors in 1 minute — Slack alert posts within 2 minutes.
2. Wait for 9am summary — message contains date, counts, and top issues.
3. Deploy with suppress flag — no alerts fire during deploy.
