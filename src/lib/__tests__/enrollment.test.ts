import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    processedWebhook: { create: fn(), deleteMany: fn() },
    user: { findUnique: fn(), create: fn() },
    checkoutSession: { findUnique: fn(), findFirst: fn(), update: fn(), updateMany: fn() },
    payment: { create: fn(), findUnique: fn(), findFirst: fn(), update: fn() },
    course: { findFirst: fn() },
    enrollment: { create: fn(), findUnique: fn(), findFirst: fn(), update: fn() },
    discountCode: { update: fn(), updateMany: fn() },
    refundRequest: { findMany: fn() },
    $transaction: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));

const mockCreatePaymentFromSource = vi.fn();
vi.mock('@/lib/paymongo', () => ({
  createPaymentFromSource: (...args: unknown[]) => mockCreatePaymentFromSource(...args),
}));

// Prisma is imported for the TransactionClient type only; stub the value import.
vi.mock('@prisma/client', () => ({ Prisma: {}, PrismaClient: class {} }));

const mockEnums = vi.hoisted(() => ({
  CheckoutStatus: { PAID: 'PAID', FAILED: 'FAILED' },
  EnrollmentStatus: { ACTIVE: 'ACTIVE' },
  PaymentMethod: { GCASH: 'GCASH', MAYA: 'MAYA', GRABPAY: 'GRABPAY', CREDIT_CARD: 'CREDIT_CARD', BANK_TRANSFER: 'BANK_TRANSFER', OTHER: 'OTHER' },
  PaymentStatus: { COMPLETED: 'COMPLETED', REFUNDED: 'REFUNDED', PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED' },
  RefundStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', PROCESSED: 'PROCESSED', FAILED: 'FAILED' },
}));
vi.mock('@/lib/enums', () => mockEnums);

vi.mock('@/lib/receipts', () => ({ issueInvoiceForPayment: vi.fn() }));
vi.mock('@/lib/email', () => ({
  sendEnrollmentConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendAccountClaimEmail: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// claim-token.ts calls these directly (not mocked itself) — mocking node:crypto
// gives deterministic raw tokens/hashes without stubbing claim-token.ts's logic.
vi.mock('node:crypto', () => ({
  randomUUID: () => 'mock-uuid',
  randomBytes: (n: number) => Buffer.alloc(n, 1),
  createHash: () => ({ update: () => ({ digest: () => 'mock-hash' }) }),
}));

import { issueInvoiceForPayment } from '@/lib/receipts';
import { sendEnrollmentConfirmationEmail, sendAccountClaimEmail } from '@/lib/email';
import {
  markWebhookProcessed,
  findOrCreateUserByEmail,
  handleCheckoutPaid,
  handleCheckoutFailed,
  handlePaymentRefunded,
  handleSourceChargeable,
  handlePaymentPaid,
  type CheckoutPaidEvent,
  type CheckoutFailedEvent,
  type PaymentRefundedEvent,
  type SourceChargeableEvent,
  type PaymentPaidEvent,
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

function makeSourceChargeableEvent(overrides: Record<string, unknown> = {}): SourceChargeableEvent {
  return {
    data: {
      id: 'evt-src-1',
      attributes: {
        type: 'source.chargeable',
        data: {
          id: 'src_test_001',
          attributes: {
            id: 'src_test_001',
            amount: 299900,
            currency: 'PHP',
            status: 'chargeable',
            type: 'gcash',
            metadata: {},
            ...overrides,
          },
        },
      },
    },
  };
}

function makePaymentPaidEvent(overrides: Record<string, unknown> = {}): PaymentPaidEvent {
  return {
    data: {
      id: 'evt-pp-1',
      attributes: {
        type: 'payment.paid',
        data: {
          id: 'pay_test_001',
          attributes: {
            id: 'pay_test_001',
            amount: 299900,
            currency: 'PHP',
            status: 'paid',
            paid_at: '2026-07-17T00:00:00.000Z',
            source: { id: 'src_test_001', type: 'source' },
            metadata: {},
            ...overrides,
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

// Source-flow checkout rows carry `discountCode` (maxUses) alongside
// `discountCodeId`, per the SourceFlowCheckout select shape in enrollment.ts.
const sourceCheckoutRow = {
  id: 'cs-src-1',
  email: 'maria@example.com',
  finalAmountPhp: 299900,
  discountCodeId: null,
  discountCode: null,
  pricingTierId: 'pt-1',
  pricingTier: { name: 'PPC Pro', tier: 'PREMIUM', slug: 'ppc-pro' },
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

/** Wire the happy-path mocks for the Source-flow handlers (guest, new user). */
function wireSourceHappyPath() {
  mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-src' });
  mockDb.checkoutSession.findFirst.mockResolvedValue(sourceCheckoutRow);
  mockDb.payment.findUnique.mockResolvedValue(null); // not already processed
  mockDb.user.create.mockResolvedValue({ id: 'u-guest' });
  mockDb.payment.create.mockResolvedValue({ id: 'pay-src-1' });
  mockDb.course.findFirst.mockResolvedValue({ id: 'c-1' });
  mockDb.enrollment.findUnique.mockResolvedValue(null);
  mockDb.enrollment.create.mockResolvedValue({ id: 'enr-src-1' });
  mockDb.payment.findFirst.mockResolvedValue(null);
  mockDb.payment.update.mockResolvedValue({});
  mockDb.checkoutSession.update.mockResolvedValue({});
  // First call (inside findOrCreateUserByEmail) misses -> placeholder created.
  // Second call (post-commit, inside sendPostPurchaseEmails) returns that user.
  mockDb.user.findUnique.mockResolvedValueOnce(null).mockResolvedValue({
    id: 'u-guest',
    email: 'maria@example.com',
    name: 'maria',
  });
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

    it('creates placeholder user with claim token when not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: 'u-new' });

      const result = await findOrCreateUserByEmail('new@example.com', 'New User');

      expect(result).toEqual({ id: 'u-new', isNew: true, rawClaimToken: expect.any(String) });
      expect(mockDb.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            name: 'New User',
            role: 'STUDENT',
            status: 'ACTIVE',
            passwordHash: expect.stringMatching(/^placeholder_/),
            claimTokenHash: expect.any(String),
            claimTokenExpiresAt: expect.any(Date),
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

    it('canonicalizes (trims + lowercases) the email before lookup and create', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: 'u-new' });

      await findOrCreateUserByEmail('  Student@Example.COM  ');

      expect(mockDb.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'student@example.com' } }),
      );
      expect(mockDb.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'student@example.com' }),
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

    it('sends the account-claim email for a new guest user, with the raw token', async () => {
      wireHappyPath();

      await handleCheckoutPaid(makePaidEvent());

      // Regression guard for the dead-code bug this task fixes: the raw claim
      // token minted in findOrCreateUserByEmail must actually reach
      // sendAccountClaimEmail, not just be generated and dropped.
      expect(sendAccountClaimEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'juan@example.com',
          rawClaimToken: expect.any(String),
        }),
      );
    });

    it('does not send a claim email for an existing (non-placeholder) user', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findUnique.mockResolvedValue(checkoutRow);
      mockDb.course.findFirst.mockResolvedValue({ id: 'c-1' });
      mockDb.user.findUnique
        .mockResolvedValueOnce({ id: 'u-existing' }) // findOrCreateUserByEmail: found
        .mockResolvedValueOnce({ id: 'u-existing', email: 'juan@example.com', name: 'Juan' });
      mockDb.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockDb.enrollment.findUnique.mockResolvedValue(null);
      mockDb.enrollment.create.mockResolvedValue({ id: 'enr-1' });
      mockDb.payment.findFirst.mockResolvedValue(null);
      mockDb.payment.update.mockResolvedValue({});
      mockDb.checkoutSession.update.mockResolvedValue({});

      await handleCheckoutPaid(makePaidEvent());

      expect(sendAccountClaimEmail).not.toHaveBeenCalled();
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
        discountCode: { maxUses: null },
      });
      mockDb.discountCode.updateMany.mockResolvedValue({ count: 1 });

      await handleCheckoutPaid(makePaidEvent());

      // H4: conditional atomic increment, not a blind update.
      expect(mockDb.discountCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'dc-1' },
        data: { currentUses: { increment: 1 } },
      });
    });

    it('throws (rolling back the transaction) when a maxUses-limited code has hit its limit', async () => {
      // Set up mocks directly (not via wireHappyPath()) — this flow throws
      // mid-transaction, before the post-commit db.user.findUnique lookup, so
      // wireHappyPath()'s second queued mockResolvedValueOnce would never be
      // consumed here and would leak into (and corrupt) a later test.
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findUnique.mockResolvedValue({
        ...checkoutRow,
        discountCodeId: 'dc-1',
        discountCode: { maxUses: 10 },
      });
      mockDb.course.findFirst.mockResolvedValue({ id: 'c-1' });
      mockDb.user.findUnique.mockResolvedValue(null); // no existing user -> placeholder path
      mockDb.user.create.mockResolvedValue({ id: 'u-new' });
      // H4: updateMany's `currentUses < maxUses` guard matched zero rows.
      mockDb.discountCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(handleCheckoutPaid(makePaidEvent())).rejects.toThrow(
        'Discount code usage limit reached.',
      );
      expect(mockDb.discountCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'dc-1', currentUses: { lt: 10 } },
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
      // Full refund (amount === payment amount) with no prior PROCESSED
      // requests → cumulative falls back to the event amount → fully refunded.
      mockDb.payment.findUnique.mockResolvedValue({ id: 'pay-1', amountPhp: 299900 });
      mockDb.refundRequest.findMany.mockResolvedValue([]);
      mockDb.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      mockDb.payment.update.mockResolvedValue({});
      mockDb.enrollment.update.mockResolvedValue({});

      await handlePaymentRefunded(makeRefundedEvent());

      expect(mockDb.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: 'REFUNDED', refundAmountPhp: 299900 }),
        }),
      );
      expect(mockDb.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'enr-1' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
    });

    it('marks PARTIALLY_REFUNDED and keeps enrollment active on a partial refund', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.payment.findUnique.mockResolvedValue({ id: 'pay-1', amountPhp: 299900 });
      // No PROCESSED requests recorded yet — falls back to the webhook's
      // (partial) amount, which is less than the payment total.
      mockDb.refundRequest.findMany.mockResolvedValue([]);
      mockDb.payment.update.mockResolvedValue({});

      const partialEvent: PaymentRefundedEvent = {
        data: {
          id: 'evt-ref-2',
          attributes: {
            type: 'payment.refunded',
            data: {
              id: 'ref_002',
              attributes: { id: 'ref_002', amount: 100000, payment_id: 'pm_pay_456', metadata: {} },
            },
          },
        },
      };
      await handlePaymentRefunded(partialEvent);

      expect(mockDb.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED', refundAmountPhp: 100000 }),
        }),
      );
      expect(mockDb.enrollment.update).not.toHaveBeenCalled();
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

  // ---------------------------------------------------------------------------
  // Source-based flow (C1 / AUDIT-2026-07-17): checkout.ts creates a PayMongo
  // Source, not a Checkout Session, so THESE handlers — not handleCheckoutPaid
  // above — are what complete a real purchase.
  // ---------------------------------------------------------------------------

  describe('handleSourceChargeable', () => {
    it('creates a payment from the source and, once paid, fulfils the order', async () => {
      wireSourceHappyPath();
      mockCreatePaymentFromSource.mockResolvedValue({
        id: 'pm_from_src_1',
        status: 'paid',
        amount: 299900,
        paidAt: '2026-07-17T00:00:00.000Z',
      });

      const result = await handleSourceChargeable(makeSourceChargeableEvent());

      expect(result).toEqual(
        expect.objectContaining({ id: 'pm_from_src_1', status: 'paid' }),
      );
      expect(mockCreatePaymentFromSource).toHaveBeenCalledWith(
        expect.objectContaining({ amountCentavos: 299900, sourceId: 'src_test_001' }),
      );
      expect(mockDb.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u-guest', paymongoPaymentId: 'pm_from_src_1' }),
        }),
      );
      expect(mockDb.enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u-guest', courseId: 'c-1', status: 'ACTIVE' }),
        }),
      );
      // Post-purchase emails fire AFTER the transaction commits (best-effort,
      // not awaited inside it) - let the pending microtasks drain before
      // asserting on them.
      await new Promise((resolve) => setImmediate(resolve));
      // The dead-code bug this task fixes: a NEW guest user must get the
      // account-claim email with the raw token, not just a log line.
      expect(sendAccountClaimEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'maria@example.com', rawClaimToken: expect.any(String) }),
      );
      expect(sendEnrollmentConfirmationEmail).toHaveBeenCalled();
    });

    it('does not fulfil the order when the source is not yet paid', async () => {
      wireSourceHappyPath();
      mockCreatePaymentFromSource.mockResolvedValue({
        id: 'pm_from_src_1',
        status: 'pending',
        amount: 299900,
        paidAt: null,
      });

      await handleSourceChargeable(makeSourceChargeableEvent());

      expect(mockDb.payment.create).not.toHaveBeenCalled();
      expect(sendAccountClaimEmail).not.toHaveBeenCalled();
    });

    it('returns null when already processed (duplicate webhook)', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(p2002());

      const result = await handleSourceChargeable(makeSourceChargeableEvent());

      expect(result).toBeNull();
      expect(mockCreatePaymentFromSource).not.toHaveBeenCalled();
    });

    it('returns null when no checkout session matches the source', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findFirst.mockResolvedValue(null);

      const result = await handleSourceChargeable(makeSourceChargeableEvent());

      expect(result).toBeNull();
      expect(mockCreatePaymentFromSource).not.toHaveBeenCalled();
    });

    it('rejects (throws) on a non-PHP currency instead of silently creating a payment', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findFirst.mockResolvedValue(sourceCheckoutRow);

      await expect(
        handleSourceChargeable(makeSourceChargeableEvent({ currency: 'USD' })),
      ).rejects.toThrow('Unexpected currency: USD');
      expect(mockCreatePaymentFromSource).not.toHaveBeenCalled();
    });

    it('rejects (throws) an underpayment instead of granting full access (H2)', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findFirst.mockResolvedValue(sourceCheckoutRow); // finalAmountPhp 299900

      await expect(
        handleSourceChargeable(makeSourceChargeableEvent({ amount: 100000 })),
      ).rejects.toThrow('less than the expected checkout amount');
      expect(mockCreatePaymentFromSource).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentPaid', () => {
    it('fulfils the order by looking up the checkout session via source id', async () => {
      wireSourceHappyPath();

      const result = await handlePaymentPaid(makePaymentPaidEvent());

      expect(result).toEqual(
        expect.objectContaining({ enrollmentId: 'enr-src-1', paymentId: 'pay-src-1' }),
      );
      expect(mockDb.checkoutSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ paymongoSourceId: 'src_test_001' }) }),
      );
      expect(sendAccountClaimEmail).toHaveBeenCalledWith(
        expect.objectContaining({ rawClaimToken: expect.any(String) }),
      );
    });

    it('falls back to paymongoPaymentId lookup when the source-id lookup misses', async () => {
      wireSourceHappyPath();
      mockDb.checkoutSession.findFirst
        .mockResolvedValueOnce(null) // source-id lookup misses
        .mockResolvedValueOnce(sourceCheckoutRow); // paymongoPaymentId lookup hits

      const result = await handlePaymentPaid(makePaymentPaidEvent());

      expect(result).toEqual(
        expect.objectContaining({ enrollmentId: 'enr-src-1', paymentId: 'pay-src-1' }),
      );
      expect(mockDb.checkoutSession.findFirst).toHaveBeenCalledTimes(2);
    });

    it('skips the source-id lookup entirely when the event carries no source', async () => {
      wireSourceHappyPath();

      const result = await handlePaymentPaid(makePaymentPaidEvent({ source: undefined }));

      expect(result).toEqual(
        expect.objectContaining({ enrollmentId: 'enr-src-1', paymentId: 'pay-src-1' }),
      );
      expect(mockDb.checkoutSession.findFirst).toHaveBeenCalledTimes(1);
      expect(mockDb.checkoutSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ paymongoPaymentId: 'pay_test_001' }) }),
      );
    });

    it('returns null when no checkout session matches by source or payment id', async () => {
      mockDb.processedWebhook.create.mockResolvedValue({ id: 'pw-1' });
      mockDb.checkoutSession.findFirst.mockResolvedValue(null);

      const result = await handlePaymentPaid(makePaymentPaidEvent());

      expect(result).toBeNull();
    });

    it('returns null when already processed (duplicate webhook)', async () => {
      mockDb.processedWebhook.create.mockRejectedValue(p2002());

      const result = await handlePaymentPaid(makePaymentPaidEvent());

      expect(result).toBeNull();
      expect(mockDb.checkoutSession.findFirst).not.toHaveBeenCalled();
    });

    it('does not double-process a payment id that already has a local Payment row', async () => {
      wireSourceHappyPath();
      mockDb.payment.findUnique.mockResolvedValue({ id: 'already-there' });

      const result = await handlePaymentPaid(makePaymentPaidEvent());

      expect(result).toBeNull();
      expect(mockDb.payment.create).not.toHaveBeenCalled();
    });
  });
});
