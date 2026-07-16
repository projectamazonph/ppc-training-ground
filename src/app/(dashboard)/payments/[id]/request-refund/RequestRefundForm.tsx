'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, Button } from '@/components/ui';
import { Toast } from '@/components/ui/Toast';
import { createRefundRequestAction } from '@/app/actions/refunds';
import styles from './request-refund.module.css';

interface FormProps {
  paymentId: string;
  amountPhp: number;
}

export function RequestRefundForm({ paymentId, amountPhp }: FormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = Toast.useToast();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createRefundRequestAction({
      paymentId,
      reason: formData.get('reason') as string,
    });
    if (result.success) {
      toast('Refund request sent', 'success');
      router.push('/dashboard/payments?refund=requested');
      router.refresh();
      return;
    }
    setError(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reason for refund</CardTitle>
        <CardDescription>
          Minimum 10 characters. Be specific — &quot;wrong tier for me&quot; is more
          helpful than &quot;changed mind&quot;.
        </CardDescription>
      </CardHeader>
      <form
        action={(formData) => startTransition(() => handleSubmit(formData))}
        className={styles.form}
      >
        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}
        <div className={styles.amount}>
          <span className={styles.amountLabel}>Refund amount</span>
          <span className={styles.amountValue}>
            {new Intl.NumberFormat('en-PH', {
              style: 'currency',
              currency: 'PHP',
              maximumFractionDigits: 2,
            }).format(amountPhp / 100)}
          </span>
          <span className={styles.amountNote}>Full refund only at this stage.</span>
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="reason" className={styles.label}>
            Why are you requesting a refund?
            <span className={styles.required} aria-hidden="true">*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={5}
            className={styles.textarea}
            placeholder="Tell us what didn't work for you. The more specific, the better."
          />
          <p className={styles.hint}>At least 10 characters. Up to 500.</p>
        </div>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" size="lg" loading={isPending}>
            Submit refund request
          </Button>
        </div>
      </form>
    </Card>
  );
}
