import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatPhp, formatDate } from '@/lib/format';
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
    totalRevenueAgg,
    recentPayments,
    totalEnrollments,
    pendingRefunds,
  ] = await Promise.all([
    db.user.count({ where: { status: { not: 'DELETED' } } }),
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.course.count({ where: { publishedAt: { not: null } } }),
    db.userBadge.count(),
    db.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amountPhp: true },
    }),
    db.payment.findMany({
      where: { status: 'COMPLETED' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        pricingTier: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 10,
    }),
    db.enrollment.count({ where: { status: 'ACTIVE' } }),
    db.refundRequest.count({ where: { status: 'PENDING' } }),
  ]);

  const totalRevenue = totalRevenueAgg._sum.amountPhp ?? 0;

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
            <Badge variant="info">{totalEnrollments} enrollments</Badge>
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
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.statValue}>{formatPhp(totalRevenue)}</div>
            <Badge variant="success">From {publishedCourses > 0 ? publishedCourses : 0} courses</Badge>
          </CardContent>
        </Card>
      </section>

      <section className={styles.activity}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Payments</h2>
          <Link href="/admin/refunds" className={styles.viewAll}>
            View all payments <Icon name="ArrowRight" size="sm" />
          </Link>
        </div>

        {recentPayments.length === 0 ? (
          <Card>
            <CardContent>
              <p className={styles.empty}>No payments yet. Revenue will appear here once students enroll.</p>
            </CardContent>
          </Card>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Tier</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment: typeof recentPayments[number]) => (
                  <tr key={payment.id}>
                    <td>
                      <div className={styles.studentCell}>
                        <span className={styles.studentName}>
                          {payment.user?.name ?? 'Unknown'}
                        </span>
                        <span className={styles.studentEmail}>
                          {payment.user?.email}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge variant="default">{payment.pricingTier?.name ?? '—'}</Badge>
                    </td>
                    <td className={styles.amountCell}>{formatPhp(payment.amountPhp)}</td>
                    <td className={styles.dateCell}>
                      {payment.paidAt ? formatDate(payment.paidAt) : '—'}
                    </td>
                    <td>
                      <Badge variant="success">Paid</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.linksGrid}>
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
          <Link href="/admin/refunds" className={styles.quickLink}>
            <Icon name="Receipt" size="md" />
            <span>
              Review Refunds
              {pendingRefunds > 0 && (
                <Badge variant="danger" className={styles.alertBadge}>
                  {pendingRefunds}
                </Badge>
              )}
            </span>
            <Icon name="ArrowRight" size="sm" />
          </Link>

        </div>
      </section>
    </div>
  );
}
