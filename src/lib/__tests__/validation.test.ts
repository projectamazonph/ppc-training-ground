import { describe, it, expect } from 'vitest';
import { signUpSchema, signInSchema, createSafeAction } from '@/lib/validation';

describe('validation.ts', () => {
  it('signUpSchema accepts valid input', () => {
    const result = signUpSchema.safeParse({ email: 'a@b.com', password: 'pass1234', name: 'Ryan' });
    expect(result.success).toBe(true);
  });

  it('signUpSchema rejects invalid email and short password', () => {
    expect(signUpSchema.safeParse({ email: 'bad', password: '123' }).success).toBe(false);
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
    expect(result.fieldErrors).toBeDefined();
  });

  it('createSafeAction returns error message on handler throw', async () => {
    const action = createSafeAction(signInSchema, async () => {
      throw new Error('boom');
    });
    const result = await action({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });
});
