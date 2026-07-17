import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { markLessonCompleteAction, startLessonAction } from '@/app/actions/progress';
import { ProgressStatus } from '@/lib/enums';
import { renderLesson } from '@/lib/mdx';
import { evaluateCourseAccess, listActivePricingTiers } from '@/lib/tier-gate';
import { TierLock } from '@/components/dashboard/TierLock';
import styles from './lesson.module.css';

interface PageProps {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { lessonSlug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug: lessonSlug } });
  if (!lesson) return { title: 'Not found' };
  return { title: lesson.title };
}

export default async function LessonPage({ params }: PageProps) {
  const user = await requireAuth();
  const { courseSlug, lessonSlug } = await params;

  // Look up the lesson + course up-front so the gate, progress, and render all share it.
  const lesson = await db.lesson.findUnique({
    where: { slug: lessonSlug, isPublished: true, deletedAt: null },
    include: {
      module: {
        include: {
          course: true,
          lessons: {
            where: { isPublished: true, deletedAt: null },
            orderBy: { lessonNumber: 'asc' },
            select: { id: true, slug: true, title: true, lessonNumber: true },
          },
        },
      },
      quiz: {
        include: {
          questions: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!lesson || lesson.module.course.slug !== courseSlug) notFound();

  // Tier gate — render lock screen for paid content the user cannot access.
  const gate = await evaluateCourseAccess(user.id, courseSlug);
  if (!gate.allowed) {
    const pricingTiers = await listActivePricingTiers();
    return (
      <TierLock
        gate={gate}
        courseTitle={lesson.module.course.title}
        pricingTiers={pricingTiers.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description,
          tier: t.tier,
          pricePhp: t.pricePhp,
          features: t.features,
        }))}
      />
    );
  }

  // Start the lesson (creates LessonProgress if not exists, returns current state)
  await startLessonAction({
    courseSlug,
    lessonSlug,
  });

  // Get progress
  const progress = await db.lessonProgress.findFirst({
    where: { userId: user.id, lessonId: lesson.id, deletedAt: null },
  });
  const isComplete = progress?.status === ProgressStatus.COMPLETED;
  // H1: when a published quiz gates the lesson, passing it is the ONLY way to
  // complete — hide the manual button so the UI matches the server rule.
  const isQuizGated = Boolean(lesson.quiz?.isPublished);

  // Find prev/next lessons
  const moduleLessons = lesson.module.lessons;
  const currentIdx = moduleLessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? moduleLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < moduleLessons.length - 1
    ? moduleLessons[currentIdx + 1]
    : null;

  const html = renderLesson(lesson.content);

  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-6) 0' }}>
      <Link
        href={`/dashboard/courses/${courseSlug}`}
        style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}
      >
        ← {lesson.module.course.title}
      </Link>

      <header style={{ margin: 'var(--space-3) 0 var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Badge variant="default">
            Module {lesson.module.moduleNumber} · Lesson {lesson.lessonNumber}
          </Badge>
          <Badge variant="info">{lesson.estimatedMinutes} min</Badge>
          <Badge variant="success">+{lesson.xpReward} XP</Badge>
        </div>
        <h1>{lesson.title}</h1>
      </header>

      <article
        className={styles.lessonBody}
        // The content is sanitized MDX rendered to HTML server-side
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className={styles.actions}>
        {!isComplete && !isQuizGated && (
          <form
            action={
              markLessonCompleteAction
                .bind(null, { courseSlug, lessonSlug }) as unknown as (
                formData: FormData
              ) => Promise<void>
            }
          >
            <Button type="submit" variant="primary">
              <Icon name="Check" size="sm" />
              Mark as complete (+{lesson.xpReward} XP)
            </Button>
          </form>
        )}
        {!isComplete && isQuizGated && (
          <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
            Pass the knowledge check below to complete this lesson.
          </p>
        )}
        {isComplete && (
          <Badge variant="success">
            <Icon name="Check" size="sm" /> Lesson complete
          </Badge>
        )}
      </div>

      {lesson.quiz && (
        <Card padding="lg" className={styles.quizCard}>
          <CardHeader>
            <CardTitle>Knowledge check</CardTitle>
            <CardDescription>
              This lesson has a quiz. Pass with {lesson.quiz.passThreshold}% or higher to count this lesson as complete.
            </CardDescription>
          </CardHeader>
          <Link
            href={`/dashboard/courses/${courseSlug}/lessons/${lessonSlug}/quiz`}
            className={styles.ctaPrimary}
          >
            Take the quiz
          </Link>
        </Card>
      )}

      <nav className={styles.prevNext}>
        {prevLesson ? (
          <Link
            href={`/dashboard/courses/${courseSlug}/lessons/${prevLesson.slug}`}
            className={styles.prevLink}
          >
            <Icon name="CaretLeft" size="sm" />
            <div>
              <div className={styles.prevNextLabel}>Previous</div>
              <div className={styles.prevNextTitle}>
                {prevLesson.title}
              </div>
            </div>
          </Link>
        ) : <div />}
        {nextLesson && (
          <Link
            href={`/dashboard/courses/${courseSlug}/lessons/${nextLesson.slug}`}
            className={styles.nextLink}
          >
            <div>
              <div className={styles.prevNextLabel}>Next</div>
              <div className={styles.prevNextTitle}>
                {nextLesson.title}
              </div>
            </div>
            <Icon name="CaretRight" size="sm" />
          </Link>
        )}
      </nav>
    </main>
  );
}