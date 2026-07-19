/**
 * Refund business logic — pure helpers + DB queries.
 *
 * Sprint 6 — STORY-028.
 *
 * Keeps refund-related decisions out of UI components and server actions
 * so they can be unit-tested and reused.
 *
 * Refund policy: students can request a full refund within 7 days of
 * payment. Partial refunds are admin-only and require the admin to set
 * the amount when approving.
 */

import 'server-only';

import { db } from './db';
import { PaymentStatus, RefundStatus } from './enums';

/** Number of days a student can request a refund after payment. */
export const REFUND_WINDOW_DAYS = 7;

/** PayMongo reason used for customer-initiated refunds. */
export const PAYMONGO_REFUND_REASON = 'requested_by_customer' as const;

/**
 * Has the given payment been paid AND is the request still within the
 * refund window? Refunds are only allowed for COMPLETED payments.
 */
export function isWithinRefundWindow(
  paidAt: Date | null,
  status: string,
  now: Date = new Date(),
): boolean {
  if (!paidAt) return false;
  if (status !== PaymentStatus.COMPLETED) return false;
  const ageMs = now.getTime() - paidAt.getTime();
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return ageMs <= windowMs;
}

/**
 * Days remaining in the refund window. Returns 0 if expired or not eligible.
 */
export function daysRemainingInWindow(paidAt: Date | null, now: Date = new Date()): number {
  if (!paidAt) return 0;
  const ageMs = now.getTime() - paidAt.getTime();
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = windowMs - ageMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

/**
 * Has this payment already been fully refunded, or has a pending refund
 * request blocking a new one?
 */
export async function hasBlockingRefundRequest(paymentId: string): Promise<boolean> {
  const open = await db.refundRequest.findFirst({
    where: {
      paymentId,
      deletedAt: null,
      status: { in: [RefundStatus.PENDING, RefundStatus.APPROVED] },
    },
    select: { id: true },
  });
  return open !== null;
}

/**
 * A Prisma client or a transaction-scoped client. Lets refund helpers run
 * inside the same transaction as the writes that depend on them.
 */
type RefundDbClient = typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * The amount already refunded for this payment (in PHP): the sum of every
 * PROCESSED refund request. This is the single source of truth for cumulative
 * refunded amount (audit C8) — both the admin approval path and the
 * `payment.refunded` webhook write `Payment.refundAmountPhp` from this value
 * instead of each adding its own amount, so a refund can never be counted
 * twice regardless of which path runs first.
 */
export async function alreadyRefundedAmountPhp(
  paymentId: string,
  client: RefundDbClient = db,
): Promise<number> {
  const completed = await client.refundRequest.findMany({
    where: {
      paymentId,
      deletedAt: null,
      status: RefundStatus.PROCESSED,
    },
    select: { amountPhp: true },
  });
  return completed.reduce((sum, r) => sum + r.amountPhp, 0);
}

/**
 * List the current user's completed payments, with refund-request state
 * and invoice attached so the UI can show "requested" / "refunded" badges
 * and a "Download receipt" link.
 */
export async function listUserPayments(userId: string) {
  return db.payment.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: [PaymentStatus.COMPLETED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
    },
    orderBy: { paidAt: 'desc' },
    select: {
      id: true,
      amountPhp: true,
      method: true,
      status: true,
      paidAt: true,
      refundedAt: true,
      refundAmountPhp: true,
      pricingTier: { select: { name: true, tier: true } },
      refundRequests: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, amountPhp: true, reason: true, createdAt: true },
      },
      // STORY-029: invoice relation for the "Download receipt" link.
      // 1:1 with payment (paymentId is @unique on Invoice).
      invoice: {
        select: { id: true, number: true, pdfUrl: true, issuedAt: true },
      },
    },
  });
}

/**
 * Pending refund requests for the admin queue. Joins user + payment for
 * display. Ordered by oldest first so the queue drains in FIFO order.
 */
export async function listPendingRefundRequests() {
  return db.refundRequest.findMany({
    where: {
      deletedAt: null,
      status: RefundStatus.PENDING,
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      amountPhp: true,
      reason: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
      payment: {
        select: {
          id: true,
          amountPhp: true,
          paidAt: true,
          method: true,
          paymongoPaymentId: true,
          pricingTier: { select: { name: true } },
        },
      },
    },
  });
}

/**
 * Refund request detail for the admin detail page.
 */
export async function getRefundRequestDetail(id: string) {
  return db.refundRequest.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      amountPhp: true,
      reason: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewerNotes: true,
      processedAt: true,
      paymongoRefundId: true,
      failedAt: true,
      failureReason: true,
      user: { select: { id: true, email: true, name: true } },
      payment: {
        select: {
          id: true,
          amountPhp: true,
          paidAt: true,
          method: true,
          paymongoPaymentId: true,
          status: true,
          pricingTier: { select: { name: true } },
        },
      },
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });
}

/**
 * Map an internal refund request status to a UI-friendly label.
 */
export function refundStatusLabel(status: string): string {
  switch (status) {
    case RefundStatus.PENDING:
      return 'Pending review';
    case RefundStatus.APPROVED:
      return 'Approved — processing';
    case RefundStatus.REJECTED:
      return 'Rejected';
    case RefundStatus.PROCESSED:
      return 'Refunded';
    case RefundStatus.FAILED:
      return 'Refund failed';
    default:
      return status;
  }
}
