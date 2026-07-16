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
 * Idempotency contract: the ProcessedWebhook row is created INSIDE the same
 * transaction as the handler's writes. If the handler fails, the row rolls
 * back too, so PayMongo's retry gets a clean slate — an event can never be
 * consumed without its side effects being committed.
 */

import 'server-only';

import { db } from './db';
import { CheckoutStatus, EnrollmentStatus, PaymentMethod, PaymentStatus } from './enums';
import { issueInvoiceForPayment } from './receipts';
import { sendEnrollmentConfirmationEmail } from './email';
import { logger } from './logger';
import { randomUUID } from 'node:crypto';

/**
 * Either the global (extended) client or a transaction scope. Both arms are
 * derived from `db`'s own type rather than the ambient `PrismaClient` /
 * `Prisma.TransactionClient` types — a `$extends()`-ed client is a
 * structurally distinct type from the un-extended ones, including the
 * transaction-scoped client its own `$transaction` callback provides.
 */
type DbClient = typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0];

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
  client: DbClient = db,
): Promise<boolean> {
  try {
    await client.processedWebhook.create({
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
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'P2002') {
      return false;
    }
    throw e;
  }
}

/**
 * Find an existing user by email, or create a minimal placeholder user
 * for guest checkout. The placeholder gets a random password hash and
 * must complete signup on first dashboard visit.
 */
export async function findOrCreateUserByEmail(
  email: string,
  name?: string | null,
  client: DbClient = db,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await client.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { id: existing.id, isNew: false };

  // Create placeholder user. They'll complete signup via /auth/signup
  // which will update passwordHash + name + emailVerified.
  const placeholder = await client.user.create({
    data: {
      email,
      name: name ?? email.split('@')[0],
      emailVerified: null,
      passwordHash: `placeholder_${randomUUID()}`,
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

  // All durable writes — including the idempotency row — happen in ONE
  // transaction. If anything fails, the ProcessedWebhook row rolls back
  // with the rest and PayMongo's retry starts clean. Invoice PDF + email
  // are non-durable and run best-effort after commit.
  const result = await db.$transaction(async (tx) => {
    const firstTime = await markWebhookProcessed(
      eventId,
      'checkout_session.payment.paid',
      'checkout_session',
      csId,
      `payment_id=${paymentIdPm}`,
      200,
      tx,
    );
    if (!firstTime) return null;

    const checkout = await tx.checkoutSession.findUnique({
      where: { paymongoSourceId: csId },
      include: { pricingTier: true },
    });
    if (!checkout) {
      // Consume the event — a session that doesn't exist won't appear on retry.
      logger.error({ paymongoId: csId }, 'CheckoutSession not found');
      return null;
    }

    const course = await tx.course.findFirst({
      where: { pricingTierId: checkout.pricingTierId, deletedAt: null },
      orderBy: { isPublished: 'desc' },
      select: { id: true },
    });
    if (!course) {
      logger.error({ pricingTierId: checkout.pricingTierId }, 'No course found for pricing tier');
      return null;
    }

    // Resolve the user FIRST (guest checkout support) so the Payment is
    // never created with a dangling FK. Uses the tx client so a rollback
    // doesn't leave an orphaned placeholder user.
    const { id: userId } = await findOrCreateUserByEmail(
      checkout.email,
      metadata?.name ?? null,
      tx,
    );

    const payment = await tx.payment.create({
      data: {
        userId,
        pricingTierId: checkout.pricingTierId,
        checkoutSessionId: checkout.id,
        paymongoPaymentId: paymentIdPm,
        paymongoSourceId: csId,
        amountPhp: checkout.finalAmountPhp,
        feePhp: 0,
        netAmountPhp: checkout.finalAmountPhp,
        currency: 'PHP',
        method: mapPaymentMethod(method),
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        metadata: JSON.stringify(metadata ?? {}),
      },
    });

    // A limited-use discount only counts once the payment completes —
    // abandoned checkouts no longer burn uses (moved from
    // createCheckoutSessionAtomic).
    if (checkout.discountCodeId) {
      await tx.discountCode.update({
        where: { id: checkout.discountCodeId },
        data: { currentUses: { increment: 1 } },
      });
    }

    // Repeat purchase of the same course reactivates the enrollment
    // instead of crashing into @@unique([userId, courseId]).
    const existingEnrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true },
    });
    const enrollment = existingEnrollment
      ? await tx.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: EnrollmentStatus.ACTIVE,
            pricingTierId: checkout.pricingTierId,
            tier: checkout.pricingTier.tier,
            cancelledAt: null,
            cancellationReason: null,
            deletedAt: null,
          },
        })
      : await tx.enrollment.create({
          data: {
            userId,
            courseId: course.id,
            pricingTierId: checkout.pricingTierId,
            tier: checkout.pricingTier.tier,
            status: EnrollmentStatus.ACTIVE,
            enrolledAt: new Date(),
          },
        });

    // Payment.enrollmentId is @unique — only link if no earlier payment
    // already points at this enrollment (repeat purchase case).
    const alreadyLinked = await tx.payment.findFirst({
      where: { enrollmentId: enrollment.id },
      select: { id: true },
    });
    if (!alreadyLinked) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { enrollmentId: enrollment.id },
      });
    }

    await tx.checkoutSession.update({
      where: { id: checkout.id },
      data: {
        status: CheckoutStatus.PAID,
        paymongoPaymentId: paymentIdPm,
        paidAt: new Date(),
        userId: checkout.userId ?? userId,
      },
    });

    return {
      enrollmentId: enrollment.id,
      paymentId: payment.id,
      userId,
      tierName: checkout.pricingTier?.name ?? 'your course',
    };
  });

  if (!result) return null;

  // Invoice issuance — non-durable, best-effort, outside transaction
  try {
    await issueInvoiceForPayment(result.paymentId);
  } catch (err) {
    logger.error({ err, paymentId: result.paymentId }, 'Failed to issue invoice');
  }

  // Send enrollment confirmation email — non-durable, best-effort
  const user = await db.user.findUnique({
    where: { id: result.userId },
    select: { email: true, name: true },
  });
  if (user?.email) {
    sendEnrollmentConfirmationEmail({
      to: user.email,
      studentName: user.name ?? user.email.split('@')[0] ?? user.email,
      tierName: result.tierName,
    }).catch((err) => logger.error({ err }, 'Enrollment confirmation email failed'));
  }

  return { enrollmentId: result.enrollmentId, paymentId: result.paymentId, userId: result.userId };
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

  await db.$transaction(async (tx) => {
    const firstTime = await markWebhookProcessed(
      eventId,
      'checkout_session.payment.failed',
      'checkout_session',
      csId,
      `reason=${reason}`,
      200,
      tx,
    );
    if (!firstTime) return;

    // updateMany: a missing session is a no-op, not a thrown P2025.
    await tx.checkoutSession.updateMany({
      where: { paymongoSourceId: csId },
      data: {
        status: CheckoutStatus.FAILED,
        failedAt: new Date(),
        failureReason: reason,
      },
    });
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

  await db.$transaction(async (tx) => {
    const firstTime = await markWebhookProcessed(
      eventId,
      'payment.refunded',
      'payment',
      paymentIdPm,
      `amount=${amount}`,
      200,
      tx,
    );
    if (!firstTime) return;

    const payment = await tx.payment.findUnique({
      where: { paymongoPaymentId: paymentIdPm },
      select: { id: true },
    });
    if (!payment) return;

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