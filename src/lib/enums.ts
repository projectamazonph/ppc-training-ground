/**
 * Application-layer enum values for Project Amazon PH Academy v2.
 *
 * Prisma with String fields (enums are not used in schema), so the schema uses
 * String columns for fields that conceptually hold enum values. The valid
 * values are constrained at the application layer via the const objects
 * and union types in this file. Use these throughout the app instead of
 * importing from @prisma/client (which has no enum types here).
 *
 * Pattern: each enum is both a const-asserted tuple (for iteration) and a
 * const object (for named-member access like `UserRole.ADMIN`).
 */

export const UserRole = {
  STUDENT: 'STUDENT',
  INSTRUCTOR: 'INSTRUCTOR',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const UserRoleValues = Object.values(UserRole) as UserRole[];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const UserStatusValues = Object.values(UserStatus) as UserStatus[];

export const CourseDifficulty = {
  FOUNDATIONS: 'FOUNDATIONS',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  MASTERY: 'MASTERY',
} as const;
export type CourseDifficulty = (typeof CourseDifficulty)[keyof typeof CourseDifficulty];
export const CourseDifficultyValues = Object.values(CourseDifficulty) as CourseDifficulty[];

export const CourseTier = {
  PPC_FOUNDATIONS: 'PPC_FOUNDATIONS',
  ACCELERATED_MASTERY: 'ACCELERATED_MASTERY',
  ULTIMATE_TRANSFORMATION: 'ULTIMATE_TRANSFORMATION',
} as const;
export type CourseTier = (typeof CourseTier)[keyof typeof CourseTier];
export const CourseTierValues = Object.values(CourseTier) as CourseTier[];

export const LessonType = {
  READING: 'READING',
  SIMULATION: 'SIMULATION',
  QUIZ: 'QUIZ',
  VIDEO: 'VIDEO',
} as const;
export type LessonType = (typeof LessonType)[keyof typeof LessonType];
export const LessonTypeValues = Object.values(LessonType) as LessonType[];

export const EnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];
export const EnrollmentStatusValues = Object.values(EnrollmentStatus) as EnrollmentStatus[];

export const ProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type ProgressStatus = (typeof ProgressStatus)[keyof typeof ProgressStatus];
export const ProgressStatusValues = Object.values(ProgressStatus) as ProgressStatus[];

export const AttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  GRADED: 'GRADED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];
export const AttemptStatusValues = Object.values(AttemptStatus) as AttemptStatus[];

export const ToolType = {
  CAMPAIGN_BUILDER: 'CAMPAIGN_BUILDER',
  BID_ELEVATOR: 'BID_ELEVATOR',
  STR_TRIAGE: 'STR_TRIAGE',
  LISTING_AUDIT: 'LISTING_AUDIT',
  KEYWORD_RESEARCH: 'KEYWORD_RESEARCH',
} as const;
export type ToolType = (typeof ToolType)[keyof typeof ToolType];
export const ToolTypeValues = Object.values(ToolType) as ToolType[];

export const BadgeCategory = {
  ENGAGEMENT: 'ENGAGEMENT',
  MASTERY: 'MASTERY',
  XP_MILESTONE: 'XP_MILESTONE',
  STREAK: 'STREAK',
  SOCIAL: 'SOCIAL',
} as const;
export type BadgeCategory = (typeof BadgeCategory)[keyof typeof BadgeCategory];
export const BadgeCategoryValues = Object.values(BadgeCategory) as BadgeCategory[];

export const BadgeTier = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
} as const;
export type BadgeTier = (typeof BadgeTier)[keyof typeof BadgeTier];
export const BadgeTierValues = Object.values(BadgeTier) as BadgeTier[];

export const CertificateStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;
export type CertificateStatus = (typeof CertificateStatus)[keyof typeof CertificateStatus];
export const CertificateStatusValues = Object.values(CertificateStatus) as CertificateStatus[];

export const ResourceType = {
  PDF: 'PDF',
  SPREADSHEET: 'SPREADSHEET',
  TEMPLATE: 'TEMPLATE',
  CHEAT_SHEET: 'CHEAT_SHEET',
  VIDEO: 'VIDEO',
  LINK: 'LINK',
  OTHER: 'OTHER',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];
export const ResourceTypeValues = Object.values(ResourceType) as ResourceType[];

export const DraftStatus = {
  WORKING: 'WORKING',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
} as const;
export type DraftStatus = (typeof DraftStatus)[keyof typeof DraftStatus];
export const DraftStatusValues = Object.values(DraftStatus) as DraftStatus[];

export const CheckoutStatus = {
  PENDING: 'PENDING',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  ERROR: 'ERROR',
} as const;
export type CheckoutStatus = (typeof CheckoutStatus)[keyof typeof CheckoutStatus];
export const CheckoutStatusValues = Object.values(CheckoutStatus) as CheckoutStatus[];

export const PaymentMethod = {
  GCASH: 'GCASH',
  MAYA: 'MAYA',
  GRABPAY: 'GRABPAY',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  OTC: 'OTC',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const PaymentMethodValues = Object.values(PaymentMethod) as PaymentMethod[];

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PaymentStatusValues = Object.values(PaymentStatus) as PaymentStatus[];

export const DiscountType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];
export const DiscountTypeValues = Object.values(DiscountType) as DiscountType[];

export const RefundStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];
export const RefundStatusValues = Object.values(RefundStatus) as RefundStatus[];

export const TeamRole = {
  MEMBER: 'MEMBER',
  INSTRUCTOR: 'INSTRUCTOR',
  ADMIN: 'ADMIN',
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];
export const TeamRoleValues = Object.values(TeamRole) as TeamRole[];