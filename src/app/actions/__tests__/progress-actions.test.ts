import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startLessonAction } from '@/app/actions/progress';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

vi.mock('@/lib/db', () => ({
  db: {
    lesson: { findUnique: vi.fn() },
    lessonProgress: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: 'u1', email: 'a@b.com', name: 'A', role: 'STUDENT',
    xp: 0, level: 1, streakDays: 0,
  }),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('progress actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('startLessonAction returns error when lesson missing', async () => {
    (db.lesson.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await startLessonAction({ courseSlug: 'c1', lessonSlug: 'l1' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Lesson not found.');
  });

  it('startLessonAction returns error when lesson belongs to another course', async () => {
    (db.lesson.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'l1', slug: 'l1', module: { course: { slug: 'other' } },
    });
    const result = await startLessonAction({ courseSlug: 'c1', lessonSlug: 'l1' });
    expect(result.success).toBe(false);
  });
});
