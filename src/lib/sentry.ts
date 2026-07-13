/**
 * Sentry configuration for client, server, and edge runtimes.
 *
 * Sprint 11 / STORY-048.
 *
 * Sentry's official Next.js SDK handles initialization in three places:
 *   - sentry.client.config.ts  : browser bundle
 *   - sentry.server.config.ts  : Node runtime (API routes, server components)
 *   - sentry.edge.config.ts    : Edge runtime (middleware)
 *
 * We wrap each through a `getSentryConfig()` helper so that release tracking,
 * environment, and tracing flags stay consistent.
 *
 * Why three files (not one)?
 *   - The edge bundle cannot import pino, Prisma, or anything Node-only.
 *   - The Node bundle cannot import edge globals.
 *   - Sentry's Next.js plugin `@sentry/nextjs` reads these on demand.
 *
 * Required env vars:
 *   - SENTRY_DSN                       (server-side)
 *   - NEXT_PUBLIC_SENTRY_DSN           (client-side / public)
 *   - SENTRY_AUTH_TOKEN                (CI: source-map upload, optional)
 *   - SENTRY_ORG / SENTRY_PROJECT      (CI: source-map upload, optional)
 */

import type { SentryConfig } from './sentry-shared';

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function getSentryConfig(): SentryConfig {
  const dsn = getEnv('SENTRY_DSN');
  const environment = getEnv('SENTRY_ENVIRONMENT') ?? process.env.NODE_ENV ?? 'development';
  const release = getEnv('SENTRY_RELEASE')
    ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA;

  const isProd = environment === 'production';

  return {
    // If DSN is missing we still produce a config object so the SDK can
    // short-circuit internally — no crashes if Sentry isn't configured.
    dsn,
    environment,
    release,

    // Lower sample rates in prod to keep cost down. Bump on incidents.
    tracesSampleRate: isProd ? 0.1 : 1.0,
    profilesSampleRate: isProd ? 0.1 : 1.0,

    // Replay 100% on errors, 0% baseline; enable once we have UI sessions.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: isProd ? 1.0 : 0,

    // Drop noise — health checks and CI probes shouldn't page anyone.
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      'ResizeObserver loop limit exceeded',
    ],
    denyUrls: [
      // Local dev artifacts.
      /\/buildManifest\.js$/,
      // Chrome extensions.
      /^chrome-extension:/,
    ],

    // Source-map upload happens in CI, not at runtime.
    disableSourceMapsUpload: true,
  };
}
