/**
 * Resend Webhook — email delivery tracking.
 *
 * Handles: delivered, bounced, complained (spam), unsubscribed events.
 *
 * Resend signs webhooks with Svix: headers `svix-id`, `svix-timestamp`,
 * `svix-signature`, where the signature is
 *   base64( HMAC-SHA256( base64decode(secret without "whsec_"),
 *                        `${svix-id}.${svix-timestamp}.${rawBody}` ) )
 * and `svix-signature` may carry several space-separated `v1,<sig>`
 * candidates (key rotation). The previous implementation checked a
 * nonexistent `resend-signature` hex HMAC and read the body twice — no
 * genuine event could ever pass (audit finding M1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

interface ResendWebhookPayload {
  type: 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.unsubscribed';
  data: {
    email_id: string;
    to: string | string[];
    tags?: { name: string; value: string }[];
  };
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Verify the Svix signature over the raw body. */
function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  rawBody: string,
): boolean {
  // Reject stale or far-future timestamps (replay protection).
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret,
    'base64',
  );
  const expected = createHmac('sha256', secretBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest('base64');

  // Header format: "v1,<base64> v1,<base64> ..." — accept any candidate.
  return svixSignature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((sig) => safeEqual(sig, expected));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('RESEND_WEBHOOK_SECRET not set — rejecting webhook');
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  // Read the body exactly once — it is a one-shot stream.
  const rawBody = await req.text();

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (
    !svixId ||
    !svixTimestamp ||
    !svixSignature ||
    !verifySvixSignature(secret, svixId, svixTimestamp, svixSignature, rawBody)
  ) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { type, data } = payload;
  const toAddresses = Array.isArray(data.to) ? data.to : [data.to];

  switch (type) {
    case 'email.delivered':
      logger.info({ emailId: data.email_id, to: toAddresses }, 'Email delivered');
      break;

    case 'email.bounced':
      logger.warn({ emailId: data.email_id, to: toAddresses }, 'Email bounced');
      break;

    case 'email.complained':
      logger.warn({ emailId: data.email_id, to: toAddresses }, 'Email spam complaint');
      break;

    case 'email.unsubscribed':
      logger.info({ emailId: data.email_id, to: toAddresses }, 'Email unsubscribed');
      break;

    default:
      logger.info({ type }, 'Unhandled resend webhook event');
  }

  return NextResponse.json({ received: true });
}
