/**
 * Server actions for checkout / payment.
 *
 * Sprint 6 — Payments.
 *
 * `createCheckoutSessionAction` is the entry point from /pricing when a
 * user selects a tier. It:
 *   1. Validates the tier exists and is active
 *   2. Applies discount code if provided
 *   3. Creates a CheckoutSession DB record
 *   4. Creates a PayMongo Source
 *   5. Returns a redirect URL for the user
 *
 * The source attach flow:
 *   - User is redirected to PayMongo-hosted checkout (GCash/Maya/Card/etc)
 *   - PayMongo webhooks signal chargeable/paid/failed
 *   - Success/failure pages at /checkout/success and /checkout/failed
 *
 * Sprint 8 adds the refund action here.
 */

'use server';

import { db } from '@/lib/db';
import { CheckoutStatus } from '@/lib/enums';
import {
  createCheckoutSessionAtomic,
  validateDiscountCode,
  getTierDisplay,
  type DiscountValidationResult,
} from '@/lib/pricing';
import {
  isTestMode,
  createSource,
  createPaymentFromSource,
  type CreateSourceInput,
  type PayMongoSource,
  PayMongoError,
} from '@/lib/paymongo';
import { getSession } from '@/lib/auth';
import { createSafeAction, type ActionResult } from '@/lib/validation';
import { z } from 'zod';
import { redirect } from 'next/navigation';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  pricingTierId: z.string().min(1),
  email: z.string().email(),
  name: z.string().max(100).optional(),
  discountCode: z.string().max(50).optional(),
  returnUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Discount validation action
// ---------------------------------------------------------------------------

export async function validateDiscountCodeAction(
  formData: unknown,
): Promise<ActionResult<DiscountValidationResult>> {
  const parsed = checkoutSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid request.' };
  }

  const { pricingTierId, discountCode } = parsed.data;
  const tiers = await getTierDisplay();
  const tier = tiers.find((t) => t.id === pricingTierId);
  if (!tier) {
    return { success: false as const, error: 'Tier not found.' };
  }

  if (!discountCode?.trim()) {
    return { success: true as const, data: { valid: false, discountAmountCentavos: 0 } };
  }

  const result = await validateDiscountCode(
    discountCode,
    pricingTierId,
    Math.round(tier.pricePhp * 100),
  );
  return { success: true as const, data: result };
}

// ---------------------------------------------------------------------------
// Create checkout session action
// ---------------------------------------------------------------------------

/**
 * Validate tier → apply discount → create CheckoutSession + PayMongo Source
 * → return redirect URL for the user.
 *
 * Guest and logged-in users both supported (email-based).
 */
export async function createCheckoutSessionAction(
  formData: unknown,
): Promise<ActionResult<{ checkoutUrl: string; sessionId: string }>> {
  const parsed = checkoutSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false as const, error: 'Check the form for errors.', fieldErrors };
  }

  const { pricingTierId, email, name: formName, discountCode, returnUrl } = parsed.data;

  const session = await getSession();
  const tier = await db.pricingTier.findFirst({
    where: { id: pricingTierId, isActive: true, deletedAt: null },
    select: { id: true, slug: true, name: true, pricePhp: true, tier: true },
  });
  if (!tier) {
    return { success: false as const, error: 'Pricing tier is not available.' };
  }

  const amountCentavos = Math.round(tier.pricePhp * 100);

  // Validate discount
  let discountCodeId: string | null = null;
  let discountAmountCentavos = 0;

  if (discountCode?.trim()) {
    const result = await validateDiscountCode(discountCode, pricingTierId, amountCentavos);
    if (result.valid && result.code) {
      const found = await db.discountCode.findUnique({
        where: { code: result.code },
        select: { id: true },
      });
      discountCodeId = found?.id ?? null;
      discountAmountCentavos = result.discountAmountCentavos;
    }
  }

  const finalAmountCentavos = amountCentavos - discountAmountCentavos;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create source with PayMongo
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUrl = new URL('/checkout/complete', appUrl);
  if (returnUrl) redirectUrl.searchParams.set('returnUrl', returnUrl);

  const sourceInput: CreateSourceInput = {
    amountCentavos: finalAmountCentavos,
    type: 'gcash', // default; PayMongo page lets user choose GCash/Maya/Card/etc
    email,
    redirectUrl: redirectUrl.toString(),
    metadata: {
      pricingTierId,
      tierSlug: tier.slug,
      tierName: tier.name,
      userId: session?.id ?? 'guest',
      userName: formName ?? session?.name ?? '',
    },
  };

  let source: PayMongoSource;
  try {
    source = await createSource(sourceInput);
  } catch (err) {
    if (err instanceof PayMongoError) {
      return { success: false as const, error: `Payment error: ${err.message}` };
    }
    return { success: false as const, error: 'Unable to initiate payment. Please try again.' };
  }

  // Atomically create CheckoutSession + increment discount usage if any
  const { checkoutSessionId } = await createCheckoutSessionAtomic({
    userId: session?.id ?? null,
    email,
    pricingTierId,
    amountCentavos,
    discountCodeId,
    discountAmountCentavos,
    finalAmountCentavos,
    paymongoSourceId: source.id,
    redirectUrl: redirectUrl.toString(),
    expiresAt,
  });

  return {
    success: true as const,
    data: {
      checkoutUrl: source.redirectUrl ?? '/checkout?error=no-url',
      sessionId: checkoutSessionId,
    },
  };
}

// ---------------------------------------------------------------------------
// Source attach (called by webhook, not client)
// ---------------------------------------------------------------------------

/**
 * Called by the webhook handler after receiving `source.chargeable` from
 * PayMongo. Converts a chargeable source into a paid Payment.
 *
 * This is NOT exposed to client code — do not call from components.
 */
export async function attachSourceAction(
  sourceId: string,
): Promise<ActionResult<{ paymentId: string }>> {
  const checkout = await db.checkoutSession.findFirst({
    where: { paymongoSourceId: sourceId },
    include: { pricingTier: true },
  });
  if (!checkout) {
    return { success: false as const, error: 'Checkout session not found.' };
  }

  const input: Parameters<typeof createPaymentFromSource>[0] = {
    amountCentavos: checkout.finalAmountPhp,
    sourceId,
    description: `${checkout.pricingTier.name} enrollment`,
    metadata: {
      pricingTierId: checkout.pricingTierId,
      tierSlug: checkout.pricingTier.slug,
      userId: checkout.userId ?? 'guest',
      email: checkout.email,
    },
  };

  try {
    const payment = await createPaymentFromSource(input);
    await db.checkoutSession.update({
      where: { id: checkout.id },
      data: {
        paymongoPaymentId: payment.id,
        status: CheckoutStatus.PAID,
        paidAt: new Date(),
      },
    });
    return { success: true as const, data: { paymentId: payment.id } };
  } catch (err) {
    if (err instanceof PayMongoError) {
      return { success: false as const, error: `Payment failed: ${err.message}` };
    }
    return { success: false as const, error: 'Payment processing failed.' };
  }
}

// ---------------------------------------------------------------------------
// Tier display helper (re-exported for PricingClient)
// ---------------------------------------------------------------------------

export const getTiers = getTierDisplay;