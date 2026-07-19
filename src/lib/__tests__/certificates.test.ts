import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCount, mockFindFirst, mockFindUnique, mockCreate } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    lesson: { count: mockCount },
    lessonProgress: { count: vi.fn() },
    certificate: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'mock-uuid-12345',
}));

import {
  getCourseLessonCount,
  getCompletedLessonsInCourse,
  evaluateCourseCompletion,
  issueCertificate,
  getCertificateByVerificationHash,
} from '@/lib/certificates';

describe('certificates.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCourseLessonCount', () => {
    it('returns lesson count for a course', async () => {
      mockCount.mockResolvedValue(10);
      const count = await getCourseLessonCount('c-1');
      expect(count).toBe(10);
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            module: expect.objectContaining({ courseId: 'c-1' }),
          }),
        }),
      );
    });
  });

  describe('getCompletedLessonsInCourse', () => {
    it('returns completed lesson count for a user in a course', async () => {
      const mockLpCount = vi.fn().mockResolvedValue(7);
      // Need to get the mock for lessonProgress.count
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(7);

      const count = await getCompletedLessonsInCourse('u-1', 'c-1');
      expect(count).toBe(7);
    });
  });

  describe('evaluateCourseCompletion', () => {
    it('returns isComplete=true when all lessons completed', async () => {
      mockCount.mockResolvedValue(10);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const result = await evaluateCourseCompletion('u-1', 'c-1');
      expect(result.isComplete).toBe(true);
      expect(result.completedLessons).toBe(10);
      expect(result.totalLessons).toBe(10);
      expect(result.progressPercent).toBe(100);
    });

    it('returns isComplete=false when not all lessons completed', async () => {
      mockCount.mockResolvedValue(10);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const result = await evaluateCourseCompletion('u-1', 'c-1');
      expect(result.isComplete).toBe(false);
      expect(result.progressPercent).toBe(30);
    });

    it('returns isComplete=false when total is 0 (no lessons means nothing to complete)', async () => {
      mockCount.mockResolvedValue(0);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await evaluateCourseCompletion('u-1', 'c-1');
      expect(result.isComplete).toBe(false);
      expect(result.progressPercent).toBe(100);
    });
  });

  describe('issueCertificate', () => {
    it('returns null when course not complete', async () => {
      mockCount.mockResolvedValue(10);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await issueCertificate('u-1', 'c-1');
      expect(result).toBeNull();
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('returns existing certificate when already issued', async () => {
      mockCount.mockResolvedValue(10);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      mockFindFirst.mockResolvedValue({
        id: 'cert-1',
        verificationHash: 'existing-hash',
        courseId: 'c-1',
        userId: 'u-1',
        issuedAt: new Date('2026-07-01'),
      });

      const result = await issueCertificate('u-1', 'c-1');
      expect(result).not.toBeNull();
      expect(result!.alreadyExisted).toBe(true);
      expect(result!.id).toBe('cert-1');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('creates new certificate when course complete and no active cert', async () => {
      mockCount.mockResolvedValue(10);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: 'cert-new',
        verificationHash: 'mock-uuid-12345',
        courseId: 'c-1',
        userId: 'u-1',
        issuedAt: new Date('2026-07-15'),
      });

      const result = await issueCertificate('u-1', 'c-1');
      expect(result).not.toBeNull();
      expect(result!.alreadyExisted).toBe(false);
      expect(result!.id).toBe('cert-new');
      expect(result!.verificationHash).toBe('mock-uuid-12345');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-1',
            courseId: 'c-1',
            status: 'ACTIVE',
            verificationHash: 'mock-uuid-12345',
          }),
        }),
      );
    });

    it('returns the winner cert (not a crash) when the create loses the unique-index race (H7 P2002)', async () => {
      mockCount.mockResolvedValue(10);
      const { db } = await import('@/lib/db');
      (db.lessonProgress.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      // First findFirst: no active cert (pre-check). Second findFirst (after
      // P2002): the row the racing writer committed.
      mockFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'cert-winner',
          verificationHash: 'winner-hash',
          courseId: 'c-1',
          userId: 'u-1',
          issuedAt: new Date('2026-07-15'),
        });
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      mockCreate.mockRejectedValue(p2002);

      const result = await issueCertificate('u-1', 'c-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('cert-winner');
      expect(result!.alreadyExisted).toBe(true);
    });
  });

  describe('getCertificateByVerificationHash', () => {
    it('returns public certificate when found', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'cert-1',
        verificationHash: 'abc-123',
        status: 'ACTIVE',
        issuedAt: new Date('2026-07-01'),
        revokedAt: null,
        revokedReason: null,
        user: { name: 'Juan' },
        course: { title: 'PPC 101', description: 'Learn PPC', estimatedHours: 10 },
      });

      const result = await getCertificateByVerificationHash('abc-123');
      expect(result).not.toBeNull();
      expect(result!.user.name).toBe('Juan');
      expect(result!.verificationHash).toBe('abc-123');
    });

    it('returns null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await getCertificateByVerificationHash('nonexistent');
      expect(result).toBeNull();
    });

    it('falls back to "Student" when user name is null', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'cert-1',
        verificationHash: 'abc-123',
        status: 'ACTIVE',
        issuedAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        user: { name: null },
        course: { title: 'PPC 101', description: 'Learn PPC', estimatedHours: 10 },
      });

      const result = await getCertificateByVerificationHash('abc-123');
      expect(result!.user.name).toBe('Student');
    });
  });
});
