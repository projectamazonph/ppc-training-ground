#!/usr/bin/env tsx
/**
 * Test helper: sign in as the seeded admin and emit the session cookie
 * value. Used by the smoke test to hit protected routes.
 *
 * Usage:
 *   DATABASE_URL="file:./dev.db" tsx scripts/smoke-test-login.ts
 */
import { scryptSync } from 'node:crypto';
import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

const EMAIL = process.env.SMOKE_EMAIL ?? '[email protected]';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'ChangeMe123!';
const AUTH_COOKIE = 'amph_session';

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not set');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(`No user with email ${EMAIL}`);
    process.exit(1);
  }

  // Verify password
  const [algo, salt, hash] = (user.passwordHash ?? '').split('$');
  if (algo !== 'scrypt' || !salt || !hash) {
    console.error('Bad passwordHash format');
    process.exit(1);
  }
  const candidate = scryptSync(PASSWORD, salt, 64).toString('hex');
  if (candidate !== hash) {
    console.error('Password mismatch');
    process.exit(1);
  }

  // Sign token
  const secretKey = new TextEncoder().encode(secret);
  const ttl = 60 * 60 * 24 * 7; // 7 days
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secretKey);

  console.log(`# User: ${user.email} (role=${user.role})`);
  console.log(`# Use this cookie in curl:`);
  console.log(`COOKIE='${AUTH_COOKIE}=${token}'`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
