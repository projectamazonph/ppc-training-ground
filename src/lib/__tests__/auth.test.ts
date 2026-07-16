import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  getAuthToken,
  getSession,
  requireAuth,
  requireAdmin,
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_TTL_SECONDS,
} from '@/lib/auth';

// ── Dynamic mocks (must be hoisted before vi.mock factories) ──────────────
const { mockCookieStore, mockDb } = vi.hoisted(() => ({
  mockCookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockDb: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('next/headers', () => ({ cookies: vi.fn(() => mockCookieStore) }));

// redirect() throws — let it propagate so async calls reject with it
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('auth.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-min-32-characters-long-aaaaaaaa';
  });

  // ── Password hashing (existing) ──────────────────────────────────────────

  it('hashPassword returns scrypt format', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it('verifyPassword accepts correct password and rejects wrong', async () => {
    const hash = await hashPassword('password123');
    expect(await verifyPassword('password123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('verifyPassword rejects malformed stored hash', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
  });

  it('verifyPassword rejects empty salt in stored hash', async () => {
    expect(await verifyPassword('x', 'scrypt$$hash')).toBe(false);
  });

  it('verifyPassword rejects wrong-length hash hex', async () => {
    expect(await verifyPassword('x', 'scrypt$salt$ab')).toBe(false);
  });

  // ── JWT sign/verify (existing) ──────────────────────────────────────────

  it('signToken and verifyToken round-trip', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'STUDENT',
      name: 'A',
    });
    const payload = await verifyToken(token);
    expect(payload).toEqual({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'STUDENT',
      name: 'A',
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
  });

  it('verifyToken returns null for invalid token', async () => {
    expect(await verifyToken('bad-token')).toBeNull();
  });

  // ── Constants (existing) ─────────────────────────────────────────────────

  it('exposes cookie name and TTL', () => {
    expect(AUTH_COOKIE_NAME).toBe('amph_auth');
    expect(AUTH_TOKEN_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });

  // ── getSecret edge cases (lines 27-32) ──────────────────────────────────

  it('throws when JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;
    await expect(
      signToken({ sub: 'u1', email: 'a@b.com', role: 'STUDENT', name: null }),
    ).rejects.toThrow('JWT_SECRET environment variable is not set');
  });

  it('throws when JWT_SECRET is too short', async () => {
    process.env.JWT_SECRET = 'short';
    await expect(
      signToken({ sub: 'u1', email: 'a@b.com', role: 'STUDENT', name: null }),
    ).rejects.toThrow('JWT_SECRET must be at least 32 characters');
  });

  // ── Cookie helpers (lines 93-112) ───────────────────────────────────────

  it('setAuthCookie sets httpOnly secure cookie with defaults', async () => {
    await setAuthCookie('tok-1');
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'amph_auth',
      'tok-1',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it('clearAuthCookie deletes the cookie', async () => {
    await clearAuthCookie();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('amph_auth');
  });

  it('getAuthToken returns token from cookie', async () => {
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: 'tok-1' });
    expect(await getAuthToken()).toBe('tok-1');
  });

  it('getAuthToken returns null when no auth cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getAuthToken()).toBeNull();
  });

  // ── getSession (lines 128-150) ──────────────────────────────────────────

  it('getSession returns null when no auth token', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  it('getSession returns null when token verification fails', async () => {
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: 'bad-token' });
    expect(await getSession()).toBeNull();
  });

  it('getSession returns session when token valid and user exists', async () => {
    const token = await signToken({
      sub: 'u1', email: 'a@b.com', role: 'STUDENT', name: 'Alice',
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue({
      xp: 100, level: 5, streakDays: 3, status: 'ACTIVE', deletedAt: null,
    });

    const session = await getSession();
    expect(session).toEqual({
      id: 'u1', email: 'a@b.com', name: 'Alice', role: 'STUDENT',
      xp: 100, level: 5, streakDays: 3,
    });
  });

  it('getSession returns null when user no longer exists', async () => {
    const token = await signToken({
      sub: 'u2', email: 'b@b.com', role: 'ADMIN', name: null,
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue(null);

    expect(await getSession()).toBeNull();
  });

  it('getSession returns null when user is suspended', async () => {
    const token = await signToken({
      sub: 'u2', email: 'b@b.com', role: 'ADMIN', name: null,
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue({
      xp: 0, level: 1, streakDays: 0, status: 'SUSPENDED', deletedAt: null,
    });

    expect(await getSession()).toBeNull();
  });

  it('getSession returns null when user is soft-deleted', async () => {
    const token = await signToken({
      sub: 'u2', email: 'b@b.com', role: 'ADMIN', name: null,
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue({
      xp: 0, level: 1, streakDays: 0, status: 'ACTIVE', deletedAt: new Date(),
    });

    expect(await getSession()).toBeNull();
  });

  // ── requireAuth / requireAdmin (lines 152-166) ──────────────────────────

  it('requireAuth returns user when session exists', async () => {
    const token = await signToken({
      sub: 'u1', email: 'a@b.com', role: 'STUDENT', name: 'A',
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue({ xp: 0, level: 1, streakDays: 0, status: 'ACTIVE', deletedAt: null });

    const user = await requireAuth();
    expect(user.id).toBe('u1');
  });

  it('requireAuth redirects when no session', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT');
  });

  it('requireAdmin returns user when role is ADMIN', async () => {
    const token = await signToken({
      sub: 'u1', email: 'admin@b.com', role: 'ADMIN', name: 'Admin',
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue({ xp: 0, level: 1, streakDays: 0, status: 'ACTIVE', deletedAt: null });

    const user = await requireAdmin();
    expect(user.role).toBe('ADMIN');
  });

  it('requireAdmin redirects when role is not ADMIN', async () => {
    const token = await signToken({
      sub: 'u1', email: 'a@b.com', role: 'STUDENT', name: 'A',
    });
    mockCookieStore.get.mockReturnValue({ name: 'amph_auth', value: token });
    mockDb.user.findUnique.mockResolvedValue({ xp: 0, level: 1, streakDays: 0, status: 'ACTIVE', deletedAt: null });

    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT');
  });

  // ── verifyToken: invalid payload shape (lines 80-81) ────────────────────

  it('verifyToken returns null when payload fields have wrong types', async () => {
    const encoder = new TextEncoder();
    const badToken = await new SignJWT(
      { sub: 123, email: 'a@b.com', role: 'STUDENT' } as unknown as ConstructorParameters<typeof SignJWT>[0],
    )
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encoder.encode(process.env.JWT_SECRET!));

    expect(await verifyToken(badToken)).toBeNull();
  });
});
