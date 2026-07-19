# Architecture Documentation - Project Amazon PH Academy v2

## Overview
**Architecture Level:** Modular Monolith (ADR-001)
**Last Review:** 2026-07-19
**Next Review:** 2026-10-19
**Owner:** Ryan Roland Dabao
**Status:** Active Implementation

---

## System Architecture

### High-Level Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Students   │  │    Admins    │  │   PayMongo   │  │   Resend    │ │
│  │   (Browser)  │  │   (Browser)  │  │   (Webhook)  │  │   (Email)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Next.js    │  │   Edge       │  │   Serverless │  │   Vercel     │ │
│  │   Runtime    │  │   Middleware  │  │   Functions  │  │   Blob       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Route       │  │  Components  │  │  Server      │  │  Lib         │ │
│  │  Handlers    │  │  (UI)        │  │  Actions     │  │  (Utils)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  PostgreSQL  │  │  Prisma ORM  │  │  Sentry      │  │  Pino        │ │
│  │  (Neon)      │  │  (Schema)    │  │  (Errors)    │  │  (Logging)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 16 | React framework with App Router |
| **Language** | TypeScript (strict) | Type safety and developer experience |
| **Database** | PostgreSQL (Neon) | Relational database |
| **ORM** | Prisma | Database schema and queries |
| **Auth** | JWT + HttpOnly cookies (jose) | Stateless authentication |
| **Styling** | CSS Modules + design tokens | Scoped styling with design system |
| **Icons** | Phosphor (light) | Consistent iconography |
| **Fonts** | Space Grotesk + JetBrains Mono | Typography system |
| **Payments** | PayMongo (GCash/Maya/Card/Bank) | Philippine payment methods |
| **Email** | Resend + React Email | Transactional emails |
| **File Storage** | Vercel Blob | Resource storage |
| **Error Tracking** | Sentry (`@sentry/nextjs@^9`) | Error monitoring |
| **Logging** | Pino + AsyncLocalStorage | Structured logging |
| **Testing** | Vitest + Playwright | Unit, integration, and E2E tests |
| **CI/CD** | GitHub Actions | Automated pipelines |
| **Hosting** | Vercel | Serverless deployment |

---

## Directory Structure

```
amph-v2/
├── src/
│   ├── app/                    # Next.js App Router routes
│   │   ├── (public)/           # Public pages (auth, pricing)
│   │   ├── (dashboard)/        # Student dashboard, courses, tools, quizzes
│   │   ├── admin/              # Admin panel (RBAC-gated)
│   │   ├── api/webhook/        # PayMongo webhook handler
│   │   └── actions/            # Server actions for mutations
│   ├── components/             # UI components
│   │   ├── ui/                 # 11 shared UI primitives (Field Manual)
│   │   └── tools/              # 5 interactive tool runners
│   ├── lib/                    # Business logic and utilities
│   │   ├── auth.ts             # JWT authentication
│   │   ├── db.ts               # Prisma client
│   │   ├── logger.ts           # Structured logging
│   │   ├── badges.ts           # Gamification logic
│   │   ├── certificates.ts     # PDF generation
│   │   ├── paymongo.ts         # Payment integration
│   │   ├── refunds.ts          # Refund handling
│   │   └── ...                 # Other utilities
│   ├── engine/                 # Tool engines
│   │   ├── registry.ts         # Tool registry (TOOL_REGISTRY)
│   │   ├── campaign-builder/   # Campaign simulator
│   │   ├── bid-elevator/       # Bid optimization
│   │   ├── search-term-triage/ # Search term analysis
│   │   ├── listing-audit/      # Listing optimization
│   │   └── keyword-research/   # Keyword discovery
│   ├── middleware.ts           # Edge JWT verification + RBAC
│   └── styles/globals.css      # Design tokens + dark mode
├── prisma/                     # Database schema (19 models)
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed data (admin + pricing tiers + badges)
├── scripts/                    # Build and maintenance scripts
│   ├── smoke.ts                # Smoke tests
│   ├── backup.ts               # Database backup
│   ├── restore.ts              # Database restore
│   └── sentry-alert.ts         # Sentry alerting
├── docs/                       # Documentation
├── .github/workflows/          # 7 GitHub Actions workflows
├── tests/                      # Test suites
└── public/                     # Static assets
```

---

## Core Components

### 1. Route Protection & Authentication

**Location:** `src/middleware.ts`, `src/lib/auth.ts`

**Implementation:**
- JWT tokens signed with `jose` library
- HttpOnly Secure SameSite=Strict cookies
- Refresh token rotation on each request
- Admin routes gated by `requireAdmin()`

