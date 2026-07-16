#!/usr/bin/env tsx
/**
 * Import AMPH-Academy content into the new amph-v2 Prisma database.
 *
 * Source: AMPH-Academy project content directory:
 *   - content/modules (9 module directories, 31 MDX lesson files)
 *   - fixtures/quiz-questions.json (8 quizzes, ~40 questions)
 *
 * Targets:
 *   Course         "Project Amazon PH Academy"
 *   Module x9      One per AMPH module (0-onboarding through 8-competitive)
 *   Lesson x31     One per MDX file
 *   Quiz x8        One per quiz in the JSON
 *   QuizQuestion   For each question in each quiz
 *
 * Currency handling:
 *   AMPH lessons use USD throughout. Filipino VA audience wants PHP.
 *   Strategy: convert $X.XX to PHP equivalent (multiply by 50, approximate
 *   exchange rate), keep both for clarity in the rewritten text.
 *
 * Idempotency: uses upsert by slug. Safe to re-run.
 *
 * Usage:  pnpm tsx scripts/import-amph-content.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { CourseDifficulty } from '../src/lib/enums';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

const SOURCE_ROOT = '/storage/emulated/0/Hermes Projects/projects/AMPH-Academy/project';
const MODULES_DIR = join(SOURCE_ROOT, 'content/modules');
const QUIZ_FIXTURE = join(SOURCE_ROOT, 'fixtures/quiz-questions.json');

// Course metadata — single course for now
const COURSE = {
  slug: 'amph-foundations',
  title: 'Project Amazon PH Academy',
  description:
    'Amazon advertising training for Filipino virtual assistants. Master CPC, ACoS, ROAS, campaign architecture, bidding, search term triage, and competitive intelligence through structured modules and interactive tools.',
  difficulty: 'FOUNDATIONS' as CourseDifficulty,
  // Attached at import time by looking up the PPC Foundations PricingTier.
  pricingTierSlug: 'ppc-foundations',
  estimatedHours: 25,
};

// Module metadata (order matches AMPH file structure)
const MODULE_META: Array<{
  dirName: string;
  moduleNumber: number;
  title: string;
  description: string;
  estimatedMinutes: number;
}> = [
  { dirName: '0-onboarding', moduleNumber: 0, title: 'Onboarding', description: 'Get oriented to Project Amazon PH Academy and the Amazon advertising landscape.', estimatedMinutes: 30 },
  { dirName: '1-foundations', moduleNumber: 1, title: 'PPC Foundations', description: 'The Big Six metrics: CPC, CTR, ACoS, TACoS, ROAS, conversion rate. The numbers every operator lives by.', estimatedMinutes: 90 },
  { dirName: '2-keyword-research', moduleNumber: 2, title: 'Keyword Research', description: 'Match types, negative keywords, keyword grouping, and the research workflow.', estimatedMinutes: 75 },
  { dirName: '3-listing-optimization', moduleNumber: 3, title: 'Listing Optimization', description: 'Listing quality score, listing anatomy, A+ content. The conversion foundation under every campaign.', estimatedMinutes: 60 },
  { dirName: '4-campaign-architecture', moduleNumber: 4, title: 'Campaign Architecture', description: 'Sponsored Products, Brands, and Display. How to structure campaigns for scale.', estimatedMinutes: 80 },
  { dirName: '5-portfolio-strategy', moduleNumber: 5, title: 'Portfolio Strategy', description: 'Portfolios, budget pacing, seasonal strategy. Operating at the account level.', estimatedMinutes: 60 },
  { dirName: '6-bidding-lab', moduleNumber: 6, title: 'Bidding Lab', description: 'Bid strategies, placement adjustments, and prep for the Bid Elevator simulator.', estimatedMinutes: 60 },
  { dirName: '7-search-term-triage', moduleNumber: 7, title: 'Search Term Triage', description: 'STR analysis, negative keyword extraction, prep for the STR Triage simulator.', estimatedMinutes: 60 },
  { dirName: '8-competitive-intelligence', moduleNumber: 8, title: 'Competitive Intelligence', description: 'Brand Analytics, share of voice, competitor benchmarking.', estimatedMinutes: 60 },
];

/**
 * Convert $X.XX → "₱{X*50} (about $X.XX)" to keep both currencies visible.
 * Only matches USD amounts in content. Skips percentages and other numerics.
 */
function convertCurrency(markdown: string): string {
  // Match $123.45 or $123 (no decimals)
  return markdown.replace(/\$(\d+(?:\.\d+)?)/g, (match, amount) => {
    const num = parseFloat(amount);
    const php = Math.round(num * 50);
    return `₱${php.toLocaleString('en-PH')} (about ${match})`;
  });
}

