'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Never render error.message — server error text can carry internals
  // (Prisma queries, file paths). The digest is safe and lets support
  // correlate with server logs / Sentry.
  return (
    <main style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p style={{ color: 'var(--ink-500)' }}>
        An unexpected error occurred. Please try again.
        {error.digest ? ` (Ref: ${error.digest})` : ''}
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
