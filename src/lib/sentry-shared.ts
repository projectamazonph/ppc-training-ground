/**
 * Shared types for the Sentry configuration helpers.
 *
 * Lives in its own module because the runtime-specific configs
 * (sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts)
 * all import this type to ensure their shapes agree.
 *
 * Keep this file dependency-free — it's a type-only module.
 */

export interface SentryConfig {
  dsn?: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  ignoreErrors: string[];
  denyUrls: RegExp[];
  disableSourceMapsUpload: boolean;
}
