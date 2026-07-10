# STORY-050: Server action tracing

**Sprint:** 11 — Observability
**Points:** 1
**Epic:** Observability

## Description

Wrap all server actions in Sentry transactions so every mutation, query, and tool session is traced end-to-end.

## Acceptance Criteria

- [ ] `wrapServerAction` helper starts a Sentry transaction per action call.
- [ ] Transaction tagged with action name, userId, and tier.
- [ ] Errors in actions capture transaction context.
- [ ] Tool session actions (`startToolSession`, `submitToolSession`) include scoring metadata in span data.
- [ ] No performance regression beyond 5ms per action.

## Verification

1. Open Sentry performance view — actions appear as transactions.
2. Trigger an action error — transaction linked to exception.
3. Check span duration for a tool session submit — scoring metadata present.
