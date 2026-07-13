/**
 * Server-side Sentry initialization.
 *
 * Wraps Node-runtime code: API routes, server components, server actions.
 */

import { getSentryConfig } from './src/lib/sentry';

const config = getSentryConfig();

export default function initServer() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs') as typeof import('@sentry/nextjs');
  if (!config.dsn) return;
  Sentry.init({
    ...config,
    integrations: [
      Sentry.nodeProfilingIntegration?.(),
    ].filter(Boolean),
  });
}
