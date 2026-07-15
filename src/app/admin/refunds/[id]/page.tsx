/**
 * /admin/refunds/[id] — approve or reject a refund request.
 *
 * Sprint 6 — STORY-028.
 *
 * Server component loads the full request detail. Renders a client
 * detail view that wires approve + reject actions. Both actions go
 * through server actions in `src/app/actions/refunds.ts`.
 *
 * After PROCESSED, the page shows the PayMongo refund id. The webhook
 * will update Payment + Enrollment independently (handles enrollment
 * soft-bump to REFUNDED).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { getRefundRequestDetail, refundStatusLabel } from '@/lib/refunds';
import { RefundDecisionForm } from './RefundDecisionForm';
import styles from './detail.module.css';

export const metadata = {
  title: 'Refund request — Admin',
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminRefundDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const request = await getRefundRequestDetail(id);
  if (!request) notFound();

  const php = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(amount / 100); // money fields store centavos

  const dateLong = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(date)
      : '—';

  const isPending = request.status === 'PENDING';
  const variant: 'success' | 'default' | 'danger' | 'warning' =
    request.status === 'PROCESSED'
      ? 'success'
      : request.status === 'REJECTED'
        ? 'default'
        : request.status === 'FAILED'
          ? 'danger'
          : 'warning';

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/refunds" className={styles.backLink}>
          ← Back to queue
        </Link>
        <p className={styles.eyebrow}>Admin · Billing · Refund</p>
        <h1 className={styles.title}>{request.user.name ?? request.user.email}</h1>
        <div className={styles.statusRow}>
          <Badge variant={variant}>{refundStatusLabel(request.status)}</Badge>
          <span className={styles.requestedAt}>
            Requested {dateLong(request.createdAt)}
          </span>
        </div>
      </header>

      <section className={styles.summary}>
        <Card>
          <CardHeader>
            <CardTitle>{request.payment.pricingTier.name}</CardTitle>
            <CardDescription>
              Paid {php(request.payment.amountPhp)} via {request.payment.method} on{' '}
              {dateLong(request.payment.paidAt)}
            </CardDescription>
          </CardHeader>
          <div className={styles.amountGrid}>
            <div className={styles.amountCell}>
              <span className={styles.amountLabel}>Refund amount</span>
              <span className={styles.amountValue}>{php(request.amountPhp)}</span>
            </div>
            <div className={styles.amountCell}>
              <span className={styles.amountLabel}>Original payment</span>
              <span className={styles.amountValue}>
                {php(request.payment.amountPhp)}
              </span>
            </div>
            <div className={styles.amountCell}>
              <span className={styles.amountLabel}>Payment status</span>
              <span className={styles.amountValueSm}>{request.payment.status}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className={styles.reasonSection}>
        <Card>
          <CardHeader>
            <CardTitle>Student&apos;s reason</CardTitle>
          </CardHeader>
          <blockquote className={styles.reason}>{request.reason}</blockquote>
          <p className={styles.studentMeta}>
            <Link href={`mailto:${request.user.email}`} className={styles.emailLink}>
              {request.user.email}
            </Link>
          </p>
        </Card>
      </section>

      {request.status === 'PROCESSED' && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Refund completed</CardTitle>
              <CardDescription>
                PayMongo refund id:{' '}
                <code className={styles.code}>{request.paymongoRefundId ?? '—'}</code>
              </CardDescription>
            </CardHeader>
            <p className={styles.completedMeta}>
              Processed {dateLong(request.processedAt)} · Reviewed by{' '}
              {request.reviewedBy?.name ?? request.reviewedBy?.email ?? '—'}
            </p>
            {request.reviewerNotes && (
              <p className={styles.reviewerNotes}>
                <strong>Reviewer note:</strong> {request.reviewerNotes}
              </p>
            )}
          </Card>
        </section>
      )}

      {request.status === 'REJECTED' && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Refund rejected</CardTitle>
              <CardDescription>
                Reviewed {dateLong(request.reviewedAt)} by{' '}
                {request.reviewedBy?.name ?? request.reviewedBy?.email ?? '—'}
              </CardDescription>
            </CardHeader>
            {request.reviewerNotes && (
              <p className={styles.reviewerNotes}>
                <strong>Note to student:</strong> {request.reviewerNotes}
              </p>
            )}
          </Card>
        </section>
      )}

      {request.status === 'FAILED' && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Refund failed</CardTitle>
              <CardDescription>
                The PayMongo API call returned an error. You can try again by
                approving once the issue is resolved.
              </CardDescription>
            </CardHeader>
            {request.failureReason && (
              <p className={styles.failureReason}>
                <code className={styles.code}>{request.failureReason}</code>
              </p>
            )}
          </Card>
        </section>
      )}

      {isPending && (
        <section>
          <RefundDecisionForm requestId={request.id} />
        </section>
      )}
    </main>
  );
}
