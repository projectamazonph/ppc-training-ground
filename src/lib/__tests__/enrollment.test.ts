import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    processedWebhook: { create: fn() },
    user: { findUnique: fn(), create: fn() },
    checkoutSession: { findUnique: fn(), update: fn(), updateMany: fn() },
    payment: { create: fn(), findUnique: fn(), findFirst: fn(), update: fn() },
    course: { findFirst: fn() },
    enrollment: { create: fn(), findUnique: fn(), findFirst: fn(), update: fn() },
    discountCode: { update: fn() },
    $transaction: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));

// Prisma is imported for the TransactionClient type only; stub the value import.
vi.mock('@prisma/client', () => ({ Prisma: {}, PrismaClient: class {} }));

const mockEnums = vi.hoisted(() => ({
  CheckoutStatus: { PAID: 'PAID', FAILED: 'FAILED' },
  EnrollmentStatus: { ACTIVE: 'ACTIVE' },
  PaymentMethod: { GCASH: 'GCASH', MAYA: 'MAYA', GRABPAY: 'GRABPAY', CREDIT_CARD: 'CREDIT_CARD', BANK_TRANSFER: 'BANK_TRANSFER', OTHER: 'OTHER' },
  PaymentStatus: { COMPLETED: 'COMPLETED', REFUNDED: 'REFUNDED' },
}));
vi.mock('@/lib/enums', () => mockEnums);

