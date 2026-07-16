import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, Badge, Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { CourseTier } from '@/lib/enums';
import { userMeetsTierRequirement, listActivePricingTiers } from '@/lib/tier-gate';
import { listUpcomingClasses, listPastClasses } from '@/lib/live-classes';
import { BRAND_NAME } from '@/lib/brand';
import styles from './live-classes.module.css';

export const metadata = {
  title: `Live Classes — ${BRAND_NAME}`,
};

export default async function LiveClassesIndexPage() {
  const user = await requireAuth();

  // One tier check up front — both pages need the same verdict.
  const [tierCheck, upcoming, past, tiers] = await Promise.all([
    userMeetsTierRequirement(user.id, CourseTier.ULTIMATE_TRANSFORMATION),
    listUpcomingClasses(user.id),
    listPastClasses(user.id),
    listActivePricingTiers(),
  ]);

  const ultimateTier = tiers.find((t) => t.tier === CourseTier.ULTIMATE_TRANSFORMATION);
  const datetimeFmt = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>LIVE COHORT SESSIONS</p>
        <h1 className={styles.title}>Live Classes</h1>
        <p className={styles.subtitle}>
          Weekly working sessions with Ryan. Bring your live campaigns, search-term reports,
          and listing screenshots. Reschedule recordings go up within 24 hours.
        </p>
        {tierCheck.allowed ? (
          <Badge variant="success" className={styles.tierBadge}>
            ULTIMATE TIER — REGISTRATION UNLOCKED
          </Badge>
        ) : (
          <Badge variant="default" className={styles.tierBadge}>
            ULTIMATE TIER REQUIRED
          </Badge>
        )}
      </header>

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className={styles.sectionTitle}>
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <Card className={styles.empty}>
            <CardHeader>
              <CardTitle>No upcoming classes yet</CardTitle>
              <CardDescription>
                New live sessions are scheduled monthly. Check back, or upgrade to Ultimate
                and we will email you the moment one drops.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className={styles.list}>
            {upcoming.map((klass) => {
              const isFull = klass.registrationCount >= klass.maxAttendees;
              return (
                <li key={klass.id}>
                  <Card className={styles.classCard}>
                    <div className={styles.dateBadge}>
                      <Icon name="Calendar" size="lg" />
                      <span>{datetimeFmt.format(klass.scheduledAt)}</span>
                    </div>
                    <div className={styles.classBody}>
                      <p className={styles.classCourse}>{klass.course.title}</p>
                      <h3 className={styles.classTitle}>{klass.title}</h3>
                      <p className={styles.classDescription}>{klass.description}</p>
                      <div className={styles.classMeta}>
                        <Badge variant="default">
                          {klass.durationMinutes} min
                        </Badge>
                        <Badge variant="default">{klass.instructorName}</Badge>
                        <Badge variant={isFull ? 'danger' : 'success'}>
                          {isFull
                            ? 'FULL'
                            : `${klass.maxAttendees - klass.registrationCount} seats left`}
                        </Badge>
                      </div>
                    </div>
                    <div className={styles.classActions}>
                      <Link href={`/dashboard/live-classes/${klass.id}`}>
                        <Button
                          variant={klass.isUserRegistered ? 'secondary' : 'primary'}
                          leftIcon={
                            klass.isUserRegistered ? <Icon name="Check" /> : <Icon name="ArrowRight" />
                          }
                          disabled={isFull}
                        >
                          {klass.isUserRegistered
                            ? 'Registered — view details'
                            : isFull
                              ? 'Class full'
                              : 'Register'}
                        </Button>
                      </Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!tierCheck.allowed && (
        <section className={styles.upgradePrompt}>
          <Card>
            <CardHeader>
              <CardTitle>Live Classes are an Ultimate tier feature</CardTitle>
              <CardDescription>
                {ultimateTier
                  ? `Upgrade for ${formatPrice(ultimateTier.pricePhp)} and unlock every live session, mastermind access, and 1-on-1 audits.`
                  : 'Ultimate tier is not currently available — check back soon.'}
              </CardDescription>
            </CardHeader>
            <div className={styles.upgradeActions}>
              <Link href="/pricing">
                <Button variant="primary" leftIcon={<Icon name="ArrowRight" />}>
                  See the Ultimate tier
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className={styles.sectionTitle}>
            Recent recordings
          </h2>
          <ul className={styles.pastList}>
            {past.slice(0, 6).map((klass) => (
              <li key={klass.id}>
                <Card className={styles.pastCard}>
                  <p className={styles.pastDate}>
                    {datetimeFmt.format(klass.scheduledAt)}
                  </p>
                  <p className={styles.pastTitle}>{klass.title}</p>
                  {klass.recordingUrl ? (
                    <a
                      href={klass.recordingUrl}
                      target="_blank"
                      rel="noopener"
                      className={styles.pastLink}
                    >
                      Watch recording
                    </a>
                  ) : (
                    <span className={styles.pastLinkMuted}>
                      Recording not yet uploaded
                    </span>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}
