# Database Schema — Project Amazon PH Academy v2

**Date:** 2026-07-07
**Owner:** Ryan Roland Dabao
**Status:** Approved (greenfield, day-1 design)

This document is the source of truth for the Prisma schema. Every model, every field, every index, every constraint is specified here. The actual `schema.prisma` is generated from this doc — they must match.

---

## Principles

1. **PostgreSQL-compatible.** SQLite in dev, Postgres in production. No SQLite-specific features.
2. **Soft-delete on every mutable table.** `deletedAt DateTime?` filtered by default.
3. **Audit columns on every mutable table.** `createdById`, `updatedById`, `createdAt`, `updatedAt`.
4. **Compound indexes on every hot read path.** Specified per model below.
5. **JSON columns have typed shapes.** Documented in `src/types/json-schemas.ts`.
6. **No nullable `orgId`** (we're not multi-tenant, per ADR-015). Removed entirely.
7. **Enums for all state machines.** Never `String` with comment-listing valid values.
8. **CUIDs for primary keys.** Not UUIDs, not auto-increment. CUIDs are sortable, URL-safe, and Prisma-native.

---

## Models

### User

Authentication and identity.

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  name          String?
  image         String?
  passwordHash  String?  // null for OAuth-only

  // Gamification
  role          UserRole @default(STUDENT)
  xp            Int      @default(0)
  level         Int      @default(1)
  streakDays    Int      @default(0)
  lastActiveAt  DateTime @default(now())

  // Soft-delete
  status        UserStatus @default(ACTIVE)
  deletedAt     DateTime?
  deletedReason String?

  // Audit
  createdById   String?
  updatedById   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  accounts              Account[]
  sessions              Session[]
  enrollments           Enrollment[]
  moduleProgress        ModuleProgress[]
  lessonProgress        LessonProgress[]
  toolSessions          ToolSession[]
  toolResults           ToolResult[]
  quizAttempts          QuizAttempt[]
  badges                UserBadge[]
  certificates          Certificate[]
  liveClassRegs         LiveClassRegistration[]
  teamMemberships       TeamMember[]
  auditLogs             AuditLog[]              @relation("AuditLogActor")
  refundRequests        RefundRequest[]
  reviewedRefunds       RefundRequest[]         @relation("RefundReviewer")
  payments              Payment[]
  checkoutSessions      CheckoutSession[]
  authoredCourses       Course[]                @relation("CourseAuthor")
  authoredLessons       Lesson[]                @relation("LessonAuthor")
  authoredBadges        Badge[]                 @relation("BadgeAuthor")
  authoredResources     Resource[]              @relation("ResourceAuthor")
  authoredLiveClasses   LiveClass[]             @relation("LiveClassAuthor")
  authoredContent       ContentDraft[]          @relation("ContentDraftAuthor")
  discountCodesCreated  DiscountCode[]

  @@index([deletedAt])
  @@index([status])
  @@index([role])
  @@index([lastActiveAt])
}

enum UserRole {
  STUDENT
  INSTRUCTOR
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING_VERIFICATION
}
```

### Account & Session (for OAuth providers, future-proofing)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### Course & Curriculum

```prisma
model Course {
  id              String   @id @default(cuid())
  slug            String   @unique
  title           String
  description     String
  icon            String   @default("BookOpen")
  difficulty      CourseDifficulty @default(FOUNDATIONS)
  pricingTierId   String?
  estimatedHours  Int      @default(10)
  isPublished     Boolean  @default(false)
  publishedAt     DateTime?
  sortOrder       Int      @default(0)
  deletedAt       DateTime?
  createdById     String?
  updatedById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  pricingTier     PricingTier?   @relation(fields: [pricingTierId], references: [id])
  author          User?          @relation("CourseAuthor", fields: [createdById], references: [id])
  modules         Module[]
  enrollments     Enrollment[]
  liveClasses     LiveClass[]
  certificates    Certificate[]

  @@index([deletedAt])
  @@index([isPublished, sortOrder])
  @@index([pricingTierId])
}

enum CourseDifficulty {
  FOUNDATIONS
  INTERMEDIATE
  ADVANCED
  MASTERY
}

