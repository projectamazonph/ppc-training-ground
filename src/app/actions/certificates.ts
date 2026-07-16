'use server';

/**
 * Certificate server actions — issue, list, public verify.
 *
 *   - issueCertificateAction(courseSlug)  → issues if course is complete, returns hash
 *   - listMyCertificatesAction()          → user's active certificates
 *   - getCertificateByHashAction(hash)   → public verify, no auth needed
 *
 * Error handling: `createSafeAction` wraps thrown errors into
 * `{ success: false, error }`. Business-logic "this can't be done yet" errors
 * (course not complete, no tier access) throw so the client sees them as
 * friendly messages rather than nested ActionResults.
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createSafeAction } from '@/lib/validation';
import { evaluateCourseAccess } from '@/lib/tier-gate';
import {
  issueCertificate,
  getCertificateByVerificationHash,
  evaluateCourseCompletion,
} from '@/lib/certificates';

const courseSlugSchema = z.object({ courseSlug: z.string().min(1) });

export interface CertificateIssuance {
  certificateId: string;
  verificationHash: string;
  alreadyExisted: boolean;
}

/**
 * Issue a certificate for the current user + course. Idempotent — re-issuing
 * returns the existing hash with `alreadyExisted: true`.
 */
export const issueCertificateAction = createSafeAction<
  typeof courseSlugSchema,
  CertificateIssuance
>(courseSlugSchema, async (data) => {
  const user = await requireAuth();

  const course = await db.course.findUnique({
    where: { slug: data.courseSlug, deletedAt: null },
    select: { id: true, slug: true, title: true },
  });
  if (!course) throw new Error('Course not found.');

  const gate = await evaluateCourseAccess(user.id, data.courseSlug);
  if (!gate.allowed) {
    throw new Error('Your current tier does not include this course. Upgrade to issue a certificate.');
  }

  const issued = await issueCertificate(user.id, course.id);
  if (!issued) {
    const summary = await evaluateCourseCompletion(user.id, course.id);
    throw new Error(
      `Course not complete (${summary.completedLessons}/${summary.totalLessons} lessons). Finish every lesson first.`,
    );
  }

  return {
    certificateId: issued.id,
    verificationHash: issued.verificationHash,
    alreadyExisted: issued.alreadyExisted,
  };
});

export interface CertificateSummary {
  id: string;
  verificationHash: string;
  issuedAt: Date;
  course: { slug: string; title: string; estimatedHours: number };
}

export async function listMyCertificatesAction(): Promise<CertificateSummary[]> {
  const user = await requireAuth();
  const certs = await db.certificate.findMany({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      deletedAt: null,
    },
    orderBy: { issuedAt: 'desc' },
    include: {
      course: { select: { slug: true, title: true, estimatedHours: true } },
    },
  });
  return certs.map((c) => ({
    id: c.id,
    verificationHash: c.verificationHash,
    issuedAt: c.issuedAt,
    course: c.course,
  }));
}
