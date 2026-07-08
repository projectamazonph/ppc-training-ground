/**
 * PayMongo webhook receiver.
 *
 * Endpoint: POST /api/paymongo/webhook
 *
 * Sprint 6 — STORY-026 PayMongo Checkout.
 *
 * PayMongo sends six event types we care about:
 *   - checkout_session.payment.paid
 *   - checkout_session.payment.failed
 *   - source.chargeable                (used when we create a Source manually)
 *   - payment.paid
 *   - payment.failed
 *   - payment.refunded
 *
 * Flow:
 *   1. Read raw body BEFORE anything else — JSON parsing breaks HMAC.
 *   2. Verify signature with HMAC-SHA256(`t=${ts}.${body}`, webhook_secret).
 *   3. Branch on event type, defer to handler in src/lib/enrollment.ts.
 *   4. Each handler does its own idempotency check via ProcessedWebhook.
 *   5. Always ACK 200 — even on handler error, after logging. PayMongo
 *      retries on non-2xx, and we don't want a partially-handled event
 *      to multiply.
 *
 * Public surface (no auth): PayMongo needs to reach this URL without our
 * cookies. The signature header is the gate.
 */

import { type NextRequest } from 'next/server';
import {
  verifyPayMongoSignature,
  PAYMONGO_SIGNATURE_HEADER,
} from '@/lib/webhook-signature';
import {
  handleCheckoutPaid,
  handleCheckoutFailed,
  handlePaymentRefunded,
  type CheckoutPaidEvent,
  type CheckoutFailedEvent,
  type PaymentRefundedEvent,
} from '@/lib/enrollment';

export const runtime = 'nodejs'; // Node runtime — uses node crypto + Prisma
export const dynamic = 'force-dynamic';

type PayMongoEvent =
  | { type: 'checkout_session.payment.paid'; data: CheckoutPaidEvent }
  | { type: 'checkout_session.payment.failed'; data: CheckoutFailedEvent }
  | { type: 'payment.refunded'; data: PaymentRefundedEvent }
  | { type: 'source.chargeable' | 'payment.paid' | 'payment.failed' | string; data: { id?: string; attributes?: { type?: string } } };

function pickEvent(body: string): PayMongoEvent | null {
  try {
    const parsed = JSON.parse(body) as {
      data?: {
        id?: string;
        attributes?: { type?: string; data?: unknown };
      };
    };
    if (!parsed?.data?.attributes?.type) return null;
    return { type: parsed.data.attributes.type, data: parsed as PayMongoEvent['data'] } as PayMongoEvent;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Raw body first — signature verification depends on it.
  const body = await request.text();
  const signatureHeader = request.headers.get(PAYMONGO_SIGNATURE_HEADER);

  // 2. Verify signature. Always 401 on mismatch.
  const verified = verifyPayMongoSignature(body, signatureHeader);
  if (!verified.valid) {
    console.warn(
      `[paymongo-webhook] rejected: reason=${verified.reason ?? 'unknown'}, ` +
      `sigLen=${signatureHeader?.length ?? 0}`,
    );
    return new Response('Invalid signature.', { status: 401 });
  }

  // 3. Parse and dispatch.
  const event = pickEvent(body);
  if (!event) {
    console.warn('[paymongo-webhook] no event parsed, acking 200');
    return new Response('No event.', { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout_session.payment.paid':
        await handleCheckoutPaid(event.data as unknown as CheckoutPaidEvent);
        break;
      case 'checkout_session.payment.failed':
        await handleCheckoutFailed(event.data as unknown as CheckoutFailedEvent);
        break;
      case 'payment.refunded':
        await handlePaymentRefunded(event.data as unknown as PaymentRefundedEvent);
        break;
      // source.chargeable + payment.paid + payment.failed are reserved for
      // the Source-based flow (legacy). Handled in STORY-027/Sprint 8 if we
      // ship that path; for now we acknowledge and skip.
      default:
        console.info(`[paymongo-webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Log but ack 200 — idempotent retry by PayMongo would otherwise
    // 10x our handler error rate. Real alert comes from the ProcessedWebhook
    // log + the absence of side-effects.
    console.error('[paymongo-webhook] handler error', err);
  }

  return new Response('OK', { status: 200 });
}

// Reject GET. PayMongo only POSTs. Make accidental hits obvious.
export async function GET(): Promise<Response> {
  return new Response('PayMongo webhook accepts POST only.', { status: 405 });
}
