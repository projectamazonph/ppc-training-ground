/**
 * Structured logging — Pino-based logger.
 *
 * Sprint 11 / STORY-049.
 *
 * Design:
 *   - Single process-wide logger instance, configured for server runtime.
 *   - Pretty output in dev (pino-pretty), JSON in prod (Logtail / Sentry friendly).
 *   - Request ID propagation via AsyncLocalStorage so all logs within a single
 *     request inherit the same correlation ID.
 *   - Edge runtime (middleware) cannot use Pino's default transport — exports
 *     a lightweight child-logger that emits one structured JSON line.
 *
 * Usage:
 *   import { logger, withRequestContext } from '@/lib/logger';
 *   logger.info({ userId, action: 'signup' }, 'user signed up');
 *
 * Replace `console.log/warn/error` across the app. The CI lint rule
 * `no-console` will fail if you don't.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

const isEdge = process.env.NEXT_RUNTIME === 'edge';
const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

// Reusable base config.
const baseConfig: LoggerOptions = {
  level: logLevel,
  base: {
    service: 'amph-v2',
    env: process.env.NODE_ENV ?? 'development',
    rev: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
  },
  // Avoid logging `req`/`res` accidentally (large, includes secrets).
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.secret',
      '*.authorization',
      'headers.cookie',
      'headers.authorization',
      'req.headers.cookie',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  // Use ISO timestamps — easier to grep and feed to log aggregators.
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

// Edge runtime: emit one-line JSON to stderr (no transports available).
function createEdgeLogger(): PinoLogger {
  return pino({
    ...baseConfig,
    // `pino.destination` would try to open a file handle; skip it.
  });
}

// Node runtime: pretty in dev, JSON in prod. `pino-pretty` is only installed
// in dev — fall back to JSON if import fails.
function createNodeLogger(): PinoLogger {
  if (isProd) return pino(baseConfig);
  try {
    // Lazy require — pino-pretty is optional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pretty = require('pino-pretty');
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
      },
    });
  } catch {
    return pino(baseConfig);
  }
}

export const logger: PinoLogger = isEdge ? createEdgeLogger() : createNodeLogger();

// ---------------------------------------------------------------------------
// Request context — AsyncLocalStorage for request-id propagation.
// ---------------------------------------------------------------------------

interface RequestContext {
  requestId: string;
  userId?: string;
  route?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Derive a child logger that always includes the current request context.
 * Use this in code paths called from middleware/server actions/webhooks.
 */
export function getRequestLogger(): PinoLogger {
  const ctx = getRequestContext();
  return ctx ? logger.child(ctx) : logger;
}

// ---------------------------------------------------------------------------
// Convenience wrappers — drop-in replacements for `console.*` calls.
// ---------------------------------------------------------------------------

export const log = {
  debug: (obj: Record<string, unknown>, msg?: string) => getRequestLogger().debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => getRequestLogger().info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => getRequestLogger().warn(obj, msg),
  error: (obj: Record<string, unknown> | Error, msg?: string) => {
    const entry = obj instanceof Error
      ? { err: { name: obj.name, message: obj.message, stack: obj.stack } }
      : obj;
    getRequestLogger().error(entry, msg);
  },
};

/**
 * Standard request-id header. Mirrors what Sentry's Next.js SDK uses.
 */
export const REQUEST_ID_HEADER = 'x-request-id';
