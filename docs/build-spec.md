# Build Spec — Project Amazon PH Academy v2

**Project:** amph-v2
**Repo:** github.com/projectamazonph/amph-v2
**Date:** 2026-07-07
**Owner:** Ryan Roland Dabao
**Status:** Approved

---

## Why Greenfield

The v1 platform at `github.com/projectamazonph/AMPH-Academy` shipped. It works. Students use it. But it accumulated problems that incremental refactor can't fix cleanly:

- AI features (mentor chat, mistake analysis) shipped against the product rule. Removing them is invasive.
- Schema has nullable `orgId` everywhere, legacy `Simulation` tables, no soft-delete, missing indexes on hot paths.
- UI is generic. Glass morphism, indigo accents, no taste direction.
- Admin panel is half-built. Users, Courses, Content, Payments admin don't exist.
- Business layer is implicit. Pricing, payment, refunds, gating don't exist.
- Zero test coverage. Zero observability.

Incremental refactor would touch every file while running on production users. Greenfield is faster, safer, and gives a clean baseline for every ADR.

**Decision:** v1 is frozen at `projectamazonph/AMPH-Academy`. v2 lives at `projectamazonph/amph-v2`. No code carries over. v1 stays online until v2 is feature-complete, then traffic redirects.

---

## What's Different From v1

Same product. Same audience. Same pricing. Same content ownership. Different foundation.

| Concern | v1 | v2 |
|---------|----|----|
| AI features | Yes (mentor, mistake analysis) | **No** (per ADR-003) |
| Design system | Ad-hoc glass morphism | **Field Manual** design system (docs/design-brief.md) |
| Copy | AI-generated tone | **Humanized** voice (docs/voice-guide.md) |
| Admin | Badges + Live Classes only | Full backend (docs/admin-backend.md) |
| Payments | Free, no gating | **PayMongo + tier gating** (docs/business-layer.md) |
| Schema | Ad-hoc, legacy tables | **Clean from day 1** (docs/db-schema.md) |
| Tests | Zero | **70%+ on lib/actions** |
| Observability | Console.log | **Sentry + structured logs** |
| Performance | Untracked | **Lighthouse CI + budgets** |
| Auth | NextAuth.js | **JWT + jose** (ADR-004) |

## What's Carried Over

Content. The course structure, the lesson content, the tool scenarios, the badges, the certificate design. v1's content is the source of truth — it ships in v2's seed data, rewritten where it doesn't match the new voice guide.

Brand identity. Orange #FF6B35, navy #1A1A1E (revised from #1A1A2E in v1), Space Grotesk + JetBrains Mono. Logos from `/root/workspace/branding/icons/concept-2-raw.png` (extracted in v1 design pass).

## Scope of This Build

Build a complete v2 from zero. Eleven sprints. Solo developer. 11 weeks.

Track breakdown:

```
Track 0 — Audit baseline          (1 sprint)
Track 1 — AI removal commitment   (1 sprint, applied throughout)
Track 2 — Design system           (1 sprint, refactor on day 1)
Track 3 — Voice guide             (1 sprint, applied throughout)
Track 4 — Admin backend           (3 sprints)
Track 5 — Business layer          (2 sprints)
Track 6 — DB hardening            (1 sprint, applied throughout)
Track 7 — Quality gates           (2 sprints)
Final   — Launch                  (1 sprint)
```

## Non-Goals

These are explicitly **not** in scope for v2:

- Multi-tenancy (ADR-015). Single-tenant only.
- Recurring subscriptions. One-time purchase per tier.
- Mobile native apps. Responsive web only.
- Multi-language UI (ADR-016). English only with Filipino cultural references in copy.
- Affiliate program. Deferred.
- White-label. Deferred.
- Internationalization beyond PHP. PHP only.

## Risks

**Risk:** Greenfield means rewriting working code.
**Mitigation:** v1 stays online throughout. v2 ships behind feature flag, gets tested with a subset of users, then redirects traffic.

**Risk:** Content quality regresses during migration.
**Mitigation:** Content goes through voice-guide audit before seeding. Every lesson rewritten in the new voice. No copy-paste from v1.

**Risk:** Solo developer burnout over 11 weeks.
**Mitigation:** Sprint slips trigger rescope, not extension. If a sprint ships < 5 points for 3 consecutive sprints, velocity target drops. Sprints are 1 week each with clear ship-or-cut decisions.

**Risk:** PayMongo integration drags.
**Mitigation:** Mock provider interface for Sprint 5 testing. Real PayMongo in Sprint 7. DR Congo PayMongo link as fallback if primary account fails verification.

**Risk:** Performance budgets too aggressive.
**Mitigation:** Lighthouse CI baseline taken in Sprint 0. Budgets set to baseline + 20%, tightened each sprint.

## Success Criteria

| Metric | Target |
|--------|--------|
| AI features in code | 0 |
| Test coverage on `src/lib` | ≥ 70% |
| Test coverage on `src/app/actions` | ≥ 70% |
| Lighthouse Performance | ≥ 85 |
| Lighthouse Accessibility | ≥ 90 |
| Lighthouse Best Practices | ≥ 90 |
| Lighthouse SEO | ≥ 95 |
| Initial route JS bundle | < 150KB gzipped |
| Server action p95 latency | < 500ms |
| ESLint errors | 0 |
| TypeScript errors | 0 |
| Banned AI-slop phrases | 0 |
| Admin routes with RBAC | 100% |
| API routes with Zod validation | 100% |
| AuditLog entries on every admin mutation | 100% |

## Migration from v1

After v2 reaches feature-complete:

1. Export content from v1 DB (lessons, modules, badges, scenarios).
2. Run content through voice-guide audit. Rewrite flagged lessons.
3. Seed v2 with cleaned content.
4. Run both platforms in parallel for 2 weeks. v1 read-only.
5. v1 users contacted with v2 access instructions.
6. v2 gets all traffic. v1 archived.

## Open Questions

- Affiliate program timing — defer to v2.1 or v3.
- Subscription pricing model — defer. One-time only for v2.
- PayMongo primary vs DR Congo fallback — build only if primary proves unreliable.

---

*This spec is the entry point for the v2 build. Each linked doc covers one concern in depth.*