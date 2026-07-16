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
            {`${BRAND_NAME} teaches the Amazon advertising skills Filipino VAs are charging `}
            ₱60,000–₱80,000/month for. Practice with real campaign tools, not just theory.
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
        <div className={styles.heroDecorative}>
          ₱60k–₱80k/mo
          <span className={styles.heroDecorativeCaption}>market rate, specialist Amazon PPC VAs</span>
        </div>
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
        <h2>Ready to learn the Amazon PPC work that&apos;s in demand right now?</h2>
        <p>
          Structured courses, real campaign tools, and a certificate that&apos;s part of the
          ProjectAmazonPH hiring pipeline.
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
              Amazon PPC training for Filipino virtual assistants.
              Learn the skill agencies and brands pay ₱60k–₱80k/month for.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h3>Platform</h3>
            <ul>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/tools/campaign-builder">Tools</Link></li>
              <li><Link href="/dashboard/courses">Courses</Link></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h3>Account</h3>
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
