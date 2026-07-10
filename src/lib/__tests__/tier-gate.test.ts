import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  evaluateCourseAccess,
  requireCourseAccess,
  userCanAccessCourse,
  getUserHighestTier,
  userMeetsTierRequirement,
  TierAccessDeniedError,
} from '@/lib/tier-gate';
import { CourseTier } from '@/lib/enums';

const txMock = {
  user: { update: vi.fn() },
  lessonProgress: { upsert: vi.fn() },
  userBadge: { create: vi.fn() },
};

vi.mock('@/lib/db', () => {
  const m = {
    course: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    pricingTier: { findMany: vi.fn() },
  };
  return { db: { ...m, $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)) } };
});

describe('tier-gate.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows free course with no pricing tier', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'free', pricingTierId: null, pricingTier: null, deletedAt: null,
    });
    const result = await evaluateCourseAccess('user-1', 'free');
    expect(result.allowed).toBe(true);
    expect(result.userTier).toBeNull();
    expect(result.requiredTier).toBeNull();
  });

  it('denies when course has no active enrollment', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'paid', pricingTierId: 't1', pricingTier: { tier: CourseTier.PPC_FOUNDATIONS }, deletedAt: null,
    });
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await evaluateCourseAccess('user-1', 'paid');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no-enrollment');
  });

  it('allows when user has equal tier', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'paid', pricingTierId: 't1', pricingTier: { tier: CourseTier.PPC_FOUNDATIONS }, deletedAt: null,
    });
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tier: CourseTier.PPC_FOUNDATIONS },
    ]);
    const result = await evaluateCourseAccess('user-1', 'paid');
    expect(result.allowed).toBe(true);
    expect(result.userTier).toBe(CourseTier.PPC_FOUNDATIONS);
  });

  it('denies when user tier is lower than required', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'ultimate', pricingTierId: 't1', pricingTier: { tier: CourseTier.ULTIMATE_TRANSFORMATION }, deletedAt: null,
    });
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tier: CourseTier.PPC_FOUNDATIONS },
    ]);
    const result = await evaluateCourseAccess('user-1', 'ultimate');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tier-insufficient');
  });

  it('allows when highest tier satisfies requirement', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'mid', pricingTierId: 't1', pricingTier: { tier: CourseTier.ACCELERATED_MASTERY }, deletedAt: null,
    });
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tier: CourseTier.ACCELERATED_MASTERY },
      { tier: CourseTier.PPC_FOUNDATIONS },
    ]);
    const result = await evaluateCourseAccess('user-1', 'mid');
    expect(result.allowed).toBe(true);
    expect(result.userTier).toBe(CourseTier.ACCELERATED_MASTERY);
  });

  it('requireCourseAccess throws on deny', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'paid', pricingTierId: 't1', pricingTier: { tier: CourseTier.PPC_FOUNDATIONS }, deletedAt: null,
    });
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await expect(requireCourseAccess('user-1', 'paid')).rejects.toBeInstanceOf(TierAccessDeniedError);
  });

  it('userCanAccessCourse returns boolean', async () => {
    (db.course.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', slug: 'paid', pricingTierId: 't1', pricingTier: { tier: CourseTier.PPC_FOUNDATIONS }, deletedAt: null,
    });
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tier: CourseTier.PPC_FOUNDATIONS },
    ]);
    expect(await userCanAccessCourse('user-1', 'paid')).toBe(true);
  });

  it('getUserHighestTier returns highest active enrollment or null', async () => {
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tier: CourseTier.PPC_FOUNDATIONS },
      { tier: CourseTier.ULTIMATE_TRANSFORMATION },
    ]);
    expect(await getUserHighestTier('user-1')).toBe(CourseTier.ULTIMATE_TRANSFORMATION);
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    expect(await getUserHighestTier('user-1')).toBeNull();
  });

  it('userMeetsTierRequirement compares rank correctly', async () => {
    (db.enrollment.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tier: CourseTier.PPC_FOUNDATIONS },
    ]);
    expect(await userMeetsTierRequirement('user-1', CourseTier.PPC_FOUNDATIONS)).toEqual({ allowed: true, userTier: CourseTier.PPC_FOUNDATIONS });
    expect(await userMeetsTierRequirement('user-1', CourseTier.ULTIMATE_TRANSFORMATION)).toEqual({ allowed: false, userTier: CourseTier.PPC_FOUNDATIONS });
  });
});
