#!/usr/bin/env node

/**
 * Coverage gate: enforces the aggregate thresholds from AGENTS.md (70% on
 * the covered tree — vitest.config.ts's coverage.include) using the
 * json-summary reporter output. Per-file numbers are printed as information;
 * the aggregate "total" entry is what passes or fails the build, matching
 * the thresholds vitest itself enforces.
 *
 * Note: AGENTS.md names src/app/actions as a coverage target too, but
 * vitest.config.ts currently only includes src/lib — widening the include
 * (and writing the missing action tests) is tracked as follow-up work.
 */

const fs = require('node:fs');
const path = require('node:path');

const coverageDir = path.resolve(process.cwd(), 'coverage');
const summaryPath = path.join(coverageDir, 'coverage-summary.json');

if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary not found at ${summaryPath}. Run pnpm test:coverage first.`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

const THRESHOLD = {
  lines: 70,
  functions: 70,
  branches: 70,
  statements: 70,
};

function pct(metricValue) {
  return Number(metricValue.total ? (metricValue.covered / metricValue.total) * 100 : 100);
}

// Informational: per-file coverage, worst first.
const files = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([key, metrics]) => ({
    file: path.relative(process.cwd(), key).replaceAll('\\', '/'),
    lines: pct(metrics.lines),
  }))
  .sort((a, b) => a.lines - b.lines);

console.log('Per-file line coverage (worst first):');
for (const { file, lines } of files) {
  console.log(`  ${lines.toFixed(1).padStart(5)}%  ${file}`);
}
console.log('');

// Enforced: aggregate thresholds.
const total = summary.total;
if (!total) {
  console.error('No "total" entry in coverage summary — cannot enforce thresholds.');
  process.exit(1);
}

let failed = false;
for (const [metric, threshold] of Object.entries(THRESHOLD)) {
  const coveredPct = pct(total[metric]);
  const status = coveredPct >= threshold ? 'PASS' : 'FAIL';
  if (status === 'FAIL') failed = true;
  console.log(`${status} total ${metric}: ${coveredPct.toFixed(1)}% (threshold ${threshold}%)`);
}

if (failed) {
  console.error('Coverage threshold check failed.');
  process.exit(1);
}

console.log('Coverage thresholds met.');
process.exit(0);
