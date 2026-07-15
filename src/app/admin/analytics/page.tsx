import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatPhp } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import styles from './analytics.module.css';

export const metadata = { title: 'Analytics — Admin' };

export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsers30d,
    activeUsers7d,
    totalRevenue,
    revenue30d,
    totalEnrollments,
    totalPayments,
  ] = await Promise.all([
    db.user.count({ where: { status: { not: 'DELETED' } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    db.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amountPhp: true } }),
    db.payment.aggregate({ where: { status: 'COMPLETED', paidAt: { gte: thirtyDaysAgo } }, _sum: { amountPhp: true } }),
    db.enrollment.count(),
    db.payment.count({ where: { status: 'COMPLETED' } }),
  ]);

  // Revenue by tier
  const revenueByTier = await db.payment.groupBy({
    by: ['pricingTierId'],
    where: { status: 'COMPLETED' },
    _sum: { amountPhp: true },
    _count: true,
  });

  const tiers = await db.pricingTier.findMany();
  const tierMap: Record<string, string> = {};
  for (const t of tiers) tierMap[t.id] = t.name;

  const totalRevenueAmt = totalRevenue._sum.amountPhp ?? 0;
  const revenue30dAmt = revenue30d._sum.amountPhp ?? 0;
  const arpu = totalPayments > 0 ? Math.round(totalRevenueAmt / totalPayments) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.subtitle}>Last 30 days</p>
      </header>

      <div className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>{totalUsers.toLocaleString()}</div>
          <div className={styles.kpiLabel}>Total Users</div>
          <div className={styles.kpiSub}>+{newUsers30d} this month</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>{activeUsers7d.toLocaleString()}</div>
          <div className={styles.kpiLabel}>Active (7 days)</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>{formatPhp(revenue30dAmt)}</div>
          <div className={styles.kpiLabel}>Revenue (30d)</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiValue}>{formatPhp(arpu)}</div>
          <div className={styles.kpiLabel}>Avg Revenue / User</div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Revenue by Tier</h2>
        <div className={styles.tierTable}>
          <div className={styles.tierHeader}>
            <span>Tier</span>
            <span>Payments</span>
            <span>Revenue</span>
            <span>Share</span>
          </div>
          {revenueByTier.map((row) => {
            const name = tierMap[row.pricingTierId] ?? '—';
            const share = totalRevenueAmt > 0 ? Math.round((row._sum.amountPhp ?? 0) / totalRevenueAmt * 100) : 0;
            return (
              <div key={row.pricingTierId} className={styles.tierRow}>
                <span className={styles.tierName}>{name}</span>
                <span>{row._count}</span>
                <span className={styles.tierRevenue}>{formatPhp(row._sum.amountPhp ?? 0)}</span>
                <span className={styles.tierShare}>{share}%</span>
              </div>
            );
          })}
          <div className={`${styles.tierRow} ${styles.tierTotal}`}>
            <span>Total</span>
            <span>{totalPayments}</span>
            <span className={styles.tierRevenue}>{formatPhp(totalRevenueAmt)}</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
