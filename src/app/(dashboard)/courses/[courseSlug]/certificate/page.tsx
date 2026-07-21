import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, Badge, Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { evaluateCourseAccess } from '@/lib/tier-gate';
import {
  evaluateCourseCompletion,
  issueCertificate,
} from '@/lib/certificates';
import { logger } from '@/lib/logger';
import { IssueButton } from './IssueButton';
import styles from './certificate.module.css';

interface PageProps {
  params: Promise<{ courseSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { courseSlug } = await params;
  const course = await db.course.findUnique({ where: { slug: courseSlug } });
  if (!course) return { title: 'Not found' };
  return { title: `Certificate — ${course.title}` };
}

export default async function CertificatePage({ params }: PageProps) {
  const user = await requireAuth();
  const { courseSlug } = await params;

  const course = await db.course.findUnique({
    where: { slug: courseSlug, isPublished: true, deletedAt: null },
    select: { id: true, slug: true, title: true },
  });
  if (!course) notFound();

  const gate = await evaluateCourseAccess(user.id, courseSlug);
  if (!gate.allowed) {
    return (
      <div className={styles.page}>
        <Card>
          <CardHeader>
            <CardTitle>Upgrade required</CardTitle>
            <CardDescription>
              This course is gated to higher tiers. Certificates are reserved for enrolled
              students.
            </CardDescription>
          </CardHeader>
          <div className={styles.actions}>
            <Link href="/pricing">
              <Button variant="primary">View tiers</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const [completion, activeCert] = await Promise.all([
    evaluateCourseCompletion(user.id, course.id),
    db.certificate.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);

  // Auto-issue on page visit if eligible. This way the user sees their existing
  // cert immediately on the final lesson completion without a manual click.
  // Issuance is best-effort here: a transient failure (or a lost issuance race)
  // must not crash the whole page to the error boundary. We fall back to showing
  // progress, and the manual "Issue" button remains as a retry.
  let verificationHash: string | null = activeCert?.verificationHash ?? null;
  if (!verificationHash && completion.isComplete) {
    try {
      const issued = await issueCertificate(user.id, course.id);
      verificationHash = issued?.verificationHash ?? null;
    } catch (err) {
      logger.error(
        { err, userId: user.id, courseId: course.id },
        'Certificate auto-issue failed; showing progress fallback',
      );
      verificationHash = null;
    }
  }

  const issuedDateFmt = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CERTIFICATE OF COMPLETION</p>
        <h1 className={styles.title}>{course.title}</h1>
      </header>

      <Card className={styles.statusCard}>
        <CardHeader>
          <CardTitle>
            {verificationHash
              ? 'You earned this certificate.'
              : `You are ${completion.progressPercent}% of the way there.`}
          </CardTitle>
          <CardDescription>
            {verificationHash
              ? `Issued ${activeCert ? issuedDateFmt.format(activeCert.issuedAt) : 'today'}. Share the public verify link on LinkedIn.`
              : `Finish the remaining ${completion.totalLessons - completion.completedLessons} lesson${completion.totalLessons - completion.completedLessons === 1 ? '' : 's'} to unlock your certificate.`}
          </CardDescription>
        </CardHeader>

        {!completion.isComplete && (
          <div className={styles.progressBlock}>
            <div className={styles.progressRow}>
              <span>{completion.completedLessons}/{completion.totalLessons} lessons</span>
              <span>{completion.progressPercent}%</span>
            </div>
            <div className={styles.progressBar} aria-hidden="true">
              <div
                className={styles.progressFill}
                style={{ width: `${completion.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {verificationHash ? (
          <div className={styles.actions}>
            <a
              href={`/certificates/${verificationHash}/pdf`}
              target="_blank"
              rel="noopener"
            >
              <Button variant="primary" leftIcon={<Icon name="Download" />}>
                Download PDF
              </Button>
            </a>
            <a href={`/verify/${verificationHash}`} target="_blank" rel="noopener">
              <Button variant="secondary">Public verify link</Button>
            </a>
            <Link href="/certificates">
              <Button variant="ghost">All my certificates</Button>
            </Link>
          </div>
        ) : (
          <div className={styles.actions}>
            <Link href={`/courses/${courseSlug}`}>
              <Button variant="primary" leftIcon={<Icon name="ArrowRight" />}>
                Back to course
              </Button>
            </Link>
            <IssueButton
              courseSlug={courseSlug}
              eligible={completion.isComplete}
            />
          </div>
        )}

        {!completion.isComplete && (
          <div className={styles.lessonList}>
            <p className={styles.lessonListTitle}>Finish these lessons:</p>
            <PendingLessons userId={user.id} courseId={course.id} />
          </div>
        )}

        <Badge variant="success" className={styles.statusBadge}>
          {verificationHash ? 'READY' : 'IN PROGRESS'}
        </Badge>
      </Card>
    </div>
  );
}

async function PendingLessons({
  userId,
  courseId,
}: {
  userId: string;
  courseId: string;
}) {
  // List lessons not yet completed, capped at 8 so the page stays readable.
  const allLessons = await db.lesson.findMany({
    where: {
      deletedAt: null,
      module: { courseId, isPublished: true, deletedAt: null },
    },
    select: { id: true, slug: true, title: true, module: { select: { slug: true } } },
    take: 50,
  });

  const lessonIds = allLessons.map((l) => l.id);

  // Bolt optimization: limit query to the specific course's lessons rather than querying and loading
  // all completed lesson progress for the user. Reduces payload, DB processing, and memory overhead.
  const completedSet = new Set(
    lessonIds.length > 0
      ? (
          await db.lessonProgress.findMany({
            where: {
              userId,
              lessonId: { in: lessonIds },
              status: 'COMPLETED',
              deletedAt: null,
            },
            select: { lessonId: true },
          })
        ).map((p) => p.lessonId)
      : [],
  );

  const pending = allLessons.filter((l) => !completedSet.has(l.id)).slice(0, 8);

  return (
    <ul className={styles.lessonItems}>
      {pending.length === 0 ? (
        <li>All lessons are complete — refresh the page to issue your certificate.</li>
      ) : (
        pending.map((l) => (
          <li key={l.id}>
            <Icon name="Circle" size="sm" /> {l.title}
          </li>
        ))
      )}
    </ul>
  );
}
