import { describe, it, expect } from 'vitest';
import { signUpSchema, signInSchema, createSafeAction } from '@/lib/validation';

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
});