model Module {
  id              String   @id @default(cuid())
  courseId        String
  moduleNumber    Int
  title           String
  slug            String   @unique
  description     String
  icon            String   @default("FileText")
  color           String   @default("orange")
  order           Int
  isPublished     Boolean  @default(false)
  publishedAt     DateTime?
  estimatedMinutes Int     @default(30)
  deletedAt       DateTime?
  createdById     String?
  updatedById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  course          Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons         Lesson[]
  progress        ModuleProgress[]
  resources       Resource[]

  @@unique([courseId, moduleNumber])
  @@index([deletedAt])
  @@index([courseId])
}

model Lesson {
  id              String   @id @default(cuid())
  moduleId        String
  lessonNumber    Int
  title           String
  slug            String   @unique
  content         String   // MDX
  excerpt         String?  // First 200 chars, for previews
  type            LessonType @default(READING)
  videoUrl        String?
  estimatedMinutes Int     @default(10)
  xpReward        Int      @default(50)
  isPublished     Boolean  @default(false)
  publishedAt     DateTime?
  deletedAt       DateTime?
  createdById     String?
  updatedById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  module          Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  author          User?    @relation("LessonAuthor", fields: [createdById], references: [id])
  progress        LessonProgress[]
  quiz            Quiz?

  @@unique([moduleId, lessonNumber])
  @@index([deletedAt])
  @@index([moduleId])
  @@index([type])
}

enum LessonType {
  READING
  SIMULATION
  QUIZ
  VIDEO
}
```

### Enrollment & Progress

```prisma
model Enrollment {
  id              String   @id @default(cuid())
  userId          String
  courseId        String
  pricingTierId   String
  tier            CourseTier  // Denormalized for fast gating check
  status          EnrollmentStatus @default(ACTIVE)
  enrolledAt      DateTime @default(now())
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancellationReason String?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  course          Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  pricingTier     PricingTier @relation(fields: [pricingTierId], references: [id])
  payment         Payment?
  progress        ModuleProgress[]

  @@unique([userId, courseId])
  @@index([deletedAt])
  @@index([status])
  @@index([tier])
  @@index([pricingTierId])
}

enum CourseTier {
  PPC_FOUNDATIONS
  ACCELERATED_MASTERY
  ULTIMATE_TRANSFORMATION
}

enum EnrollmentStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  REFUNDED
}

model ModuleProgress {
  id              String   @id @default(cuid())
  userId          String
  moduleId        String
  enrollmentId    String?
  status          ProgressStatus @default(NOT_STARTED)
  score           Int      @default(0)
  xpEarned        Int      @default(0)
  startedAt       DateTime?
  completedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  module          Module     @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  enrollment      Enrollment? @relation(fields: [enrollmentId], references: [id])

  @@unique([userId, moduleId])
  @@index([userId, status])
  @@index([deletedAt])
  @@index([enrollmentId])
}

model LessonProgress {
  id              String   @id @default(cuid())
  userId          String
  lessonId        String
  status          ProgressStatus @default(NOT_STARTED)
  score           Int      @default(0)
  xpEarned        Int      @default(0)
  timeSpentSeconds Int     @default(0)
  completedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson          Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])
  @@index([userId, status])
  @@index([deletedAt])
}

enum ProgressStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### Quizzes

```prisma
model Quiz {
  id              String   @id @default(cuid())
  lessonId        String   @unique
  title           String
  description     String   @default("")
  passThreshold   Int      @default(70)
  timeLimitSeconds Int?
  isPublished     Boolean  @default(false)
  publishedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  lesson          Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  questions       QuizQuestion[]
  attempts        QuizAttempt[]

  @@index([deletedAt])
  @@index([isPublished])
}

model QuizQuestion {
  id              String   @id @default(cuid())
  quizId          String
  order           Int
  question        String
  optionA         String
  optionB         String
  optionC         String
  optionD         String   @default("")
  correctAnswer   String   // "A" | "B" | "C" | "D"
  explanation     String   @default("")
  points          Int      @default(1)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  quiz            Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)

  @@unique([quizId, order])
  @@index([deletedAt])
}

model QuizAttempt {
  id              String   @id @default(cuid())
  userId          String
  quizId          String
  attemptNumber   Int
  status          AttemptStatus @default(IN_PROGRESS)
  answers         String   // JSON: { "1": "A", "2": "C" }
  score           Int      @default(0)
  correctCount    Int      @default(0)
  totalQuestions  Int      @default(0)
  xpEarned        Int      @default(0)
  timeSpentSeconds Int     @default(0)
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quiz            Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)

  @@unique([userId, quizId, attemptNumber])
  @@index([userId, quizId])
  @@index([deletedAt])
  @@index([status])
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  GRADED
  ARCHIVED
}
```

