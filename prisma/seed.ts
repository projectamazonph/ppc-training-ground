/**
 * Seed script — idempotent, safe to re-run.
 *
 * Creates:
 *  - 1 admin user (email from ADMIN_EMAIL env, password "ChangeMe123!")
 *  - 3 PricingTiers (PPC Foundations / Accelerated Mastery / Ultimate Transformation)
 *  - 5 Badges with full enum fields
 *
 * To reset and re-seed: pnpm prisma migrate reset (drops + recreates DB)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  UserRole,
  UserStatus,
  CourseTier,
  BadgeCategory,
  BadgeTier,
  EnrollmentStatus,
} from '../src/lib/enums';
import { randomBytes, scryptSync } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

function hashPassword(password: string): string {
  // Format: scrypt$<salt-hex>$<hash-hex>
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt\$${salt}\$${hash}`;
}

async function upsertAdminUser(): Promise<void> {
  // C5: fail loudly when ADMIN_EMAIL or ADMIN_PASSWORD is missing instead of
  // silently seeding a well-known ([email protected] / ChangeMe123!) admin
  // account — that fallback shipping to production would be a standing
  // account-takeover hole.
  const isProduction = process.env.NODE_ENV === 'production';
  // Canonicalize to match the app's trim().toLowerCase() contract, so a
  // mixed-case ADMIN_EMAIL still matches canonicalized sign-in lookups.
  const rawEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const rawPassword = process.env.ADMIN_PASSWORD ?? '';
  if (isProduction && (!rawEmail || !rawPassword.trim())) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required in production. ' +
      'Set them in .env.local or your deployment environment.',
    );
  }
  if (!rawEmail) {
    throw new Error('ADMIN_EMAIL must not be empty.');
  }
  if (!rawPassword.trim()) {
    throw new Error('ADMIN_PASSWORD must not be empty or whitespace-only.');
  }
  const email = rawEmail;
  const password = rawPassword;

  await prisma.user.upsert({
    where: { email },
    update: {
      emailVerified: new Date(),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email,
      name: 'Ryan Dabao',
      emailVerified: new Date(),
      passwordHash: hashPassword(password),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`  ✓ admin user: ${email}`);
}

async function upsertPricingTiers(): Promise<void> {
  const tiers = [
    {
      slug: 'ppc-foundations',
      name: 'PPC Foundations',
      tier: CourseTier.PPC_FOUNDATIONS,
      pricePhp: 299900, // PHP 2,999.00 in centavos
      description:
        'Five core modules. The basics of Amazon advertising — campaign structure, bid logic, search term triage.',
      features: JSON.stringify({
        bullets: [
          '5 core modules (~15 hours)',
          'Campaign Builder simulator',
          'Bid Elevator simulator',
          'Search Term Triage simulator',
          'Badges and progress tracking',
        ],
        includesLiveClasses: false,
        includesOneOnOne: false,
      }),
      sortOrder: 1,
    },
    {
      slug: 'accelerated-mastery',
      name: 'Accelerated Mastery',
      tier: CourseTier.ACCELERATED_MASTERY,
      pricePhp: 599900, // PHP 5,999.00
      description:
        'The Foundations course, plus the Accelerated Mastery course: 4 more modules and all scenario packs across five product categories.',
      features: JSON.stringify({
        bullets: [
          'Foundations (5 modules) + Accelerated Mastery (4 modules), ~25 hours total',
          'Every scenario pack: kitchen, electronics, garden, fitness, beauty',
          'All downloadable resources and templates',
          'Live class recordings library',
          'Priority badge progression',
        ],
        includesLiveClasses: false,
        includesOneOnOne: false,
      }),
      sortOrder: 2,
    },
    {
      slug: 'ultimate-transformation',
      name: 'Ultimate Transformation',
      tier: CourseTier.ULTIMATE_TRANSFORMATION,
      pricePhp: 999900, // PHP 9,999.00
      description:
        'Everything in Mastery, plus weekly live classes with Ryan and a monthly 1-on-1 portfolio review.',
      features: JSON.stringify({
        bullets: [
          'Foundations + Accelerated Mastery, plus early-access new content',
          'Weekly live classes with Ryan',
          '1-on-1 portfolio review every month',
          'Private community channel',
          'Priority certificate review',
          'Custom resource requests',
        ],
        includesLiveClasses: true,
        includesOneOnOne: true,
        monthlySupportHours: 2,
      }),
      sortOrder: 3,
    },
  ];

  for (const tier of tiers) {
    await prisma.pricingTier.upsert({
      where: { slug: tier.slug },
      update: {
        name: tier.name,
        description: tier.description,
        pricePhp: tier.pricePhp,
        tier: tier.tier,
        features: tier.features,
        sortOrder: tier.sortOrder,
        isActive: true,
      },
      create: {
        slug: tier.slug,
        name: tier.name,
        description: tier.description,
        pricePhp: tier.pricePhp,
        tier: tier.tier,
        features: tier.features,
        sortOrder: tier.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`  ✓ pricing tiers: ${tiers.length}`);
}

async function upsertBadges(): Promise<void> {
  const badges = [
    {
      slug: 'first-lesson',
      title: 'First Steps',
      description: 'Completed your first lesson.',
      icon: 'BookOpen',
      category: BadgeCategory.ENGAGEMENT,
      tier: BadgeTier.BRONZE,
      xpReward: 25,
      criteria: JSON.stringify({
        type: 'module_complete',
        threshold: 1,
      }),
      order: 1,
    },
    {
      slug: 'quiz-ace',
      title: 'Quiz Ace',
      description: 'Scored 100% on a quiz.',
      icon: 'Trophy',
      category: BadgeCategory.MASTERY,
      tier: BadgeTier.SILVER,
      xpReward: 50,
      criteria: JSON.stringify({
        type: 'quiz_score',
        threshold: 100,
      }),
      order: 2,
    },
    {
      slug: 'campaign-builder-master',
      title: 'Campaign Builder Master',
      description: 'Completed all Campaign Builder scenarios with a passing score.',
      icon: 'Rocket',
      category: BadgeCategory.MASTERY,
      tier: BadgeTier.GOLD,
      xpReward: 150,
      criteria: JSON.stringify({
        type: 'tool_sessions',
        threshold: 5,
        scope: { toolType: 'CAMPAIGN_BUILDER' },
      }),
      order: 3,
    },
    {
      slug: 'streak-7',
      title: 'Week Warrior',
      description: 'Logged in 7 days in a row.',
      icon: 'Flame',
      category: BadgeCategory.STREAK,
      tier: BadgeTier.SILVER,
      xpReward: 75,
      criteria: JSON.stringify({
        type: 'streak_days',
        threshold: 7,
      }),
      order: 4,
    },
    {
      slug: 'xp-1000',
      title: 'Thousandaire',
      description: 'Earned 1,000 XP total.',
      icon: 'Sparkle',
      category: BadgeCategory.XP_MILESTONE,
      tier: BadgeTier.GOLD,
      xpReward: 100,
      criteria: JSON.stringify({
        type: 'xp_threshold',
        threshold: 1000,
      }),
      order: 5,
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: {
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        tier: badge.tier,
        xpReward: badge.xpReward,
        criteria: badge.criteria,
        order: badge.order,
        isPublished: true,
      },
      create: badge,
    });
  }

  console.log(`  ✓ badges: ${badges.length}`);
}

async function upsertLiveClasses(): Promise<void> {
  // Skip seeding if no published course exists yet. The script runs after
  // import-amph-content.ts so this should be safe, but guard anyway.
  const course = await prisma.course.findFirst({
    where: { isPublished: true, deletedAt: null },
    select: { id: true },
  });
  if (!course) {
    console.log('  • live classes: skipped (no published course)');
    return;
  }

  // Seed two demo classes — one ~2 weeks out, one in the past with a recording.
  const now = Date.now();
  const upcoming = new Date(now + 14 * 24 * 60 * 60 * 1000);
  upcoming.setUTCHours(13, 0, 0, 0); // 9pm Manila
  const past = new Date(now - 7 * 24 * 60 * 60 * 1000);
  past.setUTCHours(13, 0, 0, 0);

  const classes = [
    {
      title: 'Weekly Office Hours — Bring Your Live Campaigns',
      description:
        'Drop into the working session with Ryan. We will screen-share your live Sponsored Products campaigns, review ACoS anomalies, and answer whatever is on your plate this week.',
      scheduledAt: upcoming,
      durationMinutes: 60,
      meetingUrl: 'https://meet.google.com/demo-amph-office-hours',
      instructorName: 'Ryan Dabao',
      maxAttendees: 50,
      isPublished: true,
    },
    {
      title: 'Search Term Triage Workshop (Recorded)',
      description:
        'Working session on triaging 400+ search-term rows in the Amazon Ads console. Includes the 5-bucket action framework and a follow-up template for weekly maintenance.',
      scheduledAt: past,
      durationMinutes: 90,
      recordingUrl: 'https://www.youtube.com/watch?v=demo-recording-amph',
      instructorName: 'Ryan Dabao',
      maxAttendees: 50,
      isPublished: true,
    },
  ];

  for (const klass of classes) {
    // Use slug-anchored upsert via title match — slug isn't a column on the
    // model so we anchor on (courseId, title) to keep idempotency.
    const existing = await prisma.liveClass.findFirst({
      where: {
        courseId: course.id,
        title: klass.title,
        deletedAt: null,
      },
    });

    if (existing) {
      await prisma.liveClass.update({
        where: { id: existing.id },
        data: { ...klass, courseId: course.id },
      });
    } else {
      await prisma.liveClass.create({
        data: { ...klass, courseId: course.id },
      });
    }
  }

  console.log(`  ✓ live classes: ${classes.length}`);
}

async function grandfatherFreeEnrollment(): Promise<void> {
  // STORY-027: any pre-existing user (admin + any earlier dev users from
  // before payments existed) gets a free PPC Foundations enrollment so the
  // tier gate doesn't lock the curriculum. Idempotent — skips users who
  // already have any non-deleted enrollment at any status.
  const tier = await prisma.pricingTier.findUnique({
    where: { slug: 'ppc-foundations' },
    select: { id: true, tier: true },
  });
  if (!tier) {
    console.log('  ⚠ ppc-foundations tier missing — skipping grandfather');
    return;
  }
  const course = await prisma.course.findFirst({
    where: { pricingTierId: tier.id, deletedAt: null },
    select: { id: true },
  });
  if (!course) {
    console.log('  ⚠ no course bound to ppc-foundations — skipping grandfather');
    return;
  }

  const candidates = await prisma.user.findMany({
    where: {
      enrollments: { none: { deletedAt: null } },
    },
    select: { id: true, email: true },
  });

  if (candidates.length === 0) {
    console.log('  ✓ grandfather: 0 users needed backfill');
    return;
  }

  let created = 0;
  for (const u of candidates) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: course.id } },
      update: {},
      create: {
        userId: u.id,
        courseId: course.id,
        pricingTierId: tier.id,
        tier: tier.tier,
        status: EnrollmentStatus.ACTIVE,
        // Backdate so the timeline reflects "this user had access before
        // payments launched" rather than "right now at seed time".
        enrolledAt: new Date('2026-07-01T00:00:00Z'),
      },
    });
    created += 1;
  }
  console.log(`  ✓ grandfather: ${created} user(s) → free PPC Foundations`);
}

async function main(): Promise<void> {
  console.log('Seeding Project Amazon PH Academy v2...\n');

  await upsertAdminUser();
  await upsertPricingTiers();
  await upsertBadges();
  await upsertLiveClasses();
  await grandfatherFreeEnrollment();

  console.log('\nSeed complete.');
  console.log(`\nSign in with the admin email you configured (ADMIN_EMAIL): ${process.env.ADMIN_EMAIL ?? '(unset)'}`);
  console.log('Use the ADMIN_PASSWORD you set. Change it after first sign-in.');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });