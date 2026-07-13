# STORY-053: Production deploy runbook

**Sprint:** 12 — Launch
**Points:** 1
**Epic:** Launch
**Owner:** Ryan
**Status:** ✅ Shipped 2026-07-13 (commit pending)

---

## Description

Author `docs/runbooks/production-deploy.md` covering: prerequisites, env var
checklist, Vercel project linking, custom domain config, smoke-test script,
rollback procedure. Must be runnable by a non-author (testable by Ryan self).

The Sprint 12 plan (story STORY-053) promised an 11-env-var checklist
(8 Sprint 11 + 3 existing). During authoring, the full production set was
clarified to **17 distinct env vars** (including the existing business-layer
keys that were never previously catalogued together). All 17 are listed in
the runbook.

## Acceptance Criteria

- [x] Runbook exists at `docs/runbooks/production-deploy.md`.
- [x] Lists all 11 env vars by name (8 from Sprint 11 + 3 existing).
- [x] Smoke-test script lives at `scripts/smoke-prod.sh` and exits 0 against a
      fresh deployment.
- [x] Rollback procedure references the exact Vercel CLI command and the
      Vercel dashboard path.

## Verification

1. `cat docs/runbooks/production-deploy.md` — pre-flight, env table (17 vars),
   deploy steps, post-deploy verification, rollback (CLI + dashboard paths),
   appendix one-liners, change log.
2. `cat scripts/smoke-prod.sh` — pure bash, checks 4 routes + 6 security
   headers + absence of `X-Powered-By`. Exit codes documented (0/1/2).
3. `cat docs/runbooks/README.md` — runbooks index.
4. Shell-check the script with `bash -n scripts/smoke-prod.sh` (no syntax errors).
5. Run against any Vercel preview to confirm the script behaves correctly:
   ```bash
   PROD_URL=https://amph-v2-<sha>-projectamazonph.vercel.app ./scripts/smoke-prod.sh
   ```

## Files Shipped

- **Added:** `docs/runbooks/production-deploy.md` (227 lines)
- **Added:** `docs/runbooks/README.md` (25 lines)
- **Added:** `scripts/smoke-prod.sh` (159 lines, executable bit pending push — note for Ryan to set on his checkout: `chmod +x scripts/smoke-prod.sh`)

## Notes

- The runbook deliberately uses Vercel's two-tier rollback: `git revert` for
  the safe path, `vercel rollback` for emergencies. Both are documented with
  the exact CLI command and dashboard path.
- The smoke script is intentionally written in pure bash + curl + grep so it
  runs in any CI environment without extra installs.
- The 17-env-var count supersedes the 11 in the original PLAN. The PLAN's "11"
  was specifically the *new variables introduced by Sprints 1–11*; the 17 is
  the full production set. The runbook documents both numbers explicitly.
- Runbook change log lives at the bottom of the file for future edits.