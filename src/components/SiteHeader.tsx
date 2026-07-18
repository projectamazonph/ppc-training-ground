'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND_NAME } from '@/lib/brand';
import { isProtectedRoute } from '@/lib/route-guards';

export function SiteHeader() {
  const pathname = usePathname();
  // Protected routes render their own app shell (sidebar + top bar) and must
  // not also get the public marketing header stacked above it.
  if (isProtectedRoute(pathname)) {
    return null;
  }

  return (
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
  );
}
