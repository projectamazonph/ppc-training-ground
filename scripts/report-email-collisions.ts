#!/usr/bin/env tsx
/**
 * Report User rows whose email is not yet canonical (trimmed + lowercase)
 * because canonicalizing it would collide with another account's email.
 *
 * The H6 backfill migration (20260718000000_audit_integrity_fixes) skips these
 * rows on purpose - normalizing them would violate the case-sensitive unique
 * email constraint. Canonicalized lookups (findOrCreateUserByEmail,
 * signUpAction) query by lowercase, so a still-mixed-case row is effectively
 * unreachable until an operator reconciles the duplicate accounts by hand.
 *
 * This script lists them so the reconciliation can actually happen.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." tsx scripts/report-email-collisions.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; email: string; canonical: string }>
  >`
    SELECT u.id, u.email, lower(btrim(u.email)) AS canonical
    FROM "User" u
    WHERE u.email <> lower(btrim(u.email))
      AND EXISTS (
        SELECT 1 FROM "User" o
        WHERE o.id <> u.id
          AND o.email = lower(btrim(u.email))
      )
    ORDER BY canonical, u.email
  `;

  if (rows.length === 0) {
    console.log('No email-canonicalization collisions - every account is canonical.');
    return;
  }

  console.log(`Found ${rows.length} account(s) needing manual reconciliation:\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  ${r.email}  →  collides with existing "${r.canonical}"`);
  }
  console.log(
    '\nResolve each by merging or renaming the duplicate account, then re-run the H6 UPDATE for that row.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
