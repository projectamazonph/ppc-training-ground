import Link from 'next/link';
import { BRAND_NAME, BRAND_NAME_UPPER } from '@/lib/brand';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <main id="main-content" className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{BRAND_NAME_UPPER}</p>
          <h1 className={styles.heroTitle}>
            Three courses. One outcome: become the Amazon ads specialist clients retain.
          </h1>
          <p className={styles.heroSub}>
            {`${BRAND_NAME} teaches Filipino VAs the Amazon advertising work that pays `}
            ₱60,000 to ₱80,000 a month. Practice with real campaign tools, not just theory.
          </p>
          <div className={styles.heroActions}>
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
        </div>
        <div className={styles.heroDecorative}>₱80k/mo</div>
      </section>

      {/* ── What You Learn ───────────────────────────────────── */}
      <section className={styles.learnSection}>
        <h2>What you learn</h2>
        <ul className={styles.learnGrid}>
          <li className={styles.learnItem}>
            <h3>Campaign structure</h3>
            <p>
              How to build Sponsored Products campaigns that Amazon&apos;s
              algorithm actually rewards.
            </p>
          </li>
          <li className={styles.learnItem}>
            <h3>Bid optimization</h3>
            <p>
              When to raise bids, when to lower them, and when to leave the
              campaign alone.
            </p>
          </li>
          <li className={styles.learnItem}>
            <h3>Search term triage</h3>
            <p>
              Cut the wasted spend on irrelevant clicks without killing the
              keywords that convert.
            </p>
          </li>
        </ul>
      </section>

      {/* ── Pricing Preview ──────────────────────────────────── */}
      <section className={styles.pricingSection}>
        <h2>Simple, one-time pricing</h2>
        <p className={styles.pricingSub}>
          No subscriptions. No hidden fees. Pay once, learn forever.
        </p>
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
          Compare tiers
        </Link>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <h2>Ready to start earning?</h2>
        <p>
          Join hundreds of Filipino VAs who turned Amazon PPC into a real career.
        </p>
        <Link
          href="/auth/signup"
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
          Create your account
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <strong>{BRAND_NAME}</strong>
            <p>
              Amazon PPC coaching for Filipino virtual assistants.
              Learn the work that pays ₱60k–₱80k/month.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h4>Platform</h4>
            <ul>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/tools/campaign-builder">Tools</Link></li>
              <li><Link href="/dashboard/courses">Courses</Link></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h4>Account</h4>
            <ul>
              <li><Link href="/auth/signin">Sign in</Link></li>
              <li><Link href="/auth/signup">Sign up</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
