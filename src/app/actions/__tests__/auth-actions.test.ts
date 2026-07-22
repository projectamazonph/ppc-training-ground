import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInAction, signUpAction, signOutAction } from '@/app/actions/auth';
import { PLACEHOLDER_PASSWORD_PREFIX } from '@/lib/claim-token';

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
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

let currentTestIp = '127.0.0.1';

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => ({
    get: (name: string) => {
      if (name === 'x-forwarded-for') return currentTestIp;
      return null;
    },
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

  // C6: guest-checkout placeholder accounts can only be claimed with the
  // single-use token emailed to the buyer.
  const placeholderUser = {
    id: 'u-guest',
    email: 'guest@b.com',
    name: 'Guest',
    role: 'STUDENT',
    status: 'ACTIVE',
    passwordHash: 'placeholder_abc123',
    emailVerified: null,
    lastActiveAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  it('signUpAction refuses to claim a placeholder without a token', async () => {
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(placeholderUser);
    const result = await signUpAction({ email: 'guest@b.com', password: 'pass1234', confirmPassword: 'pass1234' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/claim link/i);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('signUpAction rejects an invalid or expired claim token', async () => {
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(placeholderUser);
    // Guarded update matches zero rows → token invalid/expired/already used.
    (db.user.updateMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const result = await signUpAction({ email: 'guest@b.com', password: 'pass1234', confirmPassword: 'pass1234', claimToken: 'wrong-token' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/invalid or has expired/i);
  });

  it('signUpAction claims a placeholder with a valid token (atomic consume)', async () => {
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(placeholderUser);
    (db.user.updateMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    const result = await signUpAction({ email: 'guest@b.com', password: 'pass1234', confirmPassword: 'pass1234', claimToken: 'right-token' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.userId).toBe('u-guest');
    // The consume is a guarded updateMany, not a blind update. Every predicate
    // that protects against takeover/replay must be asserted so removing any of
    // them fails this test: id, placeholder marker, token hash, and expiry.
    expect(db.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'u-guest',
          passwordHash: { startsWith: PLACEHOLDER_PASSWORD_PREFIX },
          claimTokenHash: expect.any(String),
          claimTokenExpiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
        data: expect.objectContaining({ claimTokenHash: null, claimTokenExpiresAt: null }),
      }),
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('signOutAction clears cookie and returns ok', async () => {
    const result = await signOutAction();
    expect(result.success).toBe(true);
    expect((result as any).data.ok).toBe(true);
  });

  it('signInAction rate limits by email after 5 attempts', async () => {
    mockVerifyPassword.mockReturnValue(false);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1', email: 'ratelimit-email@example.com', passwordHash: 'x', status: 'ACTIVE', role: 'STUDENT', name: 'A', emailVerified: new Date(), lastActiveAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });

    for (let i = 0; i < 5; i++) {
      const result = await signInAction({ email: 'ratelimit-email@example.com', password: 'wrong' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Email or password is incorrect.');
      }
    }

    const result = await signInAction({ email: 'ratelimit-email@example.com', password: 'wrong' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Too many attempts.');
    }
  });

  it('signInAction rate limits by IP after 10 attempts with different emails', async () => {
    currentTestIp = '192.168.1.50'; // Use a fresh IP address to avoid prior test interference
    mockVerifyPassword.mockReturnValue(false);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1', email: 'irrelevant@example.com', passwordHash: 'x', status: 'ACTIVE', role: 'STUDENT', name: 'A', emailVerified: new Date(), lastActiveAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });

    for (let i = 0; i < 10; i++) {
      const result = await signInAction({ email: `ip-test-${i}@example.com`, password: 'wrong' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Email or password is incorrect.');
      }
    }

    const result = await signInAction({ email: 'ip-test-blocked@example.com', password: 'wrong' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Too many attempts from this IP.');
    }
  });
});