**Security Model (ADR-004):**
- Access token: 15 minutes
- Refresh token: 7 days
- Absolute timeout: 30 days
- Server-side invalidation on logout (client-side cookie clear)

### 2. Database Architecture

**Location:** `prisma/schema.prisma`

**Design Patterns:**
- **Soft Delete:** Every mutable table has `deletedAt DateTime?` (ADR-012)
- **Audit Trail:** Every mutable table has `createdById`, `updatedById`
- **Soft Publish:** Content tables have `isPublished Boolean` (ADR-013)
- **Single Tenant:** `orgId` column exists but no multi-tenancy (ADR-015)

**Schema Features:**
- 19 models covering courses, users, payments, gamification
- No SQLite-specific features (PostgreSQL everywhere)
- Prisma middleware for automatic soft-delete filtering

### 3. Server Actions Pattern

**Location:** `src/app/actions/`

**Implementation (ADR-005):**
- All mutations use server actions
- API routes reserved for webhooks and file uploads
- Progressive enhancement works automatically
- Type-safe end-to-end

**Usage Pattern:**
```typescript
// Server action example
'use server'

import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'

export async function updateUserRole(userId: string, role: string) {
  await requireAdmin()  // RBAC check
  
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  })
  
  await auditLog({
    actor: currentUserId,
    action: 'UPDATE_ROLE',
    entity: 'User',
    entityId: userId,
    metadata: { role },
  })
}
```

### 4. Tool Engine Architecture

**Location:** `src/engine/`

**Registry Pattern:**
```typescript
// src/engine/registry.ts
export const TOOL_REGISTRY = {
  'campaign-builder': {
    name: 'Campaign Builder',
    scenarios: ['campaign-builder-scenarios.json'],
    engine: CampaignBuilderEngine,
  },
  'bid-elevator': {
    name: 'Bid Elevator',
    scenarios: ['bid-elevator-scenarios.json'],
    engine: BidElevatorEngine,
  },
  // ... 5 tools total
}
```

**Tool Components:**
1. **UI Runner:** `src/components/tools/` - Interactive interface
2. **Engine:** `src/engine/` - Business logic
3. **Scenarios:** `src/engine/*/scenarios.json` - Test data
4. **Registry:** `src/engine/registry.ts` - Tool configuration

### 5. Gamification System

**Location:** `src/lib/badges.ts`, `src/lib/xp.ts`

**Features:**
- **XP & Levels:** Experience points for completing lessons, quizzes, tools
- **Streaks:** Daily login tracking with bonus XP
- **Badges:** Achievement system with unlock criteria
- **Certificates:** PDF generation with public verification

**Data Model:**
- `UserXP` - Experience points tracking
- `UserBadge` - Badge achievements
- `UserStreak` - Daily login tracking
- `Certificate` - Course completion certificates

### 6. Payment Integration

**Location:** `src/lib/paymongo.ts`

**Implementation (ADR-006):**
- **Provider:** PayMongo
- **Methods:** GCash, Maya, GrabPay, Card, Bank, OTC
- **Currencies:** Philippine Peso (PHP)
- **Webhooks:** Signature verification for payment confirmation

**Flow:**
1. Student selects course and payment method
2. PayMongo creates payment intent
3. Student completes payment
4. PayMongo webhook confirms payment
5. System unlocks course access
6. Audit log records transaction

### 7. Admin Panel Architecture

**Location:** `src/app/admin/`

**Security (ADR-014):**
- **RBAC:** Role-based access control via `requireAdmin()`
- **Audit Trail:** Every mutation logs to `AuditLog` table
- **Search/Filter/Pagination:** All routes support data exploration

**Features:**
- **Dashboard:** Real-time stats on users, enrollments, revenue
- **User Management:** Search, view, manage student accounts
- **Course Management:** Create/edit courses, modules, lessons
- **Tool Management:** Manage simulator scenarios and difficulty
- **Refund Management:** Review and process refund requests
- **Badges & Gamification:** Create badges, set criteria
- **Analytics:** Enrollment funnels, revenue trends, engagement
- **Settings:** Platform configuration

---

## Data Flow

### Student Enrollment Flow
```
1. Student visits pricing page
2. Selects course tier
3. Redirected to PayMongo checkout
4. Completes payment (GCash/Maya/Card/Bank)
5. PayMongo webhook confirms payment
6. System creates enrollment record
7. Course access unlocked
8. Welcome email sent via Resend
9. Audit log records transaction
```

