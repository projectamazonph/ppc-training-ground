'use server';

/**
 * Progress server actions — start lesson, mark complete, submit quiz.
 *
 * Called from course pages and lesson pages.
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSafeAction, type ActionResult } from '@/lib/validation';
import { ProgressStatus, AttemptStatus } from '@/lib/enums';
import { evaluateCourseAccess } from '@/lib/tier-gate';
import { evaluateBadges } from '@/lib/badges';

const slugsSchema = z.object({
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
});

// ---------------------------------------------------------------------------
// startLessonAction
// ---------------------------------------------------------------------------

export async function startLessonAction(
  input: z.infer<typeof slugsSchema>
): Promise<ActionResult<{ status: string }>> {
  const user = await requireAuth();

  const lesson = await db.lesson.findUnique({
    where: { slug: input.lessonSlug },
    include: { module: { include: { course: true } } },
  });

  if (!lesson || lesson.module.course.slug !== input.courseSlug) {
    return { success: false, error: 'Lesson not found.' };
  }

  // Tier gate — deny if user lacks the required enrollment.
  const gate = await evaluateCourseAccess(user.id, input.courseSlug);
  if (!gate.allowed) {
    return {
      success: false,
      error: 'Your current tier does not include this lesson. Upgrade to continue.',
    };
  }

  // C6: Never downgrade COMPLETED progress — only set IN_PROGRESS if
  // the lesson hasn't been completed yet.
  const existingProgress = await db.lessonProgress.findUnique({
    where: {
      userId_lessonId: { userId: user.id, lessonId: lesson.id },
    },
    select: { status: true },
  });

  if (existingProgress?.status === ProgressStatus.COMPLETED) {
    return { success: true, data: { status: ProgressStatus.COMPLETED } };
  }

  // Upsert LessonProgress as IN_PROGRESS
  await db.lessonProgress.upsert({
    where: {
      userId_lessonId: { userId: user.id, lessonId: lesson.id },
    },
    update: { status: ProgressStatus.IN_PROGRESS },
    create: {
      userId: user.id,
      lessonId: lesson.id,
      status: ProgressStatus.IN_PROGRESS,
    },
  });

  return { success: true, data: { status: ProgressStatus.IN_PROGRESS } };
}

// ---------------------------------------------------------------------------
// markLessonCompleteAction
// ---------------------------------------------------------------------------

// H7: markLessonCompleteAction uses a form-action wrapper that calls
// redirect() AFTER the safe action returns, avoiding the swallowed
// redirect() problem inside createSafeAction's catch block.

export const markLessonCompleteAction = createSafeAction(slugsSchema, async (data) => {
  const user = await requireAuth();

  const lesson = await db.lesson.findUnique({
    where: { slug: data.lessonSlug },
    include: { module: { include: { course: true } } },
  });

  if (!lesson || lesson.module.course.slug !== data.courseSlug) {
    throw new Error('Lesson not found.');
  }

  // Tier gate — deny if user lacks the required enrollment.
  const gate = await evaluateCourseAccess(user.id, data.courseSlug);
  if (!gate.allowed) {
    throw new Error('Your current tier does not include this lesson. Upgrade to continue.');
  }

  // C6: Award XP only on the atomic transition from non-complete to complete.
  // Check current progress first.
  const currentProgress = await db.lessonProgress.findUnique({
    where: {
      userId_lessonId: { userId: user.id, lessonId: lesson.id },
    },
    select: { status: true },
  });

  const alreadyCompleted = currentProgress?.status === ProgressStatus.COMPLETED;

  await db.$transaction(async (tx) => {
    if (alreadyCompleted) {
      await tx.lessonProgress.update({
        where: {
          userId_lessonId: { userId: user.id, lessonId: lesson.id },
        },
        data: {
          completedAt: new Date(),
        },
      });
      return;
    }

    await tx.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: user.id, lessonId: lesson.id },
      },
      update: {
        status: ProgressStatus.COMPLETED,
        completedAt: new Date(),
        xpEarned: lesson.xpReward,
      },
      create: {
        userId: user.id,
        lessonId: lesson.id,
        status: ProgressStatus.COMPLETED,
        completedAt: new Date(),
        xpEarned: lesson.xpReward,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        xp: { increment: lesson.xpReward },
        lastActiveAt: new Date(),
      },
    });
  });

  revalidatePath(`/dashboard/courses/${data.courseSlug}`);
  revalidatePath(`/dashboard/courses/${data.courseSlug}/lessons/${data.lessonSlug}`);
  revalidatePath('/dashboard');

  // Evaluate badges after the side effects are durable.
  await evaluateBadges(user.id, { trigger: 'lesson_complete' });

  // H7: Return the redirect URL instead of calling redirect() inside
  // createSafeAction. The caller (markLessonCompleteFormAction) handles
  // the navigation so the redirect() throw isn't caught by createSafeAction.
  return { redirectTo: `/dashboard/courses/${data.courseSlug}/lessons/${data.lessonSlug}` };
});

// ---------------------------------------------------------------------------
// submitQuizAction
// ---------------------------------------------------------------------------

const submitQuizSchema = z.object({
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
  answers: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export const submitQuizAction = createSafeAction(submitQuizSchema, async (data) => {
  const user = await requireAuth();

  const lesson = await db.lesson.findUnique({
    where: { slug: data.lessonSlug },
    include: { module: { include: { course: true } }, quiz: { include: { questions: true } } },
  });

  if (!lesson || !lesson.quiz || lesson.module.course.slug !== data.courseSlug) {
    throw new Error('Quiz not found.');
  }

  // Tier gate — deny if user lacks the required enrollment.
  const gate = await evaluateCourseAccess(user.id, data.courseSlug);
  if (!gate.allowed) {
    throw new Error('Your current tier does not include this quiz. Upgrade to continue.');
  }

  const totalQuestions = lesson.quiz.questions.length;
  let correctCount = 0;
  for (const q of lesson.quiz.questions) {
    if (data.answers[String(q.order)] === q.correctAnswer) {
      correctCount++;
    }
  }
  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= lesson.quiz.passThreshold;

  // C6: Award XP only on the atomic transition from non-complete to complete.
  // Check current progress before creating the attempt — set xpEarned to 0
  // when the lesson is already completed.
  const lessonProgress = passed
    ? await db.lessonProgress.findUnique({
        where: {
          userId_lessonId: { userId: user.id, lessonId: lesson.id },
        },
        select: { status: true },
      })
    : null;

  const alreadyCompleted = lessonProgress?.status === ProgressStatus.COMPLETED;

  // Get the next attempt number
  const priorAttempts = await db.quizAttempt.count({
    where: { userId: user.id, quizId: lesson.quiz.id },
  });

  // Persist attempt — only award XP on first-time completion
  const attemptXp = passed && !alreadyCompleted ? 50 : 0;
  await db.quizAttempt.create({
    data: {
      userId: user.id,
      quizId: lesson.quiz.id,
      attemptNumber: priorAttempts + 1,
      status: passed ? AttemptStatus.GRADED : AttemptStatus.SUBMITTED,
      answers: JSON.stringify(data.answers),
      score,
      correctCount,
      totalQuestions,
      xpEarned: attemptXp, // bonus XP only for first-time passes
      timeSpentSeconds: data.timeSpentSeconds ?? 0,
      completedAt: new Date(),
    },
  });

  // If passed and not already completed, mark lesson complete and award XP
  if (passed && !alreadyCompleted) {
    await db.$transaction(async (tx) => {
      await tx.lessonProgress.upsert({
        where: {
          userId_lessonId: { userId: user.id, lessonId: lesson.id },
        },
        update: {
          status: ProgressStatus.COMPLETED,
          completedAt: new Date(),
          xpEarned: lesson.xpReward + 50,
        },
        create: {
          userId: user.id,
          lessonId: lesson.id,
          status: ProgressStatus.COMPLETED,
          completedAt: new Date(),
          xpEarned: lesson.xpReward + 50,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          xp: { increment: lesson.xpReward + 50 },
          lastActiveAt: new Date(),
        },
      });
    });
  }

  revalidatePath(`/dashboard/courses/${data.courseSlug}/lessons/${data.lessonSlug}`);
  revalidatePath(`/dashboard/courses/${data.courseSlug}/lessons/${data.lessonSlug}/quiz`);

  // Badge evaluation runs only if the quiz passed — quiz_score criteria is
  // pass-gated to keep false positives out of the awarded-feed.
  if (passed) {
    await evaluateBadges(user.id, { trigger: 'quiz_submit', score, passed });
  }

  return {
    score,
    passed,
    correctCount,
    totalQuestions,
    passThreshold: lesson.quiz.passThreshold,
  };
});