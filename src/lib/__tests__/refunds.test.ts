import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  REFUND_WINDOW_DAYS,
  isWithinRefundWindow,
  daysRemainingInWindow,
  hasBlockingRefundRequest,
  alreadyRefundedAmountPhp,
  refundStatusLabel,
} from '@/lib/refunds';
import { PaymentStatus, RefundStatus } from '@/lib/enums';

const { mockRefundFindFirst, mockRefundFindMany } = vi.hoisted(() => ({
  mockRefundFindFirst: vi.fn(),
  mockRefundFindMany: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    refundRequest: { findFirst: mockRefundFindFirst, findMany: mockRefundFindMany },
  },
}));

const NOW = new Date('2026-07-16T12:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('refunds.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isWithinRefundWindow', () => {
    it('rejects a payment that was never paid', () => {
      expect(isWithinRefundWindow(null, PaymentStatus.COMPLETED, NOW)).toBe(false);
    });

    it('rejects a payment that is not COMPLETED', () => {
      expect(isWithinRefundWindow(daysAgo(1), PaymentStatus.PENDING, NOW)).toBe(false);
    });

    it('accepts a completed payment inside the window', () => {
      expect(isWithinRefundWindow(daysAgo(REFUND_WINDOW_DAYS - 1), PaymentStatus.COMPLETED, NOW)).toBe(
        true,
      );
    });

    it('accepts a payment exactly at the window boundary', () => {
      expect(isWithinRefundWindow(daysAgo(REFUND_WINDOW_DAYS), PaymentStatus.COMPLETED, NOW)).toBe(
        true,
      );
    });

    it('rejects a payment past the window', () => {
      expect(
        isWithinRefundWindow(daysAgo(REFUND_WINDOW_DAYS + 1), PaymentStatus.COMPLETED, NOW),
      ).toBe(false);
    });
  });

  describe('daysRemainingInWindow', () => {
    it('returns 0 when the payment was never paid', () => {
      expect(daysRemainingInWindow(null, NOW)).toBe(0);
    });

    it('returns 0 when the window has expired', () => {
      expect(daysRemainingInWindow(daysAgo(REFUND_WINDOW_DAYS + 1), NOW)).toBe(0);
    });

    it('returns 0 exactly at expiry', () => {
      expect(daysRemainingInWindow(daysAgo(REFUND_WINDOW_DAYS), NOW)).toBe(0);
    });

    it('returns the full window for a payment made just now', () => {
      expect(daysRemainingInWindow(NOW, NOW)).toBe(REFUND_WINDOW_DAYS);
    });

    it('rounds partial days up', () => {
      const paidAt = new Date(NOW.getTime() - 1.5 * 24 * 60 * 60 * 1000);
      expect(daysRemainingInWindow(paidAt, NOW)).toBe(REFUND_WINDOW_DAYS - 1);
    });
  });

  describe('hasBlockingRefundRequest', () => {
    it('returns true when a PENDING or APPROVED request exists', async () => {
      mockRefundFindFirst.mockResolvedValue({ id: 'rr_1' });
      await expect(hasBlockingRefundRequest('pay_1')).resolves.toBe(true);
      expect(mockRefundFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentId: 'pay_1',
            status: { in: [RefundStatus.PENDING, RefundStatus.APPROVED] },
          }),
        }),
      );
    });

    it('returns false when no open request exists', async () => {
      mockRefundFindFirst.mockResolvedValue(null);
      await expect(hasBlockingRefundRequest('pay_1')).resolves.toBe(false);
    });
  });

  describe('alreadyRefundedAmountPhp', () => {
    it('sums PROCESSED refund amounts', async () => {
      mockRefundFindMany.mockResolvedValue([{ amountPhp: 1000 }, { amountPhp: 499 }]);
      await expect(alreadyRefundedAmountPhp('pay_1')).resolves.toBe(1499);
      expect(mockRefundFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentId: 'pay_1', status: RefundStatus.PROCESSED }),
        }),
      );
    });

    it('returns 0 when nothing has been refunded', async () => {
      mockRefundFindMany.mockResolvedValue([]);
      await expect(alreadyRefundedAmountPhp('pay_1')).resolves.toBe(0);
    });
  });

  describe('refundStatusLabel', () => {
    it('maps every known status to its label', () => {
      expect(refundStatusLabel(RefundStatus.PENDING)).toBe('Pending review');
      expect(refundStatusLabel(RefundStatus.APPROVED)).toBe('Approved — processing');
      expect(refundStatusLabel(RefundStatus.REJECTED)).toBe('Rejected');
      expect(refundStatusLabel(RefundStatus.PROCESSED)).toBe('Refunded');
      expect(refundStatusLabel(RefundStatus.FAILED)).toBe('Refund failed');
    });

    it('passes unknown statuses through unchanged', () => {
      expect(refundStatusLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
    });
  });
});
