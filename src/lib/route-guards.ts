/**
 * Pure route-classification logic for the edge middleware. Kept free of
 * NextRequest/NextResponse so it's unit-testable without mocking the Edge
 * runtime, so middleware.ts is the thin orchestration layer around this.
 */

// The (dashboard) route group contributes no URL segment, so its pages live
// at these top-level prefixes rather than under /dashboard/*.
const STUDENT_ROUTE_PREFIXES = [
  '/dashboard',
  '/courses',
  '/tools',
  '/payments',
  '/certificates',
  '/live-classes',
] as const;

const ADMIN_ROUTE_PREFIX = '/admin';

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminRoute(pathname: string): boolean {
  return matchesPrefix(pathname, ADMIN_ROUTE_PREFIX);
}

export function isStudentRoute(pathname: string): boolean {
  return STUDENT_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isProtectedRoute(pathname: string): boolean {
  return isAdminRoute(pathname) || isStudentRoute(pathname);
}

/**
 * Legacy /dashboard/<feature> bookmarks (from before the (dashboard) route
 * group's pages moved to top-level paths) redirect to their real path.
 * Returns null for anything that isn't such a bookmark, including the bare
 * /dashboard path itself, which is a real page, not a legacy redirect.
 *
 * Collapses any leading duplicate slashes in the result so it can never look
 * protocol-relative (e.g. /dashboard//evil.example must not yield
 * //evil.example, which `new URL(x, base)` would resolve off-origin).
 */
export function legacyDashboardRedirectTarget(pathname: string): string | null {
  if (!pathname.startsWith('/dashboard/')) return null;
  const remainder = pathname.slice('/dashboard'.length);
  return remainder.replace(/^\/+/, '/');
}
