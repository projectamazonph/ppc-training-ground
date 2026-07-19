/**
 * Redirect URL validator (C3 / XSS / open-redirect defence).
 *
 * Shared between server and client components. No server-only imports.
 */

export function validateRedirectUrl(
  raw: string | null | undefined,
  fallback = '/',
): string {
  if (!raw || typeof raw !== 'string') return fallback;

  // Check for control characters BEFORE trimming — a path like '/path\n'
  // must be rejected even though trim() would strip the trailing newline.
  if (/[\x00-\x1f\x7f\\]/.test(raw)) return fallback;

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Must start with a single '/' — reject '//', backslash, javascript:, data:
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;

  // Reject URL schemes (e.g. javascript:, data:, vbscript:, file:)
  const schemeMatch = trimmed.match(/^\/?([a-zA-Z][a-zA-Z0-9+\-.]*:)/);
  if (schemeMatch) return fallback;

  // Reject encoded schemes (%6A%61%76%61%73%63%72%69%70%74 = "javascript")
  if (/^\/[^/]*%[0-9a-fA-F]{2}/.test(trimmed)) return fallback;

  // Reject paths that look like absolute URLs with host (e.g. /https://evil.com)
  if (/^\/(https?|ftp):\/\//i.test(trimmed.slice(1))) return fallback;

  return trimmed;
}
