'use server';

/**
 * Refund server actions — student request, admin approve/reject.
 *
 * Sprint 6 — STORY-028.
 *
 * Flow:
 *   1. Student submits `createRefundRequestAction` (from /dashboard/payments)
 *      → creates RefundRequest(status=PENDING).
 *   2. Admin reviews in /admin/refunds, calls `approveRefundAction` →
 *      sets RefundRequest.status=APPROVED, calls PayMongo refundPayment(),
 *      sets status=PROCESSED on success or FAILED on error.
 *   3. Webhook `payment.refunded` arrives (asynchronously from PayMongo) and
 *      updates Payment.status + Enrollment.status. The user-facing status
 *      surfaces that immediately, not the synchronous API call result.
 *
 * Approve race: if the webhook arrives before our synchronous call returns,
 * our update from the action will see status=PROCESSED already. We use
 * `updateMany` with a `status: APPROVED` guard so we don't downgrade.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { auditLog } from '@/lib/admin-audit';
import { createSafeAction, type ActionResult } from '@/lib/validation';
import { PaymentStatus, RefundStatus } from '@/lib/enums';
import { refundPayment, PayMongoError } from '@/lib/paymongo';
import {
  isWithinRefundWindow,
  hasBlockingRefundRequest,
  alreadyRefundedAmountPhp,
  PAYMONGO_REFUND_REASON,
} from '@/lib/refunds';
import { sendRefundStatusEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { isUniqueConstraintError } from '@/lib/prisma-errors';
import { auditLog } from '@/lib/admin-audit';

/**
 * Best-effort AuditLog for a refund admin action. The state transition has
 * already been committed by the time we log it, so a logging failure must not
 * break the action or misreport a refund that actually moved money - we log
 * the failure and move on (AGENTS.md: every admin action logs to AuditLog).
 */
async function auditRefundAction(
  action: string,
  requestId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await auditLog({ action, entityType: 'RefundRequest', entityId: requestId, metadata });
  } catch (err) {
    logger.error({ err, action, requestId }, 'Failed to write refund AuditLog entry');
  }
}

// ---------------------------------------------------------------------------
// Student: create refund request
// ---------------------------------------------------------------------------

const createRequestSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().min(10, 'Tell us why — at least 10 characters.').max(500),
});

/**
 * A student requests a refund for a payment they own. Validates:
 *   - the payment exists and belongs to the current user
 *   - the payment is COMPLETED (no double-refund)
 *   - the request is within the 7-day refund window
 *   - no PENDING or APPROVED refund request already exists for this payment
 */
export const createRefundRequestAction = createSafeAction<
  typeof createRequestSchema,
  { requestId: string }
>(createRequestSchema, async (data) => {
  const user = await requireAuth();

  const payment = await db.payment.findUnique({
    where: { id: data.paymentId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      amountPhp: true,
      paidAt: true,
      status: true,
      pricingTier: { select: { name: true } },
    },
  });

  if (!payment) {
    throw new Error('Payment not found.');
  }
  if (payment.userId !== user.id) {
    // Don't leak the existence of payments the caller doesn't own.
    throw new Error('Payment not found.');
  }
  if (!isWithinRefundWindow(payment.paidAt, payment.status)) {
    throw new Error(
      'Refund window has expired or payment is not eligible for a refund.',
    );
  }
  if (await hasBlockingRefundRequest(payment.id)) {
    throw new Error('A refund request for this payment is already in progress.');
  }

  // Full refund = payment amount minus any previously-processed refunds.
  const alreadyRefunded = await alreadyRefundedAmountPhp(payment.id);
  const refundAmountPhp = payment.amountPhp - alreadyRefunded;
  if (refundAmountPhp <= 0) {
    throw new Error('This payment has already been fully refunded.');
  }

  // The pre-check above catches the common case; the partial unique index
  // (one active request per payment) is the concurrency backstop — two
  // simultaneous requests both pass the read, but only one insert survives.
  let request: { id: string };
  try {
    request = await db.refundRequest.create({
      data: {
        userId: user.id,
        paymentId: payment.id,
        reason: data.reason.trim(),
        amountPhp: refundAmountPhp,
        status: RefundStatus.PENDING,
      },
      select: { id: true },
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      throw new Error('A refund request for this payment is already in progress.');
    }
    throw e;
  }

  revalidatePath('/dashboard/payments');
  revalidatePath('/admin/refunds');

  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });

  sendRefundStatusEmail({
    to: userData!.email,
    studentName: userData!.name ?? 'Student',
    status: 'requested',
    tierName: payment.pricingTier?.name ?? 'your course',
    amountPhp: refundAmountPhp,
    reason: data.reason.trim(),
  }).catch(() => {});

  return { requestId: request.id };
});

