#!/usr/bin/env node

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

const targets = ['src/lib'];
let failed = false;

for (const [filePath, metrics] of Object.entries(summary)) {
  if (!targets.some((t) => filePath.startsWith(t))) {
    continue;
  }

  for (const [metric, value] of Object.entries(metrics)) {
    const threshold = THRESHOLD[metric];
    if (threshold === undefined) continue;
    const pct = Number(value.total ? ((value.total - value.covered) / value.total) * 100 : 100);
    const coveredPct = Number(value.total ? (value.covered / value.total) * 100 : 100);
    const status = coveredPct >= threshold ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failed = true;
    console.log(`${status} ${metric} ${filePath}: ${coveredPct.toFixed(1)}% (threshold ${threshold}%)`);
  }
}

if (failed) {
  console.error('Coverage threshold check failed.');
  process.exit(1);
}

console.log('Coverage thresholds met.');
process.exit(0);
