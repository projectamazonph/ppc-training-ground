import { describe, it, expect } from 'vitest';
import { UserRole, UserStatus, CourseDifficulty, CourseTier, LessonType, EnrollmentStatus, ProgressStatus, AttemptStatus, ToolType, BadgeCategory, BadgeTier, CertificateStatus, ResourceType, DraftStatus, CheckoutStatus, PaymentMethod, PaymentStatus, DiscountType, RefundStatus, TeamRole } from '@/lib/enums';

describe('enums.ts', () => {
  it('UserRole has expected values', () => {
    expect(Object.values(UserRole)).toEqual(['STUDENT', 'INSTRUCTOR', 'ADMIN']);
  });

  it('CourseTier values are ordered from low to high', () => {
    expect(Object.values(CourseTier)).toEqual([
      'PPC_FOUNDATIONS',
      'ACCELERATED_MASTERY',
      'ULTIMATE_TRANSFORMATION',
    ]);
  });

  it('EnrollmentStatus includes ACTIVE and REFUNDED', () => {
    expect(EnrollmentStatus.ACTIVE).toBe('ACTIVE');
    expect(EnrollmentStatus.REFUNDED).toBe('REFUNDED');
  });

  it('ToolType covers all 5 tools', () => {
    expect(Object.values(ToolType)).toEqual([
      'CAMPAIGN_BUILDER',
      'BID_ELEVATOR',
      'STR_TRIAGE',
      'LISTING_AUDIT',
      'KEYWORD_RESEARCH',
    ]);
  });

  it('DiscountType is percentage or fixed', () => {
    expect(DiscountType.PERCENTAGE).toBe('PERCENTAGE');
    expect(DiscountType.FIXED).toBe('FIXED');
  });
});
