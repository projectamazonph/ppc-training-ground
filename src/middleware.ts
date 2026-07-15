/**
 * Edge middleware — verifies JWT and protects /admin/* and /dashboard/*.
 *
 * Pattern (per consensus plan B6):
 *   - Middleware runs on Edge runtime — no Prisma, no Node crypto, just `jose`
 *   - Server Components re-verify via getSession() in src/lib/auth.ts (cheap,
 *     avoids trusting headers blindly)
 *   - This middleware only does coarse-grained gating (auth + role) — server
 *     actions and Server Components do the authoritative checks
 */

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

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

  // Legacy /dashboard/* → /* redirect (real URLs live at /courses, /payments,
  // /tools, /live-classes, /certificates — the (dashboard) route group does
  // not contribute to the URL). Strip /dashboard and continue. Query strings
  // and hash are preserved.
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const remainder = pathname.slice('/dashboard'.length); // "" or "/courses/..."
    const redirectUrl = new URL(remainder || '/', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Only protect admin and dashboard routes
  const isAdminRoute = pathname.startsWith('/admin');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  if (!isAdminRoute && !isDashboardRoute) {
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

  // Admin routes require ADMIN role. Do NOT clear the cookie here — a
  // student following a stray /admin link should be turned away, not
  // logged out of their whole session.
  if (isAdminRoute && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};