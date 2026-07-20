import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--side-pad)',
        textAlign: 'center',
        gap: 'var(--space-4)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-4xl)',
          fontWeight: 700,
          color: 'var(--ink-300)',
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        404
      </p>
      <h1 style={{ margin: 0 }}>Page not found</h1>
      <p style={{ color: 'var(--ink-500)', maxWidth: '480px', margin: 0 }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-6)',
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          textDecoration: 'none',
        }}
      >
        Go to {BRAND_NAME}
      </Link>
    </main>
  );
}
