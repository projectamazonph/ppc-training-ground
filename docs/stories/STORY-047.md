# STORY-047: Coverage Enforcement + CI Polish

**Sprint:** 10
**Points:** 0.5
**Epic:** Infrastructure

## Goal

Create the missing `scripts/check-coverage.js` (referenced by CI but doesn't exist) and ensure CI runs clean with coverage enforcement.

## Why

CI references `scripts/check-coverage.js` in the coverage threshold step — the file doesn't exist, so CI fails at that step. This is the last piece to make CI fully functional.

## Acceptance Criteria

- [ ] `scripts/check-coverage.js` exists and runs without error
- [ ] Reads Vitest coverage output (JSON or text)
- [ ] Enforces ≥70% line coverage on `src/lib/`
- [ ] Exits 0 if threshold met, exits 1 if not
- [ ] CI `quality` job passes end-to-end (all green)
- [ ] `pnpm test:coverage` output shows thresholds

## Files to Create

- `scripts/check-coverage.js`

## Files to Modify

- `.github/workflows/ci.yml` — ensure coverage step runs after tests

## Implementation Notes

```javascript
// scripts/check-coverage.js
// Read Vitest JSON coverage report from coverage/coverage-summary.json
// Check src/lib/ line coverage ≥ 70%
// process.exit(1) if below threshold
```

## Verification

```bash
pnpm test:coverage
node scripts/check-coverage.js  # exits 0
```

## Pitfalls

- Vitest coverage must output JSON (`coverageReporter: ['json', 'text']` in vitest.config.ts)
- CI step order matters: tests → coverage check → build
- Don't fail on uncovered branches — only enforce line coverage at 70%
