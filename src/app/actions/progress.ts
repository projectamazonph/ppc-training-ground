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
import { awardXpOnce } from '@/lib/xp';
import { isUniqueConstraintError } from '@/lib/prisma-errors';

/** Bonus XP granted for passing a quiz, on top of the lesson's completion XP. */
const QUIZ_PASS_BONUS_XP = 50;

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

export const markLessonCompleteAction = createSafeAction(slugsSchema, async (data) => {
  const user = await requireAuth();

  const lesson = await db.lesson.findUnique({
    where: { slug: data.lessonSlug },
    include: {
      module: { include: { course: true } },
      quiz: { select: { isPublished: true } },
    },
  });

  if (!lesson || lesson.module.course.slug !== data.courseSlug) {
    throw new Error('Lesson not found.');
  }

  // Tier gate — deny if user lacks the required enrollment.
  const gate = await evaluateCourseAccess(user.id, data.courseSlug);
  if (!gate.allowed) {
    throw new Error('Your current tier does not include this lesson. Upgrade to continue.');
  }

  // H1: a lesson with a published quiz can only be completed by passing that
  // quiz (submitQuizAction). Manual completion here would let students earn
  // completion — and certificate eligibility — without demonstrating mastery.
  if (lesson.quiz?.isPublished) {
    throw new Error('Complete this lesson by passing its quiz.');
  }

  // Award XP exactly once (C10), THEN mark the lesson complete. These can't
  // share one transaction: awardXpOnce relies on its ledger's unique-index
  // insert failing (P2002) to enforce exactly-once, and a P2002 inside an outer
  // transaction would abort the whole thing - including the progress write -
  // breaking idempotent re-completion. Awarding first means any XP failure
  // leaves the lesson un-completed and cleanly retryable, rather than
  // "completed but no XP." A crash in the gap self-heals: the lesson still
  // shows incomplete, and re-completing no-ops the (already-granted) XP.
  await awardXpOnce(
    user.id,
    `lesson-complete:${lesson.id}`,
    lesson.xpReward,
    'Lesson completed',
  );

  await db.lessonProgress.upsert({
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

  revalidatePath(`/dashboard/courses/${data.courseSlug}`);
  revalidatePath(`/dashboard/courses/${data.courseSlug}/lessons/${data.lessonSlug}`);
  revalidatePath('/dashboard');

  // Evaluate badges after the redirect-relevant side effects are durable.
  // Idempotent — users who already have "First Steps" / "Thousandaire" won't
  // get duplicates.
  await evaluateBadges(user.id, { trigger: 'lesson_complete' });

  redirect(`/dashboard/courses/${data.courseSlug}/lessons/${data.lessonSlug}`);
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
  // A draft (unpublished) quiz must not grant completion or XP even if a
  // direct action call reaches here. Treat it as not found.
  if (!lesson.quiz.isPublished) {
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

  // Persist attempt with a concurrency-safe attempt number. `count + 1`
  // collides under concurrent submissions (both read the same count); the
  // unique index on (userId, quizId, attemptNumber) rejects the loser, so we
  // retry with the next number instead of 500-ing (C10).
  await createQuizAttempt({
    userId: user.id,
    quizId: lesson.quiz.id,
    status: passed ? AttemptStatus.GRADED : AttemptStatus.SUBMITTED,
    answers: JSON.stringify(data.answers),
    score,
    correctCount,
    totalQuestions,
    xpEarned: passed ? QUIZ_PASS_BONUS_XP : 0,
    timeSpentSeconds: data.timeSpentSeconds ?? 0,
  });

  // If passed, award XP exactly once THEN mark the lesson complete. Completion
  // XP and the pass bonus are separate ledger events so neither can be
  // double-granted by a re-submit or a concurrent pass (C10). XP is awarded
  // before the progress write for the same reason as markLessonCompleteAction:
  // a shared transaction is incompatible with the ledger's P2002-based
  // exactly-once gate, and awarding first keeps any failure cleanly retryable.
  if (passed) {
    await awardXpOnce(
      user.id,
      `lesson-complete:${lesson.id}`,
      lesson.xpReward,
      'Lesson completed',
    );
    await awardXpOnce(
      user.id,
      `quiz-pass:${lesson.quiz.id}`,
      QUIZ_PASS_BONUS_XP,
      'Quiz passed',
    );

    await db.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: user.id, lessonId: lesson.id },
      },
      update: {
        status: ProgressStatus.COMPLETED,
        completedAt: new Date(),
        xpEarned: lesson.xpReward + QUIZ_PASS_BONUS_XP,
      },
      create: {
        userId: user.id,
        lessonId: lesson.id,
        status: ProgressStatus.COMPLETED,
        completedAt: new Date(),
        xpEarned: lesson.xpReward + QUIZ_PASS_BONUS_XP,
      },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface QuizAttemptInput {
  userId: string;
  quizId: string;
  status: string;
  answers: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  timeSpentSeconds: number;
}

/**
 * Insert a QuizAttempt, allocating the next attempt number safely under
 * concurrency. Two simultaneous submissions both compute the same
 * `count + 1`; the unique (userId, quizId, attemptNumber) index rejects the
 * loser with P2002, and we retry with the next number rather than failing.
 */
async function createQuizAttempt(input: QuizAttemptInput): Promise<void> {
  const priorAttempts = await db.quizAttempt.count({
    where: { userId: input.userId, quizId: input.quizId },
  });

  let attemptNumber = priorAttempts + 1;
  for (let tries = 0; tries < 8; tries++) {
    try {
      await db.quizAttempt.create({
        data: {
          userId: input.userId,
          quizId: input.quizId,
          attemptNumber,
          status: input.status,
          answers: input.answers,
          score: input.score,
          correctCount: input.correctCount,
          totalQuestions: input.totalQuestions,
          xpEarned: input.xpEarned,
          timeSpentSeconds: input.timeSpentSeconds,
          completedAt: new Date(),
        },
      });
      return;
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        attemptNumber++;
        continue;
      }
      throw e;
    }
  }
  throw new Error('Could not record quiz attempt. Please try again.');
}