import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link href="/">Go home</Link>
    </main>
  );
}
