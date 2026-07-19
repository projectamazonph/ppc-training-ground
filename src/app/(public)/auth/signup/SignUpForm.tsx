'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { Toast } from '@/components/ui/Toast';
import { signUpAction } from '@/app/actions/auth';
import styles from '../signin/auth.module.css';

interface SignUpFormProps {
  error: string | null;
  prefilledEmail?: string;
  nextUrl?: string;
  claimToken?: string;
}

export function SignUpForm({
  error: initialError,
  prefilledEmail = '',
  nextUrl = '/',
  claimToken,
}: SignUpFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const { toast } = Toast.useToast();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const result = await signUpAction({
      email: formData.get('email'),
      password,
      confirmPassword,
      name: (formData.get('name') as string) || undefined,
      claimToken: (formData.get('claimToken') as string) || undefined,
    });
    if (result.success) {
      // STORY-027: respect the `next` param so guest checkout returns to
      // /checkout/complete (now signed in → falls through to SuccessCard).
      router.push(nextUrl || '/');
      router.refresh();
      toast('Account created', 'success');
    } else {
      setError(result.error);
    }
  }

  return (
    <form action={(formData) => startTransition(() => handleSubmit(formData))} className={styles.form}>
      {error && <div className={styles.errorBanner} role="alert">{error}</div>}
      {claimToken && <input type="hidden" name="claimToken" value={claimToken} />}
      <Input label="Name" type="text" name="name" autoComplete="name" placeholder="Maria Cruz" />
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        defaultValue={prefilledEmail}
        readOnly={Boolean(claimToken)}
        hint={
          claimToken
            ? 'This claim link is tied to this email.'
            : prefilledEmail
              ? 'From your checkout. Change if needed.'
              : undefined
        }
        placeholder="[email protected]"
      />
      <Input label="Password" type="password" name="password" autoComplete="new-password" required hint="At least 8 characters." />
      <Input label="Confirm password" type="password" name="confirmPassword" autoComplete="new-password" required />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={isPending}>
        Create account
      </Button>
    </form>
  );
}