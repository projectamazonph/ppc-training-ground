# AMPH v2 — Full System Fix Plan

> Generated from system trace + E2E test results on 2026-07-15. 26 issues across 6 phases.
> Source: Memoria memory `019f65bb65e471718470656c3048da0b` + `019f65c24cf77b139923027263bf3335`

---

## Phase 0: E2E-Confirmed Product Defect (HOTFIX)

### 0.1 Add missing courses index page

**File to create:** `src/app/(dashboard)/courses/page.tsx`

**Problem:** Every signed-in student clicking "Courses" hits 404. The `(dashboard)/courses/[courseSlug]/page.tsx` exists for individual courses, but there's no `courses/page.tsx` index. The middleware strips `/dashboard` → `/courses` → Next.js 404.

**Evidence:** E2E test #5 confirmed — `goto('/courses')` returns 404. Among student nav links (Courses, Tools, Payments, Live Classes, Certificates), Courses is the ONLY broken entry.

**Fix:** Create `src/app/(dashboard)/courses/page.tsx` — a courses list/grid page showing:
- Enrolled courses with progress (from `Enrollment` model)
- Available courses to browse (from `Course` where `isPublished: true`)
- Links to `/courses/[slug]` for each course

**Also update tests:**
- Test #4 (line 35): Replace `/dashboard/i` link assertion with actual student link (`/courses/i`)
- Test #5 (line 47): Change `goto('/dashboard')` to `goto('/courses')` and assert course content

---

## Phase 1: Payment Pipeline Criticals (HOTFIX — ship before anything else)

These are data-integrity issues. Money can be taken without enrollment being created.

### 1.1 Wrap `handleCheckoutPaid` in a transaction

**File:** `src/lib/enrollment.ts` — `handleCheckoutPaid()` (lines 172-305)

**Problem:** 10 sequential DB operations with no transaction. If the process crashes after Payment creation but before Enrollment creation, the student paid but gets no access. The idempotency log also records the event as processed, so PayMongo won't retry.

**Fix:**
```typescript
// Wrap the critical path in a single transaction:
await db.$transaction(async (tx) => {
  // 1. Create Payment
  const payment = await tx.payment.create({ data: { ... } });
  
  // 2. Issue invoice (inside transaction, but PDF render is deferred)
  await issueInvoiceForPayment(payment.id); // must use tx, not db
  
  // 3. Find or create user
  const { id: userId } = await findOrCreateUserByEmail(email, name); // must use tx
  
  // 4. Find course for tier
  const course = await tx.course.findFirst({ ... });
  
  // 5. Create Enrollment
  const enrollment = await tx.enrollment.create({ data: { ... payment connect ... } });
  
  // 6. Update CheckoutSession → PAID
  await tx.checkoutSession.update({ ... });
  
  // 7. Link enrollment to payment
  await tx.payment.update({ where: { id: payment.id }, data: { enrollmentId: enrollment.id } });
});
```

**Complication:** `issueInvoiceForPayment` and `findOrCreateUserByEmail` currently use the global `db` client. They need to accept a `PrismaClient` transaction scope parameter, or the transaction must be passed down.

**Approach:**
- Add optional `tx?: PrismaClient` parameter to `issueInvoiceForPayment`, `findOrCreateUserByEmail`
- Default to `db` when `tx` is not provided (backward compatible)
- Wrap the 7 operations in `db.$transaction`

**Test:** Write integration test that simulates crash after Payment create — verify Enrollment is NOT created (rollback).

---

### 1.2 Fix webhook idempotency race

**File:** `src/lib/enrollment.ts` — `markWebhookProcessed()` (lines 91-117)

**Problem:** `findUnique` then `create` has a read gap. Two concurrent webhooks for the same event both see `null` and both create. The unique constraint on `paymongoEventId` prevents duplicates at the DB level, but the second `create` throws a Prisma unique constraint error which propagates as an unhandled error.

