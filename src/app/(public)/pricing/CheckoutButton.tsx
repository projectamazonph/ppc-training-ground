'use client';

/**
 * Checkout button — kicks off PayMongo checkout.
 *
 * Sprint 6 — STORY-026.
 *
 * Calls `createCheckoutSessionAction` server action, then redirects the
 * user to the PayMongo-hosted checkout page. Holds local state for email
 * (guest users enter it here; logged-in users get the default).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  createCheckoutSessionAction,
  validateDiscountCodeAction,
} from '@/app/actions/checkout';
import styles from './checkout-button.module.css';

export function CheckoutButton({
  pricingTierId,
  tierName,
  defaultEmail,
  isFeatured,
}: {
  pricingTierId: string;
  tierName: string;
  defaultEmail: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountNote, setDiscountNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function applyDiscount() {
    setDiscountNote(null);
    if (!discountCode.trim()) {
      setDiscountNote('Enter a code first.');
      return;
    }
    const result = await validateDiscountCodeAction({
      pricingTierId,
      email: email || 'placeholder@amph.local',
      discountCode,
    });
    if (!result.success) {
      setDiscountNote(result.error);
      return;
    }
    if (!result.data.valid) {
      setDiscountNote(result.data.error ?? 'Code not valid for this tier.');
      return;
    }
    const amount = (result.data.discountAmountCentavos / 100).toLocaleString('en-PH');
    setDiscountNote(`Discount applied — you save ₱${amount}.`);
  }

  function handleCheckout() {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email so we can send you the course access link.');
      return;
    }
    startTransition(async () => {
      const result = await createCheckoutSessionAction({
        pricingTierId,
        email,
        name: name.trim() || undefined,
        discountCode: discountCode.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Hand-off to PayMongo-hosted checkout.
      // Using window.location instead of router.push because it's a cross-origin redirect.
      window.location.href = result.data.checkoutUrl;
    });
  }

  return (
    <div className={styles.wrapper}>
      {!defaultEmail && (
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={styles.input}
            autoComplete="email"
          />
        </label>
      )}
      {!defaultEmail && (
        <label className={styles.field}>
          <span>Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className={styles.input}
            autoComplete="name"
          />
        </label>
      )}

      <label className={styles.field}>
        <span>Discount code (optional)</span>
        <div className={styles.discountRow}>
          <input
            type="text"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            placeholder="PILOT100"
            className={styles.input}
          />
          <button
            type="button"
            onClick={applyDiscount}
            className={styles.applyBtn}
            disabled={isPending}
          >
            Apply
          </button>
        </div>
        {discountNote && <p className={styles.note}>{discountNote}</p>}
      </label>

      <Button
        variant={isFeatured ? 'primary' : 'secondary'}
        size="lg"
        onClick={handleCheckout}
        loading={isPending}
        className={styles.checkoutBtn}
      >
        Pay for {tierName}
      </Button>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
