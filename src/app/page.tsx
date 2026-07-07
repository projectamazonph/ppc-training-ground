import Link from 'next/link';

export default function HomePage() {
  return (
    <main id="main-content" className="container">
      <section style={{ padding: 'var(--space-16) 0' }}>
        <h1
          style={{
            fontSize: 'var(--text-4xl)',
            marginBottom: 'var(--space-6)',
            maxWidth: '720px',
          }}
        >
          Three courses. One outcome: become the Amazon ads specialist clients retain.
        </h1>
        <p
          style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--ink-700)',
            marginBottom: 'var(--space-8)',
            maxWidth: '600px',
          }}
        >
          PPC Training Ground teaches Filipino VAs the Amazon advertising work
          that pays ₱60,000 to ₱80,000 a month. Practice with real campaign
          tools, not just theory.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link
            href="/pricing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
            }}
          >
            See pricing
          </Link>
          <Link
            href="/tools/campaign-builder"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--space-3) var(--space-6)',
              border: '1px solid var(--border-strong)',
              color: 'var(--ink-900)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
            }}
          >
            Try a tool
          </Link>
        </div>
      </section>

      <section
        style={{
          padding: 'var(--space-12) 0',
          borderTop: '1px solid var(--border)',
        }}
      >
        <h2 style={{ marginBottom: 'var(--space-6)' }}>What you learn</h2>
        <ul
          style={{
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          <li>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Campaign structure</h3>
            <p style={{ color: 'var(--ink-700)' }}>
              How to build Sponsored Products campaigns that Amazon&apos;s
              algorithm actually rewards.
            </p>
          </li>
          <li>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Bid optimization</h3>
            <p style={{ color: 'var(--ink-700)' }}>
              When to raise bids, when to lower them, and when to leave the
              campaign alone.
            </p>
          </li>
          <li>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Search term triage</h3>
            <p style={{ color: 'var(--ink-700)' }}>
              Cut the wasted spend on irrelevant clicks without killing the
              keywords that convert.
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}