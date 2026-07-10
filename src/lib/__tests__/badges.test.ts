import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { evaluateBadges } from '@/lib/badges';
import { BadgeCriteria } from '@/lib/badges';
import { CourseTier } from '@/lib/enums';

const txMock = {
  userBadge: { create: vi.fn() },
  user: { update: vi.fn() },
};

vi.mock('@/lib/db', () => {
  const m = {
    badge: { findMany: vi.fn() },
    userBadge: { findMany: vi.fn() },
    lessonProgress: { count: vi.fn() },
    toolSession: { count: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  return { db: { ...m, $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)) } };
});

describe('badges.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.toolSession.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('returns no awards when no badges earned', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toEqual([]);
    expect(result.totalXpGained).toBe(0);
  });

  it('is idempotent when badge already awarded', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ badgeId: 'b1' }]);
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toEqual([]);
  });

  it('awards xp_threshold badge when criteria met', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'XP', slug: 'xp', criteria: JSON.stringify({ type: 'xp_threshold', threshold: 100 } as BadgeCriteria), xpReward: 50, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ xp: 150, streakDays: 0 });
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toHaveLength(1);
    expect(result.totalXpGained).toBe(50);
  });

  it('skips malformed criteria JSON', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Bad', criteria: 'not-json', xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toEqual([]);
  });
});
