/**
 * /courses — course catalog (index page for the (dashboard) route group).
 *
 * Shows all published courses with the student's progress on each.
 * This is the entry point students reach via the "Courses" nav link.
 */

import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { BottomNav } from '@/components/ui/BottomNav';
import { ProgressStatus } from '@/lib/enums';
import styles from './courses.module.css';

export const metadata = {
  title: 'Courses',
};

export default async function CoursesIndexPage() {
  const user = await requireAuth();

  const courses = await db.course.findMany({
    where: { isPublished: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    include: {
      modules: {
        where: { isPublished: true, deletedAt: null },
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            where: { isPublished: true, deletedAt: null },
            orderBy: { lessonNumber: 'asc' },
            select: { id: true },
          },
        },
      },
    },
  });

  // Get user's lesson progress
  const lessonProgress = await db.lessonProgress.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { lessonId: true, status: true },
  });
  const progressMap = new Map(lessonProgress.map((p) => [p.lessonId, p.status]));

  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-8) 0' }}>
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ marginBottom: 'var(--space-2)' }}>Courses</h1>
        <p style={{ color: 'var(--ink-500)' }}>
          {courses.length > 0
            ? `Browse all ${courses.length} available course${courses.length === 1 ? '' : 's'}.`
            : 'No courses published yet. Check back soon.'}
        </p>
      </header>

      <section className={styles.courseGrid}>
        {courses.map((course) => {
          const courseLessons = course.modules.flatMap((m) => m.lessons);
          const courseCompleted = courseLessons.filter(
            (l) => progressMap.get(l.id) === ProgressStatus.COMPLETED
          ).length;
          const pct = courseLessons.length > 0
            ? Math.round((courseCompleted / courseLessons.length) * 100)
            : 0;

          return (
            <Card key={course.id} variant="interactive" padding="md">
              <Link href={`/dashboard/courses/${course.slug}` as never} className={styles.courseLink}>
                <CardHeader>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <CardTitle>{course.title}</CardTitle>
                    <Badge variant="default">{course.difficulty}</Badge>
                  </div>
                  <CardDescription>{course.description}</CardDescription>
                </CardHeader>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={styles.courseMeta}>
                  <span>{courseCompleted} / {courseLessons.length} lessons</span>
                  <span>{pct}% complete</span>
                </div>
              </Link>
            </Card>
          );
        })}
      </section>

      <BottomNav active="courses" />
    </main>
  );
}
