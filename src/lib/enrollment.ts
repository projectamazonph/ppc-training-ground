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
 *
 * AUDIT-2026-07-17 (C1): checkout.ts creates a PayMongo Source, not a
 * Checkout Session (the SDK has no `checkoutSessions` resource — see
 * paymongo.ts). A Source-based purchase fires `source.chargeable` then
 * `payment.paid`, NOT `checkout_session.payment.paid` — so
 * handleSourceChargeable/handlePaymentPaid below are what actually complete
 * a real purchase. handleCheckoutPaid/handleCheckoutFailed are kept for a
 * future PayMongo Checkout Session integration and exercised by tests, but
 * are not reachable from the current Source-based checkout flow.
 */

import 'server-only';

import { db } from './db';
import { CheckoutStatus, EnrollmentStatus, PaymentMethod, PaymentStatus } from './enums';
import { alreadyRefundedAmountPhp } from './refunds';
import { issueInvoiceForPayment } from './receipts';
import { sendEnrollmentConfirmationEmail, sendAccountClaimEmail } from './email';
import { logger } from './logger';
import { generateClaimToken, PLACEHOLDER_PASSWORD_PREFIX } from './claim-token';
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
  | { type: 'source.chargeable'; payload: SourceChargeableEvent }
  | { type: 'payment.paid'; payload: PaymentPaidEvent }
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
 * for guest checkout. The placeholder gets a single-use claim token; the
 * buyer claims it via /auth/signup by presenting the raw token (delivered
 * by email — see sendAccountClaimEmail). Only the token's hash is stored.
 *
 * Returns the raw claim token so the caller can email it to the user. The
 * raw token is a one-time secret — the caller MUST send it via email and
 * MUST NOT log it, store it, or expose it in client-side code.
 */
