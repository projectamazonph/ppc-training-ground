/**
 * /admin/refunds — admin queue of pending refund requests.
 *
 * Sprint 6 — STORY-028.
 *
 * Lists every PENDING refund request ordered by oldest first (FIFO).
 * Each row links to /admin/refunds/[id] for the approve/reject detail.
 * Also shows counts of PROCESSED + REJECTED this month for context.
 */

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { listPendingRefundRequests, refundStatusLabel } from '@/lib/refunds';
import { RefundStatus } from '@/lib/enums';
import styles from './refunds.module.css';

export const metadata = {
  title: 'Refund requests — Admin',
  robots: { index: false },
};

export default async function AdminRefundsPage() {
  await requireAdmin();
  const requests = await listPendingRefundRequests();

  // Quick context counts — processed + rejected this month.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [processedThisMonth, rejectedThisMonth] = await Promise.all([
    db.refundRequest.count({
      where: {
        deletedAt: null,
        status: RefundStatus.PROCESSED,
        processedAt: { gte: startOfMonth },
      },
    }),
    db.refundRequest.count({
      where: {
        deletedAt: null,
        status: RefundStatus.REJECTED,
        reviewedAt: { gte: startOfMonth },
      },
    }),
  ]);

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Admin · Billing</p>
        <h1 className={styles.title}>Refund requests</h1>
        <p className={styles.subtitle}>
          Oldest first. Approve to refund through PayMongo, or reject with a
          note for the student.
        </p>
      </header>

      <section className={styles.stats}>
        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
            <CardDescription>Awaiting your review</CardDescription>
          </CardHeader>
          <div className={styles.statValue}>{requests.length}</div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Refunded this month</CardTitle>
            <CardDescription>Completed</CardDescription>
          </CardHeader>
          <div className={styles.statValue}>{processedThisMonth}</div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rejected this month</CardTitle>
            <CardDescription>With reviewer note</CardDescription>
          </CardHeader>
          <div className={styles.statValue}>{rejectedThisMonth}</div>
        </Card>
      </section>

      {requests.length === 0 ? (
        <Card className={styles.empty}>
          <CardHeader>
            <CardTitle>Queue is empty</CardTitle>
            <CardDescription>
              Nothing waiting on you. New requests show up here in real time.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className={styles.list}>
          {requests.map((r) => {
            // eslint-disable-next-line react-hooks/purity -- safe in server component; render once per request
            const ageMs = Date.now() - r.createdAt.getTime();
            const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
            const ageLabel =
              ageHours < 1
                ? 'Just now'
                : ageHours < 24
                  ? `${ageHours}h ago`
                  : `${Math.floor(ageHours / 24)}d ago`;
            return (
              <li key={r.id}>
                <Link href={`/admin/refunds/${r.id}`} className={styles.rowLink}>
                  <Card className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowHeader}>
                        <h2 className={styles.rowTitle}>
                          {r.user.name ?? r.user.email}
                        </h2>
                        <Badge variant="warning">{refundStatusLabel(r.status)}</Badge>
                      </div>
                      <p className={styles.rowMeta}>
                        {r.payment.pricingTier.name} ·{' '}
                        {new Intl.NumberFormat('en-PH', {
                          style: 'currency',
                          currency: 'PHP',
                          maximumFractionDigits: 2,
                        }).format(r.amountPhp / 100)}{' '}
                        of{' '}
                        {new Intl.NumberFormat('en-PH', {
                          style: 'currency',
                          currency: 'PHP',
                          maximumFractionDigits: 2,
                        }).format(r.payment.amountPhp / 100)}{' '}
                        · {r.payment.method} · {ageLabel}
                      </p>
                      <p className={styles.rowReason}>
                        &ldquo;{r.reason}&rdquo;
                      </p>
                    </div>
                    <span className={styles.rowArrow}>→</span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
