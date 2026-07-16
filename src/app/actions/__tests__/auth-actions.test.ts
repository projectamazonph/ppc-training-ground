import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInAction, signUpAction, signOutAction } from '@/app/actions/auth';

const mockSignToken = vi.fn();
const mockSetAuthCookie = vi.fn();
const mockClearAuthCookie = vi.fn();
const mockVerifyPassword = vi.fn();
const mockHashPassword = vi.fn().mockReturnValue('hashed-pw');

vi.mock('@/lib/auth', () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  signToken: (...args: unknown[]) => mockSignToken(...args),
  setAuthCookie: (...args: unknown[]) => mockSetAuthCookie(...args),
  clearAuthCookie: (...args: unknown[]) => mockClearAuthCookie(...args),
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { db } from '@/lib/db';

describe('auth actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSignToken.mockResolvedValue('token');
  });

  it('signInAction rejects unknown email', async () => {
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await signInAction({ email: 'nobody@example.com', password: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Email or password is incorrect.');
  });

  it('signInAction rejects suspended account', async () => {
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1', email: 'a@b.com', passwordHash: 'x', status: 'SUSPENDED', role: 'STUDENT', name: null, emailVerified: null, lastActiveAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });
    const result = await signInAction({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('This account is suspended. Contact support.');
  });

  it('signInAction succeeds for active user with valid password', async () => {
    mockVerifyPassword.mockReturnValue(true);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1', email: 'a@b.com', passwordHash: 'x', status: 'ACTIVE', role: 'STUDENT', name: 'A', emailVerified: new Date(), lastActiveAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });
    const result = await signInAction({ email: 'a@b.com', password: 'correct' });
    expect(result.success).toBe(true);
  });

  it('signUpAction creates new user when email is new', async () => {
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.user.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u2', email: 'new@b.com', name: 'New', role: 'STUDENT', status: 'ACTIVE', emailVerified: null, lastActiveAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });
    const result = await signUpAction({ email: 'new@b.com', password: 'pass1234', confirmPassword: 'pass1234', name: 'New' });
    expect(result.success).toBe(true);
    expect((result as any).data.userId).toBe('u2');
  });

  it('signOutAction clears cookie and returns ok', async () => {
    const result = await signOutAction();
    expect(result.success).toBe(true);
    expect((result as any).data.ok).toBe(true);
  });
});
