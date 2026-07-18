/**
 * Edge middleware. Verifies JWT and protects /admin/* and the authenticated
 * student area (the (dashboard) route group: /dashboard, /courses, /tools,
 * /payments, /certificates, /live-classes).
 *
 * Pattern (per consensus plan B6):
 *   - Middleware runs on Edge runtime, so no Prisma, no Node crypto, just `jose`
 *   - Server Components re-verify via getSession() in src/lib/auth.ts (cheap,
 *     avoids trusting headers blindly)
 *   - This middleware only does coarse-grained gating (auth + role). Server
 *     actions and Server Components do the authoritative checks
 *   - Route classification lives in src/lib/route-guards.ts as plain
 *     functions (no NextRequest/NextResponse) so it's unit-tested directly,
 *     instead of only through curl/browser checks against the Edge runtime.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { isAdminRoute, isProtectedRoute, legacyDashboardRedirectTarget } from '@/lib/route-guards';

const AUTH_COOKIE = 'amph_auth';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return new TextEncoder().encode(secret);
}

interface TokenPayload {
  sub: string;
  email: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  name: string | null;
  exp: number;
}

async function verifyEdgeToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const role = payload.role;
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    if (role !== 'STUDENT' && role !== 'INSTRUCTOR' && role !== 'ADMIN') {
      return null;
    }
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacyTarget = legacyDashboardRedirectTarget(pathname);
  if (legacyTarget !== null) {
    // Clone nextUrl (not `new URL(target, request.url)`) so a redirect
    // target can never be parsed as protocol-relative and escape the
    // origin, and so the query string survives the redirect.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyTarget;
    return NextResponse.redirect(redirectUrl);
  }

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const signinUrl = new URL('/auth/signin', request.url);
    signinUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signinUrl);
  }

  const payload = await verifyEdgeToken(token);
  if (!payload) {
    const signinUrl = new URL('/auth/signin', request.url);
    signinUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(signinUrl);
    response.cookies.delete(AUTH_COOKIE);
    return response;
  }

  // Admin routes require ADMIN role. Do NOT clear the cookie here, since a
  // student following a stray /admin link should be turned away, not
  // logged out of their whole session.
  if (isAdminRoute(pathname) && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/courses/:path*',
    '/tools/:path*',
    '/payments/:path*',
    '/certificates/:path*',
    '/live-classes/:path*',
  ],
};
