import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';
import styles from './page.module.css';

export const metadata = {
  title: 'Admin Dashboard',
};

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  const [
    totalUsers,
    activeUsers,
    publishedCourses,
    badgeCount,
    totalEnrollments,
    recentEnrollments,
  ] = await Promise.all([
    db.user.count({ where: { status: { not: 'DELETED' } } }),
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.course.count({ where: { publishedAt: { not: null } } }),
    db.userBadge.count(),
    db.enrollment.count({ where: { status: 'ACTIVE' } }),
    db.enrollment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        pricingTier: { select: { name: true } },
      },
      orderBy: { enrolledAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.greeting}>Welcome, {admin.name ?? admin.email}</h1>
        <p className={styles.subtitle}>
          {`${BRAND_NAME} Admin — ${activeUsers} active users, ${publishedCourses} published courses`}
        </p>
      </header>

      <section className={styles.stats}>
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.statValue}>{totalUsers}</div>
            <Badge variant="default">{activeUsers} active</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Published Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.statValue}>{publishedCourses}</div>
            <Badge variant="info">Ready for students</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges Awarded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.statValue}>{badgeCount}</div>
            <Badge variant="success">Earned by students</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.statValue}>{totalEnrollments}</div>
            <Badge variant="success">Granted manually</Badge>
          </CardContent>
        </Card>
      </section>

      <section className={styles.activity}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Enrollments</h2>
          <Link href="/admin/enroll" className={styles.viewAll}>
            Enroll a student <Icon name="ArrowRight" size="sm" />
          </Link>
        </div>

        {recentEnrollments.length === 0 ? (
          <Card>
            <CardContent>
              <p className={styles.empty}>
                No enrollments yet. Use “Enroll a student” to grant access after
                a manual payment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Tier</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEnrollments.map(
                  (enrollment: (typeof recentEnrollments)[number]) => (
                    <tr key={enrollment.id}>
                      <td>
                        <div className={styles.studentCell}>
                          <span className={styles.studentName}>
                            {enrollment.user?.name ?? 'Unknown'}
                          </span>
                          <span className={styles.studentEmail}>
                            {enrollment.user?.email}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge variant="default">
                          {enrollment.pricingTier?.name ?? '—'}
                        </Badge>
                      </td>
                      <td className={styles.dateCell}>
                        {formatDate(enrollment.enrolledAt)}
                      </td>
                      <td>
                        <Badge
                          variant={
                            enrollment.status === 'ACTIVE' ? 'success' : 'default'
                          }
                        >
                          {enrollment.status}
                        </Badge>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.linksGrid}>
          <Link href="/admin/enroll" className={styles.quickLink}>
            <Icon name="Plus" size="md" />
            <span>Enroll Student</span>
            <Icon name="ArrowRight" size="sm" />
          </Link>
          <Link href="/admin/users" className={styles.quickLink}>
            <Icon name="User" size="md" />
            <span>Manage Users</span>
            <Icon name="ArrowRight" size="sm" />
          </Link>
          <Link href="/admin/courses" className={styles.quickLink}>
            <Icon name="BookOpen" size="md" />
            <span>Manage Courses</span>
            <Icon name="ArrowRight" size="sm" />
          </Link>
          <Link href="/admin/analytics" className={styles.quickLink}>
            <Icon name="ChartBar" size="md" />
            <span>Analytics</span>
            <Icon name="ArrowRight" size="sm" />
          </Link>
        </div>
      </section>
    </div>
  );
}
