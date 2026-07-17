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
  searchParams: Promise<{ error?: string; email?: string; next?: string; token?: string }>;
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
  const nextUrl = validateRedirectUrl(params.next);
  const claimToken = params.token ?? '';

  return (
    <main id="main-content" className={styles.authContainer}>
      <ToastProvider>
        <div className={styles.authCard}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>
            Start with the free tools. Upgrade when you&apos;re ready for the full curriculum.
          </p>

          <SignUpForm error={error} prefilledEmail={prefilledEmail} nextUrl={nextUrl} claimToken={claimToken} />

          <p className={styles.footer}>
            Already have an account? <Link href="/auth/signin">Sign in</Link>
          </p>
        </div>
      </ToastProvider>
    </main>
  );
}