**Fix:**
```typescript
export async function markWebhookProcessed(
  eventId: string, eventType: string, resourceType: string | null,
  resourceId: string | null, result?: string, httpStatus = 200,
): Promise<boolean> {
  try {
    await db.processedWebhook.create({
      data: {
        paymongoEventId: eventId,
        eventType, resourceType, resourceId,
        processingResult: result ?? null,
        httpStatus,
      },
    });
    return true; // first time — created successfully
  } catch (e) {
    // P2002 = Prisma unique constraint violation = already processed
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return false;
    }
    throw e; // unexpected error — let it propagate
  }
}
```

**Alternative:** Use `upsert` with `paymongoEventId` as the unique key. Simpler but less explicit about the "first time" semantics.

**Test:** Concurrent webhook test — fire 2 identical events simultaneously, verify only 1 returns `true`.

---

### 1.3 Fix `nextInvoiceSequence` full table scan

**File:** `src/lib/receipts.tsx` — `nextInvoiceSequence()` (lines 51-68)

**Problem:** Loads ALL invoices into memory to find max sequence for current year. No year filter.

**Fix:**
```typescript
async function nextInvoiceSequence(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`; // e.g. "2026-"
  
  const latest = await db.invoice.findFirst({
    where: {
      deletedAt: null,
      number: { startsWith: prefix },
    },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  
  const seq = latest ? parseInt(latest.number.split('-')[1], 10) + 1 : 1;
  return `${year}-${String(seq).padStart(5, '0')}`;
}
```

**Migration:** Existing invoices already have `number` format. Add a database index on `number` if not present (Prisma schema shows `@unique` which creates an index).

**Test:** Unit test with 3 existing invoices for current year — verify next is max+1.

---

### 1.4 Fix live class capacity race

**File:** `src/app/actions/live-classes.ts` — `registerForLiveClass()` (lines 86-104)

**Problem:** `isClassFull()` reads count, then `create()` inserts. TOCTOU race allows overfilling.

**Fix:**
```typescript
// Replace separate check + create with atomic conditional create:
const result = await db.$transaction(async (tx) => {
  const klass = await tx.liveClass.findUnique({
    where: { id: data.classId },
    select: { maxAttendees: true },
  });
  
  const count = await tx.liveClassRegistration.count({
    where: { liveClassId: data.classId, deletedAt: null, cancelledAt: null },
  });
  
  if (count >= klass.maxAttendees) {
    throw new Error('This class is at capacity.');
  }
  
  return tx.liveClassRegistration.create({
    data: { liveClassId: data.classId, userId: user.id },
  });
});
```

**Alternative:** Use a unique constraint + catch P2002 for idempotency, combined with a count check.

**Test:** Concurrent registration test — fire 50 registrations for a class with maxAttendees=50, verify exactly 50 succeed.

---

### 1.5 Fix registration count queries

**File:** `src/lib/live-classes.ts` — `listUpcomingClasses()`, `listPastClasses()`

**Problem:** Loads all registration rows just to compute `.length` and `.some()`.

**Fix:**
```typescript
// Replace:
registrations: { where: { deletedAt: null }, select: { id: true, userId: true } }

// With:
_count: {
  registrations: {
    where: { deletedAt: null, cancelledAt: null },
  },
},
// Plus a separate check for user-specific registration:
registrations: isUserId
  ? { where: { userId: currentUserId, deletedAt: null }, take: 1, select: { id: true } }
  : undefined,
```

**Test:** Performance test with 1000 registrations — verify query time < 50ms.

---

## Phase 2: Auth Hardening (Sprint 12)

### 2.1 Add rate limiting to auth endpoints

**File:** `src/app/actions/auth.ts`

**Approach:** Use `@upstash/ratelimit` with Redis (or Vercel KV) for production. For dev/staging, use a simple in-memory sliding window.

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60s'), // 5 attempts per 60s
  analytics: true,
});

export async function rateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const { success, remaining } = await ratelimit.limit(identifier);
  return { allowed: success, remaining };
}
```

**Apply to:**
- `signInAction` — rate limit by email
- `signUpAction` — rate limit by IP
- `createCheckoutSessionAction` — rate limit by email/IP

**Fallback:** If `UPSTASH_REDIS_REST_URL` is not set, skip rate limiting (dev mode). Log a warning.

---

### 2.2 Enforce email verification

**File:** `src/app/actions/auth.ts` — `signInAction()`

**Problem:** `emailVerified` field exists but is never checked. `UserStatus.PENDING_VERIFICATION` enum exists but is unused.

**Fix:**
```typescript
// In signInAction, after password verification:
if (!user.emailVerified) {
  throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
}
```

**Also needed:** Email verification flow (send verification email on signup, verify endpoint). This is a larger feature — for now, just enforce the check so unverified users can't sign in.

**Migration:** Existing users without `emailVerified` — backfill with `new Date()` for production users, or add a grace period.

---

### 2.3 Add server-side password confirmation

**File:** `src/lib/validation.ts` — `signUpSchema`

**Fix:**
```typescript
export const signUpSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  confirmPassword: z.string(),
  name: z.string().min(1).max(100).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});
```

**Also update:** `SignUpForm.tsx` to remove the client-only check (keep it for UX, but server now enforces too).

---

### 2.4 Clear cookie on admin role violation

**File:** `src/middleware.ts` — lines 86-88

**Fix:**
```typescript
if (isAdminRoute && payload.role !== 'ADMIN') {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.delete(AUTH_COOKIE); // clear stale token
  return response;
}
```

---

### 2.5 Change sameSite to strict

**File:** `src/lib/auth.ts` — `setAuthCookie()`

**Fix:**
```typescript
store.set(AUTH_COOKIE, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict', // was 'lax'
  path: '/',
  maxAge: TOKEN_TTL_SECONDS,
});
```

**Risk:** `strict` means the cookie won't be sent on cross-site navigations (e.g., clicking a link from an email). For an app where users click email links to reach dashboard, this could break. Test the checkout-complete flow specifically (PayMongo redirect → `/checkout/complete`).

**Alternative:** Keep `lax` but add CSRF tokens to auth actions. The current risk is low since server actions use POST with Origin header checking.

---

## Phase 3: Input Validation & API Safety (Sprint 12)

### 3.1 Add Zod schemas to admin actions

**File:** `src/app/actions/admin-users.ts`

```typescript
import { z } from 'zod';

const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID required.'),
});

export const suspendUserAction = createSafeAction(userIdSchema, async (data) => {
  await adminGuard();
  await db.user.update({ where: { id: data.userId }, data: { status: 'SUSPENDED' } });
  await auditLog({ action: 'SUSPEND_USER', entityType: 'User', entityId: data.userId });
  revalidatePath(`/admin/users/${data.userId}`);
  revalidatePath('/admin/users');
});
```

**Apply same pattern to:** `reactivateUserAction`, `deleteUserAction`, `updateCourseAction`, `addModuleAction`.

---

### 3.2 Validate tool session state

**File:** `src/app/actions/tools.ts` — `saveToolSession`, `submitToolSession`

**Problem:** `state: z.unknown()` accepts any JSON. Malformed state sent to grading engines could cause crashes.

**Fix:** Replace `z.unknown()` with tool-specific state schemas:
```typescript
const saveSessionSchema = z.object({
  sessionId: z.string().min(1),
  state: z.record(z.string(), z.unknown()), // at minimum require object shape
  timeSpentSeconds: z.number().int().min(0).optional(),
});
```

For `submitToolSession`, validate state shape matches the tool type before grading.

---

### 3.3 Harden Resend webhook

**File:** `src/app/api/resend/webhook/route.ts`

**Fix:**
```typescript
const secret = process.env.RESEND_WEBHOOK_SECRET;
if (!secret) {
  console.error('RESEND_WEBHOOK_SECRET not set — rejecting webhook');
  return new Response('Webhook secret not configured.', { status: 500 });
}
```

---

## Phase 4: Performance & Data Access (Sprint 13)

### 4.1 Optimize badge evaluation

**File:** `src/lib/badges.ts` — `evaluateBadges()`

**Problem:** Serial per-badge queries (~30 DB roundtrips). Each badge criteria check does individual DB calls.

**Fix:**
1. Fetch user data once before the loop (xp, level, streakDays, enrollment count, etc.)
2. Use `Promise.all` for independent badge criteria checks
3. Batch `UserBadge.findMany` for already-awarded check

```typescript
// Pre-fetch user data once
const user = await db.user.findUnique({
  where: { userId },
  select: { xp: true, level: true, streakDays: true, lastActiveAt: true },
});

// Pre-fetch already awarded badges
const awarded = new Set(
  (await db.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  })).map(a => a.badgeId)
);

// Then evaluate in parallel
const results = await Promise.all(
  published.filter(b => !awarded.has(b.id)).map(badge => checkCriteria(userId, badge, user, event))
);
```

---

### 4.2 Move gamification into JWT

**File:** `src/lib/auth.ts` — `signToken()`, `getSession()`

**Problem:** `getSession()` fetches `xp`, `level`, `streakDays` from DB on every call. These change infrequently (on lesson completion, quiz pass, tool submission).

**Fix:**
1. Add `xp`, `level`, `streakDays` to JWT payload
2. Update `signToken()` to include these fields
3. Update `getSession()` to read from JWT instead of DB
4. After any XP change, re-issue the token (or accept staleness for 7 days)

**Trade-off:** Token is slightly larger (~50 bytes). Gamification data may be stale for up to 7 days. For a learning platform, this is acceptable — XP/level display is not security-critical.

**Alternative:** Keep DB fetch but add a short TTL cache (e.g., 5-minute in-memory cache per user).

---

### 4.3 Add pagination to list actions

**Files:**
- `src/lib/refunds.ts` — `listPendingRefundRequests()`, `listUserPayments()`
- `src/app/actions/certificates.ts` — `listMyCertificatesAction()`

**Fix:** Add `take`/`skip` or cursor-based pagination:
```typescript
export async function listPendingRefundRequests(page = 1, pageSize = 20) {
  const [items, total] = await Promise.all([
    db.refundRequest.findMany({
      where: { deletedAt: null, status: RefundStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { ... },
    }),
    db.refundRequest.count({
      where: { deletedAt: null, status: RefundStatus.PENDING },
    }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
```

---

### 4.4 Fix discount code race

**File:** `src/lib/pricing.ts` — `validateDiscountCode()`

**Problem:** Validation reads `currentUses` without a lock. Two concurrent checkouts could both see `currentUses < maxUses` and proceed. The atomic `increment` in `createCheckoutSessionAtomic` will push over the limit by 1.

**Fix:** Accept the +1 overshoot for now (low volume). If it becomes an issue, use `SELECT ... FOR UPDATE` via `$queryRaw` or move the validation inside the transaction.

---

## Phase 5: DX & Resilience (Sprint 13)

### 5.1 Add error.tsx

**File:** `src/app/error.tsx` (root level)

```tsx
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p style={{ color: 'var(--ink-500)' }}>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
```

Also add `src/app/(dashboard)/error.tsx` and `src/app/admin/error.tsx` for route-group-specific handling.

---

### 5.2 Add loading.tsx

**File:** `src/app/loading.tsx`

```tsx
export default function Loading() {
  return (
    <main style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <p>Loading...</p>
    </main>
  );
}
```

---

### 5.3 Add not-found.tsx

**File:** `src/app/not-found.tsx`

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p style={{ color: 'var(--ink-500)' }}>The page you're looking for doesn't exist.</p>
      <Link href="/">Go home</Link>
    </main>
  );
}
```

---

### 5.4 Create (dashboard)/layout.tsx

**File:** `src/app/(dashboard)/layout.tsx`

```tsx
import { requireAuth } from '@/lib/auth';
import { BottomNav } from '@/components/ui/BottomNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  
  return (
    <div style={{ paddingBottom: 'var(--space-16)' }}>
      {children}
      <BottomNav active="home" />
    </div>
  );
}
```

**Note:** Currently each dashboard page imports `BottomNav` individually. This centralizes it.

---

### 5.5 Replace console.* with structured logger

**Files:**
- `src/lib/enrollment.ts` — 4 instances of `console.error`
- `src/app/api/resend/webhook/route.ts` — `console.info`/`console.warn`

**Fix:** Replace with `log.error(...)`, `log.info(...)`, `log.warn(...)` from `src/lib/logger.ts`.

---

## Implementation Order

```
Day 1 (E2E HOTFIX):
  └── 0.1 courses index page + test fixes (F4, F2, F3)

