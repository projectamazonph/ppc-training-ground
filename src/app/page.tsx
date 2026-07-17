import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';
import styles from './home.module.css';

/**
 * Landing page — Screen 1 of the Stitch "Field Manual" design set.
 * See docs/stitch-prompts.md § SCREEN 1 for the source design brief.
 *
 * Left-aligned, asymmetric compositions throughout (no centered heroes,
 * no 3-equal-column grids). Typographic decoration only — no imagery.
 */
export default function HomePage() {
  return (
    <main id="main-content" className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Amazon PPC training for Filipino VAs</p>
          <h1 className={styles.heroTitle}>
            Stop earning ₱15k/month. Start charging ₱60k–₱80k for Amazon ads.
          </h1>
          <p className={styles.heroSub}>
            {BRAND_NAME} teaches Filipino VAs the Amazon advertising work that clients pay
            premium rates for. Practice with real campaign tools, not just theory videos.
          </p>
          <div className={styles.heroActions}>
            <Link href="/pricing" className={styles.btnPrimary}>
              See pricing <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className={styles.heroDecorative} aria-hidden="true">
          ₱80k
          <span className={styles.heroDecorativeCaption}>market rate, specialist Amazon PPC VAs</span>
        </div>
      </section>

      {/* ── Social proof bar ─────────────────────────────────── */}
      <section className={styles.proofBar} aria-label="By the numbers">
        <div className={styles.proofInner}>
          <div className={styles.proofStat}>
            <span className={styles.proofNumber}>500+</span>
            <span className={styles.proofLabel}>VAs trained</span>
          </div>
          <div className={styles.proofStat}>
            <span className={styles.proofNumber}>₱50M+</span>
            <span className={styles.proofLabel}>ad spend managed</span>
          </div>
          <div className={styles.proofStat}>
            <span className={styles.proofNumber}>60%</span>
            <span className={styles.proofLabel}>average completion</span>
          </div>
          <div className={styles.proofStat}>
            <span className={styles.proofNumber}>4.8/5</span>
            <span className={styles.proofLabel}>student rating</span>
          </div>
        </div>
      </section>

      {/* ── What you learn (asymmetric 60/40) ────────────────── */}
      <section className={styles.learnSection}>
        <h2>What you learn</h2>
        <div className={styles.learnGrid}>
          <div className={styles.learnLead}>
            <h3>Campaign structure</h3>
            <p>
              How to build Sponsored Products campaigns that Amazon&apos;s algorithm
              rewards. SP, SB, SD, and BTV structures explained with real examples you
              rebuild yourself in the Campaign Builder.
            </p>
          </div>
          <div className={styles.learnRest}>
            <div className={styles.learnItem}>
              <h3>Bid optimization</h3>
              <p>
                When to raise bids, when to lower them, and when to leave the campaign
                alone. Practice with the Bid Elevator tool.
              </p>
            </div>
            <div className={styles.learnItem}>
              <h3>Search term triage</h3>
              <p>
                Cut wasted spend on irrelevant clicks without killing the keywords that
                convert. 20 real search terms to practice on.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three tiers (asymmetric, featured center) ────────── */}
      <section className={styles.tiersSection}>
        <h2>Three tiers. One goal.</h2>
        <div className={styles.tiersGrid}>
          <div className={styles.tiersSide}>
            <article className={styles.tierCompact}>
              <p className={styles.tierEyebrow}>PPC Foundations</p>
              <p className={styles.tierPrice}>
                <span className={styles.tierCurrency}>₱</span>2,999
              </p>
              <p className={styles.tierBlurb}>
                Start here if you&apos;re new to Amazon ads or want a solid foundation.
              </p>
            </article>
            <article className={styles.tierCompact}>
              <p className={styles.tierEyebrow}>Ultimate Transformation</p>
              <p className={styles.tierPrice}>
                <span className={styles.tierCurrency}>₱</span>9,999
              </p>
              <p className={styles.tierBlurb}>
                The full package — live coaching and monthly portfolio review with Ryan.
              </p>
            </article>
          </div>
          <article className={styles.tierFeatured}>
            <span className={styles.tierBadge}>Most popular</span>
            <p className={styles.tierEyebrow}>Accelerated Mastery</p>
            <p className={styles.tierPriceLarge}>
              <span className={styles.tierCurrency}>₱</span>5,999
            </p>
            <p className={styles.tierBlurb}>
              The fastest path to Amazon ads specialist. Everything in Foundations plus the
              advanced tools, resources, and session recordings.
            </p>
            <ul className={styles.tierList}>
              <li>8 modules (31 lessons)</li>
              <li>All 5 interactive tools</li>
              <li>4 completion badges</li>
              <li>Priority certificate</li>
            </ul>
            <Link href="/pricing" className={styles.btnPrimary}>
              Get started <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
        <Link href="/pricing" className={styles.tiersLink}>
          Compare all tiers <span aria-hidden="true">→</span>
        </Link>
      </section>

      {/* ── Tools showcase (zig-zag) ─────────────────────────── */}
      <section className={styles.toolsSection}>
        <h2>Practice with real tools</h2>
        <p className={styles.toolsIntro}>
          Five interactive tools that simulate the Amazon Advertising Console. Not theory.
          Practice.
        </p>
        <ul className={styles.toolsList}>
          <li className={styles.toolRow}>
            <div className={styles.toolText}>
              <h3>Campaign Builder</h3>
              <p>Build SP, SB, SD, and BTV campaign structures step by step.</p>
            </div>
            <span className={styles.toolNumber} aria-hidden="true">05</span>
          </li>
          <li className={styles.toolRow}>
            <div className={styles.toolText}>
              <h3>Bid Elevator</h3>
              <p>Practice bid optimization across 10 real-world scenarios.</p>
            </div>
            <span className={styles.toolNumber} aria-hidden="true">10</span>
          </li>
          <li className={styles.toolRow}>
            <div className={styles.toolText}>
              <h3>Search Term Triage</h3>
              <p>Triage 20 search terms per session. Keep, pause, or negate.</p>
            </div>
            <span className={styles.toolNumber} aria-hidden="true">20</span>
          </li>
          <li className={styles.toolRow}>
            <div className={styles.toolText}>
              <h3>Listing Audit</h3>
              <p>Audit product listings for ad readiness and optimization.</p>
            </div>
            <span className={styles.toolNumber} aria-hidden="true">05</span>
          </li>
          <li className={styles.toolRow}>
            <div className={styles.toolText}>
              <h3>Keyword Research</h3>
              <p>Research, categorize, and prioritize keywords by intent.</p>
            </div>
            <span className={styles.toolNumber} aria-hidden="true">05</span>
          </li>
        </ul>
      </section>

      {/* ── Ryan / authority (asymmetric) ────────────────────── */}
      <section className={styles.ryanSection}>
        <div className={styles.ryanText}>
          <h2>Built by someone who&apos;s done the work</h2>
          <p>
            Ryan has managed ₱50M+ in Amazon ad spend across 200+ client accounts since
            2014. He built {BRAND_NAME}{' '}because the training he wished existed when he
            started doesn&apos;t exist anywhere — especially not for Filipino VAs.
          </p>
        </div>
        <span className={styles.ryanNumber} aria-hidden="true">₱50M+</span>
      </section>

      {/* ── CTA (dark, left-aligned) ─────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaHeading}>Start earning ₱60k–₱80k/month</h2>
          <p className={styles.ctaSub}>
            Join 500+ Filipino VAs who specialized in Amazon advertising through {BRAND_NAME}.
          </p>
          <Link href="/pricing" className={styles.btnPrimary}>
            See pricing <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <strong>{BRAND_NAME}</strong>
            <p>
              Amazon PPC training for Filipino virtual assistants. Learn the skill agencies
              and brands pay ₱60k–₱80k/month for.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h3>Platform</h3>
            <ul>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/tools/campaign-builder">Tools</Link></li>
              <li><Link href="/auth/signin">Sign in</Link></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h3>Contact</h3>
            <ul>
              <li><a href="mailto:hello@projectamazonph.com">hello@projectamazonph.com</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
