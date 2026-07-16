import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDiscountCode, getTierDisplay, createCheckoutSessionAtomic } from '@/lib/pricing';
import { DiscountType, CourseTier } from '@/lib/enums';

const { mockFindUnique, mockFindMany, mockUpdate, mockCreate, mockTransaction } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    discountCode: { findUnique: mockFindUnique, update: mockUpdate },
    pricingTier: { findMany: mockFindMany },
    checkoutSession: { create: mockCreate },
    $transaction: mockTransaction,
  },
}));

function makeValidDiscount(overrides: Record<string, unknown> = {}) {
  return {
    code: 'SAVE10',
    isActive: true,
    startsAt: new Date('2020-01-01'),
    expiresAt: new Date('2099-01-01'),
    maxUses: null,
    currentUses: 0,
    minPurchasePhp: 0,
    type: DiscountType.PERCENTAGE,
    value: 10,
    tiers: [],
    ...overrides,
  };
}

describe('pricing.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateDiscountCode', () => {
    it('rejects missing code', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await validateDiscountCode('MISSING', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Discount code not found.');
    });

    it('rejects inactive code', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ isActive: false }));
      const result = await validateDiscountCode('SAVE', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Discount code is not active.');
    });

    it('rejects code that has not started yet', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ startsAt: new Date('2099-01-01') }));
      const result = await validateDiscountCode('FUTURE', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Discount code has not started yet.');
    });

    it('rejects expired code', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ expiresAt: new Date('2020-01-01') }));
      const result = await validateDiscountCode('EXPIRED', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Discount code has expired.');
    });

    it('rejects fully used code', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ maxUses: 5, currentUses: 5 }));
      const result = await validateDiscountCode('USEUP', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Discount code has been fully used.');
    });

    it('rejects code below min purchase', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ minPurchasePhp: 500000 }));
      const result = await validateDiscountCode('MINPURCHASE', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum purchase');
    });

    it('applies percentage discount', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount());
      const result = await validateDiscountCode('pct', 't1', 299900);
      expect(result.valid).toBe(true);
      expect(result.discountAmountCentavos).toBe(29990);
      expect(result.code).toBe('SAVE10');
    });

    it('caps fixed discount to amount', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ type: DiscountType.FIXED, value: 999999 }));
      const result = await validateDiscountCode('FIXED', 't1', 299900);
      expect(result.valid).toBe(true);
      expect(result.discountAmountCentavos).toBe(299900);
    });

    it('enforces tier restriction', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ tiers: [{ pricingTierId: 'other-tier' }] }));
      const result = await validateDiscountCode('TIERED', 't1', 299900);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Discount code not valid for this tier.');
    });

    it('passes tier restriction when discount applies to the tier', async () => {
      mockFindUnique.mockResolvedValue(makeValidDiscount({ tiers: [{ pricingTierId: 't1' }] }));
      const result = await validateDiscountCode('MYTIER', 't1', 299900);
      expect(result.valid).toBe(true);
      expect(result.discountAmountCentavos).toBe(29990);
    });
  });

  describe('createCheckoutSessionAtomic', () => {
    it('creates checkout session without discount', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          discountCode: { update: vi.fn() },
          checkoutSession: { create: vi.fn().mockResolvedValue({ id: 'cs-1' }) },
        };
        return cb(tx);
      });

      const result = await createCheckoutSessionAtomic({
        userId: 'u-1', email: 'test@test.com', pricingTierId: 'pt-1',
        amountCentavos: 299900, discountCodeId: null, discountAmountCentavos: 0,
        finalAmountCentavos: 299900, redirectUrl: 'https://example.com/thanks',
        expiresAt: new Date('2099-01-01'),
      });

      expect(result.checkoutSessionId).toBe('cs-1');
    });

    it('does NOT increment discount usage at session creation (counted on paid webhook instead)', async () => {
      const mockTxDiscountUpdate = vi.fn().mockResolvedValue({});
      const mockTxCheckoutCreate = vi.fn().mockResolvedValue({ id: 'cs-2' });
      mockTransaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          discountCode: { update: mockTxDiscountUpdate },
          checkoutSession: { create: mockTxCheckoutCreate },
        };
        return cb(tx);
      });

      const result = await createCheckoutSessionAtomic({
        userId: 'u-1', email: 'test@test.com', pricingTierId: 'pt-1',
        amountCentavos: 299900, discountCodeId: 'dc-1', discountAmountCentavos: 29990,
        finalAmountCentavos: 269910, redirectUrl: 'https://example.com/thanks',
        expiresAt: new Date('2099-01-01'),
      });

      expect(result.checkoutSessionId).toBe('cs-2');
      // Abandoned checkouts must not burn limited-use codes — the increment
      // happens in handleCheckoutPaid when the payment completes.
      expect(mockTxDiscountUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getTierDisplay', () => {
    it('maps active tiers', async () => {
      mockFindMany.mockResolvedValue([
        { id: 't1', slug: 'foundations', name: 'Foundations', description: 'x', pricePhp: 2999, tier: CourseTier.PPC_FOUNDATIONS, features: '{"bullets":[]}', sortOrder: 0, isActive: true, deletedAt: null },
      ]);
      const tiers = await getTierDisplay();
      expect(tiers).toHaveLength(1);
      expect(tiers[0]!.slug).toBe('foundations');
      expect(tiers[0]!.features).toEqual({ bullets: [] });
    });

    it('defaults to empty object when features is null', async () => {
      mockFindMany.mockResolvedValue([
        { id: 't1', slug: 'foundations', name: 'Foundations', description: 'x', pricePhp: 2999, tier: CourseTier.PPC_FOUNDATIONS, features: null, sortOrder: 0, isActive: true, deletedAt: null },
      ]);
      const tiers = await getTierDisplay();
      expect(tiers[0]!.features).toEqual({});
    });
  });
});