Week 1 (PIPELINE HOTFIX):
  ├── 1.1 handleCheckoutPaid transaction
  ├── 1.2 webhook idempotency race
  ├── 1.3 nextInvoiceSequence year filter
  ├── 1.4 live class capacity race
  └── 1.5 registration count optimization

Week 2 (Sprint 12):
  ├── 2.1 rate limiting
  ├── 2.2 email verification enforcement
  ├── 2.3 server-side password confirmation
  ├── 2.4 middleware cookie clear
  ├── 2.5 sameSite strict
  ├── 3.1 admin Zod schemas
  ├── 3.2 tool state validation
  └── 3.3 Resend webhook harden

Week 3 (Sprint 13):
  ├── 4.1 badge evaluation optimization
  ├── 4.2 gamification in JWT
  ├── 4.3 pagination
  ├── 4.4 discount race (monitor)
  ├── 5.1 error.tsx
  ├── 5.2 loading.tsx
  ├── 5.3 not-found.tsx
  ├── 5.4 dashboard layout
  └── 5.5 structured logger cleanup
```

---

## Testing Strategy

Each fix MUST include:
1. **Unit test** — for pure functions (nextInvoiceSequence, validateDiscountCode)
2. **Integration test** — for transactional operations (handleCheckoutPaid, registerForLiveClass)
3. **Concurrency test** — for race conditions (webhook idempotency, live class capacity)

**Test files go next to the code:** `foo.ts` → `foo.test.ts`

**Coverage thresholds:** 70% on `src/lib` and `src/app/actions` (per AGENTS.md)

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| 1.1 | Transaction wraps too much — slow webhook processing | Keep invoice PDF render OUTSIDE transaction (lazy on demand) |
| 1.2 | Unique constraint error changes error semantics | Catch P2002 specifically, log as info not error |
| 2.1 | Rate limiting blocks legitimate users | Generous limits (5/min for auth), skip in dev |
| 2.2 | Existing users without emailVerified locked out | Backfill migration before deploying enforcement |
| 2.5 | sameSite strict breaks email link flows | Test PayMongo redirect flow specifically |
| 4.2 | Stale gamification in JWT | Accept staleness, re-issue on significant XP changes |

---

## Success Criteria

- [ ] E2E critical-path suite passes 5/5 (Courses nav link resolves, tests assert real routing)
- [ ] Zero orphaned Payment records (Payment without Enrollment after webhook processing)
- [ ] Zero duplicate webhook processing under concurrent delivery
- [ ] Invoice sequence generation completes in < 100ms with 100K+ invoices
- [ ] Live class never exceeds maxAttendees under concurrent registration
- [ ] Auth endpoints have rate limiting in production
- [ ] All admin actions validate input with Zod
- [ ] All pages have error boundaries
- [ ] Dashboard pages use centralized layout with BottomNav
