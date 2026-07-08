import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { updateCourseAction, addModuleAction } from '@/app/actions/admin-courses';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import Link from 'next/link';
import styles from './course-detail.module.css';

export const metadata = { title: 'Edit Course — Admin' };

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      pricingTier: true,
      modules: {
        orderBy: { order: 'asc' },
        include: {
          lessons: { orderBy: { lessonNumber: 'asc' }, select: { id: true, title: true, lessonNumber: true, type: true, isPublished: true } },
        },
      },
    },
  });
  if (!course) notFound();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/courses" className={styles.back}>
          <Icon name="CaretLeft" size="sm" /> Courses
        </Link>
      </header>

      <div className={styles.layout}>
        {/* Main: modules + lessons */}
        <main className={styles.main}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Modules & Lessons</h2>
          </div>

          {course.modules.length === 0 ? (
            <div className={styles.empty}>No modules yet. Add the first one below.</div>
          ) : (
            <div className={styles.moduleList}>
              {course.modules.map((mod) => (
                <div key={mod.id} className={styles.module}>
                  <div className={styles.moduleHeader}>
                    <span className={styles.moduleNum}>M{mod.moduleNumber}</span>
                    <div className={styles.moduleInfo}>
                      <span className={styles.moduleTitle}>{mod.title}</span>
                      <span className={styles.moduleMeta}>
                        {mod.lessons.length} lessons · {mod.estimatedMinutes} min
                      </span>
                    </div>
                    <Badge variant={mod.isPublished ? 'success' : 'default'}>
                      {mod.isPublished ? 'Live' : 'Draft'}
                    </Badge>
                  </div>
                  {mod.lessons.length > 0 && (
                    <div className={styles.lessonList}>
                      {mod.lessons.map((les) => (
                        <div key={les.id} className={styles.lesson}>
                          <span className={styles.lessonNum}>L{les.lessonNumber}</span>
                          <span className={styles.lessonTitle}>{les.title}</span>
                          <Badge variant="default" className={styles.typeBadge}>
                            {les.type}
                          </Badge>
                          <Badge variant={les.isPublished ? 'success' : 'default'}>
                            {les.isPublished ? 'Live' : 'Draft'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Sidebar: course metadata */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Course Settings</h3>
            <dl className={styles.dl}>
              <dt>Title</dt><dd>{course.title}</dd>
              <dt>Slug</dt><dd className={styles.mono}>{course.slug}</dd>
              <dt>Difficulty</dt><dd>{course.difficulty}</dd>
              <dt>Pricing</dt><dd>{course.pricingTier?.name ?? '—'}</dd>
              <dt>Estimated Hours</dt><dd>{course.estimatedHours}h</dd>
              <dt>Sort Order</dt><dd>{course.sortOrder}</dd>
              <dt>Status</dt>
              <dd>
                <Badge variant={course.isPublished ? 'success' : 'default'}>
                  {course.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </dd>
              <dt>Published At</dt><dd>{course.publishedAt ? formatDate(course.publishedAt) : '—'}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