### Badges & Certificates

```prisma
model Badge {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  description String
  icon        String
  category    BadgeCategory
  tier        BadgeTier @default(BRONZE)
  xpReward    Int      @default(0)
  criteria    String   // JSON: programmatic awarding criteria
  order       Int      @default(0)
  isSecret    Boolean  @default(false)
  isPublished Boolean  @default(true)
  deletedAt   DateTime?
  createdById String?
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  author      User?       @relation("BadgeAuthor", fields: [createdById], references: [id])
  awards      UserBadge[]

  @@index([deletedAt])
  @@index([category])
  @@index([tier])
  @@index([isPublished])
}

enum BadgeCategory {
  ENGAGEMENT
  MASTERY
  XP_MILESTONE
  STREAK
  SOCIAL
}

enum BadgeTier {
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

model UserBadge {
  id          String   @id @default(cuid())
  userId      String
  badgeId     String
  xpEarned    Int      @default(0)
  earnedAt    DateTime @default(now())
  deletedAt   DateTime?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge       Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])
  @@index([userId, earnedAt])
  @@index([deletedAt])
}

model Certificate {
  id              String   @id @default(cuid())
  userId          String
  courseId        String
  status          CertificateStatus @default(ACTIVE)
  verificationHash String  @unique
  metadata        String?  // JSON
  issuedAt        DateTime @default(now())
  expiresAt       DateTime?
  revokedAt       DateTime?
  revokedReason   String?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  course          Course  @relation(fields: [courseId], references: [id])

  @@index([userId])
  @@index([verificationHash])
  @@index([status])
  @@index([deletedAt])
}

enum CertificateStatus {
  ACTIVE
  EXPIRED
  REVOKED
}
```

### Live Classes

```prisma
model LiveClass {
  id              String   @id @default(cuid())
  courseId        String
  title           String
  description     String
  instructorName  String   @default("Ryan Dabao")
  scheduledAt     DateTime
  durationMinutes Int      @default(60)
  meetingUrl      String?
  recordingUrl    String?
  maxAttendees    Int      @default(50)
  isPublished     Boolean  @default(false)
  cancelledAt     DateTime?
  cancellationReason String?
  deletedAt       DateTime?
  createdById     String?
  updatedById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  course          Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  author          User?     @relation("LiveClassAuthor", fields: [createdById], references: [id])
  registrations   LiveClassRegistration[]

  @@index([isPublished, scheduledAt])
  @@index([courseId])
  @@index([deletedAt])
  @@index([scheduledAt])
}

model LiveClassRegistration {
  id              String   @id @default(cuid())
  liveClassId     String
  userId          String
  attended        Boolean  @default(false)
  registeredAt    DateTime @default(now())
  cancelledAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())

  liveClass       LiveClass @relation(fields: [liveClassId], references: [id], onDelete: Cascade)
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([liveClassId, userId])
  @@index([liveClassId])
  @@index([userId])
  @@index([deletedAt])
}
```

### Interactive Tools

