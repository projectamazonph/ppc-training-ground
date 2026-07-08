import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { TierGateResult } from '@/lib/tier-gate';
import type { CourseTier } from '@/lib/enums';
import styles from './TierLock.module.css';

interface PricingTierDisplay {
  id: string;
  slug: string;
  name: string;
  description: string;
  tier: string;
  pricePhp: number;
  features: string | null;
}

interface TierLockProps {
  gate: Extract<TierGateResult, { allowed: false }>;
  courseTitle: string;
  pricingTiers: PricingTierDisplay[];
}

const TIER_LABEL: Record<string, string> = {
  PPC_FOUNDATIONS: 'PPC Foundations',
  ACCELERATED_MASTERY: 'Accelerated Mastery',
  ULTIMATE_TRANSFORMATION: 'Ultimate Transformation',
};

function formatPrice(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

function getReasonCopy(reason: TierLockProps['gate']['reason']): {
  headline: string;
  body: string;
} {
  switch (reason) {
    case 'no-enrollment':
      return {
        headline: 'Enroll to unlock this lesson.',
        body: 'This lesson is part of a paid course. Pick a tier below to start learning.',
      };
    case 'tier-insufficient':
      return {
        headline: 'Upgrade to access this lesson.',
        body: 'Your current tier covers the foundations, but this lesson needs a higher plan.',
      };
    case 'inactive-enrollment':
      return {
        headline: 'Your enrollment is paused.',
        body: 'Reactivate your enrollment to keep going where you left off.',
      };
    case 'course-not-tiered':
      return {
        headline: 'Course configuration issue.',
        body: 'This course is not configured for tier-based access. Contact support.',
      };
  }
}

export function TierLock({ gate, courseTitle, pricingTiers }: TierLockProps) {
  const requiredLabel = gate.requiredTier ? TIER_LABEL[gate.requiredTier] ?? gate.requiredTier : '—';
  const userLabel = gate.userTier ? TIER_LABEL[gate.userTier] ?? gate.userTier : 'No active plan';
  const copy = getReasonCopy(gate.reason);

  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-6) 0' }}>
      <Card padding="lg" className={styles.lockCard}>
        <div className={styles.iconWrap}>
          <Icon name="Lock" size="lg" />
        </div>
        <CardHeader>
          <CardTitle>{copy.headline}</CardTitle>
          <CardDescription>
            <strong>{courseTitle}</strong> requires the <strong>{requiredLabel}</strong> tier.
            {gate.userTier && (
              <>
                {' '}You are on <strong>{userLabel}</strong>.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <p>{copy.body}</p>

        <div className={styles.tierGrid}>
          {pricingTiers.map((tier) => {
            const label = TIER_LABEL[tier.tier] ?? tier.tier;
            const isCurrent = gate.userTier === tier.tier;
            const isRequired = gate.requiredTier === tier.tier;
            let features: { bullets?: string[] } = {};
            if (tier.features) {
              try {
                features = JSON.parse(tier.features) as { bullets?: string[] };
              } catch {
                features = {};
              }
            }
            return (
              <div
                key={tier.id}
                className={`${styles.tierCard} ${isRequired ? styles.tierCardRequired : ''} ${isCurrent ? styles.tierCardCurrent : ''}`}
              >
                <div className={styles.tierHeader}>
                  <div>
                    <div className={styles.tierName}>{label}</div>
                    <div className={styles.tierPrice}>{formatPrice(tier.pricePhp)}</div>
                  </div>
                  <div className={styles.tierBadges}>
                    {isCurrent && <Badge variant="info">Current</Badge>}
                    {isRequired && <Badge variant="warning">Needed</Badge>}
                  </div>
                </div>
                <p className={styles.tierDescription}>{tier.description}</p>
                {features.bullets && (
                  <ul className={styles.tierBullets}>
                    {features.bullets.slice(0, 4).map((b) => (
                      <li key={b}>
                        <Icon name="Check" size="sm" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/dashboard/billing?tier=${tier.slug}` as never}
                  className={`${styles.ctaButton} ${isRequired ? styles.ctaPrimary : styles.ctaSecondary}`}
                >
                  {isCurrent ? 'Manage plan' : `Choose ${label}`}
                </Link>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <Link href="/dashboard/courses" style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
            ← Back to courses
          </Link>
        </div>
      </Card>
    </main>
  );
}
