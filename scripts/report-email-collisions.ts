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
  // Group by canonical (lowercased) email and report every member of any group
  // with more than one row. This catches collisions where BOTH rows are
  // non-canonical (e.g. 'Foo@Bar.com' + 'FOO@bar.com') and share a canonical
  // form, which an exact-value EXISTS lookup would miss - exactly the rows the
  // H6 migration leaves un-normalized.
  const rows = await prisma.$queryRaw<
    Array<{ id: string; email: string; canonical: string }>
  >`
    SELECT u.id, u.email, lower(btrim(u.email)) AS canonical
    FROM "User" u
    WHERE lower(btrim(u.email)) IN (
      SELECT lower(btrim(email))
      FROM "User"
      GROUP BY lower(btrim(email))
      HAVING COUNT(*) > 1
    )
    ORDER BY canonical, u.email
  `;

  if (rows.length === 0) {
    console.log('No email-canonicalization collisions - every canonical email is unique.');
    return;
  }

  console.log(`Found ${rows.length} account(s) in ${new Set(rows.map((r) => r.canonical)).size} colliding group(s), needing manual reconciliation:\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  ${r.email}  ->  canonical "${r.canonical}"`);
  }
  console.log(
    '\nResolve each group by merging or renaming the duplicate accounts, then re-run the H6 UPDATE.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
