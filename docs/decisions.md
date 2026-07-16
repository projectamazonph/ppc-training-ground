# Architecture Decision Records — Project Amazon PH Academy v2

**Status:** Active
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

This document collects the ADRs that govern Project Amazon PH Academy's architecture. New ADRs append below. Each follows the [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

---

## ADR-001: Modular Monolith over Microservices

**Status:** Accepted (2026-07-01)
**Context:** Solo developer, early-stage product, unknown scale.
**Decision:** Build as a single Next.js application. All features in one codebase, one deploy.
**Consequences:**
- Easier to develop alone (no service orchestration)
- Cheaper to run (one Vercel deployment, one Postgres)
- Code-level module boundaries enforced by directory structure (`src/app/admin/`, `src/app/(dashboard)/`, `src/lib/`)
- Migration to microservices later is possible but expensive — defer until revenue justifies
- **Revisit when:** Monthly active users > 10,000 OR team > 3 developers.

## ADR-002: PostgreSQL for All Environments

**Status:** Accepted (2026-07-01)
**Context:** Project Amazon PH Academy starts solo with low traffic. Postgres adds hosting cost and operational complexity.
**Decision:** Use PostgreSQL everywhere (dev + production). Consistent environment eliminates provider-specific bugs. CI uses PostgreSQL service container, local dev uses local or remote PostgreSQL.
**Consequences:**
- Schema uses no SQLite-specific features
- Use `prisma migrate dev` for local PostgreSQL, `prisma migrate deploy` for production
- Local seed data is disposable — production data is the source of truth
- Migration path: `provider = "postgresql"` in `schema.prisma` for production deploy
- **Revisit when:** Monthly active users > 1,000 OR concurrent writes > 10/sec.

## ADR-003: Zero External AI Features

**Status:** Accepted (2026-07-07)
**Context:** Product rule: no external AI APIs. Platform must work without AI dependencies.
**Decision:** No `openai`, `anthropic`, `langchain`, or any LLM API in the codebase. All content is human-authored. All scoring is deterministic rule-based code.
**Consequences:**
- No mentor chat, no AI mistake analysis, no AI-generated content
- Cost is fixed regardless of usage
- Predictable latency (no API call delays)
- No hallucination risk
- Static "Common Mistakes" sections replace dynamic AI explanations
- **Revisit when:** Business rule explicitly changes.

## ADR-004: JWT in HttpOnly Cookies for Auth

**Status:** Accepted (2026-07-02)
**Context:** Need stateless auth that works with Next.js middleware and server actions.
**Decision:** JWT signed with `jose`, stored in HttpOnly Secure SameSite=Strict cookie. Refresh token rotation on each request.
**Consequences:**
- No server-side session table needed
- Middleware can verify without DB hit
- Logout requires client-side cookie clear (no server-side invalidation)
- Refresh window: 7 days, absolute timeout: 30 days
- See `SECURITY.md` for token handling details
- **Revisit when:** Need server-side session invalidation (e.g., admin force-logout).

## ADR-005: Server Actions over API Routes for Mutations

**Status:** Accepted (2026-07-02)
**Context:** Next.js App Router supports both. Server actions are simpler for forms and mutations.
**Decision:** Use server actions for all mutations. Reserve API routes for: webhooks (PayMongo), file uploads (large), third-party integrations (Composio).
**Consequences:**
- Less boilerplate (no fetch wrappers)
- Progressive enhancement works automatically
- Type-safe end-to-end
- Cannot be called from external clients (intentional)
- **Revisit when:** Need to expose API to external consumers.

## ADR-006: PayMongo for Payments

**Status:** Accepted (2026-07-07)
**Context:** Project Amazon PH Academy sells in Philippine pesos. Need payment provider that supports PHP, GCash, Maya, and bank transfer with strong DX and reliable webhooks.
**Decision:** PayMongo as primary payment provider. Native PHP support, clean API, strong webhook reliability for Philippine market.
**Consequences:**
- Native PHP support, no conversion fees
- Multiple payment methods (GCash, Maya, GrabPay, card, bank, OTC)
- Sources API for card payments, Payments API for e-wallets
- Webhook-driven payment confirmation with signature verification
- Test mode uses `sk_test_*` / `pk_test_*` keys; live uses `sk_live_*` / `pk_live_*`
- See `business-layer.md` for full integration
- **Revisit when:** International expansion (add Stripe), or recurring billing becomes a need.

## ADR-007: Resend for Email

**Status:** Accepted (2026-07-07)
**Context:** Need transactional email for receipts, refund confirmations, class reminders.
**Decision:** Resend. Free tier (3,000 emails/month) covers Project Amazon PH Academy scale. React Email for templates.
**Consequences:**
- Simple API, good DX
- Templates as React components (type-safe)
- Domain authentication required (SPF, DKIM, DMARC)
- Bounce/complaint handling built-in
- **Revisit when:** Monthly email volume > 100K.

## ADR-008: File Storage on Vercel Blob

**Status:** Accepted (2026-07-07)
**Context:** Resources (PDFs, spreadsheets, templates) need to be stored and served.
**Decision:** Vercel Blob for production. Local filesystem (`/public/downloads/`) for development.
**Consequences:**
- No S3 configuration needed
- Costs scale with usage (~$0.15/GB/month)
- Direct upload from admin UI via signed URLs
- Public read for non-sensitive resources, signed URLs for sensitive
- **Revisit when:** Need fine-grained access control (signed URLs only).

