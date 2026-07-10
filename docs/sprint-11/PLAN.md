# Sprint 11: Observability (5/5 pts)

**Goal:** Ship production-grade observability before launch: Sentry error tracking, structured logging, server-action tracing, performance budgets, and alerting.

| Story | Pts | Description |
|-------|-----|-------------|
| STORY-048: Sentry setup | 1 | Client, server, edge configs. Source maps. Release tracking. |
| STORY-049: Structured logging | 1 | Pino. Request ID propagation. Replace `console.log`. |
| STORY-050: Server action tracing | 1 | Wrap actions in Sentry transactions. |
| STORY-051: Lighthouse CI | 1 | Performance budgets enforced in CI. |
| STORY-052: Alerting | 1 | Slack alerts on Sentry error spike. Daily summary at 9am. |

**Done when:** Errors surface in Sentry within 60s, logs are structured and queryable, every server action is traced, CI blocks on Lighthouse thresholds, and alerts route to Slack.
