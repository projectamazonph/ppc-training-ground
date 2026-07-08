import { db } from './db';
import { EnrollmentStatus, CourseTier, CourseTier as CourseTierConst } from './enums';

/**
 * Tier ranking. Lower index = lower tier (more accessible).
 * Order: PPC_FOUNDATIONS < ACCELERATED_MASTERY < ULTIMATE_TRANSFORMATION.
 */
const TIER_RANK: Record<string, number> = {
  [CourseTierConst.PPC_FOUNDATIONS]: 0,
  [CourseTierConst.ACCELERATED_MASTERY]: 1,
  [CourseTierConst.ULTIMATE_TRANSFORMATION]: 2,
};

export type TierGateResult =
  | {
      allowed: true;
      userTier: CourseTier | null;
      requiredTier: CourseTier | null;
    }
  | {
      allowed: false;
      reason: 'no-enrollment' | 'tier-insufficient' | 'inactive-enrollment' | 'course-not-tiered';
      userTier: CourseTier | null;
      requiredTier: CourseTier | null;
    };

/**
 * Decide whether the given user can access a course.
 *
 * Rules:
 *   - If the course has no `pricingTierId`, it's FREE / always-accessible.
 *   - If the user has no ACTIVE enrollment, deny (no-enrollment).
 *   - If any ACTIVE enrollment is at or above the course's required tier, allow.
 *   - Otherwise deny (tier-insufficient).
 *
 * The user only needs ONE qualifying enrollment — the highest-tier ACTIVE one
 * covers everything below it.
 */
export async function evaluateCourseAccess(
  userId: string,
  courseSlug: string,
): Promise<TierGateResult> {
  const course = await db.course.findUnique({
    where: { slug: courseSlug, deletedAt: null },
    include: { pricingTier: { select: { tier: true } } },
  });

  if (!course) {
    // Caller treats this as 404 separately. Defensive deny.
    return {
      allowed: false,
      reason: 'no-enrollment',
      userTier: null,
      requiredTier: null,
    };
  }

  // No pricing tier attached → free / always-accessible course.
  if (!course.pricingTierId || !course.pricingTier) {
    return {
      allowed: true,
      userTier: null,
      requiredTier: null,
    };
  }

  const requiredTier = course.pricingTier.tier as CourseTier;
  const requiredRank = TIER_RANK[requiredTier];

  // Defensive: if we don't recognise the required tier, deny.
  if (requiredRank === undefined) {
    return {
      allowed: false,
      reason: 'course-not-tiered',
      userTier: null,
      requiredTier,
    };
  }

  // Find the user's highest ACTIVE enrollment across any course.
  const activeEnrollments = await db.enrollment.findMany({
    where: {
      userId,
      status: EnrollmentStatus.ACTIVE,
      deletedAt: null,
      cancelledAt: null,
    },
    select: { tier: true },
  });

  if (activeEnrollments.length === 0) {
    return {
      allowed: false,
      reason: 'no-enrollment',
      userTier: null,
      requiredTier,
    };
  }

  let highestRank = -1;
  let userTier: CourseTier | null = null;
  for (const enrollment of activeEnrollments) {
    const rank = TIER_RANK[enrollment.tier];
    if (rank !== undefined && rank > highestRank) {
      highestRank = rank;
      userTier = enrollment.tier as CourseTier;
    }
  }

  if (highestRank >= requiredRank) {
    return { allowed: true, userTier, requiredTier };
  }

  return {
    allowed: false,
    reason: 'tier-insufficient',
    userTier,
    requiredTier,
  };
}

/**
 * Convenience helper for server actions / pages that just want a boolean.
 */
export async function userCanAccessCourse(
  userId: string,
  courseSlug: string,
): Promise<boolean> {
  const result = await evaluateCourseAccess(userId, courseSlug);
  return result.allowed;
}

/**
 * Generic tier check that doesn't go through a course slug. Returns the user's
 * highest active tier (or null if no active enrollment).
 *
 * Use this for cross-tier features like Live Classes where the gate is at
 * the feature level, not the course level.
 */
export async function getUserHighestTier(
  userId: string,
): Promise<CourseTier | null> {
  const enrollments = await db.enrollment.findMany({
    where: {
      userId,
      status: EnrollmentStatus.ACTIVE,
      deletedAt: null,
    },
    select: { tier: true },
  });

  let highestRank = -1;
  let highest: CourseTier | null = null;
  for (const e of enrollments) {
    const rank = TIER_RANK[e.tier] ?? -1;
    if (rank > highestRank) {
      highestRank = rank;
      highest = e.tier as CourseTier;
    }
  }
  return highest;
}

/**
 * Tier check for cross-tier features (Live Classes, masterminds, etc).
 */
export async function userMeetsTierRequirement(
  userId: string,
  requiredTier: CourseTier,
): Promise<{ allowed: boolean; userTier: CourseTier | null }> {
  const userTier = await getUserHighestTier(userId);
  // No active enrollment => no tier => cannot meet *any* requirement.
  // (PPC_FOUNDATIONS is treated as the floor, not a default.)
  if (userTier === null) {
    return { allowed: false, userTier: null };
  }
  const userRank = TIER_RANK[userTier];
  const requiredRank = TIER_RANK[requiredTier];
  if (userRank === undefined || requiredRank === undefined) {
    return { allowed: false, userTier };
  }
  return {
    allowed: userRank >= requiredRank,
    userTier,
  };
}

/**
 * Fetch all active PricingTiers for display (tier comparison, lock screen).
 */
export async function listActivePricingTiers() {
  return db.pricingTier.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
}