export async function findOrCreateUserByEmail(
  email: string,
  name?: string | null,
  client: DbClient = db,
): Promise<{ id: string; isNew: boolean; rawClaimToken?: string }> {
  const canonicalEmail = email.trim().toLowerCase();
  const existing = await client.user.findUnique({
    where: { email: canonicalEmail },
    select: { id: true },
  });
  if (existing) return { id: existing.id, isNew: false };

  // Create a placeholder user with a single-use claim token. The buyer claims
  // it via /auth/signup by presenting the raw token (delivered by email); only
  // the token's hash is stored. `placeholder_` marks the account as unclaimed
  // (see PLACEHOLDER_PASSWORD_PREFIX).
  const claim = generateClaimToken();
  const placeholder = await client.user.create({
    data: {
      email: canonicalEmail,
      name: name ?? canonicalEmail.split('@')[0],
      emailVerified: null,
      passwordHash: `${PLACEHOLDER_PASSWORD_PREFIX}${randomUUID()}`,
      claimTokenHash: claim.hash,
      claimTokenExpiresAt: claim.expiresAt,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  return { id: placeholder.id, isNew: true, rawClaimToken: claim.raw };
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
 * Atomically bump a DiscountCode's currentUses, guarding against exceeding
 * maxUses under concurrency (H4). `updateMany` with a `currentUses < maxUses`
 * predicate is a single atomic UPDATE — Postgres re-evaluates the predicate
 * against the row's committed value under the row lock, so two concurrent
 * bumps of the last remaining use can't both succeed. A null maxUses means
 * unlimited (no guard). Throws if the code has hit its limit — callers run
 * this inside the fulfillment transaction so the whole thing rolls back
 * rather than granting access on a discount that can no longer be honored.
 */
async function bumpDiscountUsageOrThrow(
  tx: DbClient,
  discountCodeId: string,
  maxUses: number | null,
): Promise<void> {
  const bumped = await tx.discountCode.updateMany({
    where:
      maxUses === null
        ? { id: discountCodeId }
        : { id: discountCodeId, currentUses: { lt: maxUses } },
    data: { currentUses: { increment: 1 } },
  });
  if (bumped.count === 0) {
    throw new Error('Discount code usage limit reached.');
  }
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
      include: { pricingTier: true, discountCode: { select: { maxUses: true } } },
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
    const { id: userId, rawClaimToken } = await findOrCreateUserByEmail(
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
    // createCheckoutSessionAtomic). H4: atomic guard against exceeding
    // maxUses under concurrency.
    if (checkout.discountCodeId) {
      await bumpDiscountUsageOrThrow(tx, checkout.discountCodeId, checkout.discountCode?.maxUses ?? null);
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
      email: checkout.email,
      rawClaimToken: rawClaimToken ?? null,
    };
  });

  if (!result) return null;

  // Guest purchase — deliver the account-claim link AFTER the transaction has
  // committed, so we never email a token for a fulfillment that rolled back
  // (audit C5). The claim email is the ONLY delivery of the raw token.
  if (result.rawClaimToken) {
    sendAccountClaimEmail({
      to: result.email,
      rawClaimToken: result.rawClaimToken,
      tierName: result.tierName,
    }).catch((err) => logger.error({ err }, 'Account claim email failed'));
  }

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
      select: { id: true, amountPhp: true },
    });
    if (!payment) return;

    // C8: cumulative refunded amount is derived from the PROCESSED refund
    // requests — the single source of truth. If the admin path has already
    // recorded this refund, that sum already includes it and we must NOT add
    // the webhook `amount` on top. When no processed request exists yet (a
    // refund initiated outside our flow, or the admin DB write is still
    // pending), fall back to the event amount without double-adding.
    const processedSum = await alreadyRefundedAmountPhp(payment.id, tx);
    const refundedTotal = processedSum > 0 ? processedSum : amount;
    const fullyRefunded = refundedTotal >= payment.amountPhp;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        refundedAt: new Date(),
        refundAmountPhp: refundedTotal,
      },
    });

    // Only revoke access on a FULL refund. A partial refund leaves the
    // enrollment active.
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
//
// checkout.ts creates a PayMongo Source, not a Checkout Session. PayMongo
// fires `source.chargeable` when the user authorizes payment on the hosted
// page, then `payment.paid` once the resulting Payment settles. These two
// handlers are what actually complete a real purchase on this codebase —
// handleCheckoutPaid above is dead code until/unless a Checkout-Session-based
// flow is wired up.
// ---------------------------------------------------------------------------

type SourceFlowCheckout = {
  id: string;
  email: string;
  finalAmountPhp: number;
  pricingTierId: string;
  discountCodeId: string | null;
  pricingTier: { name: string; tier: string; slug: string };
  discountCode: { maxUses: number | null } | null;
};

/**
 * Reject a webhook-reported payment whose currency is not PHP or whose amount
 * is less than the checkout's expected amount (H2). Underpayment must never
 * grant full tier access; a non-PHP currency (including an empty string) is
 * likewise refused. Overpayment only warns - it isn't a security issue.
 *
 * A `currency` of `undefined` skips the currency assertion (some events, e.g.
 * `payment.paid`, don't carry it); the amount assertion always runs.
 */
function assertPaymentMatchesCheckout(
  expectedAmountCentavos: number,
  actualAmountCentavos: number,
  currency: string | undefined,
  context: Record<string, unknown>,
): void {
  if (currency !== undefined && currency !== 'PHP') {
    logger.error({ ...context, currency }, 'payment currency is not PHP - rejecting');
    throw new Error(`Unexpected currency: ${currency || '(empty)'}. Expected PHP.`);
  }
  if (actualAmountCentavos < expectedAmountCentavos) {
    logger.error(
      { ...context, expectedAmountCentavos, actualAmountCentavos },
      'payment amount is less than the expected checkout amount - rejecting',
    );
    throw new Error('Payment amount is less than the expected checkout amount.');
  }
  if (actualAmountCentavos > expectedAmountCentavos) {
    logger.warn(
      { ...context, expectedAmountCentavos, actualAmountCentavos },
      'payment amount exceeds expected - proceeding (overpayment)',
    );
  }
}

