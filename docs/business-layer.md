# Business Layer Specification — AMPH Academy v2

**Status:** Approved
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

---

## Purpose

The business layer is what turns AMPH Academy from "free course site" into "paid product business." It covers pricing tiers, the enrollment flow, payment processing, refunds, receipts, and tier-based content gating.

This spec assumes Xendit as the payment provider. Xendit is the right choice because:
- Native Philippine peso (PHP) support, no currency conversion fees
- Supports GCash, Maya, GrabPay, bank transfer, and credit card
- Webhooks for payment confirmation
- Developer-friendly API
- Reasonable fees (2.9% + ₱15 for cards, lower for e-wallets)

Fallback: PayMongo (also PHP-native, similar feature set).

## Pricing Tiers

Three tiers, matching ProjectAmazonPH's existing structure:

| Tier | Price | Includes |
|------|-------|----------|
| **PPC Foundations** | ₱2,999 | 5 core modules, basic tools (Campaign Builder, Bid Elevator, STR Triage), quizzes, badges, community access |
| **Accelerated Mastery** | ₱5,999 | Everything in Foundations + advanced modules (8 total), all scenario packs (kitchen, electronics, garden, fitness, beauty), downloadable resources, live class recordings |
| **Ultimate Transformation** | ₱9,999 | Everything in Mastery + weekly live classes with Ryan, 1-on-1 portfolio review (1×/month), private community channel, certificate priority review |

Prices are stored on `Course.tier` + `Course.price`. Tier is a `CourseTier` enum value. Editing tier price is admin-only (see admin backend spec).

**Bundle option:** All-access pass = ₱12,999 (saves ₱6,997 vs buying Ultimate once + future updates). Admin-controlled.

**Discount codes:** Single-use and multi-use. Created by admin. Applied at checkout. Stored in `DiscountCode` table.

## Enrollment Flow

```
1. Visitor browses /pricing
2. Picks tier → POST /api/checkout (creates Xendit invoice)
3. Redirected to Xendit payment page
4. Pays via GCash / Maya / card / bank
5. Xendit webhook POST /api/webhooks/xendit → server verifies signature
6. Server creates Enrollment, links to Payment
7. Server sends confirmation email with course access link
8. User clicks link → already logged in or sent to signup → lands in dashboard
```

### State Machine

```
User visits /pricing
  ↓
CheckoutSession created (status: PENDING)
  ↓
User submits payment method
  ↓
CheckoutSession.status = AWAITING_PAYMENT (Xendit invoice created)
  ↓
User completes payment in Xendit
  ↓ (webhook)
CheckoutSession.status = PAID
Enrollment created (status: ACTIVE)
Payment created (status: COMPLETED)
Email sent
  ↓
User accesses dashboard
```

Failure paths:

- Webhook times out → Xendit retries. If still failing after 3 retries, mark CheckoutSession as `FAILED_PENDING_REVIEW`, notify admin.
- User abandons checkout → CheckoutSession expires after 24 hours, no Enrollment created.
- Webhook arrives but Enrollment can't be created (DB issue) → mark CheckoutSession as `ERROR`, retry queue picks it up.

## New Prisma Models

