/**
 * Guest-checkout account-claim tokens (audit C5/C6).
 *
 * A guest purchase creates a placeholder User. To become usable, the buyer
 * must PROVE they own the email by presenting a single-use claim token that
 * is delivered only to that address. We store the SHA-256 hash of the token,
 * never the token itself, and consume it atomically at signup so it can't be
 * claimed twice or by anyone who merely knows the email.
 */

import 'server-only';

import { randomBytes, createHash } from 'node:crypto';

/** Claim links expire after this window. */
export const CLAIM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Prefix marking a placeholder (guest) account's password hash. */
export const PLACEHOLDER_PASSWORD_PREFIX = 'placeholder_';

/** SHA-256 hex of a raw claim token. Deterministic — used for lookup + compare. */
export function hashClaimToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Mint a fresh claim token: strong raw value, its hash, and an expiry. */
export function generateClaimToken(now: Date = new Date()): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = randomBytes(32).toString('base64url');
  return {
    raw,
    hash: hashClaimToken(raw),
    expiresAt: new Date(now.getTime() + CLAIM_TOKEN_TTL_MS),
  };
}