```prisma
model ToolSession {
  id              String   @id @default(cuid())
  userId          String
  toolType        ToolType
  scenarioId      String?
  status          AttemptStatus @default(IN_PROGRESS)
  state           String   // JSON
  score           Int      @default(0)
  timeSpentSeconds Int     @default(0)
  startedAt       DateTime @default(now())
  submittedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  results         ToolResult[]

  @@index([userId, toolType])
  @@index([userId, status])
  @@index([deletedAt])
  @@index([toolType])
}

enum ToolType {
  CAMPAIGN_BUILDER
  BID_ELEVATOR
  STR_TRIAGE
}

model ToolResult {
  id              String   @id @default(cuid())
  sessionId       String
  step            Int
  prompt          String
  decision        String
  correct         String
  isCorrect       Boolean
  explanation     String
  pointsEarned    Int      @default(0)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())

  session         ToolSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([deletedAt])
  @@index([isCorrect])
}
```

### Resources (downloadable)

```prisma
model Resource {
  id          String   @id @default(cuid())
  moduleId    String?
  title       String
  description String   @default("")
  type        ResourceType
  fileUrl     String
  fileSize    Int?     // bytes
  isPublished Boolean  @default(false)
  publishedAt DateTime?
  sortOrder   Int      @default(0)
  deletedAt   DateTime?
  createdById String?
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  module      Module? @relation(fields: [moduleId], references: [id])
  author      User?   @relation("ResourceAuthor", fields: [createdById], references: [id])

  @@index([moduleId])
  @@index([isPublished, sortOrder])
  @@index([deletedAt])
  @@index([type])
}

enum ResourceType {
  PDF
  SPREADSHEET
  TEMPLATE
  CHEAT_SHEET
  VIDEO
  LINK
  OTHER
}
```

### Content Drafts (work-in-progress lessons)

```prisma
model ContentDraft {
  id              String   @id @default(cuid())
  lessonId        String?  // null = new lesson being drafted
  title           String
  content         String   // MDX
  status          DraftStatus @default(WORKING)
  reviewNotes     String?
  reviewedById    String?
  reviewedAt      DateTime?
  deletedAt       DateTime?
  createdById     String?
  updatedById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  author          User? @relation("ContentDraftAuthor", fields: [createdById], references: [id])

  @@index([lessonId])
  @@index([status])
  @@index([deletedAt])
  @@index([createdById, createdAt])
}

enum DraftStatus {
  WORKING
  IN_REVIEW
  APPROVED
  PUBLISHED
  REJECTED
}
```

### Pricing Tiers & Payments