### Admin Content Management Flow
```
1. Admin logs in (JWT verification)
2. Navigates to course management
3. Creates new lesson with rich editor
4. Saves as draft (isPublished: false)
5. Reviews and publishes lesson
6. Course-level publish cascades to modules/lessons
7. Students see new content
8. Audit log records all changes
```

### Tool Execution Flow
```
1. Student selects tool (e.g., Campaign Builder)
2. System loads tool from TOOL_REGISTRY
3. Student interacts with tool UI
4. Engine processes business logic
5. Results displayed to student
6. XP awarded for tool usage
7. Progress saved to database
```

---

## Security Architecture

### Authentication Layers
```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT REQUEST                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE MIDDLEWARE                              │
│  • JWT verification (HttpOnly cookie)                          │
│  • Route classification (public/admin/dashboard)               │
│  • CORS validation                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER ACTIONS                               │
│  • RBAC checks (requireAdmin())                                │
│  • Input validation                                            │
│  • Business logic execution                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                               │
│  • Prisma middleware (soft-delete filtering)                    │
│  • Parameterized queries (SQL injection prevention)            │
│  • Audit logging (all admin mutations)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Security Headers
```typescript
// next.config.ts security headers
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]
```

### Data Protection
- **Encryption at Rest:** Database fields encrypted
- **Encryption in Transit:** TLS 1.3 enforced
- **Secrets Management:** Environment variables (Vercel)
- **PII Handling:** Minimal collection, encrypted storage

---

## Performance Architecture

### Caching Strategy
- **Static Pages:** Next.js ISR (Incremental Static Regeneration)
- **Dynamic Pages:** Server-side rendering with caching
- **API Responses:** Edge caching via Vercel
- **Database:** Connection pooling via Prisma

### Performance Budgets
- **Lighthouse CI:** Performance score > 90
- **First Contentful Paint:** < 1.5s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1

### Monitoring
- **Error Tracking:** Sentry with source maps
- **Performance:** Sentry transactions
- **Logging:** Pino with structured logging
- **Alerting:** Slack incoming webhooks

---

## Deployment Architecture

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm tsc --noEmit      # Type checking
      - run: pnpm lint               # ESLint
      - run: pnpm test              # Unit/integration tests
      - run: pnpm test:coverage     # Coverage threshold
      - run: pnpm test:e2e          # Playwright E2E
      - run: pnpm build             # Production build
      - run: pnpm lighthouse        # Performance budget
      - run: gitleaks detect        # Secret detection
```

### Deployment Flow
```
1. Developer pushes to feat/* or fix/* branch
2. Pull request created
3. CI runs full validation suite
4. Code review and approval
5. Squash merge to main
6. Vercel auto-deploys to production
7. Sentry tracks release via Git SHA
```

### Environment Management
- **Development:** Local PostgreSQL
- **Staging:** Vercel preview deployments
- **Production:** Vercel production deployment
- **Database:** Neon PostgreSQL (serverless)

---

## Development Guidelines

### File Dependency Chain (AGENTS.md)
```
src/lib/        ← Pure utilities, no deps
   ↑
src/components/ ← UI primitives, depend on lib
   ↑
src/app/        ← Routes, depend on components + lib
   ↑
tests/          ← Mirror src structure
```

**Rule:** Lower layers must not import from higher layers.

### Code Style (AGENTS.md)
- **TypeScript strict** - No `any`
- **Server components by default** - `'use client'` only when needed
- **No `console.log`** - Use structured logger
- **No comments that restate the code** - Comment the why, not the what
- **File names:** `kebab-case.ts` for non-components, `PascalCase.tsx` for components

### Testing Strategy
- **Vitest:** Unit and integration tests
- **Playwright:** End-to-end and accessibility tests
- **Coverage:** 70% threshold on `src/lib` and `src/app/actions`
- **Location:** Tests live next to code they test

---

## Future Considerations

### Scalability (ADR-001)
**Current:** Modular Monolith (single Next.js application)
**Revisit when:**
- Monthly active users > 10,000
- Team > 3 developers
- Need for independent scaling

### Multi-Tenancy (ADR-015)
**Current:** Single tenant with `orgId` column
**Revisit when:**
- Enterprise customer requests isolated data
- White-label offering

### Internationalization (ADR-016)
**Current:** English-only UI
**Revisit when:**
- > 10% of users request Filipino UI translation

---

## Contact

For architecture questions, contact:
- **Owner:** Ryan Roland Dabao
- **Email:** ryan@projectamazonph.com

*© 2026 Project Amazon PH. All rights reserved.*