/**
 * PayMongo webhook signature verification.
 *
 * Per docs/business-layer.md:
 *   PayMongo sends the `paymongo-signature` header with two signatures
 *   (test + live), comma-separated:
 *     "t=1234567890,te=abc...,li=def..."
 *   The signature is HMAC-SHA256(`${timestamp}.${rawBody}`, webhook_secret).
 *
 * IMPORTANT: this MUST run against the raw request body. Next.js
 * `request.json()` consumes the body, so the webhook route reads `await
 * request.text()` first and passes the string here.
 *
 * Sprint 6 — Payments.
 */

import { timingSafeEqual, createHmac } from 'node:crypto';

const SIGNATURE_HEADER = 'paymongo-signature';

interface ParsedSignature {
  timestamp: string | null;
  testSignature: string | null;
  liveSignature: string | null;
}

/**
 * Parse the comma-separated header into its parts. Robust to whitespace
 * and missing pieces — any missing required piece returns null fields.
 */
function parseSignatureHeader(header: string | null): ParsedSignature {
  if (!header) {
    return { timestamp: null, testSignature: null, liveSignature: null };
  }
  const parts: Record<string, string> = {};
  for (const segment of header.split(',')) {
    const [k, v] = segment.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  return {
    timestamp: parts.t ?? null,
    testSignature: parts.te ?? null,
    liveSignature: parts.li ?? null,
  };
}

/**
 * Compute the expected signature for a given timestamp + body using the
 * configured webhook secret. Returns hex.
 */
function computeSignature(timestamp: string, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Constant-time signature comparison. Returns false if either side is the
 * wrong length (timingSafeEqual throws on mismatch length).
 */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export interface VerifyResult {
  valid: boolean;
  reason?: 'missing-header' | 'missing-secret' | 'malformed-header' | 'signature-mismatch';
}

/**
 * Verify the PayMongo signature on an incoming webhook.
 *
 * Strategy: accept either the test (te=) or live (li=) signature, since
 * test mode webhooks use te= and live uses li=. The matching env var
 * (`PAYMONGO_SECRET_KEY` prefix) tells us which to check, but we check
 * both because PayMongo rotates secrets and a deployment window may have
 * the wrong key active.
 *
 * IMPORTANT: use the raw body string — never a re-stringified JSON.
 */
export function verifyPayMongoSignature(
  rawBody: string,
  signatureHeader: string | null,
): VerifyResult {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    return { valid: false, reason: 'missing-secret' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'missing-header' };
  }
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.timestamp) {
    return { valid: false, reason: 'malformed-header' };
  }

  const expected = computeSignature(parsed.timestamp, rawBody, secret);

  // Try test signature first (test mode), then live.
  if (parsed.testSignature && safeEqualHex(parsed.testSignature, expected)) {
    return { valid: true };
  }
  if (parsed.liveSignature && safeEqualHex(parsed.liveSignature, expected)) {
    return { valid: true };
  }

  return { valid: false, reason: 'signature-mismatch' };
}

export const PAYMONGO_SIGNATURE_HEADER = SIGNATURE_HEADER;