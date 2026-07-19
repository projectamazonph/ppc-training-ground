-- Audit remediation (2026-07-17): integrity + security fixes on main.
-- Covers: XP ledger (C10), guest-claim token (C5/C6), unique refund id (C8),
-- one-active-refund-per-payment (C7), one-active-certificate-per-course (H7),
-- and canonical (lowercase) email backfill (H6).
--
-- This is a single hand-assembled migration reconciling PR #33's
-- 20260717000001_claim_token and PR #34's 20260717000000_audit_integrity_fixes
-- migrations, which both independently added `User.claimTokenHash` /
-- `User.claimTokenExpiresAt` and would collide (duplicate-column error) if
-- stacked directly on top of one another.

-- ----------------------------------------------------------------------------
-- C5/C6: guest-checkout account-claim token columns on User.
-- ----------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "claimTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "claimTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "User_claimTokenHash_idx" ON "User"("claimTokenHash");

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
-- untouched, and need manual reconciliation before a case-insensitive
-- uniqueness constraint (citext / normalized column) can be enforced.
--
-- The collision guard compares canonical-to-CANONICAL, not canonical-to-exact.
-- Two rows that are both non-canonical but share a canonical form (e.g.
-- 'Foo@Bar.com' and 'FOO@bar.com') would otherwise BOTH satisfy an exact-match
-- guard and both UPDATE to the same value in one statement (WHERE is evaluated
-- against the MVCC snapshot), violating the case-sensitive unique email index
-- and failing the migration. Canonical-to-canonical skips every member of a
-- colliding group instead.
-- ----------------------------------------------------------------------------
UPDATE "User" u
SET email = lower(btrim(u.email))
WHERE u.email <> lower(btrim(u.email))
  AND NOT EXISTS (
    SELECT 1 FROM "User" o
    WHERE o.id <> u.id
      AND lower(btrim(o.email)) = lower(btrim(u.email))
  );

-- Surface the rows we deliberately skipped (their canonical form collides with
-- another account) so they don't vanish silently: canonicalized lookups
-- (findOrCreateUserByEmail, signUpAction) query by lowercase and can't find a
-- still-mixed-case row. These need manual reconciliation. Emitted as a WARNING
-- so it shows in migration/deploy logs; run scripts/report-email-collisions.ts
-- afterwards to list them again on demand.
DO $$
DECLARE
  skipped_count INTEGER;
BEGIN
  SELECT count(*) INTO skipped_count
  FROM "User" u
  WHERE u.email <> lower(btrim(u.email))
    AND EXISTS (
      SELECT 1 FROM "User" o
      WHERE o.id <> u.id
        AND lower(btrim(o.email)) = lower(btrim(u.email))
    );
  IF skipped_count > 0 THEN
    RAISE WARNING 'H6 email canonicalization: % account(s) left un-normalized due to a case-insensitive collision. Run scripts/report-email-collisions.ts and reconcile manually.', skipped_count;
  END IF;
END $$;