```prisma
model PricingTier {
  id          String   @id @default(cuid())
  slug        String   @unique  // "ppc-foundations", "accelerated-mastery", "ultimate-transformation"
  name        String
  description String
  pricePhp    Int      // centavos (299900 = ₱2,999.00)
  tier        CourseTier @unique
  features    String   // JSON array of feature bullets
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  paymongoProductId String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  enrollments Enrollment[]
  courses     Course[]
  discounts   DiscountTier[]
  checkouts   CheckoutSession[]
  payments    Payment[]

  @@index([isActive, sortOrder])
  @@index([deletedAt])
}

model CheckoutSession {
  id              String   @id @default(cuid())
  userId          String?  // nullable for guest checkout
  email           String
  pricingTierId   String
  status          CheckoutStatus @default(PENDING)
  paymongoInvoiceId String?  @unique
  paymongoInvoiceUrl String?
  amountPhp       Int
  discountCodeId  String?
  discountAmount  Int      @default(0)
  finalAmountPhp  Int
  expiresAt       DateTime
  paidAt          DateTime?
  failedAt        DateTime?
  failureReason   String?
  ipAddress       String?
  userAgent       String?
  metadata        String?  // JSON
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User?         @relation(fields: [userId], references: [id])
  pricingTier     PricingTier   @relation(fields: [pricingTierId], references: [id])
  discountCode    DiscountCode? @relation(fields: [discountCodeId], references: [id])
  payment         Payment?

  @@index([userId])
  @@index([status])
  @@index([paymongoInvoiceId])
  @@index([expiresAt])
  @@index([deletedAt])
}

enum CheckoutStatus {
  PENDING
  AWAITING_PAYMENT
  PAID
  EXPIRED
  FAILED
  ERROR
}

model Payment {
  id                String   @id @default(cuid())
  userId            String
  pricingTierId     String
  enrollmentId      String?  @unique
  checkoutSessionId String?  @unique
  paymongoPaymentId   String?  @unique
  paymongoChargeId    String?
  amountPhp         Int      // centavos
  feePhp            Int      @default(0)
  netAmountPhp      Int
  currency          String   @default("PHP")
  method            PaymentMethod
  status            PaymentStatus @default(PENDING)
  paidAt            DateTime?
  refundedAt        DateTime?
  refundAmountPhp   Int?
  refundReason      String?
  receiptUrl        String?
  invoiceUrl        String?
  metadata          String?  // JSON of PayMongo response
  deletedAt         DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User             @relation(fields: [userId], references: [id])
  pricingTier       PricingTier      @relation(fields: [pricingTierId], references: [id])
  enrollment        Enrollment?      @relation(fields: [enrollmentId], references: [id])
  checkoutSession   CheckoutSession? @relation(fields: [checkoutSessionId], references: [id])
  refundRequests    RefundRequest[]

  @@index([userId])
  @@index([status])
  @@index([paymongoPaymentId])
  @@index([paidAt])
  @@index([deletedAt])
}

enum PaymentMethod {
  GCASH
  MAYA
  GRABPAY
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  OTC
  OTHER
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

model DiscountCode {
  id              String   @id @default(cuid())
  code            String   @unique
  description     String
  type            DiscountType
  value           Int      // percentage (1-100) or centavos
  maxUses         Int?
  currentUses     Int      @default(0)
  minPurchasePhp  Int      @default(0)
  startsAt        DateTime
  expiresAt       DateTime
  isActive        Boolean  @default(true)
  createdById     String
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  createdBy       User           @relation(fields: [createdById], references: [id])
  tiers           DiscountTier[]
  checkouts       CheckoutSession[]

  @@index([code])
  @@index([isActive, startsAt, expiresAt])
  @@index([deletedAt])
}

model DiscountTier {
  id            String   @id @default(cuid())
  discountId    String
  pricingTierId String

  discount      DiscountCode @relation(fields: [discountId], references: [id], onDelete: Cascade)
  pricingTier   PricingTier  @relation(fields: [pricingTierId], references: [id], onDelete: Cascade)

  @@unique([discountId, pricingTierId])
}

enum DiscountType {
  PERCENTAGE
  FIXED
}

model RefundRequest {
  id          String   @id @default(cuid())
  userId      String
  paymentId   String
  reason      String
  amountPhp   Int
  status      RefundStatus @default(PENDING)
  reviewedById String?
  reviewedAt  DateTime?
  reviewerNotes String?
  paymongoRefundId String?
  processedAt DateTime?
  failedAt    DateTime?
  failureReason String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  payment     Payment  @relation(fields: [paymentId], references: [id])
  reviewedBy  User?    @relation("RefundReviewer", fields: [reviewedById], references: [id])

  @@index([userId])
  @@index([status])
  @@index([paymentId])
  @@index([deletedAt])
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  PROCESSED
  FAILED
}
```

### Audit Log

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  actorId     String
  action      String   // "user.suspend", "course.publish", "payment.refund"
  entityType  String   // "User", "Course", "Payment"
  entityId    String
  metadata    String?  // JSON of relevant changes
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  actor       User     @relation("AuditLogActor", fields: [actorId], references: [id])

  @@index([actorId, createdAt])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
}
```

Immutable. No updates. No deletes. 2-year retention, then archived to cold storage.

### Team (for instructors)

```prisma
model TeamMember {
  id        String   @id @default(cuid())
  userId    String
  role      TeamRole @default(MEMBER)
  joinedAt  DateTime @default(now())
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@index([deletedAt])
}

enum TeamRole {
  MEMBER
  INSTRUCTOR
  ADMIN
}
```

---

## JSON Column Schemas

Documented in `src/types/json-schemas.ts`:

```typescript
// Badge.criteria
export interface BadgeCriteria {
  type: 'module_complete' | 'quiz_score' | 'streak_days' | 'tool_sessions' | 'xp_threshold';
  threshold: number;
  scope?: { moduleId?: string; quizId?: string; toolType?: ToolType };
}