/**
 * Handle `source.chargeable` webhook.
 *
 * This fires when a Source (GCash, Maya, GrabPay) becomes chargeable after
 * the user authorizes the payment on PayMongo's hosted page. We call
 * `createPaymentFromSource` to convert the source into an actual Payment.
 *
 * Ordering (why it's shaped this way):
 *   - Idempotency FIRST: `markWebhookProcessed` commits the event id before any
 *     external call. Its unique index makes concurrent redeliveries race-safe -
 *     exactly one caller proceeds to charge; duplicates return null. A source is
 *     charged at most once per event.
 *   - State 1 - the external PayMongo charge runs OUTSIDE any DB transaction, so
 *     we never hold row locks or a pooled connection across an HTTP round-trip.
 *     If the charge itself fails, we RELEASE the idempotency claim so PayMongo's
 *     retry can re-attempt (a transient failure must not silently lose the sale).
 *   - State 2 - durable local fulfillment runs in its own short transaction
 *     (DB writes only). If it fails, the idempotency claim stays (the money was
 *     charged) and the `payment.paid` webhook - a separate event id - is the
 *     backstop that creates the enrollment.
 *   - Post-purchase emails are best-effort, fired AFTER the transaction commits
 *     (never awaited inside it - they read via the top-level `db` client, which
 *     cannot see a transaction's uncommitted rows).
 */