```prisma
model PricingTier {
  id          String   @id @default(cuid())
  orgId       String?
  slug        String   @unique  // "ppc-foundations", "accelerated-mastery", "ultimate-transformation"
  name        String
  description String
  pricePhp    Int      // in centavos (299900 = ₱2,999.00)
  features    String   // JSON array of bullet points
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  stripePriceId String?  // Xendit equivalent
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  enrollments Enrollment[]
  discounts   DiscountTier[]

  @@index([orgId])
  @@index([isActive, sortOrder])
}

model CheckoutSession {
  id              String   @id @default(cuid())
  orgId           String?
  userId          String?  // nullable for guest checkout
  email           String   // captured at checkout start
  pricingTierId   String?
  courseId        String?
  status          CheckoutStatus @default(PENDING)
  xenditInvoiceId String?  @unique
  xenditInvoiceUrl String?
  amountPhp       Int
  discountCodeId  String?
  discountAmount  Int      @default(0)
  finalAmountPhp  Int
  expiresAt       DateTime
  paidAt          DateTime?
  failedAt        DateTime?
  failureReason   String?
  ipAddress       String?
  userAgent       String?
  metadata        String?  // JSON
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User?           @relation(fields: [userId], references: [id])
  pricingTier     PricingTier?    @relation(fields: [pricingTierId], references: [id])
  payment         Payment?
  discountCode    DiscountCode?   @relation(fields: [discountCodeId], references: [id])

  @@index([orgId])
  @@index([userId])
  @@index([status])
  @@index([xenditInvoiceId])
  @@index([expiresAt])
}

model Payment {
  id                String   @id @default(cuid())
  orgId             String?
  userId            String
  pricingTierId     String?
  enrollmentId      String?  @unique
  checkoutSessionId String?  @unique
  xenditPaymentId   String?  @unique
  xenditChargeId    String?
  amountPhp         Int      // in centavos
  feePhp            Int      @default(0)
  netAmountPhp      Int      // amountPhp - feePhp
  currency          String   @default("PHP")
  method            PaymentMethod  // GCASH, MAYA, CARD, BANK, etc.
  status            PaymentStatus  @default(PENDING)
  paidAt            DateTime?
  refundedAt        DateTime?
  refundAmountPhp   Int?
  refundReason      String?
  receiptUrl        String?
  invoiceUrl        String?
  metadata          String?  // JSON of Xendit response
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User          @relation(fields: [userId], references: [id])
  pricingTier       PricingTier?  @relation(fields: [pricingTierId], references: [id])
  enrollment        Enrollment?   @relation(fields: [enrollmentId], references: [id])
  checkoutSession   CheckoutSession? @relation(fields: [checkoutSessionId], references: [id])

  @@index([orgId])
  @@index([userId])
  @@index([status])
  @@index([xenditPaymentId])
  @@index([paidAt])
}

model DiscountCode {
  id              String   @id @default(cuid())
  orgId           String?
  code            String   @unique  // "LAUNCH50", "BLACKFRIDAY", etc.
  description     String
  type            DiscountType  // PERCENTAGE, FIXED
  value           Int      // percentage (1-100) or centavos
  maxUses         Int?     // null = unlimited
  currentUses     Int      @default(0)
  minPurchasePhp  Int      @default(0)
  startsAt        DateTime
  expiresAt       DateTime
  isActive        Boolean  @default(true)
  createdById     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  createdBy       User         @relation(fields: [createdById], references: [id])
  tiers           DiscountTier[]
  checkouts       CheckoutSession[]

  @@index([orgId])
  @@index([code])
  @@index([isActive, startsAt, expiresAt])
}

model DiscountTier {
  id            String   @id @default(cuid())
  discountId    String
  pricingTierId String

  discount      DiscountCode @relation(fields: [discountId], references: [id], onDelete: Cascade)
  pricingTier   PricingTier  @relation(fields: [pricingTierId], references: [id], onDelete: Cascade)

  @@unique([discountId, pricingTierId])
}

model RefundRequest {
  id          String   @id @default(cuid())
  orgId       String?
  userId      String
  paymentId   String
  reason      String
  amountPhp   Int
  status      RefundStatus @default(PENDING)
  reviewedById String?
  reviewedAt   DateTime?
  reviewerNotes String?
  xenditRefundId String?
  processedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  payment     Payment  @relation(fields: [paymentId], references: [id])
  reviewedBy  User?    @relation("RefundReviewer", fields: [reviewedById], references: [id])

  @@index([orgId])
  @@index([userId])
  @@index([status])
  @@index([paymentId])
}

enum CheckoutStatus {
  PENDING
  AWAITING_PAYMENT
  PAID
  EXPIRED
  FAILED
  ERROR
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PaymentMethod {
  GCASH
  MAYA
  GRABPAY
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  OTC
  OTHER
}

enum DiscountType {
  PERCENTAGE
  FIXED
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  PROCESSED
  FAILED
}
```

