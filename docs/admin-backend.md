# Admin Backend Specification — Project Amazon PH Academy v2

**Status:** Approved
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

---

## Purpose

The admin panel is the operational interface for running the business. Today it has badges and live classes. It needs to be the place Ryan manages users, courses, content, tools, payments, refunds, certificates, resources, and analytics — without leaving the product.

Everything in the admin panel is gated behind `role >= ADMIN`. Every mutation writes to `AuditLog`. Every list view supports filter, sort, search, and bulk action.

## Roles

Defined in the existing `UserRole` enum. The admin backend uses three roles:

| Role | Permissions |
|------|-------------|
| `STUDENT` | None. Sees no admin routes. |
| `INSTRUCTOR` | Read-only on courses, lessons, analytics. Can view users. Cannot modify pricing, payments, or roles. |
| `ADMIN` | Full access. The only role that can promote/demote, edit pricing, issue refunds, edit settings. |

`ADMIN` is the only role that can create another `ADMIN`. There is no self-service admin promotion.

## Route Structure

All routes live under `/admin/*`. Middleware checks `role >= ADMIN` for the entire `/admin` subtree.

```
/admin
├── /                              Dashboard (overview cards + recent activity)
├── /users                         List users (search, filter, bulk)
│   ├── /users/[id]                User detail
│   │   ├── /users/[id]/edit       Edit user fields, role, status
│   │   ├── /users/[id]/enrollments  User's enrollments + payments
│   │   └── /users/[id]/progress   User's progress, badges, certificates
├── /courses                       List courses
│   ├── /courses/new               Create course
│   ├── /courses/[id]              Edit course (overview)
│   ├── /courses/[id]/modules      Manage modules in course
│   │   ├── /modules/[id]          Edit module
│   │   └── /modules/[id]/lessons  Manage lessons in module
│   │       └── /lessons/[id]      Edit lesson (MDX editor)
│   └── /courses/[id]/pricing      Edit pricing tier for course
├── /tools                         Interactive tool management
│   ├── /tools/campaign-builder    Scenario packs (kitchen, electronics, etc.)
│   ├── /tools/bid-elevator        Bid scenarios
│   └── /tools/str-triage          Search term datasets
├── /badges                        List badges
│   ├── /badges/new                Create badge
│   └── /badges/[id]               Edit badge (criteria, tier, icon)
├── /certificates                  List certificates
│   └── /certificates/[id]         View certificate, revoke (with reason)
├── /live-classes                  List live classes
│   ├── /live-classes/new          Schedule class
│   └── /live-classes/[id]         Edit class, view registrations
├── /resources                     List downloadable resources
│   ├── /resources/new             Upload resource
│   └── /resources/[id]            Edit resource
├── /analytics                     Analytics dashboards
│   ├── /analytics/enrollments     Funnel: visit → signup → paid → active
│   ├── /analytics/engagement      DAU/WAU/MAU, session duration
│   ├── /analytics/content         Module completion rates, drop-off points
│   └── /analytics/revenue         MRR, refunds, tier mix
├── /payments                      Payment operations
│   ├── /payments                  List all transactions
│   └── /payments/[id]             View transaction, issue refund
├── /settings                      App-level settings
│   ├── /settings/branding         Logo, colors, copy
│   ├── /settings/pricing          Edit tier prices
│   ├── /settings/email            Email templates, sender config
│   └── /settings/integrations     PayMongo keys, Sentry DSN, etc.
└── /audit-log                     View audit log
    └── /audit-log?entity=User&id=xxx  Filter to specific entity
```

## Page Patterns

Every list page follows the same pattern:

```
┌─ Header ─────────────────────────────────────────────┐
│ Title                           [Primary Action Button]│
├─ Filters ────────────────────────────────────────────┤
│ [Search] [Filter: Status] [Filter: Tier] [Date Range]│
├─ Table ──────────────────────────────────────────────┤
│ ☐  Name         Email           Role    Status   ⋮  │
│ ☐  Maria Cruz   [email protected]  STUDENT ACTIVE    ⋮  │
│ ☐  ...                                                │
├─ Bulk Actions (shown when items selected) ───────────┤
│ [Bulk: Export] [Bulk: Suspend] [Bulk: Delete]        │
├─ Pagination ─────────────────────────────────────────┤
│ Showing 1–50 of 1,247          [< 1 2 3 ... 25 >]    │
└──────────────────────────────────────────────────────┘
```

Every detail page:

```
┌─ Breadcrumb ─────────────────────────────────────────┐
│ Users / Maria Cruz                                   │
├─ Header ─────────────────────────────────────────────┤
│ Maria Cruz            [Edit] [Suspend] [Delete]      │
│ [email protected] • STUDENT • Active since Jan 2026   │
├─ Tabs ───────────────────────────────────────────────┤
│ [Overview] [Enrollments] [Progress] [Activity]      │
├─ Tab Content ────────────────────────────────────────┤
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

## RBAC Middleware

Single middleware at `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // Admin routes require ADMIN role
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return redirectToLogin(request);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

**Defense in depth:** middleware checks role, but every server action also re-checks. Never trust middleware alone.

## Server Action Pattern

Every mutation goes through a server action with this shape:

