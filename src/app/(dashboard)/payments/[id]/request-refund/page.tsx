/**
 * /dashboard/payments/[id]/request-refund — student refund request form.
 *
 * Sprint 6 — STORY-028.
 *
 * Server component reads the payment + re-validates the refund window
 * (defense in depth — the action re-validates too). Renders a small
 * client form that posts the reason to `createRefundRequestAction`.
 *
 * On success, redirect to /dashboard/payments with a success query param.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isWithinRefundWindow, hasBlockingRefundRequest, daysRemainingInWindow, REFUND_WINDOW_DAYS } from '@/lib/refunds';
import { RequestRefundForm } from './RequestRefundForm';
import { BRAND_NAME } from '@/lib/brand';
import styles from './request-refund.module.css';

export const metadata = {
  title: `Request a refund — ${BRAND_NAME}`,
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RequestRefundPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      userId: true,
      amountPhp: true,
      paidAt: true,
      status: true,
      pricingTier: { select: { name: true } },
    },
  });

  if (!payment || payment.userId !== user.id) {
    notFound();
  }

  // Re-validate eligibility so we don't even render the form if the user
  // is ineligible — same checks the action runs.
  if (!isWithinRefundWindow(payment.paidAt, payment.status)) {
    redirect(`/dashboard/payments?error=ineligible&id=${payment.id}`);
  }
  if (await hasBlockingRefundRequest(payment.id)) {
    redirect(`/dashboard/payments?error=already-requested&id=${payment.id}`);
  }

  const days = daysRemainingInWindow(payment.paidAt);

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Billing · Refund</p>
        <h1 className={styles.title}>Request a refund</h1>
        <p className={styles.subtitle}>
          Tell us what went wrong. We read every request personally — you&apos;ll
          hear back within one business day.
        </p>
      </header>

      <Card className={styles.summary}>
        <CardHeader>
          <CardTitle>{payment.pricingTier.name}</CardTitle>
          <CardDescription>
            Paid on{' '}
            {payment.paidAt
              ? new Intl.DateTimeFormat('en-PH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }).format(payment.paidAt)
              : '—'}
            . Refund window closes in {days} day{days === 1 ? '' : 's'}{' '}
            ({REFUND_WINDOW_DAYS}-day policy).
          </CardDescription>
        </CardHeader>
      </Card>

      <RequestRefundForm
        paymentId={payment.id}
        amountPhp={payment.amountPhp}
      />

      <p className={styles.footer}>
        Changed your mind? <Link href="/dashboard/payments">Back to payments</Link>
      </p>
    </main>
  );
}
