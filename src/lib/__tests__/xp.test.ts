import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  xpLedger: { create: vi.fn() },
  user: { update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('server-only', () => ({}));

import { awardXpOnce } from '@/lib/xp';

/** Error shaped like Prisma's unique-constraint violation. */
function p2002(): Error {
  const err = new Error('Unique constraint failed') as Error & { code: string };
  err.code = 'P2002';
  return err;
}

describe('awardXpOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(
      async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb),
    );
  });

  it('inserts the ledger row then increments XP, returning true', async () => {
    mockDb.xpLedger.create.mockResolvedValue({ id: 'x1' });
    mockDb.user.update.mockResolvedValue({});

    const awarded = await awardXpOnce('u1', 'lesson-complete:l1', 50, 'Lesson completed');

    expect(awarded).toBe(true);
    expect(mockDb.xpLedger.create).toHaveBeenCalledWith({
      data: { userId: 'u1', eventKey: 'lesson-complete:l1', amount: 50, reason: 'Lesson completed' },
    });
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ xp: { increment: 50 } }),
      }),
    );
  });

  it('returns false without double-incrementing on a duplicate event (P2002)', async () => {
    // Ledger insert is first — a duplicate event key aborts the transaction.
    mockDb.xpLedger.create.mockRejectedValue(p2002());

    const awarded = await awardXpOnce('u1', 'lesson-complete:l1', 50, 'Lesson completed');

    expect(awarded).toBe(false);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it('rethrows non-unique errors', async () => {
    mockDb.xpLedger.create.mockRejectedValue(new Error('connection lost'));

    await expect(
      awardXpOnce('u1', 'lesson-complete:l1', 50, 'Lesson completed'),
    ).rejects.toThrow('connection lost');
  });
});
