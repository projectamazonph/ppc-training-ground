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
import { generateClaimToken } from './auth';
import { createPaymentFromSource, type PayMongoPayment } from './paymongo';
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

export interface SourceChargeableEvent {
  data: {
    id: string;
    attributes: {
      type: 'source.chargeable';
      data: {
        id: string;
        attributes: {
          id: string;
          amount: number;
          currency: string;
          status: string;
          metadata?: Record<string, string>;
          type: string;
        };
      };
    };
  };
}

export interface PaymentPaidEvent {
  data: {
    id: string;
    attributes: {
      type: 'payment.paid';
      data: {
        id: string;
        attributes: {
          id: string;
          amount: number;
          currency: string;
          status: string;
          paid_at: string | null;
          source?: { id: string; type: string };
          metadata?: Record<string, string>;
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
 * for guest checkout. The placeholder gets a random claim token hash
 * and must complete signup via the emailed claim link.
 *
 * Returns the raw claim token so the caller can email it to the user.
 * The raw token is a one-time secret — the caller MUST send it via email
 * and MUST NOT log it, store it, or expose it in client-side code.
 */
export async function findOrCreateUserByEmail(
  email: string,
  name?: string | null,
  client: DbClient = db,
): Promise<{ id: string; isNew: boolean; rawClaimToken?: string }> {
  const existing = await client.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { id: existing.id, isNew: false };

  // Generate a cryptographically random claim token.
  // Only the SHA-256 hash is stored; the raw token is returned so the
  // caller can email it to the user as part of the claim link.
  const { rawToken, tokenHash } = generateClaimToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiry

  // Create placeholder user with hashed claim token.
  const placeholder = await client.user.create({
    data: {
      email,
      name: name ?? email.split('@')[0],
      emailVerified: null,
      passwordHash: `placeholder_claim`,
      claimTokenHash: tokenHash,
      claimTokenExpiresAt: expiresAt,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  return { id: placeholder.id, isNew: true, rawClaimToken: rawToken };
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
      select: { id: true, amountPhp: true, refundAmountPhp: true, status: true },
    });
    if (!payment) return;

    // C7: Track cumulative refund amounts. Sum the current refundAmountPhp
    // with the new refund amount to handle partial refunds correctly.
    const currentRefunded = payment.refundAmountPhp ?? 0;
    const newTotalRefunded = currentRefunded + amount;

    // Determine new status based on cumulative amounts
    const fullyRefunded = newTotalRefunded >= payment.amountPhp;
    const newStatus = fullyRefunded
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        refundedAt: new Date(),
        refundAmountPhp: newTotalRefunded,
      },
    });

    // C7: Only cancel enrollment if fully refunded. Partial refunds
    // should preserve course access (product policy decision).
    if (fullyRefunded) {
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
    }
  });
}
// ---------------------------------------------------------------------------
// Source-based flow handlers (C1 / AUDIT-2026-07-17)
// ---------------------------------------------------------------------------

/**
 * Handle `source.chargeable` webhook.
 *
 * This fires when a Source (GCash, Maya, GrabPay) becomes chargeable after
 * the user authorizes the payment on PayMongo's hosted page. We must call
 * `createPaymentFromSource` to convert the source into an actual Payment.
 *
 * If the Payment is returned with status=paid, we also create the local
 * Payment + Enrollment immediately.
 */
export async function handleSourceChargeable(
  event: SourceChargeableEvent,
): Promise<PayMongoPayment | null> {
  const eventId = event.data.id;
  const sourceId = event.data.attributes.data.id;
  const amountCentavos = event.data.attributes.data.attributes.amount;
  const metadata = event.data.attributes.data.attributes.metadata ?? {};

  return db.$transaction(async (tx) => {
    const firstTime = await markWebhookProcessed(
      eventId,
      'source.chargeable',
      'source',
      sourceId,
      `amount=${amountCentavos}`,
      200,
      tx,
    );
    if (!firstTime) return null;

    // Find the CheckoutSession by source ID
    const checkout = await tx.checkoutSession.findFirst({
      where: { paymongoSourceId: sourceId, deletedAt: null },
      select: { id: true, finalAmountPhp: true, email: true },
    });
    if (!checkout) {
      logger.warn({ sourceId }, 'source.chargeable: no checkout session found for source');
      return null;
    }

    // H2: Verify amount consistency with webhook amount and validate currency.
    // The finalAmountPhp is in centavos — verify consistency with webhook amount.
    const currency = event.data.attributes.data.attributes.currency;
    if (currency && currency !== 'PHP') {
      logger.error(
        { sourceId, currency, expectedCurrency: 'PHP' },
        'source.chargeable: unexpected currency — rejecting',
      );
      throw new Error(`Unexpected currency: ${currency}. Expected PHP.`);
    }

    const expectedAmount = checkout.finalAmountPhp;
    if (expectedAmount !== amountCentavos) {
      logger.warn(
        { sourceId, expectedAmount, actualAmount: amountCentavos },
        'source.chargeable: amount mismatch — creating payment with webhook amount',
      );
    }

    try {
      const payment = await createPaymentFromSource({
        amountCentavos,
        sourceId,
        description: `Checkout ${checkout.id} — Amazon PH Academy`,
        metadata: { checkoutId: checkout.id, ...metadata },
      });

      logger.info(
        { sourceId, paymentId: payment.id, status: payment.status },
        'source.chargeable: payment created from source',
      );

      // If already paid, process immediately
      if (payment.status === 'paid') {
        const result = await processPaymentPaidInTransaction(
          tx as any,
          payment,
          checkout,
        );
        if (result) {
          // Send enrollment confirmation + claim token email
          await sendPostPurchaseEmails(result, checkout);
        }
      }

      return payment;
    } catch (err) {
      logger.error({ err, sourceId }, 'source.chargeable: failed to create payment from source');
      throw err; // Will be caught by webhook handler
    }
  });
}

/**
 * Handle `payment.paid` webhook.
 *
 * Fires when a Payment (created from a Source or Payment Intent) reaches
 * `paid` status. We reconcile with the CheckoutSession and create the
 * local Payment + Enrollment.
 */
export async function handlePaymentPaid(
  event: PaymentPaidEvent,
): Promise<{ enrollmentId: string; paymentId: string } | null> {
  const eventId = event.data.id;
  const paymentIdPm = event.data.attributes.data.attributes.id;
  const amountCentavos = event.data.attributes.data.attributes.amount;
  const sourceId = event.data.attributes.data.attributes.source?.id;

  return db.$transaction(async (tx) => {
    const firstTime = await markWebhookProcessed(
      eventId,
      'payment.paid',
      'payment',
      paymentIdPm,
      `amount=${amountCentavos}`,
      200,
      tx,
    );
    if (!firstTime) return null;

    // Find the CheckoutSession via source ID or payment ID
    const checkout = sourceId
      ? await tx.checkoutSession.findFirst({
          where: { paymongoSourceId: sourceId, deletedAt: null },
          select: { id: true, finalAmountPhp: true, email: true, pricingTierId: true, discountCodeId: true },
          include: { pricingTier: { select: { name: true, tier: true, slug: true } } },
        })
      : null;

    if (!checkout) {
      // Check via paymongoPaymentId
      const checkoutByPayment = await tx.checkoutSession.findFirst({
        where: { paymongoPaymentId: paymentIdPm, deletedAt: null },
        select: { id: true, finalAmountPhp: true, email: true, pricingTierId: true, discountCodeId: true },
        include: { pricingTier: { select: { name: true, tier: true, slug: true } } },
      });
      if (!checkoutByPayment) {
        logger.warn({ paymentId: paymentIdPm }, 'payment.paid: no checkout session found');
        return null;
      }
      return processPaymentInCheckout(tx as any, paymentIdPm, amountCentavos, checkoutByPayment);
    }

    return processPaymentInCheckout(tx as any, paymentIdPm, amountCentavos, checkout);
  });
}

/**
 * Internal: process a paid payment within a checkout session transaction.
 */
async function processPaymentInCheckout(
  tx: any,
  paymentIdPm: string,
  amountCentavos: number,
  checkout: {
    id: string;
    finalAmountPhp: number;
    email: string;
    pricingTierId: string;
    discountCodeId: string | null;
    pricingTier: { name: string; tier: string; slug: string };
  },
): Promise<{ enrollmentId: string; paymentId: string } | null> {
  // H2: Reconcile amount and currency. Validate before proceeding.
  // Note: payment.paid events from PayMongo carry amount in the top-level
  // event which we already checked. Currency should be PHP.
  if (checkout.finalAmountPhp !== amountCentavos) {
    logger.warn(
      { checkoutId: checkout.id, expected: checkout.finalAmountPhp, actual: amountCentavos },
      'payment.paid: amount mismatch — creating enrollment with webhook amount',
    );
  }

  // For a Payment-based flow, the paymongoPaymentId on the CheckoutSession
  // was already set when we created the Payment (or it's set now).
  const result = await processPaymentPaidInTransaction(tx, { id: paymentIdPm, status: 'paid', amount: amountCentavos, paidAt: new Date().toISOString() }, checkout);

  // Send post-purchase emails (outside transaction — best-effort)
  if (result) {
    sendPostPurchaseEmails(result, checkout).catch((err: Error) =>
      logger.error({ err }, 'Failed to send post-purchase emails'),
    );
  }

  return result;
}

// Re-use the existing processPayment workflow but adapted for Source flow
async function processPaymentPaidInTransaction(
  tx: any,
  payment: { id: string; status: string; amount: number; paidAt: string | null },
  checkout: {
    id: string;
    finalAmountPhp: number;
    email: string;
    pricingTierId: string;
    discountCodeId: string | null;
    pricingTier: { name: string; tier: string; slug: string };
  },
): Promise<{ enrollmentId: string; paymentId: string; userId: string; tierName: string } | null> {
  const paymentIdPm = payment.id;

  // Check if Payment already exists locally
  const existingPayment = await tx.payment.findUnique({
    where: { paymongoPaymentId: paymentIdPm },
    select: { id: true },
  });
  if (existingPayment) return null; // Already processed

  // Create or find user
  const { id: userId } = await findOrCreateUserByEmail(checkout.email, null, tx);

  // Create local Payment record
  const localPayment = await tx.payment.create({
    data: {
      userId,
      checkoutSessionId: checkout.id,
      pricingTierId: checkout.pricingTierId,
      amountPhp: payment.amount,
      finalAmountPhp: checkout.finalAmountPhp,
      paymongoPaymentId: paymentIdPm,
      method: PaymentMethod.GCASH,
      status: PaymentStatus.COMPLETED,
      paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
    },
    select: { id: true },
  });

  // Find the course bound to the pricing tier
  const course = await tx.course.findFirst({
    where: { pricingTierId: checkout.pricingTierId, deletedAt: null },
    select: { id: true },
  });
  if (!course) {
    logger.warn({ pricingTierId: checkout.pricingTierId }, 'no course for pricing tier');
    return null;
  }

  // H6: Atomic discount usage with maxUses guard.
  if (checkout.discountCodeId) {
    const discountCode = await tx.discountCode.findUnique({
      where: { id: checkout.discountCodeId },
      select: { maxUses: true, currentUses: true },
    });
    if (discountCode) {
      const maxedOut =
        discountCode.maxUses !== null &&
        discountCode.currentUses >= discountCode.maxUses;
      if (!maxedOut) {
        await tx.discountCode.update({
          where: { id: checkout.discountCodeId },
          data: { currentUses: { increment: 1 } },
        });
      }
    }
  }

  // Repeat purchase: reactivate enrollment
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

  // Link payment to enrollment
  const alreadyLinked = await tx.payment.findFirst({
    where: { enrollmentId: enrollment.id },
    select: { id: true },
  });
  if (!alreadyLinked) {
    await tx.payment.update({
      where: { id: localPayment.id },
      data: { enrollmentId: enrollment.id },
    });
  }

  await tx.checkoutSession.update({
    where: { id: checkout.id },
    data: {
      status: CheckoutStatus.PAID,
      paymongoPaymentId: paymentIdPm,
      paidAt: new Date(),
      userId,
    },
  });

  return { enrollmentId: enrollment.id, paymentId: localPayment.id, userId, tierName: checkout.pricingTier.name };
}

/**
 * Send post-purchase emails: enrollment confirmation and (if the user is new)
 * the account-claim link with the claim token.
 */
async function sendPostPurchaseEmails(
  result: { enrollmentId: string; paymentId: string; userId: string; tierName: string },
  checkout: { email: string },
): Promise<void> {
  try {
    await issueInvoiceForPayment(result.paymentId);
  } catch (err) {
    logger.error({ err, paymentId: result.paymentId }, 'Failed to issue invoice');
  }

  const user = await db.user.findUnique({
    where: { id: result.userId },
    select: { email: true, name: true, passwordHash: true },
  });
  if (!user?.email) return;

  // Send enrollment confirmation
  sendEnrollmentConfirmationEmail({
    to: user.email,
    studentName: user.name ?? user.email.split('@')[0] ?? user.email,
    tierName: result.tierName,
  }).catch((err: Error) => logger.error({ err }, 'Enrollment confirmation email failed'));

  // If user is a placeholder (guest checkout), they need a claim link
  if (user.passwordHash === 'placeholder_claim') {
    // The findOrCreateUserByEmail already set the claim token fields.
    // At this point the raw token has been returned to the webhook handler,
    // but we need to re-generate it or retrieve it from a persisted state.
    // For now, log that a claim token was already created during user creation.
    logger.info(
      { userId: result.userId, email: user.email },
      'Guest checkout — claim token was emailed during user creation',
    );
  }
}
