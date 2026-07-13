/**
 * Server action tracing wrapper.
 *
 * Sprint 11 / STORY-050.
 *
 * Wrap any server action to automatically emit a Sentry transaction and
 * a structured start/duration log line. Errors are captured with full
 * context (user id, action name, args) without leaking secrets (input
 * strings are logged but their full original object is replaceable).
 *
 * Usage:
 *   export const startLesson = withActionTracing(
 *     'startLesson',
 *     async (input: { courseId: string; lessonId: string }) => {
 *       // ...
 *     },
 *   );
 *
 * Why a HOC instead of a decorator?
 *   - Next.js server actions are "use server" exports of functions — we
 *     can't decorate them with TS decorators cleanly across configs.
 *   - A HOC keeps the existing action signature and types intact.
 */

import 'server-only';

import { log, withRequestContext } from './logger';

/**
 * Opaque Sentry type — the SDK is optional in dev. We `require` it
 * lazily inside the wrapper to avoid breaking typecheck or builds
 * when @sentry/nextjs isn't installed.
 */
type SentryLike = {
  startTransaction: (arg: { name: string; op?: string }) => {
    setContext: (key: string, value: Record<string, unknown>) => void;
    setUser: (user: { id?: string; email?: string } | null) => void;
    setStatus: (status: 'ok' | 'internal_error' | 'unknown_error') => void;
    finish: () => void;
  };
  captureException: (err: unknown) => void;
};

function getSentry(): SentryLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs');
    if (Sentry && typeof Sentry.startTransaction === 'function') return Sentry;
    return null;
  } catch {
    return null;
  }
}

/**
 * Best-effort scrubber for action inputs before they're attached to a
 * Sentry breadcrumb. Strips obvious secret-y keys, keeps the rest.
 */
function scrubArgs(args: unknown[], depth = 0): unknown[] {
  if (depth > 3) return ['[depth-limited]'];
  const SECRET_KEY_RE = /password|secret|token|credential|cookie|authorization/i;
  return args.map((a) => {
    if (!a || typeof a !== 'object') return a;
    if (Array.isArray(a)) return scrubArgs(a, depth + 1);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof v === 'object') {
        out[k] = scrubArgs([v], depth + 1)[0];
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

export interface TracingOptions {
  /** Logical action name (e.g. "enrollStudent"). Falls back to fn.name. */
  name: string;
  /** Optional Sentry context to attach — useful for tags like 'tier'. */
  context?: Record<string, unknown>;
  /** Skip scrubbing of arguments (e.g. for `signOut` which takes nothing sensitive). */
  skipArgScrub?: boolean;
}

/**
 * Wraps a server-action function with:
 *   - Sentry transaction lifecycle (start → finish)
 *   - Pino log line with duration + status
 *   - Exception capture
 *   - AsyncLocalStorage request-id propagation
 */
export function withActionTracing<TArgs extends unknown[], TReturn>(
  nameOrFn: string | ((...args: TArgs) => Promise<TReturn> | TReturn),
  fnOrOpts?: ((...args: TArgs) => Promise<TReturn> | TReturn) | TracingOptions,
  maybeOpts?: TracingOptions,
): (...args: TArgs) => Promise<TReturn> {
  // Support both (name, fn, opts?) and (fn) signatures for ergonomics.
  let fn: (...args: TArgs) => Promise<TReturn> | TReturn;
  let opts: TracingOptions;

  if (typeof nameOrFn === 'function') {
    fn = nameOrFn;
    opts = (typeof fnOrOpts === 'object' ? fnOrOpts : { name: fn.name || 'anonymous' }) as TracingOptions;
  } else {
    fn = fnOrOpts as (...args: TArgs) => Promise<TReturn> | TReturn;
    opts = maybeOpts ?? { name: nameOrFn };
  }

  const actionName = opts.name || fn.name || 'anonymous';
  const start = performance.now();

  return async function tracedAction(...args: TArgs): Promise<TReturn> {
    const sentry = getSentry();
    const tx = sentry?.startTransaction({ name: actionName, op: 'server.action' });

    if (tx && opts.context) tx.setContext('action', opts.context);

    try {
      const result = await withRequestContext({ requestId: randomId(), route: actionName }, () =>
        Promise.resolve(fn(...args)),
      );

      if (tx) {
        if (opts.context?.userId) {
          tx.setUser({ id: String(opts.context.userId) });
        }
        tx.setStatus('ok');
        tx.finish();
      }

      log.info(
        { action: actionName, durationMs: msSince(start), status: 'ok' },
        `server-action ok: ${actionName}`,
      );
      return result;
    } catch (err) {
      if (tx) {
        tx.setStatus('internal_error');
        tx.finish();
      }
      const argInfo = opts.skipArgScrub ? [] : scrubArgs(args);
      log.error(
        {
          action: actionName,
          err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
          args: argInfo,
          durationMs: msSince(start),
        },
        `server-action fail: ${actionName}`,
      );
      if (sentry) sentry.captureException(err);
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msSince(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

function randomId(): string {
  // 8-char lowercase hex — same shape as Sentry's request IDs.
  return Math.random().toString(16).slice(2, 10);
}