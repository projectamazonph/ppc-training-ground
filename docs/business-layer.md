# Business Layer — Project Amazon PH Academy v2

**Status:** Approved
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

---

## Purpose

The business layer is what turns Project Amazon PH Academy from "free course site" into "paid product business." It covers pricing tiers, the enrollment flow, payment processing via PayMongo, refunds, receipts, and tier-based content gating.

This spec assumes PayMongo as the payment provider. PayMongo is the right choice because:
- Native Philippine peso (PHP) support, no currency conversion fees
- Supports GCash, Maya, GrabPay, bank transfer (InstaPay/PESONet), and credit/debit card
- Cleaner API than alternatives; better developer experience for one-time Philippine peso flows
- Reliable webhook delivery with signature verification
- Test mode well-documented (`sk_test_*` / `pk_test_*` keys)

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
2. Picks tier → POST /api/checkout (creates PayMongo Checkout Session or Source)
3. Redirected to PayMongo-hosted payment page
4. Pays via GCash / Maya / card / bank
5. PayMongo webhook POST /api/webhooks/paymongo → server verifies signature
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
CheckoutSession.status = AWAITING_PAYMENT (PayMongo source/checkout created)
  ↓
User completes payment on PayMongo
  ↓ (webhook)
CheckoutSession.status = PAID
Enrollment created (status: ACTIVE)
Payment created (status: COMPLETED)
Email sent
  ↓
User accesses dashboard
```

Failure paths:

- Webhook times out → PayMongo retries (typically 3 attempts over 24h). If still failing, mark CheckoutSession as `FAILED_PENDING_REVIEW`, notify admin.
- User abandons checkout → CheckoutSession expires after 24 hours, no Enrollment created.
- Webhook arrives but Enrollment can't be created (DB issue) → mark CheckoutSession as `ERROR`, retry queue picks it up.

## New Prisma Models

```prisma
model PricingTier {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String
  pricePhp    Int      // centavos (299900 = ₱2,999.00)
  features    String   // JSON
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  paymongoProductId String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  enrollments Enrollment[]
  discounts   DiscountTier[]
  checkouts   CheckoutSession[]
  payments    Payment[]

  @@index([isActive, sortOrder])
  @@index([deletedAt])
}

model CheckoutSession {
  id              String   @id @default(cuid())
  userId          String?
  email           String
  pricingTierId   String
  status          CheckoutStatus @default(PENDING)
  // PayMongo references
  paymongoSourceId      String? @unique
  paymongoPaymentId     String? @unique
  paymongoCheckoutId    String? @unique
  paymongoCheckoutUrl   String?
  paymongoRedirectUrl   String?
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
  metadata        String?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User?         @relation(fields: [userId], references: [id])
  pricingTier     PricingTier   @relation(fields: [pricingTierId], references: [id])
  discountCode    DiscountCode? @relation(fields: [discountCodeId], references: [id])
  payment         Payment?

  @@index([userId])
  @@index([status])
  @@index([paymongoSourceId])
  @@index([paymongoCheckoutId])
  @@index([expiresAt])
  @@index([deletedAt])
}

enum CheckoutStatus {
  PENDING
  AWAITING_PAYMENT
  PAID
  EXPIRED
  FAILED
  ERROR
}

model Payment {
  id                String   @id @default(cuid())
  userId            String
  pricingTierId     String
  enrollmentId      String?  @unique
  checkoutSessionId String?  @unique
  // PayMongo references
  paymongoPaymentId   String?  @unique
  paymongoSourceId    String?
  paymongoChargeId    String?
  amountPhp         Int
  feePhp            Int      @default(0)
  netAmountPhp      Int
  currency          String   @default("PHP")
  method            PaymentMethod
  status            PaymentStatus @default(PENDING)
  paidAt            DateTime?
  refundedAt        DateTime?
  refundAmountPhp   Int?
  refundReason      String?
  receiptUrl        String?
  invoiceUrl        String?
  metadata          String?  // JSON of PayMongo response
  deletedAt         DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User             @relation(fields: [userId], references: [id])
  pricingTier       PricingTier      @relation(fields: [pricingTierId], references: [id])
  enrollment        Enrollment?      @relation(fields: [enrollmentId], references: [id])
  checkoutSession   CheckoutSession? @relation(fields: [checkoutSessionId], references: [id])
  refundRequests    RefundRequest[]

  @@index([userId])
  @@index([status])
  @@index([paymongoPaymentId])
  @@index([paidAt])
  @@index([deletedAt])
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

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

model DiscountCode {
  id              String   @id @default(cuid())
  code            String   @unique
  description     String
  type            DiscountType
  value           Int
  maxUses         Int?
  currentUses     Int      @default(0)
  minPurchasePhp  Int      @default(0)
  startsAt        DateTime
  expiresAt       DateTime
  isActive        Boolean  @default(true)
  createdById     String
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  createdBy       User           @relation(fields: [createdById], references: [id])
  tiers           DiscountTier[]
  checkouts       CheckoutSession[]

  @@index([code])
  @@index([isActive, startsAt, expiresAt])
  @@index([deletedAt])
}

model DiscountTier {
  id            String   @id @default(cuid())
  discountId    String
  pricingTierId String

  discount      DiscountCode @relation(fields: [discountId], references: [id], onDelete: Cascade)
  pricingTier   PricingTier  @relation(fields: [pricingTierId], references: [id], onDelete: Cascade)

  @@unique([discountId, pricingTierId])
}

enum DiscountType {
  PERCENTAGE
  FIXED
}

model RefundRequest {
  id          String   @id @default(cuid())
  userId      String
  paymentId   String
  reason      String
  amountPhp   Int
  status      RefundStatus @default(PENDING)
  reviewedById String?
  reviewedAt  DateTime?
  reviewerNotes String?
  paymongoRefundId String?
  processedAt DateTime?
  failedAt    DateTime?
  failureReason String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  payment     Payment  @relation(fields: [paymentId], references: [id])
  reviewedBy  User?    @relation("RefundReviewer", fields: [reviewedById], references: [id])

  @@index([userId])
  @@index([status])
  @@index([paymentId])
  @@index([deletedAt])
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  PROCESSED
  FAILED
}
```

## PayMongo Integration

### Setup

1. Create a PayMongo account at https://paymongo.com.
2. Get test API keys from the PayMongo Dashboard (Developers → API Keys).
3. Set webhook endpoint in Dashboard (Developers → Webhooks) pointing to `https://amph-v2.vercel.app/api/webhooks/paymongo`.
4. Subscribe to events: `checkout_session.payment.paid`, `checkout_session.payment.failed`, `source.chargeable`, `payment.paid`, `payment.failed`, `payment.refunded`.

### Environment Variables

```
# Test mode
PAYMONGO_SECRET_KEY="sk_test_..."
PAYMONGO_PUBLIC_KEY="pk_test_..."

# Live mode (after verification)
PAYMONGO_SECRET_KEY="sk_live_..."
PAYMONGO_PUBLIC_KEY="pk_live_..."

# Webhook secret (from PayMongo dashboard after registering endpoint)
PAYMONGO_WEBHOOK_SECRET="whsec_..."
```

### Approach: Checkout Session (preferred)

PayMongo's hosted Checkout Sessions are the recommended integration. They handle the entire UI, support all payment methods in one flow, and reduce PCI scope.

```typescript
// src/lib/paymongo.ts
import Paymongo from 'paymongo';

const paymongo = new Paymongo(process.env.PAYMONGO_SECRET_KEY!);

export async function createCheckoutSession(params: {
  amount: number;            // centavos
  description: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  return paymongo.checkoutSessions.create({
    data: {
      attributes: {
        amount: params.amount,
        currency: 'PHP',
        description: params.description,
        payment_method_types: [
          'gcash',
          'paymaya',
          'grab_pay',
          'card',
          'dob',         // Direct online bank transfer (InstaPay/PESONet)
          'billease',    // Optional: buy-now-pay-later
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata ?? {},
      },
    },
  });
}
```

### Approach: Sources (alternative, for embedded flows)

For embedded payment flows where you want users to stay on your site:

```typescript
// Create a Source for GCash/Maya/bank
export async function createSource(params: {
  amount: number;
  type: 'gcash' | 'paymaya' | 'grab_pays' | 'dob';
  email: string;
  redirectUrl: string;
  metadata?: Record<string, string>;
}) {
  return paymongo.sources.create({
    data: {
      attributes: {
        amount: params.amount,
        currency: 'PHP',
        type: params.type,
        redirect: { success: `${params.redirectUrl}?status=success`, failed: `${params.redirectUrl}?status=failed` },
        billing: { email: params.email },
        metadata: params.metadata ?? {},
      },
    },
  });
}
```

### Webhook Handler

```typescript
// src/app/api/webhooks/paymongo/route.ts
import crypto from 'crypto';
import { handleCheckoutPaid, handleCheckoutFailed, handlePaymentRefunded } from '@/lib/enrollment';

export async function POST(request: Request) {
  const body = await request.text();
  const signatureHeader = request.headers.get('paymongo-signature');

  if (!signatureHeader) {
    return new Response('Missing signature', { status: 401 });
  }

  // Verify signature: PayMongo sends two signatures (live + test), separated by comma
  // Format: "t=timestamp,te=test_signature,li=live_signature"
  if (!verifyPayMongoSignature(body, signatureHeader)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  switch (event.data.attributes.type) {
    case 'checkout_session.payment.paid':
      await handleCheckoutPaid(event);
      break;
    case 'checkout_session.payment.failed':
      await handleCheckoutFailed(event);
      break;
    case 'payment.refunded':
      await handlePaymentRefunded(event);
      break;
    default:
      console.log('Unhandled PayMongo event:', event.data.attributes.type);
  }

  return new Response('OK', { status: 200 });
}

function verifyPayMongoSignature(body: string, header: string): boolean {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET!;
  const parts = Object.fromEntries(
    header.split(',').map(p => p.split('=') as [string, string])
  );
  const timestamp = parts.t;
  const expectedSig = parts.te ?? parts.li;

  if (!timestamp || !expectedSig) return false;

  const payload = `${timestamp}.${body}`;
  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'utf8'),
    Buffer.from(computed, 'utf8')
  );
}
```

Webhook must respond in < 5 seconds. All heavy work goes to a background queue.

### Idempotency

PayMongo may send the same webhook multiple times. The handler must be idempotent:

```typescript
// Before processing, check if event already handled
const existing = await db.processedWebhook.findUnique({
  where: { paymongoEventId: event.data.id }
});
if (existing) return;

await db.$transaction(async (tx) => {
  await tx.processedWebhook.create({
    data: { paymongoEventId: event.data.id, processedAt: new Date() }
  });
  // ... rest of handler
});
```

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

1. Call PayMongo refund API
2. On success: Payment.status = REFUNDED, Enrollment.status = CANCELLED, user loses access, email sent
3. On failure: RefundRequest.status = FAILED, admin retries

### PayMongo Refund API Call

```typescript
export async function refundPayment(paymentId: string, amountCentavos: number, reason: string) {
  return paymongo.refunds.create({
    data: {
      attributes: {
        amount: amountCentavos,
        payment_id: paymentId,
        reason: 'requested_by_customer',
        metadata: { internalReason: reason },
      },
    },
  });
}
```

Valid reasons: `duplicate`, `fraudulent`, `requested_by_customer`. Use `requested_by_customer` for all standard refund requests.

### Admin-Initiated Refund

For chargebacks or special cases. Admin clicks "Refund" on a payment, enters amount (full or partial) and reason. Same flow as self-service approval.

## Receipts and Invoices

### Email Receipt

Sent automatically on successful payment. Includes:
- Course/tier name
- Amount paid
- Payment method (GCash, Maya, etc.)
- PayMongo transaction ID
- Refund policy summary
- Receipt PDF link

### PDF Receipt

Generated server-side using `@react-pdf/renderer`. Includes BIR-compliant fields (TIN, business name, etc.). Available at `Payment.receiptUrl`. Stored in Vercel Blob.

### Philippine Tax Compliance

- Project Amazon PH Academy is a Philippine business. BIR requires:
  - Receipts with sequential numbering
  - TIN displayed
  - VAT breakdown (12% VAT on digital services)
- Implemented via `Invoice` table with sequential numbers (00001, 00002, ...)
- VAT calculation: `finalAmountPhp / 1.12` = net, `finalAmountPhp - net` = VAT

## Email Notifications

Using Resend (free tier covers Project Amazon PH Academy scale):

| Trigger | Template |
|---------|----------|
| Payment successful | "Welcome to Project Amazon PH Academy. Your access is live." |
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

For v2, Project Amazon PH Academy is one-time purchase only. No recurring billing. Dunning applies only to subscription billing (deferred to v2.1 or later).

## PayMongo Test Mode

Test mode API keys allow testing without real charges. Test card numbers:

- **Successful payment:** `4242 4242 4242 4242`, any future expiry, any CVC
- **Declined payment:** `4000 0000 0000 0002`
- **Insufficient funds:** `4000 0000 0000 9995`
- **Lost card:** `4000 0000 0000 9987`
- **Stolen card:** `4000 0000 0000 9979`

Test GCash/Maya: PayMongo test mode simulates redirect flow without actual money movement.

Test webhook endpoint: use `ngrok` or `cloudflared` tunnel to expose localhost during development. Register the tunneled URL as your webhook endpoint in PayMongo dashboard.

## Going Live Checklist

1. PayMongo business account verified (KYC complete, bank account linked for payouts).
2. Live API keys generated and stored in Vercel env vars.
3. Production webhook endpoint registered in PayMongo dashboard with HMAC secret rotated.
4. Test checkout → payment → webhook → enrollment flow end-to-end with real test card.
5. Refund flow tested with test payment.
6. Email receipts verified in production.
7. Tax compliance (BIR) confirmed with accountant.
8. Live transactions tested with small amounts before public launch.

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
- Webhook handler idempotent (replays don't double-process)