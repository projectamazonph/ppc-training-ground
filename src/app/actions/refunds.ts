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

  const request = await db.refundRequest.create({
    data: {
      userId: user.id,
      paymentId: payment.id,
      reason: data.reason.trim(),
      amountPhp: refundAmountPhp,
      status: RefundStatus.PENDING,
    },
    select: { id: true },
  });

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
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
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

  // Call PayMongo. If this throws, mark the request FAILED.
  let paymongoRefundId: string | null = null;
  try {
    const refund = await refundPayment({
      paymentId: request.payment.paymongoPaymentId,
      amountCentavos: request.amountPhp, // money fields store centavos
      reason: PAYMONGO_REFUND_REASON,
      metadata: { refundRequestId: request.id },
    });
    paymongoRefundId = refund.id;

    // Mark PROCESSED. The webhook will update Payment + Enrollment; this
    // is a best-effort synchronous update so the admin sees immediate
    // feedback. Webhook will idempotently fill in the rest.
    await db.refundRequest.updateMany({
      where: { id: request.id, status: RefundStatus.APPROVED },
      data: {
        status: RefundStatus.PROCESSED,
        paymongoRefundId: refund.id,
        processedAt: new Date(),
      },
    });

    // Also update Payment.status optimistically. If webhook beats us,
    // it will see status=REFUNDED and skip its own update.
    const newPaymentStatus =
      request.amountPhp >= request.payment.amountPhp
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    await db.payment.update({
      where: { id: request.payment.id },
      data: {
        status: newPaymentStatus,
        refundedAt: new Date(),
        refundAmountPhp: request.amountPhp,
        refundReason: PAYMONGO_REFUND_REASON,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof PayMongoError
        ? `PayMongo: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await db.refundRequest.update({
      where: { id: request.id },
      data: {
        status: RefundStatus.FAILED,
        failedAt: new Date(),
        failureReason: message.slice(0, 500),
      },
    });
    revalidatePath('/admin/refunds');
    revalidatePath(`/admin/refunds/${request.id}`);
    return { success: false, error: `Refund API call failed: ${message}` };
  }

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
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
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