## Xendit Integration

### Setup

Environment variables:

```
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_TOKEN=whk_...
XENDIT_PUBLIC_KEY=xnd_public_development_...
```

Stored in Vercel env vars. Never committed.

### Create Invoice

```typescript
// src/lib/xendit.ts
import { Xendit } from 'xendit-node';

const xendit = new Xendit({ secretKey: process.env.XENDIT_SECRET_KEY! });

export async function createInvoice(params: {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successUrl: string;
  failureUrl: string;
}) {
  return xendit.Invoice.createInvoice({
    data: {
      externalId: params.externalId,
      amount: params.amount,
      payerEmail: params.payerEmail,
      description: params.description,
      successRedirectUrl: params.successUrl,
      failureRedirectUrl: params.failureUrl,
      currency: 'PHP',
      paymentMethods: ['GCASH', 'PAYMAYA', 'GRABPAY', 'CREDIT_CARD', 'BANK_TRANSFER'],
    },
  });
}
```

### Webhook Handler

```typescript
// src/app/api/webhooks/xendit/route.ts
import { verifyWebhookSignature } from '@/lib/xendit';
import { handleInvoicePaid, handleInvoiceFailed } from '@/lib/enrollment';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-callback-token')!;

  if (!verifyWebhookSignature(signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  switch (event.event) {
    case 'invoice.paid':
      await handleInvoicePaid(event);
      break;
    case 'invoice.expired':
    case 'invoice.failed':
      await handleInvoiceFailed(event);
      break;
    default:
      console.log('Unhandled Xendit event:', event.event);
  }

  return new Response('OK', { status: 200 });
}
```

Webhook must respond in < 5 seconds. All heavy work goes to a background queue (Inngest or Vercel cron).

## Tier Gating

Once enrolled, what content does the user see?

### Rule

| Tier | Course access | Tool access | Live class access | Resources | Certificate |
|------|---------------|-------------|-------------------|-----------|-------------|
| PPC Foundations | 5 core modules | Basic tools (3 scenarios) | Recordings only | Basic templates | Yes |
| Accelerated Mastery | All 8 modules | All scenario packs | Recordings + 1 live class/mo | All resources | Yes |
| Ultimate Transformation | All 8 modules + early access | All + new packs first | Weekly live + portfolio review | All + custom templates | Priority review |

### Implementation

Every gated route checks enrollment tier via `requireTier()` helper:

```typescript
// src/lib/auth.ts
export async function requireTier(minimumTier: CourseTier) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const enrollment = await db.enrollment.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!enrollment) redirect('/pricing');

  const tierOrder = ['PPC_FOUNDATIONS', 'ACCELERATED_MASTERY', 'ULTIMATE_TRANSFORMATION'];
  const userTierIndex = tierOrder.indexOf(enrollment.tier);
  const requiredIndex = tierOrder.indexOf(minimumTier);

  if (userTierIndex < requiredIndex) {
    redirect(`/upgrade?needed=${minimumTier}`);
  }

  return { user, enrollment };
}
```

Used in lesson pages, tool pages, live class pages:

```typescript
// src/app/(dashboard)/courses/[slug]/lessons/[lessonId]/page.tsx
export default async function LessonPage({ params }) {
  const { user, enrollment } = await requireTier('PPC_FOUNDATIONS');
  const lesson = await getLesson(params.lessonId);
  // ...
}
```

For Ultimate-tier-only content (live portfolio review, custom templates), check `enrollment.tier === 'ULTIMATE_TRANSFORMATION'` specifically.

## Refund Flow

### Self-Service (within 7 days)

