import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { CourseTier } from '@/lib/enums';
import { userMeetsTierRequirement, listActivePricingTiers } from '@/lib/tier-gate';
import { getClassDetail } from '@/lib/live-classes';
import { RegisterButton } from './RegisterButton';
import { BRAND_NAME } from '@/lib/brand';
import styles from '../live-classes.module.css';
import detailStyles from './detail.module.css';
import breadcrumbStyles from '../breadcrumb.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();
  const klass = await getClassDetail(id, user.id);
  if (!klass) return { title: `Class not found — ${BRAND_NAME}` };
  return { title: `${klass.title} — Live Class` };
}

export default async function LiveClassDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const [klass, tierCheck, tiers] = await Promise.all([
    getClassDetail(id, user.id),
    userMeetsTierRequirement(user.id, CourseTier.ULTIMATE_TRANSFORMATION),
    listActivePricingTiers(),
  ]);
  if (!klass) notFound();

  const ultimateTier = tiers.find((t) => t.tier === CourseTier.ULTIMATE_TRANSFORMATION);

  const datetimeFmt = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
  const dateFmt = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const classStart = klass.scheduledAt.getTime();
  const classEnd = classStart + klass.durationMinutes * 60 * 1000;
  // eslint-disable-next-line react-hooks/purity -- safe in server component; render once per request
  const now = Date.now();
  const hasStarted = now >= classStart;
  const hasEnded = now >= classEnd;
  const isFull = klass.registrationCount >= klass.maxAttendees;
  const isCancelled = klass.cancelledAt !== null;
  const meetingUrlAvailable = hasStarted && !hasEnded && !isCancelled && klass.meetingUrl;

  return (
    <div className={styles.page}>
      <nav aria-label="breadcrumb" className={breadcrumbStyles.breadcrumb}>
        <Link href="/dashboard/live-classes">← Back to Live Classes</Link>
      </nav>

      <header className={detailStyles.header}>
        <p className={styles.eyebrow}>{klass.course.title}</p>
        <h1 className={styles.title}>{klass.title}</h1>
        <p className={styles.subtitle}>{klass.description}</p>
      </header>

      {isCancelled && (
        <Card className={detailStyles.cancelled}>
          <CardHeader>
            <CardTitle>This class has been cancelled</CardTitle>
            <CardDescription>
              {klass.cancellationReason ?? 'No reason provided.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className={detailStyles.grid}>
        <Card className={detailStyles.mainCard}>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <dl className={detailStyles.detailList}>
            <dt>Instructor</dt>
            <dd>{klass.instructorName}</dd>

            <dt>Date and time</dt>
            <dd>{datetimeFmt.format(klass.scheduledAt)} (Asia/Manila)</dd>

            <dt>Duration</dt>
            <dd>{klass.durationMinutes} minutes</dd>

            <dt>Course</dt>
            <dd>
              <Link href={`/dashboard/courses/${klass.course.slug}`}>{klass.course.title}</Link>
            </dd>

            <dt>Capacity</dt>
            <dd>
              {klass.registrationCount} of {klass.maxAttendees} seats taken
              {isFull ? ' (full)' : ''}
            </dd>
          </dl>

          {hasEnded && klass.recordingUrl && (
            <div className={detailStyles.recording}>
              <h3 className={detailStyles.recordingTitle}>Recording</h3>
              <a
                href={klass.recordingUrl}
                target="_blank"
                rel="noopener"
                className={detailStyles.recordingLink}
              >
                Watch the replay →
              </a>
            </div>
          )}

          {hasEnded && !klass.recordingUrl && (
            <div className={detailStyles.recordingPending}>
              Recording is being edited and will land in your dashboard within 24 hours.
            </div>
          )}
        </Card>

        <Card className={detailStyles.actionCard}>
          <CardHeader>
            <CardTitle>
              {hasEnded
                ? 'Class ended'
                : klass.isUserRegistered
                  ? "You're registered"
                  : tierCheck.allowed
                    ? 'Reserve your seat'
                    : 'Ultimate tier required'}
            </CardTitle>
            <CardDescription>
              {!tierCheck.allowed && ultimateTier && !klass.isUserRegistered
                ? `Upgrade for ${formatPrice(ultimateTier.pricePhp)} to register.`
                : klass.isUserRegistered && klass.registeredAt
                  ? `Registered ${dateFmt.format(klass.registeredAt)}.`
                  : 'Free to register once you meet the tier requirement.'}
            </CardDescription>
          </CardHeader>

          <div className={detailStyles.actionBlock}>
            {meetingUrlAvailable && (
              <a
                href={klass.meetingUrl ?? '#'}
                target="_blank"
                rel="noopener"
                className={detailStyles.joinLink}
              >
                <Icon name="Video" /> Join live session
              </a>
            )}

            {!isCancelled && !hasEnded && (
              <RegisterButton
                classId={klass.id}
                isRegistered={klass.isUserRegistered === true}
                isFull={isFull}
                tierAllowed={tierCheck.allowed}
              />
            )}

            {!tierCheck.allowed && !klass.isUserRegistered && (
              <Link href="/pricing" className={detailStyles.upgradeLink}>
                See the Ultimate tier →
              </Link>
            )}
          </div>

          <div className={detailStyles.seatProgress}>
            <div className={detailStyles.seatMeta}>
              <span>{klass.registrationCount} registered</span>
              <span>{klass.maxAttendees} max</span>
            </div>
            <div className={detailStyles.seatBar} aria-hidden="true">
              <div
                className={detailStyles.seatFill}
                style={{
                  width: `${Math.min(100, (klass.registrationCount / klass.maxAttendees) * 100)}%`,
                }}
              />
            </div>
          </div>
        </Card>
      </div>
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
