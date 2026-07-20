import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuditLog = vi.fn();
const mockRefundPayment = vi.fn();
const mockSendRefundStatusEmail = vi.fn();

vi.mock('@/lib/admin-audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

vi.mock('@/lib/paymongo', () => ({
  refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
  PayMongoError: class PayMongoError extends Error {},
}));

vi.mock('@/lib/email', () => ({
  sendRefundStatusEmail: (...args: unknown[]) => mockSendRefundStatusEmail(...args),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'STUDENT' }),
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    refundRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    payment: {
      update: vi.fn(),
    },
  },
}));

import { approveRefundAction, rejectRefundAction } from '../refunds';
import { RefundStatus } from '@/lib/enums';

describe('refund actions audit log integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('approveRefundAction', () => {
    it('successfully approves a refund and records it in AuditLog', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'req_123',
        status: RefundStatus.PENDING,
        amountPhp: 2999,
        user: { email: 'student@test.com', name: 'Student' },
        payment: {
          id: 'pay_123',
          paymongoPaymentId: 'pm_pay_123',
          amountPhp: 2999,
          status: 'COMPLETED',
          pricingTier: { name: 'Accelerated Course' },
        },
      });

      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockRefundPayment.mockResolvedValue({ id: 'ref_abc' });
      mockSendRefundStatusEmail.mockResolvedValue({});

      const result = await approveRefundAction({
        requestId: 'req_123',
        reviewerNotes: 'Approved refund.',
      });

      expect(result.success).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledWith({
        action: 'APPROVE_REFUND',
        entityType: 'RefundRequest',
        entityId: 'req_123',
        metadata: { amountPhp: 2999, paymongoRefundId: 'ref_abc' },
      });
    });

    it('does not log to AuditLog if the transition fails (claimed count 0)', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'req_123',
        status: RefundStatus.PENDING,
        amountPhp: 2999,
        user: { email: 'student@test.com', name: 'Student' },
        payment: {
          id: 'pay_123',
          paymongoPaymentId: 'pm_pay_123',
          amountPhp: 2999,
          status: 'COMPLETED',
          pricingTier: { name: 'Accelerated Course' },
        },
      });

      // Simulation of a race where another admin already approved it
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await approveRefundAction({
        requestId: 'req_123',
        reviewerNotes: 'Approved refund.',
      });

      expect(result.success).toBe(false);
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('does not log to AuditLog if the PayMongo API call fails', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'req_123',
        status: RefundStatus.PENDING,
        amountPhp: 2999,
        user: { email: 'student@test.com', name: 'Student' },
        payment: {
          id: 'pay_123',
          paymongoPaymentId: 'pm_pay_123',
          amountPhp: 2999,
          status: 'COMPLETED',
          pricingTier: { name: 'Accelerated Course' },
        },
      });

      mockUpdateMany.mockResolvedValue({ count: 1 });
      // Simulate PayMongo API throwing an error
      mockRefundPayment.mockRejectedValue(new Error('PayMongo network failure'));

      const result = await approveRefundAction({
        requestId: 'req_123',
        reviewerNotes: 'Approved refund.',
      });

      expect(result.success).toBe(false);
      expect(mockAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('rejectRefundAction', () => {
    it('successfully rejects a refund and records it in AuditLog', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'req_123',
        amountPhp: 2999,
        user: { email: 'student@test.com', name: 'Student' },
        payment: {
          pricingTier: { name: 'Accelerated Course' },
        },
      });

      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockSendRefundStatusEmail.mockResolvedValue({});

      const result = await rejectRefundAction({
        requestId: 'req_123',
        reviewerNotes: 'Rejected because window passed.',
      });

      expect(result.success).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledWith({
        action: 'REJECT_REFUND',
        entityType: 'RefundRequest',
        entityId: 'req_123',
        metadata: { reason: 'Rejected because window passed.' },
      });
    });

    it('does not log to AuditLog if the rejection fails (claimed count 0)', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await rejectRefundAction({
        requestId: 'req_123',
        reviewerNotes: 'Rejected because window passed.',
      });

      expect(result.success).toBe(false);
      expect(mockAuditLog).not.toHaveBeenCalled();
    });
  });
});