export async function handleSourceChargeable(
  event: SourceChargeableEvent,
): Promise<PayMongoPayment | null> {
  const eventId = event.data.id;
  const sourceId = event.data.attributes.data.id;
  const amountCentavos = event.data.attributes.data.attributes.amount;
  const metadata = event.data.attributes.data.attributes.metadata ?? {};
  const currency = event.data.attributes.data.attributes.currency;

  // Idempotency claim FIRST - never charge a source twice for the same event.
  // Concurrent redeliveries race on the unique index; only the winner proceeds.
  const firstTime = await markWebhookProcessed(
    eventId,
    'source.chargeable',
    'source',
    sourceId,
    `amount=${amountCentavos}`,
    200,
  );
  if (!firstTime) return null;

  // Read-only lookup + validation before charging.
  const checkout = (await db.checkoutSession.findFirst({
    where: { paymongoSourceId: sourceId, deletedAt: null },
    select: {
      id: true,
      email: true,
      finalAmountPhp: true,
      pricingTierId: true,
      discountCodeId: true,
      pricingTier: { select: { name: true, tier: true, slug: true } },
      discountCode: { select: { maxUses: true } },
    },
  })) as SourceFlowCheckout | null;
  if (!checkout) {
    // Unknown source - leave the event marked (retrying won't conjure a
    // session) and don't charge.
    logger.warn({ sourceId }, 'source.chargeable: no checkout session found for source');
    return null;
  }

  // H2: reject underpayment / non-PHP currency BEFORE charging the source.
  // Throwing returns 500 for this delivery, but the event is already marked
  // processed above, so PayMongo's retry short-circuits (never charges, no
  // retry storm) rather than looping on the same mismatch.
  assertPaymentMatchesCheckout(checkout.finalAmountPhp, amountCentavos, currency, { sourceId });

  // State 1 - external provider call, OUTSIDE any DB transaction.
  let payment: PayMongoPayment;
  try {
    payment = await createPaymentFromSource({
      amountCentavos,
      sourceId,
      description: `Checkout ${checkout.id} - Amazon PH Academy`,
      metadata: { checkoutId: checkout.id, ...metadata },
    });
  } catch (err) {
    // Release the idempotency claim so PayMongo's retry can re-attempt the
    // charge - a transient failure must not silently lose the sale.
    await db.processedWebhook
      .deleteMany({ where: { paymongoEventId: eventId } })
      .catch((cleanupErr) =>
        logger.error({ cleanupErr, eventId }, 'Failed to release webhook idempotency claim'),
      );
    logger.error({ err, sourceId }, 'source.chargeable: charge failed; released claim for retry');
    throw err; // surfaced to the webhook route → 500 → PayMongo retries
  }

  logger.info(
    { sourceId, paymentId: payment.id, status: payment.status },
    'source.chargeable: payment created from source',
  );

  // Only fulfil when the payment already settled; otherwise the payment.paid
  // webhook completes it.
  if (payment.status === 'paid') {
    // State 2 - durable local fulfillment (DB writes only). A failure here does
    // NOT undo the PayMongo charge and must not re-run State 1; payment.paid
    // reconciles.
    let result: PostPurchaseResult | null = null;
    try {
      result = await db.$transaction((tx) =>
        processPaymentPaidInTransaction(
          tx,
          payment,
          checkout,
          event.data.attributes.data.attributes.type,
        ),
      );
    } catch (err) {
      logger.error(
        { err, sourceId, paymentId: payment.id },
        'source.chargeable: local fulfillment failed; payment.paid webhook will reconcile',
      );
    }
    if (result) {
      // Best-effort emails, AFTER commit - never awaited inside the transaction.
      sendPostPurchaseEmails(result).catch((err: Error) =>
        logger.error({ err }, 'Failed to send post-purchase emails'),
      );
    }
  }

  return payment;
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
  const currency = event.data.attributes.data.attributes.currency;
  const sourceId = event.data.attributes.data.attributes.source?.id;
  // Forward the real payment method so non-GCash payments aren't mis-recorded.
  const sourceType = event.data.attributes.data.attributes.source?.type;

  const checkoutSelect = {
    id: true,
    email: true,
    finalAmountPhp: true,
    pricingTierId: true,
    discountCodeId: true,
    pricingTier: { select: { name: true, tier: true, slug: true } },
    discountCode: { select: { maxUses: true } },
  } as const;

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
      ? ((await tx.checkoutSession.findFirst({
          where: { paymongoSourceId: sourceId, deletedAt: null },
          select: checkoutSelect,
        })) as SourceFlowCheckout | null)
      : null;

    if (!checkout) {
      // Check via paymongoPaymentId
      const checkoutByPayment = (await tx.checkoutSession.findFirst({
        where: { paymongoPaymentId: paymentIdPm, deletedAt: null },
        select: checkoutSelect,
      })) as SourceFlowCheckout | null;
      if (!checkoutByPayment) {
        logger.warn({ paymentId: paymentIdPm }, 'payment.paid: no checkout session found');
        return null;
      }
      return processPaymentInCheckout(tx, paymentIdPm, amountCentavos, checkoutByPayment, sourceType, currency);
    }

    return processPaymentInCheckout(tx, paymentIdPm, amountCentavos, checkout, sourceType, currency);
  });
}

/**
 * Internal: process a paid payment within a checkout session transaction.
 */
async function processPaymentInCheckout(
  tx: DbClient,
  paymentIdPm: string,
  amountCentavos: number,
  checkout: SourceFlowCheckout,
  paymentMethod?: string,
  currency?: string,
): Promise<{ enrollmentId: string; paymentId: string } | null> {
  // H2: reject underpayment / non-PHP currency rather than granting access on
  // a webhook amount below the listed price. This event has already been marked
  // processed by the caller, so returning null consumes it without granting an
  // enrollment (no retry storm), matching the "refuse, don't retry" posture.
  try {
    assertPaymentMatchesCheckout(checkout.finalAmountPhp, amountCentavos, currency, {
      checkoutId: checkout.id,
      paymentId: paymentIdPm,
    });
  } catch (err) {
    logger.error({ err, checkoutId: checkout.id }, 'payment.paid: amount/currency check failed - not granting access');
    return null;
  }

  const result = await processPaymentPaidInTransaction(
    tx,
    { id: paymentIdPm, status: 'paid', amount: amountCentavos, paidAt: new Date().toISOString() },
    checkout,
    paymentMethod,
  );

  // Send post-purchase emails (outside transaction — best-effort)
  if (result) {
    sendPostPurchaseEmails(result).catch((err: Error) =>
      logger.error({ err }, 'Failed to send post-purchase emails'),
    );
  }

  return result ? { enrollmentId: result.enrollmentId, paymentId: result.paymentId } : null;
}

