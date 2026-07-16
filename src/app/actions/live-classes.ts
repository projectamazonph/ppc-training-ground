'use server';

/**
 * Live Classes server actions — register, cancel.
 *
 * Tier check: Live Classes require ULTIMATE_TRANSFORMATION. The check is
 * server-side via `userMeetsTierRequirement` — gating in the UI alone is a
 * security hole.
 *
 * Email reminders: stubbed for Sprint 8 (when Resend templates land). The
 * action returns silently if RESEND_API_KEY is absent, so we don't break the
 * flow in development or pre-launch.
 */

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { CourseTier } from '@/lib/enums';
import { createSafeAction, type ActionResult } from '@/lib/validation';
import { userMeetsTierRequirement } from '@/lib/tier-gate';
import { sendLiveClassReminderEmail } from '@/lib/email';


const classIdSchema = z.object({ classId: z.string().min(1) });

export interface RegistrationState {
  classId: string;
  registered: boolean;
  alreadyRegistered: boolean;
}

/**
 * Register the current user for a live class. Idempotent — re-registering
 * returns the existing registration with `alreadyRegistered: true`.
 *
 * Tier gate: ULTIMATE_TRANSFORMATION required.
 */
export const registerForLiveClass = createSafeAction<
  typeof classIdSchema,
  RegistrationState
>(classIdSchema, async (data) => {
  const user = await requireAuth();

  const klass = await db.liveClass.findUnique({
    where: { id: data.classId, deletedAt: null },
    select: {
      id: true,
      isPublished: true,
      cancelledAt: true,
      scheduledAt: true,
    },
  });
  if (!klass || !klass.isPublished || klass.cancelledAt) {
    throw new Error('Class is not available.');
  }
  if (klass.scheduledAt.getTime() < Date.now()) {
    throw new Error('This class has already started. Registration is closed.');
  }

  const tier = await userMeetsTierRequirement(user.id, CourseTier.ULTIMATE_TRANSFORMATION);
  if (!tier.allowed) {
    throw new Error(
      `Live Classes require the Ultimate tier. ${
        tier.userTier ? `Your current tier: ${tier.userTier}.` : 'You have no active enrollment.'
      }`,
    );
  }

  const existing = await db.liveClassRegistration.findUnique({
    where: {
      liveClassId_userId: {
        liveClassId: data.classId,
        userId: user.id,
      },
    },
  });

  if (existing && !existing.cancelledAt && !existing.deletedAt) {
    return {
      classId: data.classId,
      registered: true,
      alreadyRegistered: true,
    };
  }

  // Capacity check + write in ONE Serializable transaction. At the default
  // READ COMMITTED level, two concurrent registrations can both pass the
  // count check and overbook; Serializable aborts the loser (P2034), which
  // we retry — it then sees the committed count and gets the capacity error.
  const registerOnce = () =>
    db.$transaction(
      async (tx) => {
        const klassRow = await tx.liveClass.findUnique({
          where: { id: data.classId },
          select: { maxAttendees: true },
        });
        const count = await tx.liveClassRegistration.count({
          where: { liveClassId: data.classId, deletedAt: null, cancelledAt: null },
        });
        if (count >= (klassRow?.maxAttendees ?? 0)) {
          throw new Error('This class is at capacity. Join the waitlist or pick another date.');
        }
        if (existing) {
          // Was cancelled — restore instead of recreating.
          await tx.liveClassRegistration.update({
            where: { id: existing.id },
            data: { cancelledAt: null, deletedAt: null },
          });
        } else {
          await tx.liveClassRegistration.create({
            data: { liveClassId: data.classId, userId: user.id },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  for (let attempt = 0; ; attempt++) {
    try {
      await registerOnce();
      break;
    } catch (e) {
      const isSerializationFailure =
        e instanceof Error && 'code' in e && (e as { code?: string }).code === 'P2034';
      if (!isSerializationFailure || attempt >= 2) throw e;
    }
  }

  // Send reminder email (best-effort — errors are swallowed).
  const [userRow, klassRow] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } }),
    db.liveClass.findUnique({
      where: { id: data.classId },
      select: { title: true, instructorName: true, scheduledAt: true, meetingUrl: true, durationMinutes: true },
    }),
  ]);

  if (userRow && klassRow) {
    sendLiveClassReminderEmail({
      to: userRow.email,
      studentName: userRow.name ?? 'Student',
      classTitle: klassRow.title,
      instructorName: klassRow.instructorName,
      scheduledAt: klassRow.scheduledAt,
      meetingUrl: klassRow.meetingUrl,
      durationMinutes: klassRow.durationMinutes,
    }).catch(() => {});
  }

  return {
    classId: data.classId,
    registered: true,
    alreadyRegistered: false,
  };
});

/**
 * Cancel the user's own registration. Idempotent — cancelling a non-existent
 * registration is a no-op.
 */
export const cancelLiveClassRegistration = createSafeAction<
  typeof classIdSchema,
  { classId: string; cancelled: boolean }
>(classIdSchema, async (data) => {
  const user = await requireAuth();

  const existing = await db.liveClassRegistration.findUnique({
    where: {
      liveClassId_userId: {
        liveClassId: data.classId,
        userId: user.id,
      },
    },
  });
  if (!existing || existing.deletedAt) {
    return { classId: data.classId, cancelled: false };
  }

  await db.liveClassRegistration.update({
    where: { id: existing.id },
    data: { cancelledAt: new Date() },
  });

  return { classId: data.classId, cancelled: true };
});