/**
 * Parse the YAML frontmatter from an MDX file. Returns {frontmatter, body}.
 * Frontmatter is between --- markers at the top of the file.
 */
function parseMdx(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fm = match[1] ?? '';
  const body = match[2] ?? content;
  const frontmatter: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w+):\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && m[2] !== undefined) frontmatter[m[1]] = m[2];
  }
  return { frontmatter, body: body.trim() };
}

/**
 * Generate a short excerpt from the lesson body (first 200 chars of text).
 */
function makeExcerpt(body: string): string {
  // Strip basic markdown for the excerpt
  const text = body
    .replace(/^#+\s+.*$/gm, '')           // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*]+)\*/g, '$1')      // italic
    .replace(/`([^`]+)`/g, '$1')         // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^>\s+/gm, '')              // blockquote
    .replace(/^[-*]\s+/gm, '')           // list items
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, 200).trim() + (text.length > 200 ? '...' : '');
}

async function importCourse(): Promise<string> {
  // Look up the PricingTier CUID by slug so the course is tiered, not free.
  const tier = await prisma.pricingTier.findUnique({
    where: { slug: COURSE.pricingTierSlug },
    select: { id: true, tier: true },
  });

  const course = await prisma.course.upsert({
    where: { slug: COURSE.slug },
    update: {
      title: COURSE.title,
      description: COURSE.description,
      difficulty: COURSE.difficulty,
      estimatedHours: COURSE.estimatedHours,
      pricingTierId: tier?.id ?? null,
    },
    create: {
      slug: COURSE.slug,
      title: COURSE.title,
      description: COURSE.description,
      difficulty: COURSE.difficulty,
      estimatedHours: COURSE.estimatedHours,
      pricingTierId: tier?.id ?? null,
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  if (tier) {
    console.log(`  ✓ Course: ${course.title} (tier: ${tier.tier})`);
  } else {
    console.log(`  ✓ Course: ${course.title} (no tier attached — run prisma/seed.ts first)`);
  }
  return course.id;
}

async function importModules(courseId: string): Promise<Map<number, string>> {
  const moduleIdByNumber = new Map<number, string>();

  for (const meta of MODULE_META) {
    const slug = `${COURSE.slug}-${meta.dirName}`;
    const module_ = await prisma.module.upsert({
      where: { slug },
      update: {
        title: meta.title,
        description: meta.description,
        estimatedMinutes: meta.estimatedMinutes,
        order: meta.moduleNumber,
        icon: iconForModule(meta.moduleNumber),
        isPublished: true,
        publishedAt: new Date(),
      },
      create: {
        slug,
        courseId,
        moduleNumber: meta.moduleNumber,
        title: meta.title,
        description: meta.description,
        estimatedMinutes: meta.estimatedMinutes,
        order: meta.moduleNumber,
        icon: iconForModule(meta.moduleNumber),
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    moduleIdByNumber.set(meta.moduleNumber, module_.id);
    console.log(`  ✓ Module ${meta.moduleNumber}: ${module_.title}`);
  }

  return moduleIdByNumber;
}

function iconForModule(n: number): string {
  const icons = ['Rocket', 'BookOpen', 'MagnifyingGlass', 'BookOpen', 'ChartLine', 'List', 'ChartLine', 'List', 'User'];
  return icons[n] ?? 'BookOpen';
}

async function importLessons(moduleIdByNumber: Map<number, string>): Promise<number> {
  let totalLessons = 0;

  for (const meta of MODULE_META) {
    const dir = join(MODULES_DIR, meta.dirName);
    const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

    for (const file of files) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, 'utf8');
      const { frontmatter, body } = parseMdx(content);

      // Apply currency conversion
      const convertedBody = convertCurrency(body);
      const convertedTitle = convertCurrency(frontmatter.title ?? '');

      // Build slug from filename: "1.1-what-is-ppc.mdx" → "1-1-what-is-ppc"
      const fileSlug = file.replace('.mdx', '');
      const lessonSlug = `${COURSE.slug}-${fileSlug}`;

      // Parse lesson number from filename: "1.1-..." → 1
      const lessonNumberMatch = fileSlug.match(/^(\d+)\.(\d+)/);
      if (!lessonNumberMatch) {
        console.warn(`  ! Skipping ${file} — cannot parse lesson number`);
        continue;
      }
      const lessonNumber = parseInt(lessonNumberMatch[2] ?? '1', 10);

      const moduleId = moduleIdByNumber.get(meta.moduleNumber);
      if (!moduleId) continue;

      const lessonType = (frontmatter.type ?? 'READING').toUpperCase() as 'READING' | 'SIMULATION' | 'QUIZ' | 'VIDEO';

      await prisma.lesson.upsert({
        where: { slug: lessonSlug },
        update: {
          title: convertedTitle,
          content: convertedBody,
          excerpt: makeExcerpt(convertedBody),
          type: lessonType,
          lessonNumber,
          estimatedMinutes: parseInt(frontmatter.estimatedMinutes ?? '10', 10),
          xpReward: parseInt(frontmatter.xpReward ?? '50', 10),
          isPublished: true,
          publishedAt: new Date(),
        },
        create: {
          slug: lessonSlug,
          moduleId,
          lessonNumber,
          title: convertedTitle,
          content: convertedBody,
          excerpt: makeExcerpt(convertedBody),
          type: lessonType,
          estimatedMinutes: parseInt(frontmatter.estimatedMinutes ?? '10', 10),
          xpReward: parseInt(frontmatter.xpReward ?? '50', 10),
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      totalLessons++;
    }
    console.log(`  ✓ Module ${meta.moduleNumber}: ${files.length} lessons imported`);
  }

  return totalLessons;
}

async function importQuizzes(): Promise<number> {
  const raw = readFileSync(QUIZ_FIXTURE, 'utf8');
  const fixture = JSON.parse(raw) as { _meta: { passThreshold: number; xpRewardPerQuiz: number }; quizzes: Array<{
    moduleNumber: number;
    title: string;
    description: string;
    questions: Array<{
      order: number;
      question: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctAnswer: string;
      explanation: string;
    }>;
  }> };

  let totalQuestions = 0;

  for (const quiz of fixture.quizzes) {
    // Find the last lesson in the module — quiz attaches to it
    const meta = MODULE_META.find((m) => m.moduleNumber === quiz.moduleNumber);
    if (!meta) continue;

    // Find the last MDX file in the module
    const dir = join(MODULES_DIR, meta.dirName);
    const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();
    const lastFile = files[files.length - 1];
    if (!lastFile) continue;
    const lastLessonSlug = `${COURSE.slug}-${lastFile.replace('.mdx', '')}`;

    const lesson = await prisma.lesson.findUnique({ where: { slug: lastLessonSlug } });
    if (!lesson) {
      console.warn(`  ! Quiz for module ${quiz.moduleNumber}: lesson ${lastLessonSlug} not found, skipping`);
      continue;
    }

    // Apply currency conversion to quiz content too
    const convertedTitle = convertCurrency(quiz.title);
    const convertedDescription = convertCurrency(quiz.description);

    const dbQuiz = await prisma.quiz.upsert({
      where: { lessonId: lesson.id },
      update: {
        title: convertedTitle,
        description: convertedDescription,
        passThreshold: fixture._meta.passThreshold,
        isPublished: true,
        publishedAt: new Date(),
      },
      create: {
        lessonId: lesson.id,
        title: convertedTitle,
        description: convertedDescription,
        passThreshold: fixture._meta.passThreshold,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    // Replace questions (cleanest path — delete and recreate)
    await prisma.quizQuestion.deleteMany({ where: { quizId: dbQuiz.id } });
    for (const q of quiz.questions) {
      await prisma.quizQuestion.create({
        data: {
          quizId: dbQuiz.id,
          order: q.order,
          question: convertCurrency(q.question),
          optionA: convertCurrency(q.optionA),
          optionB: convertCurrency(q.optionB),
          optionC: convertCurrency(q.optionC),
          optionD: q.optionD ? convertCurrency(q.optionD) : '',
          correctAnswer: q.correctAnswer,
          explanation: convertCurrency(q.explanation),
          points: 1,
        },
      });
    }

    totalQuestions += quiz.questions.length;
    console.log(`  ✓ Module ${quiz.moduleNumber} quiz: ${quiz.questions.length} questions`);
  }

  return totalQuestions;
}

async function main(): Promise<void> {
  console.log('Importing AMPH-Academy content into amph-v2...\n');

  console.log('Step 1: Course');
  const courseId = await importCourse();

  console.log('\nStep 2: Modules');
  const moduleIdByNumber = await importModules(courseId);

  console.log('\nStep 3: Lessons');
  const lessonCount = await importLessons(moduleIdByNumber);
  console.log(`  Total: ${lessonCount} lessons`);

  console.log('\nStep 4: Quizzes');
  const questionCount = await importQuizzes();
  console.log(`  Total: ${questionCount} questions`);

  console.log('\nImport complete.');
}

main()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });