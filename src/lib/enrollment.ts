/**
 * Enrollment & webhook processing.
 *
 * Sprint 6 — Payments.
 *
 * Contains the webhook event handlers that:
 *   1. Check idempotency (ProcessedWebhook table)
 *   2. Create Payment + Enrollment on success
 *   3. Update CheckoutSession status
 *   4. Handle failure/expiry
 *
 * All handlers are pure and idempotent-safe — they check the
 * ProcessedWebhook log before doing any work.
 */

import 'server-only';

import { db } from './db';
import { CheckoutStatus, EnrollmentStatus, PaymentMethod, PaymentStatus } from './enums';
import { randomUUID } from 'node:crypto';

export interface CheckoutPaidEvent {
  data: {
    id: string;               // PayMongo event id
    attributes: {
      type: 'checkout_session.payment.paid';
      data: {
        id: string;           // checkout_session id
        attributes: {
          id: string;
          payment_id: string; // payment id
          amount: number;
          currency: string;
          status: string;
          payment_method_type: string;
          metadata: Record<string, string>;
        };
      };
    };
  };
}

export interface CheckoutFailedEvent {
  data: {
    id: string;
    attributes: {
      type: 'checkout_session.payment.failed';
      data: {
        id: string;
        attributes: {
          id: string;
          failure_reason?: string;
          metadata: Record<string, string>;
        };
      };
    };
  };
}

export interface PaymentRefundedEvent {
  data: {
    id: string;
    attributes: {
      type: 'payment.refunded';
      data: {
        id: string;
        attributes: {
          id: string;       // payment id
          amount: number;
          payment_id: string;
          metadata: Record<string, string>;
        };
      };
    };
  };
}

export type PayMongoWebhookEvent =
  | { type: 'checkout_session.payment.paid'; payload: CheckoutPaidEvent }
  | { type: 'checkout_session.payment.failed'; payload: CheckoutFailedEvent }
  | { type: 'payment.refunded'; payload: PaymentRefundedEvent }
  | { type: string; payload: unknown };

/**
 * Mark a webhook event as processed (idempotency log).
 * Returns true if this is the first time we've seen it; false if it was
 * already processed. If false, the caller should skip all side effects.
 */
export async function markWebhookProcessed(
  eventId: string,
  eventType: string,
  resourceType: string | null,
  resourceId: string | null,
  result?: string,
  httpStatus = 200,
): Promise<boolean> {
  const existing = await db.processedWebhook.findUnique({
    where: { paymongoEventId: eventId },
    select: { id: true },
  });
  if (existing) {
    return false; // already processed
  }
  await db.processedWebhook.create({
    data: {
      paymongoEventId: eventId,
      eventType,
      resourceType,
      resourceId,
      processingResult: result ?? null,
      httpStatus,
    },
  });
  return true;
}

/**
 * Find an existing user by email, or create a minimal placeholder user
 * for guest checkout. The placeholder gets a random password hash and
 * must complete signup on first dashboard visit.
 */
export async function findOrCreateUserByEmail(
  email: string,
  name?: string | null,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { id: existing.id, isNew: false };

  // Create placeholder user. They'll complete signup via /auth/signup
  // which will update passwordHash + name + emailVerified.
  const placeholder = await db.user.create({
    data: {
      email,
      name: name ?? email.split('@')[0],
      emailVerified: null,
      passwordHash: `placeholder_${crypto.randomUUID()}`,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  return { id: placeholder.id, isNew: true };
}

function mapPaymentMethod(pm: string): PaymentMethod {
  const m = pm.toLowerCase();
  if (m === 'gcash') return PaymentMethod.GCASH;
  if (m === 'paymaya') return PaymentMethod.MAYA;
  if (m === 'grab_pay' || m === 'grabpay') return PaymentMethod.GRABPAY;
  if (m === 'card') return PaymentMethod.CREDIT_CARD;
  if (m === 'dob') return PaymentMethod.BANK_TRANSFER;
  return PaymentMethod.OTHER;
}

/**
 * Handle `checkout_session.payment.paid` webhook.
 *
 * Flow:
 *   1. Idempotency check on event id
 *   2. Find the CheckoutSession by PayMongo checkout_session id
 *   3. Create Payment record
 *   4. Find or create user
 *   5. Create Enrollment (ACTIVE)
 *   6. Update CheckoutSession -> PAID
 *   7. Return enrollment for email sending (Sprint 8)
 */
export async function handleCheckoutPaid(
  event: CheckoutPaidEvent,
): Promise<{ enrollmentId: string; paymentId: string; userId: string } | null> {
  const eventId = event.data.id;
  const csId = event.data.attributes.data.id;
  const paymentIdPm = event.data.attributes.data.attributes.payment_id;
  const amount = event.data.attributes.data.attributes.amount;
  const method = event.data.attributes.data.attributes.payment_method_type;
  const metadata = event.data.attributes.data.attributes.metadata;

  // Idempotency
  const firstTime = await markWebhookProcessed(
    eventId,
    'checkout_session.payment.paid',
    'checkout_session',
    csId,
    `payment_id=${paymentIdPm}`,
  );
  if (!firstTime) return null;

  // Find our CheckoutSession
  const checkout = await db.checkoutSession.findUnique({
    where: { paymongoSourceId: csId }, // we store the source/checkout id here
    include: { pricingTier: true },
  });
  if (!checkout) {
    // Log but don't throw — webhook will still ack 200
    console.error(`[webhook] CheckoutSession not found for paymongo id ${csId}`);
    return null;
  }

  // Create Payment
  const payment = await db.payment.create({
    data: {
      userId: checkout.userId ?? '', // will be updated if guest
      pricingTierId: checkout.pricingTierId,
      checkoutSessionId: checkout.id,
      paymongoPaymentId: paymentIdPm,
      paymongoSourceId: csId,
      amountPhp: checkout.finalAmountPhp,
      feePhp: 0, // PayMongo fee not exposed in this event; compute in Sprint 8 if needed
      netAmountPhp: checkout.finalAmountPhp,
      currency: 'PHP',
      method: mapPaymentMethod(method),
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
      metadata: JSON.stringify(metadata ?? {}),
    },
  });

  // Find or create user (guest checkout support)
  const { id: userId, isNew } = await findOrCreateUserByEmail(checkout.email, metadata.name ?? null);

  // Resolve the course for this pricing tier. A tier may have multiple courses;
  // we pick the first published one (or the first one if none published).
  const course = await db.course.findFirst({
    where: { pricingTierId: checkout.pricingTierId, deletedAt: null },
    orderBy: { isPublished: 'desc' },
    select: { id: true },
  });
  if (!course) {
    console.error(`[webhook] No course found for pricing tier ${checkout.pricingTierId}`);
    return null;
  }

  // If guest, link payment to user
  if (isNew) {
    await db.payment.update({
      where: { id: payment.id },
      data: { userId },
    });
  }

  // Create Enrollment
  const enrollment = await db.enrollment.create({
    data: {
      userId,
      courseId: course.id,
      pricingTierId: checkout.pricingTierId,
      tier: checkout.pricingTier.tier,
      status: EnrollmentStatus.ACTIVE,
      payment: { connect: { id: payment.id } },
      enrolledAt: new Date(),
    },
  });

  // Update CheckoutSession
  await db.checkoutSession.update({
    where: { id: checkout.id },
    data: {
      status: CheckoutStatus.PAID,
      paymongoPaymentId: paymentIdPm,
      paidAt: new Date(),
      userId: isNew ? userId : checkout.userId,
    },
  });

  // Link enrollment to payment
  await db.payment.update({
    where: { id: payment.id },
    data: { enrollmentId: enrollment.id },
  });

  return { enrollmentId: enrollment.id, paymentId: payment.id, userId };
}

/**
 * Handle `checkout_session.payment.failed` webhook.
 */
export async function handleCheckoutFailed(
  event: CheckoutFailedEvent,
): Promise<void> {
  const eventId = event.data.id;
  const csId = event.data.attributes.data.id;
  const reason = event.data.attributes.data.attributes.failure_reason ?? 'unknown';

  const firstTime = await markWebhookProcessed(
    eventId,
    'checkout_session.payment.failed',
    'checkout_session',
    csId,
    `reason=${reason}`,
  );
  if (!firstTime) return;

  await db.checkoutSession.update({
    where: { paymongoSourceId: csId },
    data: {
      status: CheckoutStatus.FAILED,
      failedAt: new Date(),
      failureReason: reason,
    },
  });
}

/**
 * Handle `payment.refunded` webhook.
 */
export async function handlePaymentRefunded(
  event: PaymentRefundedEvent,
): Promise<void> {
  const eventId = event.data.id;
  const paymentIdPm = event.data.attributes.data.attributes.payment_id;
  const amount = event.data.attributes.data.attributes.amount;

  const firstTime = await markWebhookProcessed(
    eventId,
    'payment.refunded',
    'payment',
    paymentIdPm,
    `amount=${amount}`,
  );
  if (!firstTime) return;

  const payment = await db.payment.findUnique({
    where: { paymongoPaymentId: paymentIdPm },
    include: { enrollment: true },
  });
  if (!payment) return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmountPhp: amount,
      },
    });
    // Access enrollment via relation
    const enrollment = await tx.enrollment.findFirst({
      where: { payment: { id: payment.id } },
    });
    if (enrollment) {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'REFUNDED',
          cancelledAt: new Date(),
          cancellationReason: 'Refund processed',
        },
      });
    }
  });
}