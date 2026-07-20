// Next.js config — strict, security-hardened, Sentry-instrumented (Sprint 11 / STORY-048)
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Content-Security-Policy (audit O5 / S13-001).
//
// Rollout is intentionally two-phase. This header ships in **Report-Only** mode
// by default so it can never break the live site: browsers evaluate the policy
// and report violations (to the console / any configured sink) but still render
// everything. Once staging has been observed to produce zero violations, set
// `CSP_ENFORCE=true` in the deploy environment to promote it to an enforcing
// `Content-Security-Policy` header — no code change required.
//
// Notes on the allow-list (the "not-yet-finalized" concern from the deferral):
//  - script-src / style-src need 'unsafe-inline': Next's App Router injects
//    inline hydration scripts, and 19 components use inline `style={{…}}`.
//    'unsafe-eval' is added in dev only (React Fast Refresh needs it).
//  - img-src is permissive (https:) because lesson MDX is rendered via
//    dangerouslySetInnerHTML and may reference images from anywhere.
//  - connect-src covers Sentry ingest (direct + the /monitoring tunnel is
//    same-origin already) and Vercel Blob.
//  - frame-ancestors 'none' mirrors the existing X-Frame-Options: DENY.
function contentSecurityPolicy(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (!isProd) scriptSrc.push("'unsafe-eval'");

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'https://*.sentry.io',
      'https://*.ingest.sentry.io',
      'https://*.blob.vercel-storage.com',
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(' ')}`,
  );
  if (isProd) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

const cspHeader = {
  key:
    process.env.CSP_ENFORCE === 'true'
      ? 'Content-Security-Policy'
      : 'Content-Security-Policy-Report-Only',
  value: contentSecurityPolicy(),
};

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
  cspHeader,
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