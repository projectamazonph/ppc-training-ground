-- Audit remediation (2026-07-17): integrity + security fixes on main.
-- Covers: XP ledger (C10), guest-claim token (C5/C6), unique refund id (C8),
-- one-active-refund-per-payment (C7), one-active-certificate-per-course (H7),
-- and canonical (lowercase) email backfill (H6).

-- ----------------------------------------------------------------------------
-- C5/C6: guest-checkout account-claim token columns on User.
-- ----------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "claimTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "claimTokenExpiresAt" TIMESTAMP(3);

-- ----------------------------------------------------------------------------
-- C10: XP ledger. Unique (userId, eventKey) makes every award exactly-once.
-- ----------------------------------------------------------------------------
CREATE TABLE "XpLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "XpLedger_userId_eventKey_key" ON "XpLedger" ("userId", "eventKey");
CREATE INDEX "XpLedger_userId_idx" ON "XpLedger" ("userId");
CREATE INDEX "XpLedger_createdAt_idx" ON "XpLedger" ("createdAt");

ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- C8: a PayMongo refund id may be recorded at most once.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX "RefundRequest_paymongoRefundId_key"
    ON "RefundRequest" ("paymongoRefundId");

-- ----------------------------------------------------------------------------
-- C7: at most one active (PENDING or APPROVED) refund request per payment.
-- Partial unique index — cannot be expressed in schema.prisma, so it is
-- managed by raw SQL here. Concurrent duplicate requests now fail with P2002.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX "RefundRequest_active_per_payment_key"
    ON "RefundRequest" ("paymentId")
    WHERE "deletedAt" IS NULL AND "status" IN ('PENDING', 'APPROVED');

-- ----------------------------------------------------------------------------
-- H7: at most one active certificate per (user, course).
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX "Certificate_active_per_user_course_key"
    ON "Certificate" ("userId", "courseId")
    WHERE "deletedAt" IS NULL AND "status" = 'ACTIVE';

-- ----------------------------------------------------------------------------
-- H6: backfill existing emails to canonical (trimmed, lowercase) form.
-- Rows whose canonical form would collide with another account are left
-- untouched — those need manual reconciliation before a case-insensitive
-- uniqueness constraint (citext / normalized column) can be enforced.
-- ----------------------------------------------------------------------------
UPDATE "User" u
SET email = lower(btrim(u.email))
WHERE u.email <> lower(btrim(u.email))
  AND NOT EXISTS (
    SELECT 1 FROM "User" o
    WHERE o.id <> u.id
      AND o.email = lower(btrim(u.email))
  );
