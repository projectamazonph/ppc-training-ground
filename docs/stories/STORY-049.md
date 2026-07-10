# STORY-049: Structured logging

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability

## Description

Replace ad-hoc `console.log` with Pino structured logging and propagate request IDs across async boundaries.

## Acceptance Criteria

- [ ] `pino` + `pino-pretty` added for dev; JSON output in production.
- [ ] `src/lib/logger.ts` exports `logger` with child-request context helper.
- [ ] Request ID generated at edge/middleware, attached to `log`.
- [ ] All `console.log` removed from `src/` except build scripts.
- [ ] Log levels respected: `debug` in dev, `info`+ in prod.
- [ ] No PII in logs by default.

## Verification

1. Hit an API route in dev — logs show structured JSON with `requestId`.
2. Hit same route in prod mode — logs are single-line JSON.
3. Grep `console.log` across `src/` — zero matches except scripts.
