---
type: entity
title: amph-v2 — API & Schema Reference
domain: ad-training
created: 2026-07-13
updated: 2026-07-13
related: [[amph-v2]], [[amph-academy]], [[projectamazonph]]
---

# amph-v2 — API & Schema Reference

> Complete technical documentation for amph-v2 (Next.js 16 App Router, TypeScript strict, Prisma ORM). Covers all Prisma models, server actions, API routes, webhook handlers, JSON schemas, tool engines, and data flows. Derived from codegraph analysis and sprint documentation.

---

## 1. Architecture Overview

### 1.1 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router (RSC + Client Components) |
| Language | TypeScript strict mode |
| Database | PostgreSQL (prod) / SQLite (dev) via Prisma ORM |
| Auth | JWT in HttpOnly cookies (jose) |
| Payments | PayMongo checkout + refund API |
| Email | Resend (Sprint 8) |
| Storage | Vercel Blob (receipt PDFs, deferred prod swap) |
| Error tracking | Sentry |
| Testing | Vitest + Playwright (Sprint 10) |
| Icons | Phosphor (tree-shaken, no barrel imports) |
| Fonts | Space Grotesk + JetBrains Mono |
| Styling | CSS Modules + design tokens (NO Tailwind) |

### 1.2 Design System: Field Manual