1. User goes to `/account/billing`
2. Sees recent payment
3. Clicks "Request Refund"
4. Modal: "Why are you requesting a refund?" + reason field
5. Submits → creates RefundRequest (status: PENDING)
6. Admin sees request in `/admin/payments`
7. Admin clicks "Approve" or "Reject"

On approve:
1. Call Xendit refund API
2. On success: Payment.status = REFUNDED, Enrollment.status = CANCELLED, user loses access, email sent
3. On failure: RefundRequest.status = FAILED, admin retries

### Admin-Initiated Refund

For chargebacks or special cases. Admin clicks "Refund" on a payment, enters amount (full or partial) and reason. Same flow as self-service approval.

## Receipts and Invoices

### Email Receipt

Sent automatically on successful payment. Includes:
- Course/tier name
- Amount paid
- Payment method (GCash, Maya, etc.)
- Transaction ID
- Refund policy summary
- Receipt PDF link

### PDF Receipt

Generated server-side using `@react-pdf/renderer`. Includes BIR-compliant fields (TIN, business name, etc.). Available at `Payment.receiptUrl`. Stored in Vercel Blob or S3.

### Philippine Tax Compliance

- AMPH Academy is a Philippine business. BIR requires:
  - Receipts with sequential numbering
  - TIN displayed
  - VAT breakdown (12% VAT on digital services)
- Implemented via `Invoice` table with sequential numbers (00001, 00002, ...)
- VAT calculation: `finalAmountPhp / 1.12` = net, `finalAmountPhp - net` = VAT

## Email Notifications

Using Resend (free tier covers AMPH Academy scale):

| Trigger | Template |
|---------|----------|
| Payment successful | "Welcome to AMPH Academy. Your access is live." |
| Payment failed | "Payment didn't go through. Try again here." |
| Refund approved | "Your refund of ₱X has been processed." |
| Certificate issued | "You earned a certificate. View it here." |
| Live class reminder (24h before) | "Reminder: [Class title] tomorrow at [time]." |
| Live class reminder (1h before) | "[Class title] starts in 1 hour. Join here." |

Email templates in `src/emails/` as React Email components.

## Discount Code Mechanics

### Create

Admin creates code with:
- Code (uppercase, alphanumeric)
- Type (percentage or fixed amount)
- Value
- Max uses (optional)
- Min purchase (optional)
- Valid date range
- Applies to tiers (optional, otherwise all)

### Apply

User enters code at checkout. Server validates:
- Code exists, is active
- Within date range
- Not exceeded max uses
- Meets min purchase
- Applies to selected tier

Discount applied: reduces `finalAmountPhp` by calculated amount.

Discount codes are atomic — increment `currentUses` inside the same transaction that creates the CheckoutSession, decrement on expiration or admin voiding.

## Dunning

If a recurring subscription (future) fails:
1. Day 0: Charge fails, user notified, grace period starts
2. Day 3: Second charge attempt, retry, user notified
3. Day 7: Final charge attempt, user notified, account downgraded to read-only on next day
4. Day 14: Account suspended

For v2, AMPH Academy is one-time purchase only. No recurring billing. Dunning applies only to subscription billing (deferred to v2.1 or later).

## Open Questions

- Bundle pricing for all-access pass: yes/no?
- Affiliate program for VAs to refer others? (Defer to v2.1)
- Multi-currency? (Defer. PHP only for v2.)
- Subscription model vs one-time? (Defer. One-time for v2.)
- Corporate/B2B bulk seats? (Defer to v2.1.)

## Success Criteria

- User can complete checkout in < 60 seconds
- Webhook → Enrollment → Email latency < 30 seconds
- Refund processed within 1 business day of approval
- All transactions appear in admin `/payments` view
- All enrolled users can access their tier's content
- Tier upgrade flow works (pay difference, get access)
- Tax-compliant receipts generated for every payment
- Email notifications sent on all payment state transitions
- Zero orphan CheckoutSessions (every one ends in PAID, EXPIRED, FAILED, or ERROR)