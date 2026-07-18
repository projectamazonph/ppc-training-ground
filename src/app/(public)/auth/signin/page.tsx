import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { validateRedirectUrl } from '@/lib/redirect-url';
import { ToastProvider } from '@/components/ui/Toast';
import { SignInForm } from './SignInForm';
import styles from './auth.module.css';

export const metadata = {
  title: 'Sign In',
};

interface PageProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  // Already signed in? Bounce to home.
  const session = await getSession();
  if (session) {
    if (session.role === 'ADMIN') redirect('/admin');
    redirect('/');
  }

  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;
  // C3: validate the redirect target before it can ever reach router.push().
  const safeRedirect = validateRedirectUrl(params.redirect);

  return (
    <main id="main-content" className={styles.authContainer}>
      <ToastProvider>
        <div className={styles.authCard}>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>Welcome back. Sign in to continue learning.</p>

          <SignInForm error={error} redirectTo={safeRedirect} />

          <p className={styles.footer}>
            New here? <Link href="/auth/signup">Create an account</Link>
          </p>
        </div>
      </ToastProvider>
    </main>
  );
}