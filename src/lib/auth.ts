/**
 * Auth — JWT (jose) + password hashing (scrypt).
 *
 * Pattern (per consensus plan B6):
 *   - Middleware (Edge runtime) verifies JWT and sets request headers
 *   - Server Components / Actions re-verify via `getSession()` — reads cookie
 *     via next/headers and verifies with `jose`. No double work since jose
 *     verification is cheap and avoids trusting headers blindly.
 *   - `requireAuth()` and `requireAdmin()` are the canonical entry points
 *     for protected code paths.
 *
 * Sprint 11 / STORY-050: tracing + structured logging around session helpers.
 */

import 'server-only';

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { type UserRole } from './enums';
import { log } from './logger';
import { trace } from './tracing';

const AUTH_COOKIE = 'amph_auth';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Run `pnpm gen:secret` to generate one.');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters. Run `pnpm gen:secret` to generate a secure one.');
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt, format: scrypt$<salt-hex>$<hash-hex>)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

export interface SessionPayload extends JWTPayload {
  sub: string;        // user id
  email: string;
  role: UserRole;
  name: string | null;
}

export async function signToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

export async function getAuthToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Session helpers (Server Components / Actions)
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  xp: number;
  level: number;
  streakDays: number;
}

export const getSession = trace('auth.getSession', async (): Promise<SessionUser | null> => {
  const token = await getAuthToken();
  if (!token) {
    log.debug({ component: 'auth' }, 'no auth cookie present');
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    log.warn({ component: 'auth' }, 'invalid or expired token');
    return null;
  }

  // Fetch gamification fields from DB (not in JWT to keep token small)
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { xp: true, level: true, streakDays: true },
  });

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    xp: user?.xp ?? 0,
    level: user?.level ?? 1,
    streakDays: user?.streakDays ?? 0,
  };
});

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    // redirect() throws NEXT_REDIRECT — must NOT be wrapped in try/catch
    log.info({ component: 'auth' }, 'unauthenticated → redirect /auth/signin');
    redirect('/auth/signin');
  }
  log.debug({ component: 'auth', userId: user.id, role: user.role }, 'requireAuth ok');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    log.warn({ component: 'auth', userId: user.id, role: user.role }, 'non-admin → redirect /');
    redirect('/');
  }
  log.debug({ component: 'auth', userId: user.id }, 'requireAdmin ok');
  return user;
}

// ---------------------------------------------------------------------------
// Convenience for middleware (Edge runtime — no Prisma, no Node crypto)
// ---------------------------------------------------------------------------

export const AUTH_COOKIE_NAME = AUTH_COOKIE;
export const AUTH_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;