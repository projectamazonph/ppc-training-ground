import { describe, it, expect } from 'vitest';
import { signUpSchema, signInSchema, createSafeAction } from '@/lib/validation';
import { validateRedirectUrl } from '@/lib/redirect-url';

describe('validation.ts', () => {
  it('signUpSchema accepts valid input', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      password: 'pass1234',
      confirmPassword: 'pass1234',
      name: 'Ryan',
    });
    expect(result.success).toBe(true);
  });

  it('signUpSchema rejects invalid email and short password', () => {
    expect(signUpSchema.safeParse({ email: 'bad', password: '123', confirmPassword: '123' }).success).toBe(false);
  });

  it('signUpSchema rejects mismatched password confirmation', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      password: 'pass1234',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
  });

  it('signInSchema accepts valid input', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('createSafeAction returns success on valid handler', async () => {
    const action = createSafeAction(signInSchema, async () => ({ ok: true }));
    const result = await action({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('createSafeAction returns fieldErrors on validation failure', async () => {
    const action = createSafeAction(signInSchema, async () => ({ ok: true }));
    const result = await action({ email: 'bad', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors).toBeDefined();
  });

  it('createSafeAction returns error message on plain Error throw', async () => {
    const action = createSafeAction(signInSchema, async () => {
      throw new Error('boom');
    });
    const result = await action({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('boom');
  });

  it('createSafeAction hides subclassed (internal) error messages', async () => {
    class FakePrismaError extends Error {
      constructor() {
        super('Invalid `prisma.user.create()` invocation — secret internals');
        this.name = 'PrismaClientKnownRequestError';
      }
    }
    const action = createSafeAction(signInSchema, async () => {
      throw new FakePrismaError();
    });
    const result = await action({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Something went wrong. Please try again.');
      expect(result.error).not.toContain('prisma');
    }
  });

  // ── validateRedirectUrl (C3 / XSS defence) ──────────────────────────────

  it('validateRedirectUrl allows valid internal path', () => {
    expect(validateRedirectUrl('/dashboard')).toBe('/dashboard');
    expect(validateRedirectUrl('/auth/signin')).toBe('/auth/signin');
    expect(validateRedirectUrl('/checkout/complete?status=success')).toBe('/checkout/complete?status=success');
  });

  it('validateRedirectUrl rejects external URLs with scheme', () => {
    expect(validateRedirectUrl('https://evil.com')).toBe('/');
    expect(validateRedirectUrl('javascript:alert(1)')).toBe('/');
    expect(validateRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/');
    expect(validateRedirectUrl('file:///etc/passwd')).toBe('/');
  });

  it('validateRedirectUrl rejects double-slash paths', () => {
    expect(validateRedirectUrl('//evil.com')).toBe('/');
    expect(validateRedirectUrl('//google.com')).toBe('/');
  });

  it('validateRedirectUrl rejects paths with control characters', () => {
    // Use actual control characters via String.fromCharCode
    expect(validateRedirectUrl('/path' + String.fromCharCode(10))).toBe('/');
    expect(validateRedirectUrl('/path' + String.fromCharCode(13))).toBe('/');
    expect(validateRedirectUrl('/path' + String.fromCharCode(0))).toBe('/');
  });

  it('validateRedirectUrl returns fallback for null/undefined/empty', () => {
    expect(validateRedirectUrl(null)).toBe('/');
    expect(validateRedirectUrl(undefined)).toBe('/');
    expect(validateRedirectUrl('')).toBe('/');
    expect(validateRedirectUrl('  ')).toBe('/');
  });

  it('validateRedirectUrl uses custom fallback', () => {
    expect(validateRedirectUrl('https://evil.com', '/fallback')).toBe('/fallback');
    expect(validateRedirectUrl(null, '/custom')).toBe('/custom');
  });

  it('validateRedirectUrl rejects encoded scheme attacks', () => {
    expect(validateRedirectUrl('/%6A%61%76%61%73%63%72%69%70%74:alert(1)')).toBe('/');
  });

  it('validateRedirectUrl rejects paths starting with scheme prefix', () => {
    expect(validateRedirectUrl('/https://evil.com')).toBe('/');
    expect(validateRedirectUrl('/http://phishing.com')).toBe('/');
  });
});