## ADR-009: Sentry for Error Tracking and Performance

**Status:** Accepted (2026-07-07)
**Context:** No observability today. Bugs ship to production silently.
**Decision:** Sentry for error tracking and performance monitoring. Free tier covers Project Amazon PH Academy.
**Consequences:**
- Errors captured with stack traces and user context
- Performance transactions for server actions (target: p95 < 500ms)
- Source maps uploaded for production debugging
- Release tracking via Git SHA
- **Revisit when:** Monthly events > 50K.

## ADR-010: Vitest for Unit Tests, Playwright for E2E

**Status:** Accepted (2026-07-07)
**Context:** Zero test coverage today. Refactor requires safety net.
**Decision:** Vitest for unit and integration tests. Playwright for end-to-end and accessibility tests.
**Consequences:**
- Vitest: fast, native ESM, compatible with Next.js
- Playwright: real browser testing, accessibility tree queries
- Coverage thresholds enforced in CI (70% on lib/actions)
- Test-driven for new admin and business layer code
- Existing code tested opportunistically
- **Revisit when:** Test suite > 5 minutes (parallelize).

## ADR-011: Feature Flags for Risky Refactors

**Status:** Accepted (2026-07-07)
**Context:** Refactor will touch many surfaces. Need ability to ship code dark and roll back instantly.
**Decision:** Use `flags.ts` config file (compiled at build time) for v2. Migrate to a real flag service (PostHog, GrowthBook) when scale demands.
**Consequences:**
- Flags check at runtime, no remote config
- Two-week max flag life (clean up after stabilization)
- Code without flag goes to trunk immediately (no long-lived branches)
- **Revisit when:** Need per-user targeting or remote flag control.

## ADR-012: Soft-Delete for All Mutable Tables

**Status:** Accepted (2026-07-07)
**Context:** Hard-deleting records with foreign key relationships causes cascading failures and data loss.
**Decision:** Every mutable table has `deletedAt DateTime?`. Queries filter by `deletedAt: null` by default.
**Consequences:**
- Prisma middleware injects the filter automatically
- Admin "Delete" sets `deletedAt = now()`, not `delete()`
- "Trash" view in admin shows deleted items with "Restore" action
- GDPR right-to-erasure requires hard delete (separate workflow)
- See `db-hardening-spec.md` for migration
- **Revisit when:** Soft-deleted data accumulates faster than expected (add archival).

## ADR-013: Soft-Publish for Content

**Status:** Accepted (2026-07-07)
**Context:** Lessons and modules need review before going live to students.
**Decision:** Every content table has `isPublished Boolean`. Default `false`. Admin explicitly publishes.
**Consequences:**
- Draft content never visible to students
- Lesson MDX content can be staged and reviewed
- Course-level publish cascades to modules and lessons
- **Revisit when:** Editorial workflow gets more complex (add states like IN_REVIEW, SCHEDULED).

## ADR-014: Audit Log on All Admin Mutations

**Status:** Accepted (2026-07-07)
**Context:** Need traceability for all admin actions for security and compliance.
**Decision:** Every admin action calls `auditLog()` with actor, action, entity, metadata. AuditLog table stores all entries.
**Consequences:**
- Immutable audit trail (no update/delete on AuditLog)
- 2-year retention, then archival
- Viewable in `/admin/audit-log`
- Required for SOC 2 / GDPR compliance if Project Amazon PH Academy ever seeks certification
- **Revisit when:** AuditLog > 1M rows (partition by month).

## ADR-015: Refuse Multi-Tenancy Until Evidence

**Status:** Accepted (2026-07-07)
**Context:** `orgId` exists on every table but no Organization model is in active use. Multi-tenancy is a massive complexity cost.
**Decision:** Keep `orgId` column for future use but do not implement multi-tenancy. Single-tenant only.
**Consequences:**
- Every query ignores `orgId`
- No tenant isolation work needed
- Migration to multi-tenant later is non-trivial (requires backfill, middleware, RLS)
- See `db-hardening-spec.md` for `orgId` decision
- **Revisit when:** Enterprise customer requests isolated data, or Project Amazon PH Academy offers white-label.

## ADR-016: i18n Deferred

**Status:** Accepted (2026-07-07)
**Context:** Filipino VA audience. Most prefer English content (technical terms). Taglish acceptable in marketing copy.
**Decision:** English-only for UI and lessons. Marketing copy uses Filipino cultural references (city names, peso amounts, real scenarios). No `next-intl` or i18n library.
**Consequences:**
- All strings are hardcoded English in source
- No translation workflow
- If Filipino-language support is needed later, add `next-intl` and extract strings
- **Revisit when:** > 10% of users request Filipino UI translation.

---

## ADR Process

When making a new architectural decision:

1. Copy this template
2. Fill in Status, Context, Decision, Consequences
3. Append to this document (don't edit old ADRs — superseded decisions get a new ADR)
4. Reference ADR numbers in code comments and PRs when relevant
5. Discuss controversial decisions in memoria before committing

ADR number is permanent. Once used, never reused, even if the decision is reversed.