```typescript
// src/app/actions/admin/users.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

const SuspendUserSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().min(10).max(500),
});

export async function suspendUser(input: z.infer<typeof SuspendUserSchema>) {
  // 1. Auth check
  const admin = await requireAdmin();

  // 2. Validate input
  const data = SuspendUserSchema.parse(input);

  // 3. Check target exists
  const target = await db.user.findUnique({ where: { id: data.userId } });
  if (!target) throw new NotFoundError('User not found');

  // 4. Prevent locking self out
  if (target.id === admin.id) throw new ValidationError('Cannot suspend yourself');

  // 5. Mutate
  await db.user.update({
    where: { id: data.userId },
    data: { /* suspended flag */ },
  });

  // 6. Audit log
  await auditLog({
    actorId: admin.id,
    action: 'user.suspend',
    entityType: 'User',
    entityId: target.id,
    metadata: { reason: data.reason, previousStatus: 'active' },
  });

  // 7. Revalidate cache
  revalidatePath('/admin/users');
}
```

**Mandatory in every admin action:**

1. `requireAdmin()` — throws if not admin
2. Zod parse — throws on bad input
3. Existence check
4. Self-protection check (don't suspend self, don't demote self, etc.)
5. Mutate
6. Audit log
7. Revalidate

## Audit Log

New Prisma model:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  orgId       String?
  actorId     String
  action      String   // "user.suspend", "course.publish", "payment.refund", etc.
  entityType  String   // "User", "Course", "Payment"
  entityId    String
  metadata    String?  // JSON of relevant changes
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  actor       User     @relation("AuditLogActor", fields: [actorId], references: [id])

  @@index([actorId, createdAt])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
}
```

Admin users can view `/admin/audit-log` filtered by actor, entity, action, or date range. Retention: 2 years.

## Critical Admin Operations

### Suspend User

Reversible. Sets `User.status = 'SUSPENDED'`. User cannot log in but data is preserved.

```typescript
// State machine: ACTIVE → SUSPENDED → ACTIVE
// Cannot suspend self.
// Cannot suspend other ADMINs without super-admin approval (out of scope for v2).
```

### Delete User

Soft delete. Sets `User.deletedAt = now()` and `User.email = "deleted-{cuid}@deleted"`. Anonymizes PII (name, image).

Hard delete reserved for GDPR right-to-erasure requests. Workflow: user requests via email, admin reviews, admin clicks "Hard Delete" with reason.

### Refund Payment

Calls PayMongo refund API. Updates local Payment record. Refund window: 7 days from purchase. Beyond 7 days: requires manual approval from admin.

```typescript
// POST /api/admin/payments/[id]/refund
// Body: { amount: number, reason: string }
// Pre-checks: refundable, within window
// Side effects: paymongo.refund, payment.status = REFUNDED, enrollment.status = REFUNDED, user notified by email
```

### Edit Pricing

Tier prices are stored in `Course.tier` + `Course.price`. Edits go through a confirmation step showing impact:

- Number of active enrollments at this price
- Projected revenue change if price updated
- Whether the change applies to existing students (it doesn't — new purchases only)

### Issue Certificate Manually

For cases where the auto-issuance didn't trigger (rare). Creates a Certificate with `metadata.issuedManually = true`.

### Revoke Certificate

Sets `Certificate.status = 'revoked'`, `Certificate.revokedAt`, `Certificate.revokedReason`. Public verification page shows revoked status.

## Empty States

Every admin list page has an empty state with a primary action:

- No users → "Users will appear here as they sign up."
- No courses → "[Create your first course]" button
- No badges → "[Create your first badge]" button
- No payments → "Payments will appear here as customers purchase courses."

No empty state says "No items" or just "Empty".

## Bulk Operations

Available on: users, courses, badges, resources, payments.

Bulk operations show a confirmation modal showing exactly what will be affected:

```
┌─ Suspend 12 users ────────────────────────────────────┐
│                                                       │
│ The following 12 users will be suspended:             │
│ • Maria Santos                                        │
│ • Jose Reyes                                          │
│ • ... (10 more)                                       │
│                                                       │
│ They will not be able to log in. Their data is        │
│ preserved and they can be reactivated.                │
│                                                       │
│ Reason (required):                                    │
│ [_______________________________________________]     │
│                                                       │
│ [Cancel]                       [Suspend 12 Users]     │
└───────────────────────────────────────────────────────┘
```

Bulk operations are atomic: either all 12 succeed or none do. Use a Prisma transaction.

## Performance

- All list queries paginated (default 50, max 200).
- Search uses Postgres trigram or `LIKE '%query%'`.
- Sort defaults to `createdAt DESC`.
- Filter chips collapse on mobile.
- Server components for initial render, client components for interactive filters.
- No client-side fetching on admin pages — keep it server-rendered.

## Testing

Every admin action gets:

1. Unit test: validates input, returns error on bad input.
2. Integration test: with seeded DB, full flow succeeds.
3. Negative test: as STUDENT, action throws Forbidden.
4. Negative test: as ADMIN, but on own user, action throws.
5. Audit log test: action creates expected log entry.

Coverage target: 90% on `src/app/actions/admin/**`.

## Open Questions

- Do we need a `MANAGER` role between `INSTRUCTOR` and `ADMIN`? Probably not for v2. Defer.
- Multi-tenant org separation (when/if needed)? Defer. Single-tenant for v2.
- Bulk email from admin to filtered users? Defer to v2.1.

## Success Criteria

- All routes under `/admin/*` require ADMIN role.
- All admin actions log to audit log.
- All admin inputs validated by Zod.
- All admin actions have tests covering happy path + 2 negative paths.
- Admin can manage users, courses, content, tools, badges, certificates, live classes, resources, analytics, payments, settings, audit log.
- No admin action takes > 500ms p95.
- Admin pages render in < 1s on staging.