import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { validateDiscountCode, getTierDisplay } from '@/lib/pricing';
import { DiscountType, CourseTier } from '@/lib/enums';

vi.mock('@/lib/db', () => ({
  db: {
    discountCode: { findUnique: vi.fn() },
    pricingTier: { findMany: vi.fn() },
  },
}));

describe('pricing.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('validateDiscountCode rejects missing code', async () => {
    (db.discountCode.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await validateDiscountCode('MISSING', 't1', 299900);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Discount code not found.');
  });

  it('validateDiscountCode rejects inactive code', async () => {
    (db.discountCode.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: 'SAVE', isActive: false, startsAt: new Date(), expiresAt: new Date(), maxUses: null, currentUses: 0, minPurchasePhp: 0, type: DiscountType.PERCENTAGE, value: 10, tiers: [],
    });
    const result = await validateDiscountCode('SAVE', 't1', 299900);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Discount code is not active.');
  });

  it('validateDiscountCode applies percentage discount', async () => {
    (db.discountCode.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: 'PCT', isActive: true, startsAt: new Date('2020-01-01'), expiresAt: new Date('2099-01-01'), maxUses: null, currentUses: 0, minPurchasePhp: 0, type: DiscountType.PERCENTAGE, value: 10, tiers: [],
    });
    const result = await validateDiscountCode('pct', 't1', 299900);
    expect(result.valid).toBe(true);
    expect(result.discountAmountCentavos).toBe(29990);
    expect(result.code).toBe('PCT');
  });

  it('validateDiscountCode caps fixed discount to amount', async () => {
    (db.discountCode.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: 'FIXED', isActive: true, startsAt: new Date('2020-01-01'), expiresAt: new Date('2099-01-01'), maxUses: null, currentUses: 0, minPurchasePhp: 0, type: DiscountType.FIXED, value: 999999, tiers: [],
    });
    const result = await validateDiscountCode('FIXED', 't1', 299900);
    expect(result.valid).toBe(true);
    expect(result.discountAmountCentavos).toBe(299900);
  });

  it('validateDiscountCode enforces tier restriction', async () => {
    (db.discountCode.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: 'TIERED', isActive: true, startsAt: new Date('2020-01-01'), expiresAt: new Date('2099-01-01'), maxUses: null, currentUses: 0, minPurchasePhp: 0, type: DiscountType.PERCENTAGE, value: 5, tiers: [{ pricingTierId: 'other-tier' }],
    });
    const result = await validateDiscountCode('TIERED', 't1', 299900);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Discount code not valid for this tier.');
  });

  it('getTierDisplay maps active tiers', async () => {
    (db.pricingTier.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 't1', slug: 'foundations', name: 'Foundations', description: 'x', pricePhp: 2999, tier: CourseTier.PPC_FOUNDATIONS, features: '{"bullets":[]}', sortOrder: 0, isActive: true, deletedAt: null },
    ]);
    const tiers = await getTierDisplay();
    expect(tiers).toHaveLength(1);
    expect(tiers[0].slug).toBe('foundations');
    expect(tiers[0].features).toEqual({ bullets: [] });
  });
});
