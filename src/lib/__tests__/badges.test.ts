import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { evaluateBadges } from '@/lib/badges';
import { BadgeCriteria } from '@/lib/badges';

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

  it('defaults to false for unknown criteria type', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Unknown', criteria: JSON.stringify({ type: 'unknown_type', threshold: 1 }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toEqual([]);
  });

  it('awards streak_days badge when criteria met', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Streak', criteria: JSON.stringify({ type: 'streak_days', threshold: 7 }), xpReward: 30, description: '', icon: '', tier: 'SILVER', isPublished: true, deletedAt: null },
    ]);
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ streakDays: 10, xp: 0 });
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toHaveLength(1);
    expect(result.totalXpGained).toBe(30);
  });

  it('does not award streak_days badge when user not found', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Streak', criteria: JSON.stringify({ type: 'streak_days', threshold: 7 }), xpReward: 30, description: '', icon: '', tier: 'SILVER', isPublished: true, deletedAt: null },
    ]);
    (db.userBadge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await evaluateBadges('user-1', { trigger: 'login' });
    expect(result.awarded).toEqual([]);
  });

  it('awards module_complete badge when criteria met', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Module Complete', slug: 'mod-comp', criteria: JSON.stringify({ type: 'module_complete', threshold: 1 }), xpReward: 20, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    const result = await evaluateBadges('user-1', { trigger: 'lesson_complete' });
    expect(result.awarded).toHaveLength(1);
    expect(result.totalXpGained).toBe(20);
    expect(db.lessonProgress.count).toHaveBeenCalledTimes(1);
  });

  it('awards quiz_score badge when criteria met', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Quiz Score', slug: 'quiz', criteria: JSON.stringify({ type: 'quiz_score', threshold: 85 }), xpReward: 25, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    const resultSuccess = await evaluateBadges('user-1', { trigger: 'quiz_submit', score: 90, passed: true });
    expect(resultSuccess.awarded).toHaveLength(1);

    const resultFail = await evaluateBadges('user-1', { trigger: 'quiz_submit', score: 50, passed: false });
    expect(resultFail.awarded).toHaveLength(0);

    const resultWrongTrigger = await evaluateBadges('user-1', { trigger: 'login' });
    expect(resultWrongTrigger.awarded).toHaveLength(0);
  });

  it('awards tool_sessions badge when criteria met without scope', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Tool master', slug: 'tools', criteria: JSON.stringify({ type: 'tool_sessions', threshold: 3 }), xpReward: 40, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.toolSession.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    const result = await evaluateBadges('user-1', { trigger: 'tool_submit', toolType: 'CAMPAIGN_BUILDER', passed: true });
    expect(result.awarded).toHaveLength(1);
    expect(db.toolSession.count).toHaveBeenCalledTimes(1);
    expect(db.toolSession.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'GRADED',
      },
    });
  });

  it('awards tool_sessions badge when criteria met with scope', async () => {
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'CB Master', slug: 'cb-master', criteria: JSON.stringify({ type: 'tool_sessions', threshold: 2, scope: { toolType: 'CAMPAIGN_BUILDER' } }), xpReward: 40, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.toolSession.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    const result = await evaluateBadges('user-1', { trigger: 'tool_submit', toolType: 'CAMPAIGN_BUILDER', passed: true });
    expect(result.awarded).toHaveLength(1);
    expect(db.toolSession.count).toHaveBeenCalledTimes(1);
    expect(db.toolSession.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'GRADED',
        toolType: 'CAMPAIGN_BUILDER',
      },
    });
  });

  it('effectively uses cache context to eliminate N+1 duplicate database queries', async () => {
    // 3 badges of type streak_days/xp_threshold, and 2 of type module_complete, and 2 of type tool_sessions (same scope)
    (db.badge.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b1', title: 'Streak 1', criteria: JSON.stringify({ type: 'streak_days', threshold: 5 }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
      { id: 'b2', title: 'Streak 2', criteria: JSON.stringify({ type: 'streak_days', threshold: 10 }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
      { id: 'b3', title: 'XP Threshold', criteria: JSON.stringify({ type: 'xp_threshold', threshold: 100 }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
      { id: 'b4', title: 'Module 1', criteria: JSON.stringify({ type: 'module_complete', threshold: 1 }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
      { id: 'b5', title: 'Module 2', criteria: JSON.stringify({ type: 'module_complete', threshold: 2 }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
      { id: 'b6', title: 'Tools 1', criteria: JSON.stringify({ type: 'tool_sessions', threshold: 1, scope: { toolType: 'STR_TRIAGE' } }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
      { id: 'b7', title: 'Tools 2', criteria: JSON.stringify({ type: 'tool_sessions', threshold: 5, scope: { toolType: 'STR_TRIAGE' } }), xpReward: 10, description: '', icon: '', tier: 'BRONZE', isPublished: true, deletedAt: null },
    ]);
    (db.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ streakDays: 12, xp: 150 });
    (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (db.toolSession.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(6);

    const result = await evaluateBadges('user-1', { trigger: 'login' });

    expect(result.awarded).toHaveLength(7);

    // Verify cache hits: DB should only be queried ONCE for user, completedCount, and toolSessionCount of STR_TRIAGE!
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.lessonProgress.count).toHaveBeenCalledTimes(1);
    expect(db.toolSession.count).toHaveBeenCalledTimes(1);
  });
});
