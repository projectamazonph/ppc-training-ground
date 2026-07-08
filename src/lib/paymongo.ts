/**
 * PayMongo client wrapper.
 *
 * Sprint 6 — Payments.
 *
 * Wraps the `paymongo` SDK into typed helpers used by the checkout action
 * and webhook handler. This version of the SDK exposes `paymentIntents`
 * and `sources`, but NOT `checkoutSessions` (PayMongo's newer hosted UI).
 * We use `paymentIntents` + `sources` per the SDK's actual surface.
 *
 * Env vars required:
 *   - PAYMONGO_SECRET_KEY (sk_test_... or sk_live_...)
 *   - PAYMONGO_WEBHOOK_SECRET (whsec_...)
 *
 * See docs/business-layer.md for the full integration spec.
 */

import 'server-only';

import Paymongo from 'paymongo';

const TEST_MODE_PREFIX = 'sk_test_';

export class PayMongoError extends Error {
  public readonly statusCode: number | null;
  public readonly paymongoCode: string | null;
  constructor(message: string, opts: { statusCode?: number | null; paymongoCode?: string | null } = {}) {
    super(message);
    this.name = 'PayMongoError';
    this.statusCode = opts.statusCode ?? null;
    this.paymongoCode = opts.paymongoCode ?? null;
  }
}

function getSecretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new PayMongoError(
      'PAYMONGO_SECRET_KEY is not configured. Add it to .env.local before testing checkout.',
    );
  }
  return key;
}

export function isTestMode(): boolean {
  return getSecretKey().startsWith(TEST_MODE_PREFIX);
}

function getClient(): any {
  return new Paymongo(getSecretKey());
}

// ---------------------------------------------------------------------------
// Payment Intents (modern flow)
// ---------------------------------------------------------------------------

export type PayMongoPaymentMethod =
  | 'gcash'
  | 'paymaya'
  | 'grab_pay'
  | 'card'
  | 'dob';

export interface CreatePaymentIntentInput {
  amountCentavos: number;
  description: string;
  metadata?: Record<string, string>;
  // Statement descriptor shown on customer's bank/GCash receipt.
  // Limited to 22 chars by PayMongo; falls back to a shortened name.
  statementDescriptor?: string;
}

export interface PayMongoPaymentIntent {
  id: string;
  clientKey: string | null;
  status: string;
  amount: number;
}

/**
 * Create a Payment Intent. Returns the id + client_key. The client_key is
 * used by the client-side SDK (or in our case, the source attach step) to
 * associate a payment method with the intent.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PayMongoPaymentIntent> {
  try {
    const paymongo = getClient();
    const result = (await paymongo.paymentIntents.create({
      data: {
        attributes: {
          amount: input.amountCentavos,
          payment_method_allowed: ['gcash', 'paymaya', 'grab_pay', 'card', 'dob'],
          payment_method_options: {
            card: { request_three_d_secure: 'automatic' },
          },
          currency: 'PHP',
          description: input.description,
          statement_descriptor: input.statementDescriptor?.slice(0, 22),
          metadata: input.metadata ?? {},
        },
      },
    })) as PayMongoSdkResponse;

    const data = result?.data;
    return {
      id: data?.id ?? '',
      clientKey: data?.attributes?.client_key ?? null,
      status: data?.attributes?.status ?? 'unknown',
      amount: data?.attributes?.amount ?? input.amountCentavos,
    };
  } catch (err: unknown) {
    throw mapPayMongoError(err);
  }
}

// ---------------------------------------------------------------------------
// Sources (legacy flow — works for GCash/Maya/GrabPay/DOB without 3DS)
// ---------------------------------------------------------------------------

export interface CreateSourceInput {
  amountCentavos: number;
  type: 'gcash' | 'paymaya' | 'grab_pay' | 'dob';
  email: string;
  /**
   * PayMongo will redirect the user back here after the source flow completes.
   * Use ?status=success or ?status=failed query params to differentiate.
   */
  redirectUrl: string;
  metadata?: Record<string, string>;
}

export interface PayMongoSource {
  id: string;
  status: string;
  redirectUrl: string | null;
}

