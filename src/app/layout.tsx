import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';
import '../styles/globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    'Amazon advertising training for Filipino virtual assistants. Three courses. One outcome: become the Amazon ads specialist clients retain at ₱60k–₱80k per month.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'en_PH',
    siteName: BRAND_NAME,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable}`}
    >
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <header
          style={{
            borderBottom: '1px solid var(--border)',
            padding: 'var(--space-3) 0',
          }}
        >
          <nav
            className="container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            aria-label="Primary"
          >
            <Link
              href="/"
              style={{
                display: 'inline-block',
                padding: 'var(--space-2) 0',
                fontWeight: 700,
                fontSize: 'var(--text-lg)',
                color: 'var(--ink-900)',
                textDecoration: 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {BRAND_NAME}
            </Link>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Link
                href="/auth/signin"
                style={{
                  color: 'var(--ink-700)',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'none',
                  padding: 'var(--space-2) var(--space-3)',
                }}
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get started
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}