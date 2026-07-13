/**
 * Edge runtime Sentry initialization.
 *
 * Used by Next.js middleware. Keep this file small — edge bundles are
 * size-sensitive. No pino, no Prisma.
 */

import { getSentryConfig } from './src/lib/sentry';

const config = getSentryConfig();

export default function initEdge() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs') as typeof import('@sentry/nextjs');
  if (!config.dsn) return;
  Sentry.init({
    ...config,
    // Tracing in middleware is high-signal and cheap; keep it on in dev too.
    tracesSampleRate: 1.0,
  });
}