// ToolSession.state (Campaign Builder)
export interface CampaignBuilderState {
  draft: {
    name: string;
    type: CampaignType;
    targetingType: TargetingType;
    dailyBudget: number;
    bidStrategy: BidStrategy;
    defaultBid: number;
    adGroups: CampaignAdGroup[];
  };
  currentStep: number;
  hintsUsed: number;
  startedAt: string;
}

// ToolSession.state (Bid Elevator)
export interface BidElevatorState {
  scenarioId: string;
  currentDecision: { keywordId: string; newBid: number };
  decisions: Record<string, number>;
  budgetRemaining: number;
}

// ToolSession.state (STR Triage)
export interface StrTriageState {
  scenarioId: string;
  decisions: Array<{
    searchTermId: string;
    action: 'keep' | 'pause' | 'negate-exact' | 'negate-phrase' | 'optimize-bid';
    newBid?: number;
    negativeKeyword?: string;
  }>;
  currentIndex: number;
}

// QuizAttempt.answers
export type QuizAnswers = Record<string, 'A' | 'B' | 'C' | 'D'>;

// Certificate.metadata
export interface CertificateMetadata {
  courseTitle: string;
  studentName: string;
  issuedBy: string;
  issuedManually?: boolean;
}

// PricingTier.features
export interface PricingTierFeatures {
  bullets: string[];
  includesLiveClasses: boolean;
  includesOneOnOne: boolean;
  monthlySupportHours?: number;
}
```

---

## Index Coverage Audit

Every hot read path has a covering index:

| Query | Index Used |
|-------|-----------|
| `findUnique(User, email)` | `@@unique([email])` |
| `findMany(Enrollment, userId, status)` | `@@index([userId, status])` (via `@@unique([userId, courseId])` + `@@index([status])`) |
| `findMany(ModuleProgress, userId, status)` | `@@index([userId, status])` |
| `findMany(LessonProgress, userId, status)` | `@@index([userId, status])` |
| `findMany(QuizAttempt, userId, quizId)` | `@@index([userId, quizId])` |
| `findMany(ToolSession, userId, toolType)` | `@@index([userId, toolType])` |
| `findMany(LiveClass, isPublished, scheduledAt)` | `@@index([isPublished, scheduledAt])` |
| `findMany(Badge, isPublished, category)` | `@@index([category])` + `@@index([isPublished])` |
| `findMany(AuditLog, actorId, createdAt)` | `@@index([actorId, createdAt])` |
| `findUnique(Certificate, verificationHash)` | `@@index([verificationHash])` + `@@unique([verificationHash])` |
| `findMany(UserBadge, userId, earnedAt)` | `@@index([userId, earnedAt])` |
| `findMany(Course, isPublished, sortOrder)` | `@@index([isPublished, sortOrder])` |

Verified via `EXPLAIN QUERY PLAN` after Sprint 0 baseline.

---

## Migration Strategy

Day 1 migrations:

1. Initial schema (this doc).
2. Seed PricingTier with the three tiers.
3. Seed admin user.
4. Seed fixture content (modules, lessons, badges, scenarios).

Every subsequent schema change follows ADR-012 (soft-delete), ADR-013 (soft-publish), ADR-014 (audit log).

---

## Backup and Restore

- **Dev:** Daily PostgreSQL backup (pg_dump) to `~/.hermes/backups/amph-v2/`. 7-day retention.
- **Production:** Vercel Postgres automatic daily backups. 30-day retention.
- **Quarterly restore drill:** Restore production backup to staging. Smoke test. Document findings.

---

## What This Schema Doesn't Have

By design:

- **No Organization model.** ADR-015: not multi-tenant.
- **No AI/ML tables.** ADR-003: no AI features.
- **No `orgId` columns.** Removed entirely.
- **No `Simulation` legacy table.** Replaced by ToolSession/ToolResult.
- **No nullable polymorphic relations.** Everything has explicit foreign keys.
- **No `metadata String` on every model.** Only on entities where JSON shape is genuinely flexible (Payment, Certificate, ToolSession).

---

*This is the source of truth. Update this doc before updating schema.prisma.*