/**
 * Create a Source. The user is redirected to the source's checkout_url
 * (a PayMongo-hosted page for GCash/Maya) and returns to redirectUrl with
 * a status query param. After redirect, the client posts the source.id
 * to /api/checkout/attach to convert it into a paid Payment.
 */
export async function createSource(input: CreateSourceInput): Promise<PayMongoSource> {
  try {
    const paymongo = getClient();
    const result = (await paymongo.sources.create({
      data: {
        attributes: {
          amount: input.amountCentavos,
          currency: 'PHP',
          type: input.type,
          redirect: {
            success: `${input.redirectUrl}?status=success`,
            failed: `${input.redirectUrl}?status=failed`,
          },
          billing: { email: input.email },
          metadata: input.metadata ?? {},
        },
      },
    })) as PayMongoSdkResponse;
    const data = result?.data;
    return {
      id: data?.id ?? '',
      status: data?.attributes?.status ?? 'unknown',
      redirectUrl: data?.attributes?.redirect?.checkout_url ?? null,
    };
  } catch (err: unknown) {
    throw mapPayMongoError(err);
  }
}

// ---------------------------------------------------------------------------
// Payments (after source.chargeable webhook arrives)
// ---------------------------------------------------------------------------

export interface CreatePaymentFromSourceInput {
  amountCentavos: number;
  sourceId: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PayMongoPayment {
  id: string;
  status: string;
  amount: number;
  paidAt: string | null;
}

/**
 * Create a Payment from a chargeable Source. Called by the webhook handler
 * after receiving `source.chargeable`. The payment moves to `paid` status
 * synchronously for most methods (GCash, Maya) — cards may take longer.
 */
export async function createPaymentFromSource(
  input: CreatePaymentFromSourceInput,
): Promise<PayMongoPayment> {
  try {
    const paymongo = getClient();
    const result = (await paymongo.payments.create({
      data: {
        attributes: {
          amount: input.amountCentavos,
          currency: 'PHP',
          description: input.description,
          source: { id: input.sourceId, type: 'source' },
          metadata: input.metadata ?? {},
        },
      },
    })) as PayMongoSdkResponse;
    const data = result?.data;
    return {
      id: data?.id ?? '',
      status: data?.attributes?.status ?? 'unknown',
      amount: data?.attributes?.amount ?? input.amountCentavos,
      paidAt: data?.attributes?.paid_at ?? null,
    };
  } catch (err: unknown) {
    throw mapPayMongoError(err);
  }
}

// ---------------------------------------------------------------------------
// Refunds (used by Sprint 8 refund flow; declared here for stable interface)
// ---------------------------------------------------------------------------

export interface PayMongoRefundInput {
  paymentId: string;
  amountCentavos: number;
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface PayMongoRefund {
  id: string;
  status: string;
  amount: number;
}

/**
 * Refund a previously-paid payment. Full or partial — pass the desired
 * amount in centavos.
 */
export async function refundPayment(input: PayMongoRefundInput): Promise<PayMongoRefund> {
  try {
    const paymongo = getClient();
    const result = (await paymongo.refunds.create({
      data: {
        attributes: {
          amount: input.amountCentavos,
          payment_id: input.paymentId,
          reason: input.reason,
          metadata: input.metadata ?? {},
        },
      },
    })) as PayMongoSdkResponse;
    const data = result?.data;
    return {
      id: data?.id ?? '',
      status: data?.attributes?.status ?? 'unknown',
      amount: data?.attributes?.amount ?? 0,
    };
  } catch (err: unknown) {
    throw mapPayMongoError(err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort minimal shape of the SDK's response. The actual SDK returns
 * a generic JSON; we don't import its types because the package has no
 * type declarations (it's a plain JS package).
 */
interface PayMongoSdkResponse {
  data?: {
    id?: string;
    attributes?: {
      amount?: number;
      status?: string;
      client_key?: string;
      paid_at?: string | null;
      redirect?: { checkout_url?: string };
    };
  };
}

function mapPayMongoError(err: unknown): PayMongoError {
  if (err instanceof PayMongoError) return err;
  if (err instanceof Error) {
    return new PayMongoError(err.message);
  }
  return new PayMongoError('Unknown PayMongo error');
}