/**
 * /dashboard/payments — student's payment history.
 *
 * Sprint 6 — STORY-028.
 *
 * Lists every completed payment for the signed-in user with:
 *   - tier name, amount, method, paid date
 *   - current refund status (none / pending / refunded)
 *   - "Request refund" link (only if within 7-day window + no open request)
 *
 * Read-only — all actions live on /dashboard/payments/[id]/request-refund.
 */

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { requireAuth } from '@/lib/auth';
import { listUserPayments, daysRemainingInWindow, refundStatusLabel, REFUND_WINDOW_DAYS } from '@/lib/refunds';
import { formatPhp, formatDate, formatReceiptNumber } from '@/lib/format';
import { BRAND_NAME } from '@/lib/brand';
import styles from './payments.module.css';

export const metadata = {
  title: `Payments — ${BRAND_NAME}`,
};

interface PageProps {
  searchParams: Promise<{ refund?: string; error?: string; id?: string }>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const payments = await listUserPayments(user.id);
  const justRequested = params.refund === 'requested';
  const ineligible = params.error === 'ineligible';
  const alreadyRequested = params.error === 'already-requested';

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Billing</p>
        <h1 className={styles.title}>Your payments</h1>
        <p className={styles.subtitle}>
          Receipts for everything you&apos;ve paid for. Need a refund? Request it
          within {REFUND_WINDOW_DAYS} days of the original charge.
        </p>
      </header>

      {justRequested && (
        <Card className={styles.bannerSuccess}>
          <CardHeader>
            <CardTitle>Refund request sent</CardTitle>
            <CardDescription>
              We&apos;ll review it within one business day. You&apos;ll get an email
              when we make a decision.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {ineligible && (
        <Card className={styles.bannerError}>
          <CardHeader>
            <CardTitle>This payment is no longer eligible for a refund</CardTitle>
            <CardDescription>
              The 7-day window has closed or the payment status changed. Email{' '}
              <a href="mailto:[email protected]">[email protected]</a> if you need
              help.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {alreadyRequested && (
        <Card className={styles.bannerInfo}>
          <CardHeader>
            <CardTitle>A refund request already exists for this payment</CardTitle>
            <CardDescription>
              You&apos;ll see the status below once we&apos;ve reviewed it.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {payments.length === 0 ? (
        <Card className={styles.empty}>
          <CardHeader>
            <CardTitle>No payments yet</CardTitle>
            <CardDescription>
              Once you enroll in a course, the receipt shows up here.
            </CardDescription>
          </CardHeader>
          <div className={styles.emptyActions}>
            <Link href="/pricing">
              <Button variant="primary">See pricing</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {payments.map((p) => {
            const lastRequest = p.refundRequests[0] ?? null;
            const days = daysRemainingInWindow(p.paidAt);
            const canRequestRefund =
              p.status === 'COMPLETED' &&
              days > 0 &&
              (!lastRequest ||
                (lastRequest.status !== 'PENDING' && lastRequest.status !== 'APPROVED'));

            return (
              <li key={p.id}>
                <Card className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowHeader}>
                      <h2 className={styles.rowTitle}>{p.pricingTier.name}</h2>
                      <Badge
                        variant={
                          p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED'
                            ? 'default'
                            : 'success'
                        }
                      >
                        {p.status === 'COMPLETED'
                          ? 'Paid'
                          : p.status === 'REFUNDED'
                            ? 'Refunded'
                            : p.status === 'PARTIALLY_REFUNDED'
                              ? 'Partially refunded'
                              : p.status}
                      </Badge>
                    </div>
                    <p className={styles.rowMeta}>
                      {formatPhp(p.amountPhp)} · {p.method} · paid{' '}
                      {p.paidAt ? formatDate(p.paidAt) : '—'}
                    </p>
                    {p.status === 'REFUNDED' && p.refundAmountPhp !== null && (
                      <p className={styles.refundedNote}>
                        Refunded {formatPhp(p.refundAmountPhp)} on{' '}
                        {p.refundedAt ? formatDate(p.refundedAt) : '—'}
                      </p>
                    )}
                    {lastRequest && (
                      <p className={styles.refundNote}>
                        Refund request: {refundStatusLabel(lastRequest.status)}
                      </p>
                    )}
                    {p.invoice && (
                      <p className={styles.invoiceNote}>
                        <Icon name="Receipt" size="sm" /> Receipt{' '}
                        <code className={styles.receiptNumber}>
                          {formatReceiptNumber(parseInt(p.invoice.number.slice(0, 5), 10), parseInt(p.invoice.number.slice(-4), 10))}
                        </code>
                      </p>
                    )}
                    {canRequestRefund && (
                      <p className={styles.windowNote}>
                        <Icon name="Clock" size="sm" /> {days} day
                        {days === 1 ? '' : 's'} left to request a refund
                      </p>
                    )}
                  </div>
                  <div className={styles.rowActions}>
                    {p.invoice && (
                      <Link
                        href={`/api/invoices/${p.invoice.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm">
                          <Icon name="Download" size="sm" /> Receipt
                        </Button>
                      </Link>
                    )}
                    {canRequestRefund ? (
                      <Link href={`/dashboard/payments/${p.id}/request-refund`}>
                        <Button variant="secondary">Request refund</Button>
                      </Link>
                    ) : (
                      <span className={styles.lockedReason}>
                        {p.status !== 'COMPLETED'
                          ? 'Refunds not available'
                          : days <= 0
                            ? 'Refund window closed'
                            : 'Refund already requested'}
                      </span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
