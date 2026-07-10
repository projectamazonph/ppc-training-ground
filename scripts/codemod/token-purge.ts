#!/usr/bin/env tsx
/**
 * token-purge — Codemod to rewrite common Field Manual violations.
 *
 * Scans src/ for:
 *   1. Tailwind utility classes in className → suggests CSS Module refs
 *   2. Inline hex colors in style objects → CSS custom property refs
 *
 * Idempotent: safe to run repeatedly.
 *
 * Usage:
 *   npx tsx scripts/codemod/token-purge.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const TOKENS_CSS = path.resolve(__dirname, '../../src/styles/tokens.css');
const DRY_RUN = process.argv.includes('--dry-run');

const PDF_GENERATORS = /cert-pdf|receipt-pdf/;

// ─── Hex → CSS variable map (from globals.css :root) ─────────────
const HEX_TO_VAR: Record<string, string> = {
  '#FAFAF7': 'var(--surface-0)',
  '#FFFFFF': 'var(--surface-1)',
  '#F4F3EE': 'var(--surface-2)',
  '#1A1A1A': 'var(--surface-3)',
  '#171717': 'var(--ink-900)',
  '#404040': 'var(--ink-700)',
  '#737373': 'var(--ink-500)',
  '#D4D4D4': 'var(--ink-300)',
  '#E5E5E0': 'var(--border)',
  '#A3A3A3': 'var(--border-strong)',
  '#FF6B35': 'var(--accent)',
  '#E55A2B': 'var(--accent-hover)',
  '#FFE5D9': 'var(--accent-soft)',
  '#0E7C3A': 'var(--success)',
  '#DCFCE7': 'var(--success-soft)',
  '#B45309': 'var(--warning)',
  '#FEF3C7': 'var(--warning-soft)',
  '#B91C1C': 'var(--danger)',
  '#FEE2E2': 'var(--danger-soft)',
  '#1E40AF': 'var(--info)',
  '#DBEAFE': 'var(--info-soft)',
};

// ─── Tailwind → Field Manual token map ────────────────────────────
const TAILWIND_REPLACEMENTS: Record<string, string> = {
  'bg-white': 'background: var(--surface-1)',
  'bg-gray-50': 'background: var(--surface-2)',
  'bg-gray-900': 'background: var(--surface-3)',
  'text-gray-500': 'color: var(--ink-500)',
  'text-gray-700': 'color: var(--ink-700)',
  'text-gray-900': 'color: var(--ink-900)',
  'text-white': 'color: var(--ink-inverse)',
  'text-orange-500': 'color: var(--accent)',
  'border-gray-200': 'border-color: var(--border)',
  'border-gray-400': 'border-color: var(--border-strong)',
};

// ─── Helpers ──────────────────────────────────────────────────────

function findAllTsx(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllTsx(full));
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

interface Violation {
  file: string;
  line: number;
  type: 'tailwind-class' | 'inline-hex';
  detail: string;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const rel = path.relative(SRC, filePath);

  // Skip tokens.css and PDF generators
  if (filePath === TOKENS_CSS) return violations;
  if (PDF_GENERATORS.test(filePath)) return violations;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for Tailwind classes in className
    const classNameMatch = line.match(/className=["'`]([^"'`]*?)["'`]/);
    if (classNameMatch) {
      const classes = classNameMatch[1].split(/\s+/);
      for (const cls of classes) {
        if (TAILWIND_REPLACEMENTS[cls]) {
          violations.push({
            file: rel,
            line: lineNum,
            type: 'tailwind-class',
            detail: `"${cls}" → ${TAILWIND_REPLACEMENTS[cls]}`,
          });
        }
      }
    }

    // Check for inline hex colors in style props
    const hexMatch = line.match(/['"]#([0-9A-Fa-f]{3,8})['"]/);
    if (hexMatch && line.includes('style')) {
      const hex = hexMatch[0];
      const upper = hex.toUpperCase().replace(/['"]/g, '');
      const variable = HEX_TO_VAR[upper];
      if (variable) {
        violations.push({
          file: rel,
          line: lineNum,
          type: 'inline-hex',
          detail: `${hex} → ${variable}`,
        });
      }
    }
  }

  return violations;
}

function fixFile(filePath: string): { fixed: boolean; count: number } {
  if (filePath === TOKENS_CSS) return { fixed: false, count: 0 };
  if (PDF_GENERATORS.test(filePath)) return { fixed: false, count: 0 };

  let content = fs.readFileSync(filePath, 'utf-8');
  let count = 0;

  // Replace hex colors with CSS variables
  for (const [hex, variable] of Object.entries(HEX_TO_VAR)) {
    // Match hex in quotes (style objects)
    const patterns = [
      new RegExp(`['"]${hex.replace(/#/, '#')}['"]`, 'gi'),
      new RegExp(`['"]${hex.replace(/#/, '#').toLowerCase()}['"]`, 'gi'),
    ];
    for (const pat of patterns) {
      const before = content;
      content = content.replace(pat, `'${variable}'`);
      if (content !== before) count++;
    }
  }

  if (count > 0 && !DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return { fixed: count > 0, count };
}

// ─── Main ─────────────────────────────────────────────────────────

function main() {
  console.log(`🔍 Scanning ${SRC} for Field Manual violations...`);
  if (DRY_RUN) console.log('   (dry-run — no files will be modified)\n');

  const files = findAllTsx(SRC);
  console.log(`   Found ${files.length} source files\n`);

  // Scan all files
  const allViolations: Violation[] = [];
  for (const f of files) {
    allViolations.push(...scanFile(f));
  }

  if (allViolations.length === 0) {
    console.log('✅ No violations found. Codebase is clean.');
    console.log('   Codemod has nothing to fix.');
    process.exit(0);
  }

  // Group by type
  const tailwind = allViolations.filter((v) => v.type === 'tailwind-class');
  const hexColors = allViolations.filter((v) => v.type === 'inline-hex');

  console.log(`📋 Found ${allViolations.length} violations:`);
  if (tailwind.length) console.log(`   - Tailwind classes: ${tailwind.length}`);
  if (hexColors.length) console.log(`   - Inline hex colors: ${hexColors.length}`);
  console.log('');

  // Print details
  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line} — ${v.detail}`);
  }

  // Auto-fix hex colors
  let fixedCount = 0;
  for (const f of files) {
    const { fixed, count } = fixFile(f);
    if (fixed) {
      fixedCount++;
      console.log(`\n  🔧 Fixed ${count} hex color(s) in ${path.relative(SRC, f)}`);
    }
  }

  if (fixedCount > 0 && !DRY_RUN) {
    console.log(`\n✅ Fixed ${fixedCount} file(s). Run again to verify idempotency.`);
  } else if (tailwind.length > 0) {
    console.log(`\n⚠️  ${tailwind.length} Tailwind class violations need manual review.`);
    console.log('   Auto-rewrite requires CSS Module file creation — not safe to automate.');
  }

  process.exit(allViolations.length > 0 ? 1 : 0);
}

main();
