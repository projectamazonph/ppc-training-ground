import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { ProgressStatus } from '@/lib/enums';
import { evaluateCourseAccess } from '@/lib/tier-gate';
import styles from './course.module.css';

interface PageProps {
  params: Promise<{ courseSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { courseSlug } = await params;
  const course = await db.course.findUnique({ where: { slug: courseSlug } });
  if (!course) return { title: 'Not found' };
  return { title: course.title };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { courseSlug } = await params;

  const course = await db.course.findUnique({
    where: { slug: courseSlug, isPublished: true, deletedAt: null },
    include: {
      modules: {
        where: { isPublished: true, deletedAt: null },
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            where: { isPublished: true, deletedAt: null },
            orderBy: { lessonNumber: 'asc' },
            include: {
              quiz: { select: { id: true, passThreshold: true } },
            },
          },
        },
      },
    },
  });

  if (!course) notFound();

  // Tier gate — read-only preview only. Each lesson shows a lock icon when
  // the user can't access the course; clicking still renders the TierLock screen.
  const gate = await evaluateCourseAccess(user.id, courseSlug);
  const locked = !gate.allowed;

  // Get lesson progress for the entire course
  const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const lessonProgress = allLessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId: user.id, lessonId: { in: allLessonIds }, deletedAt: null },
        select: { lessonId: true, status: true },
      })
    : [];
  const progressMap = new Map(lessonProgress.map((p) => [p.lessonId, p.status]));

  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-6) 0' }}>
      <Link href="/dashboard" style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
        ← Dashboard
      </Link>

      <header style={{ margin: 'var(--space-3) 0 var(--space-8)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Badge variant="default">{course.difficulty}</Badge>
          <Badge variant="info">{course.estimatedHours}h estimated</Badge>
        </div>
        <h1>{course.title}</h1>
        <p style={{ color: 'var(--ink-500)', maxWidth: '720px' }}>{course.description}</p>
      </header>

      {course.modules.map((module) => (
        <section key={module.id} className={styles.moduleSection}>
          <div className={styles.moduleHeader}>
            <div className={styles.moduleNumber}>Module {module.moduleNumber}</div>
            <h2>{module.title}</h2>
            <p style={{ color: 'var(--ink-500)' }}>{module.description}</p>
            <div className={styles.moduleMeta}>
              <span>{module.lessons.length} lessons</span>
              <span>~{module.estimatedMinutes} min</span>
              {locked && (
                <Badge variant="warning">
                  <Icon name="Lock" size="sm" /> Tier required
                </Badge>
              )}
            </div>
          </div>

          <ul className={styles.lessonList}>
            {module.lessons.map((lesson) => {
              const status = progressMap.get(lesson.id);
              const isComplete = status === ProgressStatus.COMPLETED;
              const isInProgress = status === ProgressStatus.IN_PROGRESS;
              return (
                <li key={lesson.id} className={styles.lessonItem}>
                  <Link
                    href={`/dashboard/courses/${course.slug}/lessons/${lesson.slug}` as never}
                    className={styles.lessonLink}
                  >
                    <div className={styles.lessonStatus}>
                      {locked ? (
                        <Icon name="Lock" size="sm" />
                      ) : isComplete ? (
                        <Icon name="Check" size="sm" />
                      ) : isInProgress ? (
                        <div className={styles.dotInProgress} />
                      ) : (
                        <div className={styles.dotPending} />
                      )}
                    </div>
                    <div className={styles.lessonContent}>
                      <div className={styles.lessonTitle}>
                        <span className={styles.lessonNumber}>
                          {module.moduleNumber}.{lesson.lessonNumber}
                        </span>
                        {lesson.title}
                      </div>
                      <div className={styles.lessonMeta}>
                        <span>{lesson.estimatedMinutes} min</span>
                        <span>·</span>
                        <span>{lesson.xpReward} XP</span>
                        {lesson.quiz && (
                          <>
                            <span>·</span>
                            <span>Quiz included</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Icon name="CaretRight" size="sm" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}