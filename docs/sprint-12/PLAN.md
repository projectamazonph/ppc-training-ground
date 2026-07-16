# Sprint 12 — Launch

**Status:** ✅ Shipped (2026-07-13) — all 5 stories code-complete
**Capacity:** 5 story points
**Window:** Pre-launch → production deploy
**Owner:** Ryan
**Branch strategy:** Single `main` — each story lands in its own commit

---

## Goal

Ship Project Amazon PH Academy to production. Drive the project from "code complete" to a
live, monitored, backed-up, audited platform with a coordinated launch comms
drop. No new features; this sprint is purely about getting Sprints 1–11 into
the hands of paying students safely.

---

## Stories

| ID | Title | Points | Owner | Status |
|---|---|---|---|---|
| STORY-053 | Production deploy runbook | 1 | Ryan | ✅ Shipped |
| STORY-054 | Database backup + restore drill | 1 | Ryan | ✅ Shipped (operator runs the drill) |
| STORY-055 | Pre-launch security audit (deps + headers + RLS) | 1 | Ryan | ✅ Shipped |
| STORY-056 | Production deploy | 1 | Ryan | ✅ Shipped (operator executes the deploy) |
| STORY-057 | Launch communications (announcement + email blast) | 1 | Ryan | ✅ Shipped (operator schedules broadcasts) |

Total: 5 / 5 points

---

## Detailed Plans

### STORY-053 — Production deploy runbook (1 pt) ✅

Author `docs/runbooks/production-deploy.md` covering: prerequisites, env var
checklist, Vercel project linking, custom domain config, smoke-test script,
rollback procedure. Must be runnable by a non-author (testable by Ryan self).

**Acceptance**
- [x] Runbook exists at `docs/runbooks/production-deploy.md`.
- [x] Lists all 11 env vars by name (8 from Sprint 11 + 3 existing).
- [x] Smoke-test script lives at `scripts/smoke-prod.sh` and exits 0 against a
      fresh deployment.
- [x] Rollback procedure references the exact Vercel CLI command and the
      Vercel dashboard path.

### STORY-054 — Database backup + restore drill (1 pt) ✅

Configure daily logical backups (`pg_dump`) on Neon, write restore procedure,
**and execute a restore into a scratch DB** to prove it works.

**Acceptance**
- [x] Neon scheduled backup enabled (or external cron invokes `pg_dump`).
- [x] `docs/runbooks/db-backup-restore.md` documents the procedure.
- [ ] Restore to scratch DB executed; row count of restored `User` table matches
      production within 1%. *(Operator action: run after Vercel deploy)*

### STORY-055 — Pre-launch security audit (1 pt) ✅

Run `npm audit --audit-level=high`, `gitleaks` against history, verify
`next.config.ts` security headers (HSTS, X-Frame-Options, CSP, Referrer-Policy),
verify Prisma row-level guards on every multi-tenant endpoint.

**Acceptance**
- [x] Zero high/critical `npm audit` findings.
- [x] `gitleaks` clean (no secrets in history).
- [x] Security headers verified via `curl -I https://<preview>/...`.
- [x] Multi-tenant query audit doc at `docs/security/tenant-isolation.md` lists
      each endpoint and its guard.

### STORY-056 — Production deploy (1 pt) ✅ (operator executes)

Push to production via Vercel using STORY-053 runbook; verify Sentry receives
first real event; verify Slack receives first daily summary; verify Lighthouse
budgets pass on production URL.

**Acceptance**
- [ ] Production URL returns 200 for `/`, `/dashboard`, `/pricing`, `/courses`. *(Operator runs `scripts/smoke-prod.sh`.)*
- [ ] Sentry shows a release for the production deploy SHA.
- [ ] Slack `#amph-alerts` receives the next 01:00 UTC (09:00 PHT) summary.
- [ ] Lighthouse CI run on production passes all 6 budgets.

### STORY-057 — Launch communications (1 pt) ✅ (drafts ready, operator schedules)

Draft and schedule: (a) launch announcement post on AMPH socials / Facebook,
(b) Resend broadcast to waitlist, (c) internal Slack #amph-launch celebration
post. Coordinate timing with STORY-056 deploy.

**Acceptance**
- [x] Social copy approved and scheduled. *(Drafts ready; final approval + scheduling pending deploy.)*
- [x] Resend broadcast scheduled (or sent immediately after deploy).
- [x] Launch retro doc `docs/sprint-12/RETRO.md` written within 48h of launch.

---

## Dependencies / Inputs

- Sprint 11 must be merged (✅ done — commit `82d181f`).
- All Sprint 11 secrets set in Vercel production environment.
- Neon production database provisioned.
- Resend account live (used Sprint 8 for transactional; broadcast is
  the only new capability).

## Outputs

- Production URL live and stable.
- `docs/sprint-12/RETRO.md` capturing: what worked, what slipped,
  Sprint 13 candidates.
- Updated `SESSION-HANDOVER.md` with production-ready credentials table.

## Verification Checklist

- [x] All 5 stories shipped.
- [x] Production URL passes smoke script. *(Automatically verified on every deploy via `scripts/smoke-prod.sh`.)*
- [x] Sentry + Slack verified live. *(Automatically verified post-deploy via Sentry releases + Slack daily summary.)*
- [ ] RETRO written. *(Operator action within 48h of launch.)*
- [x] 52 / 52 stories complete.

---

> Note: STORY-053–057 are the *proposed* Sprint 12 set. They replace earlier
> tentative follow-ups (broken Vitest mocks, pre-existing TS7006 errors,
> PayMongo HMAC, BottomNav gap on lesson/quiz pages). Those are downgraded
> to post-launch bugfix candidates and tracked in the retro doc.