vi.mock('@/lib/receipts', () => ({ issueInvoiceForPayment: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendEnrollmentConfirmationEmail: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('node:crypto', () => ({ randomUUID: () => 'mock-uuid' }));

import { issueInvoiceForPayment } from '@/lib/receipts';
import { sendEnrollmentConfirmationEmail } from '@/lib/email';
import {
  markWebhookProcessed,
  findOrCreateUserByEmail,
  handleCheckoutPaid,
  handleCheckoutFailed,
  handlePaymentRefunded,
  type CheckoutPaidEvent,
  type CheckoutFailedEvent,
  type PaymentRefundedEvent,
} from '@/lib/enrollment';

/** Error shaped like Prisma's unique-constraint violation. */
function p2002(): Error {
  const err = new Error('Unique constraint failed') as Error & { code: string };
  err.code = 'P2002';
  return err;
}

function makePaidEvent(overrides: Record<string, unknown> = {}): CheckoutPaidEvent {
  return {
    data: {
      id: 'evt-paid-1',
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          id: 'cs_test_123',
          attributes: {
            id: 'cs_test_123',
            payment_id: 'pm_pay_456',
            amount: 299900,
            currency: 'PHP',
            status: 'paid',
            payment_method_type: 'gcash',
            metadata: { name: 'Juan', email: 'juan@example.com' },
            ...overrides,
          },
        },
      },
    },
  };
}

function makeFailedEvent(): CheckoutFailedEvent {
  return {
    data: {
      id: 'evt-fail-1',
      attributes: {
        type: 'checkout_session.payment.failed',
        data: {
          id: 'cs_test_456',
          attributes: { id: 'cs_test_456', failure_reason: 'insufficient_funds', metadata: {} },
        },
      },
    },
  };
}

function makeRefundedEvent(): PaymentRefundedEvent {
  return {
    data: {
      id: 'evt-ref-1',
      attributes: {
        type: 'payment.refunded',
        data: {
          id: 'ref_001',
          attributes: {
            id: 'ref_001', amount: 299900, payment_id: 'pm_pay_456',
            metadata: {},
          },
        },
      },
    },
  };
}

const checkoutRow = {
  id: 'cs-1',
  email: 'juan@example.com',
  finalAmountPhp: 299900,
  userId: null,
  discountCodeId: null,
  pricingTierId: 'pt-1',
  pricingTier: { tier: 'PREMIUM', name: 'PPC Pro' },
};

/** Wire the happy-path mocks for handleCheckoutPaid (guest, new user). */
function wireHappyPath() {
  mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
  mockDb.checkoutSession.findUnique.mockResolvedValue(checkoutRow);
  mockDb.course.findFirst.mockResolvedValue({ id: 'c-1' });
  mockDb.user.findUnique
    .mockResolvedValueOnce(null) // findOrCreateUserByEmail: not found
    .mockResolvedValueOnce({ id: 'u-new', email: 'juan@example.com', name: 'Juan' }); // post-commit email lookup
  mockDb.user.create.mockResolvedValue({ id: 'u-new' });
  mockDb.payment.create.mockResolvedValue({ id: 'pay-1' });
  mockDb.enrollment.findUnique.mockResolvedValue(null); // no prior enrollment
  mockDb.enrollment.create.mockResolvedValue({ id: 'enr-1' });
  mockDb.payment.findFirst.mockResolvedValue(null); // enrollment not yet linked
  mockDb.payment.update.mockResolvedValue({});
  mockDb.checkoutSession.update.mockResolvedValue({});
}

describe('enrollment.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The handlers run everything through db.$transaction(cb). Passing the
    // mockDb itself as the tx client keeps assertions on one set of spies.
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb),
    );
  });

  describe('markWebhookProcessed', () => {
    it('returns true and creates record on first process', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });

      const result = await markWebhookProcessed('evt-1', 'payment.paid', 'checkout_session', 'cs_1');

      expect(result).toBe(true);
      expect(mockDb.processedWebhook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymongoEventId: 'evt-1',
          eventType: 'payment.paid',
          resourceType: 'checkout_session',
          resourceId: 'cs_1',
        }),
      });
    });

    it('returns false when event already processed (unique violation)', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(p2002());

      const result = await markWebhookProcessed('evt-1', 'payment.paid', 'checkout_session', 'cs_1');

      expect(result).toBe(false);
    });

    it('rethrows non-unique-violation errors', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(new Error('connection lost'));

      await expect(
        markWebhookProcessed('evt-1', 'payment.paid', 'checkout_session', 'cs_1'),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('findOrCreateUserByEmail', () => {
    it('returns existing user', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: 'u-1' });

      const result = await findOrCreateUserByEmail('juan@example.com');
      expect(result).toEqual({ id: 'u-1', isNew: false });
    });

    it('creates placeholder user when not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: 'u-new' });

      const result = await findOrCreateUserByEmail('new@example.com', 'New User');

      expect(result).toEqual({ id: 'u-new', isNew: true });
      expect(mockDb.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            name: 'New User',
            role: 'STUDENT',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('derives name from email when name not provided', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: 'u-new' });

      await findOrCreateUserByEmail('student@example.com');

      expect(mockDb.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'student' }),
        }),
      );
    });
  });

  describe('handleCheckoutPaid', () => {
    it('creates payment, user, enrollment and links them', async () => {
      wireHappyPath();

      const result = await handleCheckoutPaid(makePaidEvent());

      expect(result).toEqual({ enrollmentId: 'enr-1', paymentId: 'pay-1', userId: 'u-new' });
      expect(mockDb.user.create).toHaveBeenCalled();
      // Regression guard for the guest-checkout FK bug: the Payment must be
      // created with the resolved user id, never '' (audit finding C4).
      expect(mockDb.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u-new' }),
        }),
      );
      expect(mockDb.enrollment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u-new',
          courseId: 'c-1',
          pricingTierId: 'pt-1',
          tier: 'PREMIUM',
          status: 'ACTIVE',
        }),
      });
      expect(mockDb.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { enrollmentId: 'enr-1' },
      });
    });

    it('returns null on duplicate webhook event', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(p2002());

      const result = await handleCheckoutPaid(makePaidEvent());
      expect(result).toBeNull();
      expect(mockDb.payment.create).not.toHaveBeenCalled();
    });

    it('returns null when CheckoutSession not found', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findUnique.mockResolvedValue(null);

      const result = await handleCheckoutPaid(makePaidEvent());
      expect(result).toBeNull();
    });

    it('returns null when no course found for pricing tier', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findUnique.mockResolvedValue(checkoutRow);
      mockDb.course.findFirst.mockResolvedValue(null);

      const result = await handleCheckoutPaid(makePaidEvent());
      expect(result).toBeNull();
      expect(mockDb.payment.create).not.toHaveBeenCalled();
    });

    it('reactivates an existing enrollment instead of creating a duplicate', async () => {
      wireHappyPath();
      mockDb.enrollment.findUnique.mockResolvedValue({ id: 'enr-old' });
      mockDb.enrollment.update.mockResolvedValue({ id: 'enr-old' });
      mockDb.payment.findFirst.mockResolvedValue({ id: 'pay-earlier' }); // already linked

      const result = await handleCheckoutPaid(makePaidEvent());

      expect(result).toEqual({ enrollmentId: 'enr-old', paymentId: 'pay-1', userId: 'u-new' });
      expect(mockDb.enrollment.create).not.toHaveBeenCalled();
      expect(mockDb.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'enr-old' },
          data: expect.objectContaining({ status: 'ACTIVE', cancelledAt: null }),
        }),
      );
      // enrollmentId is @unique on Payment — must not re-link.
      expect(mockDb.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { enrollmentId: 'enr-old' } }),
      );
    });

    it('increments discount usage when the checkout used a code', async () => {
      wireHappyPath();
      mockDb.checkoutSession.findUnique.mockResolvedValue({
        ...checkoutRow,
        discountCodeId: 'dc-1',
      });
      mockDb.discountCode.update.mockResolvedValue({});

      await handleCheckoutPaid(makePaidEvent());

      expect(mockDb.discountCode.update).toHaveBeenCalledWith({
        where: { id: 'dc-1' },
        data: { currentUses: { increment: 1 } },
      });
    });

    it('does not fail when invoice issuance throws', async () => {
      (issueInvoiceForPayment as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invoice failed'));
      wireHappyPath();

      const result = await handleCheckoutPaid(makePaidEvent());
      expect(result).not.toBeNull();
    });

    it('maps different payment methods (paymaya, grabpay, card, dob, unknown)', async () => {
      for (const [pmt, expectedMethod] of [
        ['paymaya', 'MAYA'],
        ['grab_pay', 'GRABPAY'],
        ['grabpay', 'GRABPAY'],
        ['card', 'CREDIT_CARD'],
        ['dob', 'BANK_TRANSFER'],
        ['unknown_foo', 'OTHER'],
      ] as const) {
        vi.clearAllMocks();
        mockDb.$transaction.mockImplementation(
          async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb),
        );
        wireHappyPath();

        const event = makePaidEvent({ payment_method_type: pmt });
        await handleCheckoutPaid(event);

        expect(mockDb.payment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ method: expectedMethod }),
          }),
        );
      }
    });

    it('sends confirmation email and does not fail on email error', async () => {
      (sendEnrollmentConfirmationEmail as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email fail'));
      wireHappyPath();

      const result = await handleCheckoutPaid(makePaidEvent());
      expect(result).not.toBeNull();
    });
  });

  describe('handleCheckoutFailed', () => {
    it('updates checkout session to FAILED on first event', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.updateMany.mockResolvedValue({ count: 1 });

      await handleCheckoutFailed(makeFailedEvent());

      expect(mockDb.checkoutSession.updateMany).toHaveBeenCalledWith({
        where: { paymongoSourceId: 'cs_test_456' },
        data: expect.objectContaining({ status: 'FAILED', failureReason: 'insufficient_funds' }),
      });
    });

    it('skips update on duplicate event', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(p2002());

      await handleCheckoutFailed(makeFailedEvent());

      expect(mockDb.checkoutSession.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentRefunded', () => {
    it('updates payment and enrollment within the transaction', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
      mockDb.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      mockDb.payment.update.mockResolvedValue({});
      mockDb.enrollment.update.mockResolvedValue({});

      await handlePaymentRefunded(makeRefundedEvent());

      expect(mockDb.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
      expect(mockDb.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'enr-1' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
    });

    it('skips on duplicate event', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(p2002());

      await handlePaymentRefunded(makeRefundedEvent());

      expect(mockDb.payment.update).not.toHaveBeenCalled();
    });

    it('skips when payment not found', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.payment.findUnique.mockResolvedValue(null);

      await handlePaymentRefunded(makeRefundedEvent());

      expect(mockDb.payment.update).not.toHaveBeenCalled();
    });
  });
});
