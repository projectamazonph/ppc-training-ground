/**
 * Middleware request-context utility.
 *
 * Sprint 11 / STORY-050 + STORY-049.
 *
 * Middleware runs on the edge runtime — it can't import pino's transport
 * or async hooks. This helper still extracts the request ID, sets the
 * `x-request-id` response header, and exposes a lightweight logger.
 *
 * Usage in middleware.ts:
 *   export default async function middleware(req, ev) {
 *     const ctx = await withMiddlewareContext(req);
 *     return ctx.response ?? NextResponse.next();
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { REQUEST_ID_HEADER } from './logger';

function makeId(): string {
  // RFC4122-ish; 16 hex chars from a Math.random — good enough for tracing.
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

export interface MiddlewareContext {
  requestId: string;
  method: string;
  url: string;
  path: string;
  response?: NextResponse;
}

export function deriveRequestId(req: NextRequest): string {
  // Honor upstream IDs (Vercel, Cloudflare) — generated IDs match in dev.
  return req.headers.get(REQUEST_ID_HEADER) ?? makeId();
}

export function applyRequestIdHeader(res: NextResponse, id: string): void {
  res.headers.set(REQUEST_ID_HEADER, id);
}

/**
 * Edge-friendly structured log emitter.
 * Calls `console.info` with a single JSON line — Logtail / pino-http
 * collectors parse it without needing pino installed in the edge bundle.
 */
export function edgeLog(ctx: Pick<MiddlewareContext, 'requestId' | 'method' | 'url'>, extra: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(JSON.stringify({
    level: 'info',
    service: 'amph-v2',
    edge: true,
    ...ctx,
    ...extra,
    time: new Date().toISOString(),
  }));
}