Dense, scannable, utilitarian. Off-white surface (#FAFAF7). Orange accent (#FF6B35). Type-led hierarchy. No glassmorphism, no gradient orbs, no decorative blurs.

### 1.3 Auth Flow (Defense-in-Depth)

1. **Edge Middleware** — verifies JWT on every request
2. **Server Component** — re-verifies via `getSession()` + `jose`
3. **Soft-delete middleware** — `db.ts` auto-filters `deletedAt: null` on all reads (ADR-012)

### 1.4 Route Groups

| Group | Path prefix | Auth |
|-------|------------|------|
| (auth) | /auth/signin, /auth/signup | Public |
| (dashboard) | /dashboard/* | JWT required |
| Admin | /admin/* | JWT + ADMIN role |
| Public | /pricing, /checkout/complete, /verify/[hash] | Public |
| API Routes | /api/* | Varies |

### 1.5 Key Design Decisions (ADR)

| ADR | Decision |
|-----|----------|
| ADR-003 | No AI/LLM APIs (no OpenAI, Anthropic, LangChain) |
| ADR-012 | Soft-delete on all mutable tables |
| ADR-015 | Not multi-tenant (no orgId) |
| ADR-016 | SQLite compat: no Prisma enums, String + lib/enums.ts const objects |



---

## 2. Prisma Schema

All mutable tables include deletedAt, createdById, updatedById (ADR-012). SQLite compat: no native Prisma enums, all use String fields + src/lib/enums.ts const objects.

### 2.1 Auth & User Models



### 2.2 Course / Curriculum



### 2.3 Enrollment & Tier Gating



Tier hierarchy: FOUNDER < PPC_FOUNDATIONS < ULTIMATE. Functions in tier-gate.ts: userMeetsTierRequirement, requireCourseAccess, getUserHighestTier, TierLock component. Grandfather helper in seed.ts.

### 2.4 Payments & Checkout



### 2.5 Refunds



### 2.6 Gamification



### 2.7 Live Classes



### 2.8 Interactive Tools







Server actions (use server directive) are the primary mutation API in Next.js 16 App Router.

### 3.1 Auth Actions (src/app/actions/auth.ts)

| Action | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| signUpAction | name, email, password | { user, session } or error | Creates User; throws on duplicate email |
| signInAction | email, password | { user, session } or error | Verifies password hash; sets JWT cookie |
| signOutAction | - | { success: true } | Clears JWT cookie |

signUpAction also handles placeholder account claim: if passwordHash starts with placeholder_, it replaces hash, sets name + emailVerified in place.

### 3.2 Progress Actions (src/app/actions/progress.ts)

| Action | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| startLessonAction | lessonId | LessonProgress | Idempotent upsert; enforces TierLock |
| markLessonCompleteAction | lessonId | LessonProgress | Sets completedAt; triggers evaluateBadges |
| submitQuizAction | quizId, answers[] | { score, passed, attemptId } | Server-side scoring; awards XP on pass |

### 3.3 Tool Actions (src/app/actions/tools.ts)

| Action | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| startToolSessionAction | toolId | ToolSession | Creates IN_PROGRESS session; loads scenario |
| saveToolSessionAction | sessionId, state | ToolSession | Saves intermediate answers (auto-save) |
| submitToolSessionAction | sessionId, state | { session, score, passed, xpEarned } | Runs engine scoring; sets SUBMITTED/GRADED |
| loadToolSessionAction | sessionId | ToolSession | Returns session for resume |
| listToolSessionsAction | toolId? | ToolSession[] | Lists user sessions; optional filter |

submitToolSessionAction also: awards 30 XP on passed submissions + bumps lastActiveAt for streak tracking.

### 3.4 Live Class Actions (src/app/actions/live-classes.ts)

| Action | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| registerForLiveClassAction | liveClassId | LiveClassRegistration | ULTIMATE tier gate; capacity check; idempotent |
| cancelLiveClassRegistrationAction | liveClassId | { success } | Removes registration |
| listMyRegistrationsAction | - | LiveClassRegistration[] | User registrations |

### 3.5 Checkout Actions (src/app/actions/checkout.ts)

| Action | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| createCheckoutSessionAction | pricingTier | { checkoutUrl } | Creates PayMongo checkout; creates Payment row |

### 3.6 Refund Actions (src/app/actions/refunds.ts)

| Action | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| createRefundRequestAction | paymentId, reason | RefundRequest | Validates ownership, window, no open request |
| approveRefundAction | refundRequestId, reviewerNotes | RefundRequest | Calls PayMongo refund API; PENDING -> PROCESSED |
| rejectRefundAction | refundRequestId, reviewerNotes | RefundRequest | Requires reviewerNotes >= 10 chars |



---


---

## 3. Server Actions

## 4. API Routes

### 4.1 POST /api/paymongo/webhook

Receives PayMongo payment events. Signature verification via HMAC-SHA256.

**Idempotency:** ProcessedWebhook table stores paymongoEventId; duplicates are skipped.

| Event Type | Handler | Side Effects |
|------------|---------|-------------|
| checkout.session.completed | handleCheckoutPaid | Payment PAID, Enrollment ACTIVE, Invoice issued, badge check |
| payment.refunded | handlePaymentRefunded | Payment REFUNDED/PARTIALLY_REFUNDED, Enrollment updated |

**Flow:** HMAC verify -> ProcessedWebhook check -> dispatch handler -> insert ProcessedWebhook

### 4.2 GET /api/invoices/[id]/pdf

Serves receipt PDFs. Owner-only auth (requireAuth + invoice.userId check).

Lazy-renders if pdfUrl is null. Returns application/pdf with content-disposition: inline.


---

## 5. JSON Column Schemas (src/types/json-schemas.ts)

### 5.1 Badge Criteria

| Field | Type |
|-------|------|
| type | module_complete \| quiz_score \| tool_sessions \| streak_days \| xp_threshold |
| moduleId | string (type=module_complete) |
| threshold | number (type=quiz_score \| tool_sessions \| streak_days \| xp_threshold) |
| courseId | string? (type=quiz_score) |

### 5.2 Tool Session State Schemas

**CampaignBuilderState:** { step, campaign: {name, type, startDate, endDate?, dailyBudget}, bidding: {strategy, defaultBid}, adGroup: {name}, targets: {keywords: [{text, matchType, bid?}], productTargets?: [{ASIN, bid?}], audiences?: [{targetingName}]} }

**BidElevatorState:** { bids: [{keyword, currentBid, newBid, acos, sales}] }

**StrTriageState:** { terms: [{term, impressions, clicks, spend, orders, sales, acos, action, bidAdjustment?, negativeKeyword?, negativeMatchType?}] }

**ListingAuditState:** { flags: {title, bullets, description, images, aplus, price, reviews, rating}, revised: {title, bullets[], description, imageCount, hasAplus, price, reviewCount, rating} }

**KeywordResearchState:** { candidates: [{keyword, relevance, volume, competition, priority, notes?}] }


---

## 6. Tool Engines (src/engine/)

### 6.1 Registry (src/engine/registry.ts)

Maps URL slugs to engine loaders:

| slug | Engine | Scenarios |
|------|-------|-----------|
| campaign-builder | campaign-builder/index.ts | 10 (5 SP + 5 BTV) |
| bid-elevator | bid-elevator/index.ts | 10 (bid-001..bid-010) |
| str-triage | str-triage/index.ts | 2 packs (str-001..str-020) |
| listing-audit | listing-audit/index.ts | 5 |
| keyword-research | keyword-research/index.ts | 5 |

### 6.2 Campaign Builder Engine

Builds SP/SB/SD/BTV campaigns. 5-step wizard: campaign settings -> bidding -> ad group -> targets/audiences -> review.

BTV mode auto-switches targets to audiences and resets bid strategy to CPM_FIXED.

### 6.3 Bid Elevator Engine

10-scenario bid adjustment engine (bid reduction/maintenance/increase scenarios).

Each scenario: market context, ACoS analysis, break-even CPC formula, acceptable bid range.

### 6.4 STR Triage Engine

20 real search terms (str-001..str-020). 5 actions: keep \| optimize_bid \| pause \| negate_exact \| negate_phrase.

Difficulty weights 0.60-0.95 per term.

### 6.5 Listing Audit Engine

5-scenario listing quality audit. 8 fields: title, bullets, description, images, A+ content, price, reviews, rating.

### 6.6 Keyword Research Engine

5-scenario categorization: PRIMARY \| SECONDARY \| NEGATIVE per keyword candidate.


---

## 7. Business Logic Libraries (src/lib/)

| File | Exports | Notes |
|------|---------|-------|
| auth.ts | signJWT, verifyJWT, getSession(), SessionUser | jose library |
| db.ts | prisma client + soft-delete middleware | Auto-filters deletedAt: null |
| tier-gate.ts | userMeetsTierRequirement, requireCourseAccess, getUserHighestTier, TierLock | ULTIMATE grants all |
| badges.ts | evaluateBadges(userId, triggerEvent) | 5 criteria types, idempotent |
| certificates.ts | evaluateCourseCompletion, issueCertificate, verifyCertificate | crypto.randomUUID hash |
| live-classes.ts | listUpcomingClasses, listPastClasses, getClassDetail, isClassFull | seed: 1 upcoming + 1 past |
| enrollment.ts | handleCheckoutPaid, activateEnrollment | Payment PAID -> Enrollment ACTIVE |
| paymongo.ts | createCheckoutSession, createRefund, verifyWebhookSignature | PayMongo REST API client |
| refunds.ts | isWithinRefundWindow, daysRemainingInWindow, hasBlockingRefundRequest, alreadyRefundedAmountPhp, listUserPayments, listPendingRefundRequests, getRefundRequestDetail, refundStatusLabel | REFUND_WINDOW_DAYS = 7 |
| receipts.tsx | issueInvoiceForPayment, renderInvoicePdf, getInvoiceForPayment, getInvoiceForUser | BIR-compliant, VAT-inclusive pricing |
| format.ts | formatPhp, formatDate, formatDateTime, formatReceiptNumber | Shared formatters |
| mdx.ts | getLessonContent, listModuleLessons | Lightweight markdown -> HTML |
| enums.ts | const objects replacing Prisma enums | SQLite compat |


---

## 8. UI Components (src/components/)

### 8.1 Shared UI (src/components/ui/)

Button, Card, Input, Badge, Modal, Toast, Icon (Phosphor tree-shaken), NavSidebar, TopBar

### 8.2 Tool Runners (src/components/tools/)

| Component | Tool | Description |
|-----------|-----|-------------|
| CampaignBuilderRunner | campaign-builder | 5-step wizard with BTV mode support |
| BidElevatorRunner | bid-elevator | 10-column editable bid table with ACoS highlighting |
| StrTriageRunner | str-triage | Per-term card with 8-cell performance grid + 5-action picker |
| ListingAuditRunner | listing-audit | 2-step form: flag issues + revise fields |
| KeywordResearchRunner | keyword-research | Per-candidate row with priority picker + live count |
| ToolResult | shared | Post-submit card: score circle, pass/fail badge, criteria breakdown |


---

## 9. Key Files Reference

| File | Purpose |
|------|---------|
| prisma/schema.prisma | Full 25+ model schema |
| src/app/actions/*.ts | All server actions (auth, progress, tools, live-classes, checkout, refunds) |
| src/lib/tier-gate.ts | Tier gating logic + TierLock component |
| src/lib/badges.ts | Auto-award badge engine |
| src/lib/certificates.ts | Certificate issuance + PDF generation |
| src/lib/receipt-pdf.tsx | BIR-compliant official receipt template |
| src/engine/registry.ts | Tool slug -> engine loader |
| src/components/tools/*.tsx | Interactive tool UIs |
| src/app/(dashboard)/tools/[tool]/[slug]/page.tsx | Dynamic tool runner page |
| src/app/api/paymongo/webhook/route.ts | PayMongo webhook handler |
| scripts/import-amph-content.ts | v1 content migration script |
| prisma/seed.ts | Database seeding + grandfatherFreeEnrollment |


---

*Source: Codegraph analysis + sprint documentation, 2026-07-13*