interface PostPurchaseResult {
  enrollmentId: string;
  paymentId: string;
  userId: string;
  tierName: string;
  email: string;
  rawClaimToken: string | null;
}

// Re-use the existing processPayment workflow but adapted for Source flow
async function processPaymentPaidInTransaction(
  tx: DbClient,
  payment: { id: string; status: string; amount: number; paidAt: string | null },
  checkout: SourceFlowCheckout,
  paymentMethod?: string,
): Promise<PostPurchaseResult | null> {
  const paymentIdPm = payment.id;

  // Check if Payment already exists locally
  const existingPayment = await tx.payment.findUnique({
    where: { paymongoPaymentId: paymentIdPm },
    select: { id: true },
  });
  if (existingPayment) return null; // Already processed

  // Create or find user. `rawClaimToken` is set ONLY when a new placeholder
  // (guest checkout) user was just created — see findOrCreateUserByEmail.
  const { id: userId, rawClaimToken } = await findOrCreateUserByEmail(checkout.email, null, tx);

  // Create local Payment record
  const localPayment = await tx.payment.create({
    data: {
      userId,
      checkoutSessionId: checkout.id,
      pricingTierId: checkout.pricingTierId,
      amountPhp: payment.amount,
      feePhp: 0,
      netAmountPhp: checkout.finalAmountPhp,
      currency: 'PHP',
      paymongoPaymentId: paymentIdPm,
      // Record the real method from the source type; only fall back to OTHER
      // when it's genuinely unavailable - never silently assume GCash.
      method: paymentMethod ? mapPaymentMethod(paymentMethod) : PaymentMethod.OTHER,
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

  // H4: Atomic discount usage with maxUses guard — same protection as the
  // checkout_session flow above, so the Source flow can't over-redeem a
  // limited-use code under concurrency either.
  if (checkout.discountCodeId) {
    await bumpDiscountUsageOrThrow(tx, checkout.discountCodeId, checkout.discountCode?.maxUses ?? null);
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

  return {
    enrollmentId: enrollment.id,
    paymentId: localPayment.id,
    userId,
    tierName: checkout.pricingTier.name,
    email: checkout.email,
    rawClaimToken: rawClaimToken ?? null,
  };
}

/**
 * Send post-purchase emails: enrollment confirmation and, if the buyer was
 * a new placeholder (guest checkout) user, the account-claim link carrying
 * the raw claim token minted in `findOrCreateUserByEmail`. This is the ONLY
 * place that token is delivered — never logged.
 */
async function sendPostPurchaseEmails(result: PostPurchaseResult): Promise<void> {
  try {
    await issueInvoiceForPayment(result.paymentId);
  } catch (err) {
    logger.error({ err, paymentId: result.paymentId }, 'Failed to issue invoice');
  }

  const user = await db.user.findUnique({
    where: { id: result.userId },
    select: { email: true, name: true },
  });
  const to = user?.email ?? result.email;
  if (!to) return;

  // Send enrollment confirmation
  sendEnrollmentConfirmationEmail({
    to,
    studentName: user?.name ?? to.split('@')[0] ?? to,
    tierName: result.tierName,
  }).catch((err: Error) => logger.error({ err }, 'Enrollment confirmation email failed'));

  // If user is a new placeholder (guest checkout), they need a claim link.
  if (result.rawClaimToken) {
    sendAccountClaimEmail({
      to,
      rawClaimToken: result.rawClaimToken,
      tierName: result.tierName,
    }).catch((err: Error) => logger.error({ err }, 'Account claim email failed'));
  }
}
