/**
 * Certificate domain logic — read-only assessment + idempotent issuance.
 *
 * A certificate is issued when every lesson in the course is COMPLETED for
 * the given user (across all published modules). Issuing returns the active
 * Certificate row (or the existing one if already issued — never duplicates).
 */

import 'server-only';

import { randomUUID } from 'node:crypto';
import { db } from './db';
import { isUniqueConstraintError } from './prisma-errors';

/**
 * Total lesson count for a course, filtered to published modules and
 * non-deleted lessons.
 */
export async function getCourseLessonCount(courseId: string): Promise<number> {
  return db.lesson.count({
    where: {
      deletedAt: null,
      module: {
        courseId,
        isPublished: true,
        deletedAt: null,
      },
    },
  });
}

/**
 * Lessons in the course that the user has marked COMPLETED.
 */
export async function getCompletedLessonsInCourse(
  userId: string,
  courseId: string,
): Promise<number> {
  return db.lessonProgress.count({
    where: {
      userId,
      status: 'COMPLETED',
      lesson: {
        module: {
          courseId,
          isPublished: true,
          deletedAt: null,
        },
        deletedAt: null,
      },
    },
  });
}

/**
 * Course completion summary for a user.
 */
export interface CourseCompletionSummary {
  courseId: string;
  isComplete: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
}

/**
 * Returns true if the user has completed every published lesson in the course.
 */
export async function evaluateCourseCompletion(
  userId: string,
  courseId: string,
): Promise<CourseCompletionSummary> {
  const [completed, total] = await Promise.all([
    getCompletedLessonsInCourse(userId, courseId),
    getCourseLessonCount(courseId),
  ]);
  const progressPercent = total === 0 ? 100 : Math.round((completed / total) * 100);
  return {
    courseId,
    isComplete: total > 0 && completed >= total,
    completedLessons: completed,
    totalLessons: total,
    progressPercent,
  };
}

export interface IssuedCertificate {
  id: string;
  verificationHash: string;
  courseId: string;
  userId: string;
  issuedAt: Date;
  alreadyExisted: boolean;
}

/**
 * Issue a certificate for `userId` + `courseId` if the course is fully complete.
 * Idempotent — if an active Certificate already exists, returns it unchanged
 * with `alreadyExisted: true`. Returns `null` if the course is not yet
 * complete or the certificate has been revoked (revoked certs are
 * re-issuable).
 */
export async function issueCertificate(
  userId: string,
  courseId: string,
): Promise<IssuedCertificate | null> {
  const completion = await evaluateCourseCompletion(userId, courseId);
  if (!completion.isComplete) return null;

  const existing = await findActiveCertificate(userId, courseId);
  if (existing) return existing;

  // The read-then-create above is a TOCTOU race: two concurrent requests (the
  // manual "issue" action and the auto-issue page render) can both pass the
  // findFirst and both create. The partial unique index
  // `Certificate_active_per_user_course_key` (one ACTIVE cert per user+course)
  // makes the loser fail with P2002 - we treat that as "already issued" and
  // return the winner's row, exactly like every other create-under-race in the
  // audit remediation (refunds, XP ledger, quiz attempts).
  try {
    const created = await db.certificate.create({
      data: {
        userId,
        courseId,
        status: 'ACTIVE',
        verificationHash: randomUUID(),
        metadata: JSON.stringify({
          completedLessons: completion.completedLessons,
          totalLessons: completion.totalLessons,
        }),
      },
    });

    return {
      id: created.id,
      verificationHash: created.verificationHash,
      courseId: created.courseId,
      userId: created.userId,
      issuedAt: created.issuedAt,
      alreadyExisted: false,
    };
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      const winner = await findActiveCertificate(userId, courseId);
      if (winner) return winner;
    }
    throw e;
  }
}

/**
 * Return the user's active certificate for a course, or null.
 */
async function findActiveCertificate(
  userId: string,
  courseId: string,
): Promise<IssuedCertificate | null> {
  const existing = await db.certificate.findFirst({
    where: { userId, courseId, status: 'ACTIVE', deletedAt: null },
    orderBy: { issuedAt: 'desc' },
  });
  if (!existing) return null;
  return {
    id: existing.id,
    verificationHash: existing.verificationHash,
    courseId: existing.courseId,
    userId: existing.userId,
    issuedAt: existing.issuedAt,
    alreadyExisted: true,
  };
}

/**
 * Public-safe subset of a certificate — used on the /verify/[hash] page and
 * any other unauthenticated surface. Returns only the recipient's name; avatar
 * and email stay behind the owner-only dashboard route.
 */
export interface PublicCertificate {
  id: string;
  verificationHash: string;
  status: string;
  issuedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  user: { name: string };
  course: { title: string; description: string; estimatedHours: number };
}

/**
 * Get a certificate by its public verification hash, joined with course + user
 * info for display. Returns only public-safe fields — never include `image`
 * or `email` here, because the verification page is reachable without auth.
 */
export async function getCertificateByVerificationHash(
  verificationHash: string,
): Promise<PublicCertificate | null> {
  const cert = await db.certificate.findUnique({
    where: { verificationHash, deletedAt: null },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true, description: true, estimatedHours: true } },
    },
  });
  if (!cert) return null;
  return {
    id: cert.id,
    verificationHash: cert.verificationHash,
    status: cert.status,
    issuedAt: cert.issuedAt,
    revokedAt: cert.revokedAt,
    revokedReason: cert.revokedReason,
    user: { name: cert.user.name ?? 'Student' },
    course: cert.course,
  };
}
