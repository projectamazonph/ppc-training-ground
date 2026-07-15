/**
 * Pricing & discount utilities.
 *
 * Sprint 6 — Payments.
 *
 * Central place for:
 *   - Validating a discount code against a tier
 *   - Computing final amount after discount (percentage or fixed)
 *   - Atomically creating a CheckoutSession with discount increment
 *
 * All money values in centavos (₱2,999.00 = 299900).
 */

import 'server-only';

import { db } from './db';
import { CheckoutStatus, DiscountType, type CourseTier } from './enums';

export interface DiscountValidationResult {
  valid: boolean;
  code?: string;
  discountAmountCentavos: number;
  error?: string;
}

/**
 * Validate a discount code for a given tier and amount.
 *
 * Rules (per business-layer.md):
 *   - Code exists, is active
 *   - Within date range (startsAt <= now <= expiresAt)
 *   - Has not exceeded maxUses (if set)
 *   - Meets minPurchasePhp
 *   - Applies to the selected tier (if DiscountTier rows exist)
 *
 * Returns the computed discount amount in centavos.
 */
export async function validateDiscountCode(
  code: string,
  tierId: string,
  amountCentavos: number,
): Promise<DiscountValidationResult> {
  const now = new Date();

  const discount = await db.discountCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { tiers: { select: { pricingTierId: true } } },
  });

  if (!discount) {
    return { valid: false, discountAmountCentavos: 0, error: 'Discount code not found.' };
  }

  if (!discount.isActive) {
    return { valid: false, discountAmountCentavos: 0, error: 'Discount code is not active.' };
  }

  if (discount.startsAt > now) {
    return { valid: false, discountAmountCentavos: 0, error: 'Discount code has not started yet.' };
  }

  if (discount.expiresAt < now) {
    return { valid: false, discountAmountCentavos: 0, error: 'Discount code has expired.' };
  }

  if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
    return { valid: false, discountAmountCentavos: 0, error: 'Discount code has been fully used.' };
  }

  if (amountCentavos < discount.minPurchasePhp) {
    return {
      valid: false,
      discountAmountCentavos: 0,
      error: `Minimum purchase of ₱${(discount.minPurchasePhp / 100).toFixed(2)} required.`,
    };
  }

  // If the discount specifies allowed tiers, enforce it.
  if (discount.tiers.length > 0) {
    const allowed = discount.tiers.some((t) => t.pricingTierId === tierId);
    if (!allowed) {
      return { valid: false, discountAmountCentavos: 0, error: 'Discount code not valid for this tier.' };
    }
  }

  // Compute discount amount.
  let discountAmount = 0;
  if (discount.type === DiscountType.PERCENTAGE) {
    discountAmount = Math.floor((amountCentavos * discount.value) / 100);
  } else {
    discountAmount = Math.min(discount.value, amountCentavos);
  }

  return {
    valid: true,
    code: discount.code,
    discountAmountCentavos: discountAmount,
  };
}

export interface CheckoutSessionData {
  userId: string | null;
  email: string;
  pricingTierId: string;
  amountCentavos: number;
  discountCodeId: string | null;
  discountAmountCentavos: number;
  finalAmountCentavos: number;
  // PayMongo references populated after source/payment intent creation.
  paymongoSourceId?: string;
  paymongoPaymentIntentId?: string;
  paymongoPaymentId?: string;
  // Where to send the user after PayMongo redirect.
  redirectUrl: string;
  // Client IP + UA for fraud review.
  ipAddress?: string;
  userAgent?: string;
  // 24-hour expiry on the checkout session.
  expiresAt: Date;
}

/**
 * Create a CheckoutSession. Discount `currentUses` is NOT incremented here —
 * a use only counts when the payment completes (see handleCheckoutPaid),
 * so abandoned checkouts don't burn limited-use codes.
 */
export async function createCheckoutSessionAtomic(
  data: CheckoutSessionData,
): Promise<{ checkoutSessionId: string; paymongoSourceId?: string; paymongoPaymentIntentId?: string }> {
  const result = await db.$transaction(async (tx) => {
    const checkout = await tx.checkoutSession.create({
      data: {
        userId: data.userId,
        email: data.email,
        pricingTierId: data.pricingTierId,
        status: CheckoutStatus.PENDING,
        amountPhp: data.amountCentavos,
        discountCodeId: data.discountCodeId,
        discountAmount: data.discountAmountCentavos,
        finalAmountPhp: data.finalAmountCentavos,
        paymongoSourceId: data.paymongoSourceId,
        paymongoPaymentId: data.paymongoPaymentIntentId, // field overloaded for payment intent id
        paymongoRedirectUrl: data.redirectUrl,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      select: { id: true },
    });

    return checkout;
  });

  return {
    checkoutSessionId: result.id,
    paymongoSourceId: data.paymongoSourceId,
    paymongoPaymentIntentId: data.paymongoPaymentIntentId,
  };
}

export interface TierDisplay {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricePhp: number;
  tier: CourseTier;
  features: {
    bullets: string[];
    includesLiveClasses: boolean;
    includesOneOnOne: boolean;
    monthlySupportHours?: number;
  };
  sortOrder: number;
}

/**
 * Fetch all active pricing tiers ordered for display (sortOrder asc).
 * Parses the JSON features field into a typed object for the pricing page.
 */
export async function getTierDisplay(): Promise<TierDisplay[]> {
  const tiers = await db.pricingTier.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  return tiers.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    pricePhp: t.pricePhp,
    tier: t.tier as CourseTier,
    features: JSON.parse(t.features ?? '{}') as TierDisplay['features'],
    sortOrder: t.sortOrder,
  }));
}