/**
 * Client-side Sentry initialization.
 *
 * Imported automatically by the @sentry/nextjs plugin at app boot.
 * Must be a default export returning the Sentry init call (idiomatic SDK use).
 */

import { getSentryConfig } from './src/lib/sentry';

const config = getSentryConfig();

// `Sentry.init` is provided by `@sentry/nextjs`. The dynamic require avoids
// pulling Sentry into the bundle during typecheck / lint.
export default function initClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs') as typeof import('@sentry/nextjs');
  if (!config.dsn) return;
  Sentry.init({
    ...config,
    // Browser-only knobs.
    integrations: [
      Sentry.browserTracingIntegration?.(),
      Sentry.replayIntegration?.(),
    ].filter(Boolean),
  });
}
