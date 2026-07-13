// Next.js config — strict, security-hardened, Sentry-instrumented (Sprint 11 / STORY-048)
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/webhooks/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
    ],
  },

  // Sentry tunnel route — bypasses ad-blockers for Sentry ingest endpoints.
  // Sprint 11 / STORY-048
  async rewrites() {
    return [
      {
        source: '/monitoring',
        destination: process.env.SENTRY_HOST
          ? `${process.env.SENTRY_HOST}/api/0/envelope/`
          : 'https://sentry.io/api/0/envelope/',
      },
    ];
  },
};

// Sentry build-time source-map configuration. Disabled by default in dev.
// Enable by setting SENTRY_AUTH_TOKEN in the deploy environment.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  hideSourceMaps: true,
  disableLogger: true,
  widenClientFileUpload: true,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(config, sentryBuildOptions)
  : config;