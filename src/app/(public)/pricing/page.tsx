/**
 * Pricing page — public-facing tier selection.
 *
 * Sprint 6 — STORY-026.
 *
 * Public route (no auth required). Guest users enter email and complete
 * signup after payment. Logged-in users get their email pre-filled and
 * the checkout creates an Account-link instead of a guest placeholder.
 */

import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { getTierDisplay, type TierDisplay } from '@/lib/pricing';
import { getSession } from '@/lib/auth';
import { CheckoutButton } from './CheckoutButton';
import { BRAND_NAME } from '@/lib/brand';
import styles from './pricing.module.css';

export const metadata = {
  title: `Pricing — ${BRAND_NAME}`,
  description:
    'Three Amazon PPC coaching tiers for Filipino virtual assistants. Pick the path that matches where you are now.',
};

export default async function PricingPage() {
  const [tiers, session] = await Promise.all([getTierDisplay(), getSession()]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>PRICING</p>
        <h1 className={styles.title}>Pick the tier that matches where you are.</h1>
        <p className={styles.subtitle}>
          Three months from now you&apos;ll either be earning ₱60,000 a month doing Amazon PPC
          work, or you&apos;ll be explaining to your family why that &ldquo;side hustle&rdquo;
          didn&apos;t pan out. The tier doesn&apos;t change what we teach — it changes how fast
          you get unstuck.
        </p>
      </header>

      <div className={styles.tierGrid}>
        {tiers.map((tier: TierDisplay) => (
          <Card key={tier.id} className={tier.slug === 'accelerated-mastery' ? styles.tierFeatured : styles.tier}>
            {tier.slug === 'accelerated-mastery' && (
              <Badge variant="info" className={styles.featuredBadge}>
                Most popular
              </Badge>
            )}
            <CardHeader>
              <p className={styles.tierEyebrow}>{tier.tier.replace(/_/g, ' ')}</p>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>

            <div className={styles.priceBlock}>
              <span className={styles.priceCurrency}>₱</span>
              <span className={styles.priceAmount}>
                {(tier.pricePhp / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </span>
              <span className={styles.priceOneTime}>one-time</span>
            </div>

            <ul className={styles.bullets}>
              {tier.features.bullets.map((b: string) => (
                <li key={b}>{b}</li>
              ))}
              {tier.features.includesLiveClasses && (
                <li className={styles.bulletLive}>
                  Weekly live classes with Ryan
                </li>
              )}
              {tier.features.includesOneOnOne && (
                <li className={styles.bulletLive}>1-on-1 portfolio review every month</li>
              )}
            </ul>

            <div className={styles.cta}>
              <CheckoutButton
                pricingTierId={tier.id}
                tierName={tier.name}
                defaultEmail={session?.email ?? ''}
                isFeatured={tier.slug === 'accelerated-mastery'}
              />
            </div>

            <p className={styles.fineprint}>Pay via GCash, Maya, credit card, or bank transfer.</p>
          </Card>
        ))}
      </div>

      <section className={styles.faqBlock}>
        <h2>Questions</h2>
        <details>
          <summary>Do you offer refunds?</summary>
          <p>
            Yes. Request within 14 days of purchase; we&apos;ll review and process within five
            business days. After 14 days, refunds are case-by-case.
          </p>
        </details>
        <details>
          <summary>Is this a subscription?</summary>
          <p>
            No. One-time payment. You keep access to the course and any future updates
            while your enrollment is active.
          </p>
        </details>
        <details>
          <summary>What if I don&apos;t have any Amazon ads experience yet?</summary>
          <p>
            Start with PPC Foundations. The first three modules build the mental model
            from scratch — you don&apos;t need prior campaign work to follow along.
          </p>
        </details>
      </section>
    </main>
  );
}
