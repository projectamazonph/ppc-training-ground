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
 *
 * H1 (AUDIT-2026-07-17): the CheckoutSession is created FIRST (before the
 * PayMongo Source) so its id can be embedded as a `checkout_id` query param
 * on the PayMongo redirect URL. /checkout/complete uses that param to
 * reliably locate the session when the user returns from PayMongo, instead
 * of relying solely on webhook timing.
 */

'use server';

import { db } from '@/lib/db';
import {
  createCheckoutSessionAtomic,
  validateDiscountCode,
  getTierDisplay,
  type DiscountValidationResult,
} from '@/lib/pricing';
import {
  createSource,
  type CreateSourceInput,
  type PayMongoSource,
  PayMongoError,
} from '@/lib/paymongo';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createSafeAction, type ActionResult } from '@/lib/validation';
import { CheckoutStatus } from '@/lib/enums';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  pricingTierId: z.string().min(1).max(100),
  // H6: canonicalize the buyer's email so the placeholder user, checkout row,
  // and later sign-in all key off the same lowercase value.
  email: z
    .string()
    .max(254, 'Email is too long.')
    .trim()
    .toLowerCase()
    .email(),
  name: z.string().max(100).optional(),
  discountCode: z.string().max(50).optional(),
  // Relative in-app paths only — an absolute URL here is an open-redirect
  // vector via /checkout/complete's "Try again" link.
  returnUrl: z
    .string()
    .max(200)
    .regex(/^\/(?!\/)/, 'Return URL must be a relative path.')
    .optional(),
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
    tier.pricePhp, // pricePhp is stored in centavos
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

  const rl = rateLimit(`checkout:${email.toLowerCase()}`, 5, 60_000);
  if (!rl.allowed) {
    return { success: false as const, error: 'Too many checkout attempts. Please wait a minute and try again.' };
  }

  const session = await getSession();
  const tier = await db.pricingTier.findFirst({
    where: { id: pricingTierId, isActive: true, deletedAt: null },
    select: { id: true, slug: true, name: true, pricePhp: true, tier: true },
  });
  if (!tier) {
    return { success: false as const, error: 'Pricing tier is not available.' };
  }

  // pricePhp is stored in centavos (₱2,999.00 = 299900) — no conversion.
  const amountCentavos = tier.pricePhp;

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

  // Base redirect URL the user lands on after PayMongo. Built before we know
  // the source id — the checkout_id param is added once we have it below.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const baseRedirectUrl = new URL('/checkout/complete', appUrl);
  if (returnUrl) baseRedirectUrl.searchParams.set('returnUrl', returnUrl);

  // Step 1: create the CheckoutSession FIRST (H1), with no PayMongo source id
  // yet (the column is nullable — leaving it unset avoids two concurrent
  // checkouts colliding on a shared placeholder value under its @unique
  // constraint). This gives us checkoutSessionId for the redirect URL.
  const { checkoutSessionId } = await createCheckoutSessionAtomic({
    userId: session?.id ?? null,
    email,
    pricingTierId,
    amountCentavos,
    discountCodeId,
    discountAmountCentavos,
    finalAmountCentavos,
    redirectUrl: baseRedirectUrl.toString(),
    expiresAt,
  });

  // Step 2: embed the checkout session id in the PayMongo redirect URL so
  // /checkout/complete can reliably locate the session (H1).
  const paymongoRedirectUrl = new URL(baseRedirectUrl.toString());
  paymongoRedirectUrl.searchParams.set('checkout_id', checkoutSessionId);

  // Step 3: create the PayMongo Source with the enriched redirect URL.
  const sourceInput: CreateSourceInput = {
    amountCentavos: finalAmountCentavos,
    type: 'gcash', // default; PayMongo page lets user choose GCash/Maya/Card/etc
    email,
    redirectUrl: paymongoRedirectUrl.toString(),
    metadata: {
      pricingTierId,
      tierSlug: tier.slug,
      tierName: tier.name,
      userId: session?.id ?? 'guest',
      userName: formName ?? session?.name ?? '',
      checkoutSessionId,
    },
  };

  let source: PayMongoSource;
  try {
    source = await createSource(sourceInput);
  } catch (err) {
    // The CheckoutSession row was created first (H1) but its PayMongo Source
    // never came into being - mark it ERROR so it isn't left dangling as a
    // PENDING row forever (there is no cron/TTL sweep to reclaim it).
    await db.checkoutSession
      .update({
        where: { id: checkoutSessionId },
        data: { status: CheckoutStatus.ERROR, failedAt: new Date(), failureReason: 'source-creation-failed' },
      })
      .catch((cleanupErr) =>
        logger.error({ cleanupErr, checkoutSessionId }, 'Failed to mark checkout session ERROR after source failure'),
      );
    if (err instanceof PayMongoError) {
      return { success: false as const, error: `Payment error: ${err.message}` };
    }
    return { success: false as const, error: 'Unable to initiate payment. Please try again.' };
  }

  // Step 4: attach the real PayMongo source id to the CheckoutSession now
  // that we have it — this is what the source.chargeable/payment.paid
  // webhook handlers look the session up by.
  await db.checkoutSession.update({
    where: { id: checkoutSessionId },
    data: { paymongoSourceId: source.id },
  });

  return {
    success: true as const,
    data: {
      checkoutUrl: source.redirectUrl ?? '/pricing?error=checkout-failed',
      sessionId: checkoutSessionId,
    },
  };
}