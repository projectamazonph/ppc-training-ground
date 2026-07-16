import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PayMongoError,
  isTestMode,
  createPaymentIntent,
  createSource,
  createPaymentFromSource,
  refundPayment,
} from '@/lib/paymongo';

const { mockIntentCreate, mockSourceCreate, mockPaymentCreate, mockRefundCreate } = vi.hoisted(
  () => ({
    mockIntentCreate: vi.fn(),
    mockSourceCreate: vi.fn(),
    mockPaymentCreate: vi.fn(),
    mockRefundCreate: vi.fn(),
  }),
);

vi.mock('paymongo', () => ({
  default: class MockPaymongo {
    paymentIntents = { create: mockIntentCreate };
    sources = { create: mockSourceCreate };
    payments = { create: mockPaymentCreate };
    refunds = { create: mockRefundCreate };
  },
}));

describe('paymongo.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMONGO_SECRET_KEY = 'sk_test_abc123';
  });

  afterEach(() => {
    delete process.env.PAYMONGO_SECRET_KEY;
  });

  describe('isTestMode', () => {
    it('returns true for sk_test_ keys', () => {
      expect(isTestMode()).toBe(true);
    });

    it('returns false for sk_live_ keys', () => {
      process.env.PAYMONGO_SECRET_KEY = 'sk_live_abc123';
      expect(isTestMode()).toBe(false);
    });

    it('throws PayMongoError when the secret key is missing', () => {
      delete process.env.PAYMONGO_SECRET_KEY;
      expect(() => isTestMode()).toThrow(PayMongoError);
      expect(() => isTestMode()).toThrow(/PAYMONGO_SECRET_KEY is not configured/);
    });
  });

  describe('PayMongoError', () => {
    it('defaults statusCode and paymongoCode to null', () => {
      const err = new PayMongoError('boom');
      expect(err.name).toBe('PayMongoError');
      expect(err.statusCode).toBeNull();
      expect(err.paymongoCode).toBeNull();
    });

    it('keeps provided statusCode and paymongoCode', () => {
      const err = new PayMongoError('boom', { statusCode: 402, paymongoCode: 'card_declined' });
      expect(err.statusCode).toBe(402);
      expect(err.paymongoCode).toBe('card_declined');
    });
  });

  describe('createPaymentIntent', () => {
    it('maps a full SDK response', async () => {
      mockIntentCreate.mockResolvedValue({
        data: {
          id: 'pi_1',
          attributes: { client_key: 'ck_1', status: 'awaiting_payment_method', amount: 299900 },
        },
      });
      const result = await createPaymentIntent({
        amountCentavos: 299900,
        description: 'PPC Foundations',
        metadata: { userId: 'u1' },
        statementDescriptor: 'A very long statement descriptor that exceeds the limit',
      });
      expect(result).toEqual({
        id: 'pi_1',
        clientKey: 'ck_1',
        status: 'awaiting_payment_method',
        amount: 299900,
      });
      const sent = mockIntentCreate.mock.calls[0]![0].data.attributes;
      expect(sent.statement_descriptor).toHaveLength(22);
      expect(sent.metadata).toEqual({ userId: 'u1' });
    });

    it('falls back to defaults when the response is missing fields', async () => {
      mockIntentCreate.mockResolvedValue({});
      const result = await createPaymentIntent({
        amountCentavos: 100,
        description: 'x',
      });
      expect(result).toEqual({ id: '', clientKey: null, status: 'unknown', amount: 100 });
      const sent = mockIntentCreate.mock.calls[0]![0].data.attributes;
      expect(sent.statement_descriptor).toBeUndefined();
      expect(sent.metadata).toEqual({});
    });

    it('wraps SDK errors in PayMongoError', async () => {
      mockIntentCreate.mockRejectedValue(new Error('network down'));
      await expect(createPaymentIntent({ amountCentavos: 100, description: 'x' })).rejects.toThrow(
        new PayMongoError('network down'),
      );
    });

    it('wraps non-Error throws in a generic PayMongoError', async () => {
      mockIntentCreate.mockRejectedValue('string failure');
      await expect(createPaymentIntent({ amountCentavos: 100, description: 'x' })).rejects.toThrow(
        'Unknown PayMongo error',
      );
    });

    it('re-throws PayMongoError as-is (missing secret key)', async () => {
      delete process.env.PAYMONGO_SECRET_KEY;
      await expect(createPaymentIntent({ amountCentavos: 100, description: 'x' })).rejects.toThrow(
        /PAYMONGO_SECRET_KEY is not configured/,
      );
      expect(mockIntentCreate).not.toHaveBeenCalled();
    });
  });

  describe('createSource', () => {
    it('maps a full SDK response and builds redirect URLs', async () => {
      mockSourceCreate.mockResolvedValue({
        data: {
          id: 'src_1',
          attributes: { status: 'pending', redirect: { checkout_url: 'https://pm.link/x' } },
        },
      });
      const result = await createSource({
        amountCentavos: 149900,
        type: 'gcash',
        email: 'student@example.com',
        redirectUrl: 'https://amph.ph/checkout/complete',
        metadata: { tier: 'PPC_FOUNDATIONS' },
      });
      expect(result).toEqual({ id: 'src_1', status: 'pending', redirectUrl: 'https://pm.link/x' });
      const sent = mockSourceCreate.mock.calls[0]![0].data.attributes;
      expect(sent.redirect).toEqual({
        success: 'https://amph.ph/checkout/complete?status=success',
        failed: 'https://amph.ph/checkout/complete?status=failed',
      });
      expect(sent.billing).toEqual({ email: 'student@example.com' });
    });

    it('falls back to defaults when the response is missing fields', async () => {
      mockSourceCreate.mockResolvedValue({ data: {} });
      const result = await createSource({
        amountCentavos: 100,
        type: 'paymaya',
        email: 'a@b.c',
        redirectUrl: 'https://amph.ph/r',
      });
      expect(result).toEqual({ id: '', status: 'unknown', redirectUrl: null });
      expect(mockSourceCreate.mock.calls[0]![0].data.attributes.metadata).toEqual({});
    });

    it('wraps SDK errors in PayMongoError', async () => {
      mockSourceCreate.mockRejectedValue(new Error('bad request'));
      await expect(
        createSource({ amountCentavos: 100, type: 'gcash', email: 'a@b.c', redirectUrl: 'r' }),
      ).rejects.toThrow(new PayMongoError('bad request'));
    });
  });

  describe('createPaymentFromSource', () => {
    it('maps a full SDK response', async () => {
      mockPaymentCreate.mockResolvedValue({
        data: {
          id: 'pay_1',
          attributes: { status: 'paid', amount: 149900, paid_at: '2026-07-16T00:00:00Z' },
        },
      });
      const result = await createPaymentFromSource({
        amountCentavos: 149900,
        sourceId: 'src_1',
        description: 'Accelerated Mastery',
        metadata: { userId: 'u1' },
      });
      expect(result).toEqual({
        id: 'pay_1',
        status: 'paid',
        amount: 149900,
        paidAt: '2026-07-16T00:00:00Z',
      });
      const sent = mockPaymentCreate.mock.calls[0]![0].data.attributes;
      expect(sent.source).toEqual({ id: 'src_1', type: 'source' });
    });

    it('falls back to defaults when the response is missing fields', async () => {
      mockPaymentCreate.mockResolvedValue({ data: { attributes: {} } });
      const result = await createPaymentFromSource({
        amountCentavos: 500,
        sourceId: 'src_2',
        description: 'x',
      });
      expect(result).toEqual({ id: '', status: 'unknown', amount: 500, paidAt: null });
      expect(mockPaymentCreate.mock.calls[0]![0].data.attributes.metadata).toEqual({});
    });

    it('wraps SDK errors in PayMongoError', async () => {
      mockPaymentCreate.mockRejectedValue(new Error('source not chargeable'));
      await expect(
        createPaymentFromSource({ amountCentavos: 100, sourceId: 's', description: 'x' }),
      ).rejects.toThrow(new PayMongoError('source not chargeable'));
    });
  });

  describe('refundPayment', () => {
    it('maps a full SDK response', async () => {
      mockRefundCreate.mockResolvedValue({
        data: { id: 'ref_1', attributes: { status: 'pending', amount: 149900 } },
      });
      const result = await refundPayment({
        paymentId: 'pay_1',
        amountCentavos: 149900,
        reason: 'requested_by_customer',
        metadata: { requestId: 'rr_1' },
      });
      expect(result).toEqual({ id: 'ref_1', status: 'pending', amount: 149900 });
      const sent = mockRefundCreate.mock.calls[0]![0].data.attributes;
      expect(sent.payment_id).toBe('pay_1');
      expect(sent.reason).toBe('requested_by_customer');
    });

    it('falls back to defaults when the response is missing fields', async () => {
      mockRefundCreate.mockResolvedValue(undefined);
      const result = await refundPayment({
        paymentId: 'pay_1',
        amountCentavos: 100,
        reason: 'duplicate',
      });
      expect(result).toEqual({ id: '', status: 'unknown', amount: 0 });
      expect(mockRefundCreate.mock.calls[0]![0].data.attributes.metadata).toEqual({});
    });

    it('wraps SDK errors in PayMongoError', async () => {
      mockRefundCreate.mockRejectedValue(new Error('already refunded'));
      await expect(
        refundPayment({ paymentId: 'p', amountCentavos: 100, reason: 'fraudulent' }),
      ).rejects.toThrow(new PayMongoError('already refunded'));
    });
  });
});