// ---------------------------------------------------------------------------
// Admin: approve a refund request
// ---------------------------------------------------------------------------

const approveSchema = z.object({
  requestId: z.string().min(1),
  reviewerNotes: z.string().max(500).optional(),
});

export interface ApproveResult {
  requestId: string;
  status: string;
  paymongoRefundId: string | null;
}

/**
 * Admin approves a pending refund request. Calls PayMongo's refund API
 * and updates the request status. If the API call fails, the request is
 * marked FAILED and the admin sees the PayMongo error in `failureReason`.
 *
 * The webhook `payment.refunded` is the source of truth for updating
 * Payment + Enrollment. If the webhook arrives between our API call and
 * our DB update, we detect it and skip the manual update.
 */
export async function approveRefundAction(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult<ApproveResult>> {
  const admin = await requireAdmin();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { requestId, reviewerNotes } = parsed.data;

  const request = await db.refundRequest.findUnique({
    where: { id: requestId, deletedAt: null },
    select: {
      id: true,
      status: true,
      amountPhp: true,
      user: { select: { email: true, name: true } },
      payment: {
        select: {
          id: true,
          paymongoPaymentId: true,
          amountPhp: true,
          status: true,
          pricingTier: { select: { name: true } },
        },
      },
    },
  });

  if (!request) {
    return { success: false, error: 'Refund request not found.' };
  }
  if (request.status !== RefundStatus.PENDING) {
    return {
      success: false,
      error: `This request is already ${request.status.toLowerCase()}.`,
    };
  }
  if (!request.payment.paymongoPaymentId) {
    return {
      success: false,
      error: 'Payment has no PayMongo reference — cannot refund.',
    };
  }

  // Atomically claim PENDING → APPROVED. Two admins racing both pass the
  // read check above; only the winner of this guarded update proceeds to
  // call PayMongo, so a refund can never be issued twice.
  const claimed = await db.refundRequest.updateMany({
    where: { id: request.id, status: RefundStatus.PENDING, deletedAt: null },
    data: {
      status: RefundStatus.APPROVED,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewerNotes: reviewerNotes?.trim() || null,
    },
  });
  if (claimed.count === 0) {
    return { success: false, error: 'Request is no longer pending.' };
  }

  // State 1 — provider call. A throw HERE means PayMongo did not accept the
  // refund, so it is safe to mark the request FAILED. This is the only place
  // FAILED is set; a DB failure after provider success must never land here
  // (audit C9).
  let paymongoRefundId: string;
  try {
    const refund = await refundPayment({
      paymentId: request.payment.paymongoPaymentId,
      amountCentavos: request.amountPhp, // money fields store centavos
      reason: PAYMONGO_REFUND_REASON,
      metadata: { refundRequestId: request.id },
    });
    paymongoRefundId = refund.id;
  } catch (err: unknown) {
    const message =
      err instanceof PayMongoError
        ? `PayMongo: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    const statusCode = err instanceof PayMongoError ? err.statusCode : null;
    // Only an explicit 4xx rejection means no money moved — safe to mark
    // FAILED. A timeout, connection reset, or 5xx is ambiguous: the refund may
    // have succeeded, so marking it FAILED would misreport a possible refund.
    const isExplicitRejection = statusCode !== null && statusCode >= 400 && statusCode < 500;

    if (isExplicitRejection) {
      await db.refundRequest.updateMany({
        where: { id: request.id, status: RefundStatus.APPROVED },
        data: {
          status: RefundStatus.FAILED,
          failedAt: new Date(),
          failureReason: message.slice(0, 500),
        },
      });
      await auditRefundAction('APPROVE_REFUND_FAILED', request.id, {
        amountPhp: request.amountPhp,
        statusCode,
        reason: message.slice(0, 200),
      });
      revalidatePath('/admin/refunds');
      revalidatePath(`/admin/refunds/${request.id}`);
      return { success: false, error: `Refund API call failed: ${message}` };
    }

    // Ambiguous outcome: leave the request APPROVED (not FAILED, not
    // re-approvable) so it can't be re-issued, and let the payment.refunded
    // webhook or a human reconcile it (C9).
    logger.error(
      { err, requestId: request.id, statusCode },
      'Refund outcome unknown; left APPROVED for reconciliation',
    );
    await auditRefundAction('APPROVE_REFUND_AMBIGUOUS', request.id, {
      amountPhp: request.amountPhp,
      statusCode,
    });
    revalidatePath('/admin/refunds');
    revalidatePath(`/admin/refunds/${request.id}`);
    return {
      success: false,
      error:
        'Refund status is unknown (network error). It has been left for automatic reconciliation. Do not retry.',
    };
  }

  // State 2 — provider refund ACCEPTED. Reconcile local records. A failure
  // here does NOT undo the refund and must NOT be reported as a provider
  // failure or re-trigger a refund (the request is already APPROVED, so a
  // retry can't re-call PayMongo). The webhook is the backstop that finishes
  // reconciliation.
  try {
    await db.$transaction(async (tx) => {
      // Mark this request PROCESSED with its provider refund id (unique —
      // C8). Once marked, it counts toward the cumulative refunded amount.
      await tx.refundRequest.updateMany({
        where: { id: request.id, status: RefundStatus.APPROVED },
        data: {
          status: RefundStatus.PROCESSED,
          paymongoRefundId,
          processedAt: new Date(),
        },
      });

      // Single-writer cumulative amount: sum of PROCESSED requests (includes
      // the one just marked, read within this transaction). The webhook
      // derives the same value, so the refund is counted exactly once.
      const refundedTotal = await alreadyRefundedAmountPhp(request.payment.id, tx);
      const fullyRefunded = refundedTotal >= request.payment.amountPhp;
      await tx.payment.update({
        where: { id: request.payment.id },
        data: {
          status: fullyRefunded
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED,
          refundedAt: new Date(),
          refundAmountPhp: refundedTotal,
          refundReason: PAYMONGO_REFUND_REASON,
        },
      });
    });
  } catch (err) {
    logger.error(
      { err, requestId: request.id, paymongoRefundId },
      'Refund succeeded at PayMongo but local reconciliation failed; webhook will reconcile',
    );
    await auditRefundAction('APPROVE_REFUND_RECONCILING', request.id, {
      amountPhp: request.amountPhp,
      paymongoRefundId,
    });
    revalidatePath('/admin/refunds');
    revalidatePath(`/admin/refunds/${request.id}`);
    // State 2 is NOT a failure — the money left PayMongo. Report it honestly.
    return {
      success: true,
      data: { requestId: request.id, status: 'PROCESSING', paymongoRefundId },
    };
  }

  await auditRefundAction('APPROVE_REFUND', request.id, {
    amountPhp: request.amountPhp,
    paymongoRefundId,
    status: 'PROCESSED',
  });

  revalidatePath('/admin/refunds');
  revalidatePath(`/admin/refunds/${request.id}`);
  revalidatePath('/dashboard/payments');

  sendRefundStatusEmail({
    to: request.user.email,
    studentName: request.user.name ?? 'Student',
    status: 'approved',
    tierName: request.payment.pricingTier?.name ?? 'your course',
    amountPhp: request.amountPhp,
    paymongoRefundId,
  }).catch(() => {});

  return {
    success: true,
    data: { requestId: request.id, status: 'PROCESSED', paymongoRefundId },
  };
}

// ---------------------------------------------------------------------------
// Admin: reject a refund request
// ---------------------------------------------------------------------------

const rejectSchema = z.object({
  requestId: z.string().min(1),
  reviewerNotes: z.string().min(10, 'Tell the student why — at least 10 characters.').max(500),
});

export interface RejectResult {
  requestId: string;
  status: string;
}

export async function rejectRefundAction(
  input: z.infer<typeof rejectSchema>,
): Promise<ActionResult<RejectResult>> {
  const admin = await requireAdmin();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { requestId, reviewerNotes } = parsed.data;

  // updateMany with status guard — only reject PENDING requests.
  const result = await db.refundRequest.updateMany({
    where: { id: requestId, deletedAt: null, status: RefundStatus.PENDING },
    data: {
      status: RefundStatus.REJECTED,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewerNotes: reviewerNotes.trim(),
    },
  });

  if (result.count === 0) {
    return { success: false, error: 'Request is no longer pending.' };
  }

  await auditRefundAction('REJECT_REFUND', requestId, {
    reviewerNotes: reviewerNotes.trim().slice(0, 200),
  });

  const refundRequest = await db.refundRequest.findUnique({
    where: { id: requestId },
    select: {
      amountPhp: true,
      user: { select: { email: true, name: true } },
      payment: {
        select: {
          pricingTier: { select: { name: true } },
        },
      },
    },
  });

  if (refundRequest) {
    sendRefundStatusEmail({
      to: refundRequest.user.email,
      studentName: refundRequest.user.name ?? 'Student',
      status: 'rejected',
      tierName: refundRequest.payment.pricingTier?.name ?? 'your course',
      amountPhp: refundRequest.amountPhp,
      reviewerNotes,
    }).catch(() => {});
  }

  revalidatePath('/admin/refunds');
  revalidatePath(`/admin/refunds/${requestId}`);

  return { success: true, data: { requestId, status: 'REJECTED' } };
}
