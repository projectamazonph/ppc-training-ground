/**
 * Cron: expire stale checkout sessions.
 *
 * Endpoint: GET /api/cron/expire-checkouts
 *
 * Driven by a Vercel Cron (see vercel.json). Marks PENDING/AWAITING_PAYMENT
 * sessions past their `expiresAt` as EXPIRED, satisfying the business-layer
 * guarantee that no CheckoutSession is left orphaned (business-layer.md:
 * "every one ends in PAID, EXPIRED, FAILED, or ERROR").
 *
 * Auth: Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` when the
 * CRON_SECRET env var is set. We require it — the endpoint mutates data and
 * must not be publicly triggerable. If CRON_SECRET is unset we fail closed
 * (503) rather than run unauthenticated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sweepExpiredCheckouts } from '@/lib/enrollment';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error({ component: 'cron-expire-checkouts' }, 'CRON_SECRET is not set — refusing to run');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    logger.warn({ component: 'cron-expire-checkouts' }, 'unauthorized cron invocation');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expired = await sweepExpiredCheckouts();
  return NextResponse.json({ expired });
}
