import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { validateRedirectUrl } from '@/lib/redirect-url';
import { ToastProvider } from '@/components/ui/Toast';
import { SignUpForm } from './SignUpForm';
import styles from '../signin/auth.module.css';

export const metadata = {
  title: 'Create Account',
};

interface PageProps {
  // STORY-027: guest checkout completion forwards the payer's email and a
  // `next` return URL so the form prefills and redirects back to checkout.
  // `claim` carries the single-use account-claim token minted for a guest
  // purchase (see sendAccountClaimEmail) — required to upgrade a placeholder
  // account instead of hitting "email already exists" (C5/C6).
  searchParams: Promise<{ error?: string; email?: string; next?: string; claim?: string }>;
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (session) {
    if (session.role === 'ADMIN') redirect('/admin');
    redirect('/');
  }

  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;
  const prefilledEmail = params.email ?? '';
  // C3: `next` is attacker-controlled query input — validate before it can
  // ever reach a redirect() or router.push().
  const nextUrl = validateRedirectUrl(params.next);
  const claimToken = params.claim ?? undefined;

  return (
    <main id="main-content" className={styles.authContainer}>
      <ToastProvider>
        <div className={styles.authCard}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>
            Start with the free tools. Upgrade when you&apos;re ready for the full curriculum.
          </p>

          <SignUpForm
            error={error}
            prefilledEmail={prefilledEmail}
            nextUrl={nextUrl}
            claimToken={claimToken}
          />

          <p className={styles.footer}>
            Already have an account? <Link href="/auth/signin">Sign in</Link>
          </p>
        </div>
      </ToastProvider>
    </main>
  );
}