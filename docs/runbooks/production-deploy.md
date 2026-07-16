# Production Deploy Runbook

**Status:** ✅ Active (Sprint 12 / STORY-053)
**Audience:** Ryan (and any future operator)
**Last verified:** 2026-07-13

This runbook takes Project Amazon PH Academy v2 from a clean `main` to a stable production deployment on Vercel. It is written to be runnable top-to-bottom by someone who did not write it. Every command is copy-pasteable; every gate has a clear pass/fail signal.

---

## 0. Pre-flight checklist (run before anything else)

Confirm each item before proceeding. If any is missing, **stop and resolve it first** — the deploy will fail or expose data if any box below is unchecked.

- [ ] You are on `main` and the working tree is clean
  ```bash
  git checkout main
  git pull --ff-only
  git status   # nothing to commit
  ```
- [ ] CI is green on the latest `main` commit
  Check: `gh run list --workflow ci.yml --limit 1` shows ✅ `success`
- [ ] All 8 Sprint 11 + 3 existing secrets are present in **Vercel production** (see §1)
- [ ] Neon production database is provisioned and reachable (see §2)
- [ ] You have `vercel` CLI authenticated against the `projectamazonph/amph-v2` project
  ```bash
  vercel whoami       # → your account
  vercel ls           # → amph-v2 must appear under projectamazonph
  ```
- [ ] Resend domain `projectamazonph.com` is verified and the `noreply@` sender is live

If any item above is red, do not proceed. Fix it, then re-run §0.

---

## 1. Vercel production environment variables

These must be set in **Vercel → Project Settings → Environment Variables → Production**. The set is **11 variables total**: 8 from Sprint 11 + 3 existing.

| # | Variable | Where it came from | Notes |
|---|----------|--------------------|-------|
| 1 | `DATABASE_URL` | Existing (Sprint 1) | Neon production pooler URL with `?sslmode=require` |
| 2 | `JWT_SECRET` | Existing (Sprint 1) | Generate with `openssl rand -base64 32`; never reuse dev |
| 3 | `PAYMONGO_SECRET_KEY` | Existing (Sprint 6) | Must start with `sk_live_` for production |
| 4 | `PAYMONGO_PUBLIC_KEY` | Existing (Sprint 6) | Must start with `pk_live_` for production |
| 5 | `PAYMONGO_WEBHOOK_SECRET` | Existing (Sprint 6) | From PayMongo dashboard webhook settings |
| 6 | `RESEND_API_KEY` | Existing (Sprint 8) | Production API key, not the dev one |
| 7 | `RESEND_FROM_EMAIL` | Existing (Sprint 8) | `noreply@projectamazonph.com` |
| 8 | `BLOB_READ_WRITE_TOKEN` | Existing (Sprint 7) | Vercel Blob production token |
| 9 | `SENTRY_DSN` | Sprint 11 (STORY-048) | From Sentry project settings |
| 10 | `NEXT_PUBLIC_SENTRY_DSN` | Sprint 11 (STORY-048) | Public-side counterpart of #9 |
| 11 | `SENTRY_AUTH_TOKEN` | Sprint 11 (STORY-048) | Org-level token for source-map upload |
| 12 | `SENTRY_ORG` | Sprint 11 (STORY-048) | `projectamazonph` |
| 13 | `SENTRY_PROJECT` | Sprint 11 (STORY-048) | `amph-v2` |
| 14 | `SENTRY_HOST` | Sprint 11 (STORY-048) | `https://sentry.io` unless self-hosted |
| 15 | `SENTRY_API_TOKEN` | Sprint 11 (STORY-052) | API token with `project:read` scope |
| 16 | `SLACK_WEBHOOK_URL` | Sprint 11 (STORY-052) | Slack Incoming Webhook for `#amph-alerts` |
| 17 | `NEXT_PUBLIC_APP_URL` | Required at runtime | The production URL (e.g. `https://amph.projectamazonph.com`) |

> **Why 17 when the PLAN says 11?** Eleven is the *count of distinct secret names that came in from Sprint 11* plus the three pre-existing critical ones (`DATABASE_URL`, `JWT_SECRET`, `PAYMONGO_SECRET_KEY`). The full production set is the table above. The PLAN's "11 env vars" = 8 Sprint 11 vars + 3 pre-existing, and the additional 6 are also-existing business layer (PayMongo public/webhook, Resend from-email, Blob, app URL). **All 17 must be set before deploy.**

**Verify:** In Vercel dashboard → Settings → Environment Variables, filter by `Production` and confirm 17 rows.

---

## 2. Neon production database

Neon manages connection pooling automatically. Verify before deploy:

```bash
# From a machine with psql installed (locally or via Neon SQL editor)
psql "$DATABASE_URL" -c "SELECT version();"
```

Expected: a Postgres 16+ version string from Neon. Then run pending migrations. **This is a manual, required step** — there is no `postinstall` hook, so the Vercel build does NOT apply migrations for you:

```bash
DATABASE_URL=<prod_url> npx prisma migrate deploy
```

Expected: `1 migration found in prisma/migrations` (the 2026-07-16 squashed
PostgreSQL baseline `20260716000000_init_postgresql`) and either `Already in
sync` or it applies the baseline. If the target database has tables from a
pre-squash deploy, use `prisma migrate resolve --applied 20260716000000_init_postgresql`
once to baseline it instead of re-applying.

---

## 3. Link the Vercel project (one-time)

If this is the first deploy from a new machine, link the repo to the existing Vercel project:

```bash
cd /path/to/amph-v2
vercel link --yes
# When prompted, choose: projectamazonph → amph-v2
```

To verify:

```bash
cat .vercel/project.json   # → projectId and orgId present
```

---

## 4. Promote `main` to production

Vercel deploys every push to a preview URL. The production deploy is the one attached to the custom domain. There are two clean ways:

### Option A — Git merge (preferred)

`main` is already set as the production branch in Vercel. Any push to `main` is automatically deployed to production **after** all preview checks pass.

```bash
git checkout main
git pull --ff-only
git log --oneline -5    # confirm HEAD is the SHA you want
git push                # no-op if already pushed; otherwise triggers deploy
```

Watch the build:

```bash
vercel ls --prod      # shows production deployments; newest at top
```

Wait until status is `● Ready` (typically 2–4 minutes for a Next.js 16 build with Sentry source-map upload).

### Option B — Promote a specific deployment

If a previous preview deployment is the one you actually want:

```bash
vercel ls                          # find the deployment ID (e.g. amph-v2-abc123)
vercel promote <deployment-id> --prod
```

---

## 5. Smoke test

Once the production build is `Ready`, run the smoke script:

```bash
PROD_URL=https://amph.projectamazonph.com ./scripts/smoke-prod.sh
```

The script hits `/`, `/dashboard`, `/pricing`, `/courses` and verifies each returns `200`. It also verifies the six security headers from `next.config.ts`. Exit code 0 = pass.

If the script fails, jump to §7 (Rollback) before debugging in place.

---

## 6. Post-deploy verification

Beyond the smoke script, manually confirm:

- [ ] **Sentry** → Issues page → confirm a release was registered for the deploy SHA. The release name follows `<project>@<git-sha>`.
- [ ] **Sentry** → trigger a synthetic error from `/dashboard` (e.g. visit `/dashboard?throw=1` if your app supports it, otherwise navigate to a known-broken path) and confirm it appears in Sentry within 30 s.
- [ ] **Slack** → `#amph-alerts` → confirm the next 01:00 UTC daily summary arrives (or trigger it manually with `gh workflow run sentry-alert.yml`).
- [ ] **Lighthouse** → wait for the next scheduled CI run on `main`, or trigger manually:
  ```bash
  gh workflow run lhci.yml
  ```
  All 6 budgets (perf ≥ 0.85, a11y ≥ 0.95, bp ≥ 0.95, seo ≥ 0.9, LCP ≤ 4000 ms, TBT ≤ 300 ms) must pass.
- [ ] **PayMongo** → in test mode first, then flip `PAYMONGO_SECRET_KEY` to live in Vercel and run a ₱1 checkout end-to-end. Confirm the Resend confirmation email arrives and the user appears in `Dashboard → My Courses`.
- [ ] **Custom domain** → open `https://amph.projectamazonph.com` in an incognito window and confirm the SSL padlock is green.

When every box above is green, mark `STORY-056` Done.

---

## 7. Rollback procedure

If the smoke script fails, Sentry lights up with new errors, or Lighthouse regresses badly:

### Option A — Revert the commit and re-push

```bash
git revert <bad-sha>
git push   # triggers a fresh deploy with the revert
```

This is the safest path because it preserves a clean history and a single SHA identifies the rollback.

### Option B — Instant Vercel rollback

If you need to go back **in the next 30 seconds** without touching git:

**Dashboard path:**
1. Open https://vercel.com/projectamazonph/amph-v2 → Deployments
2. Find the last-known-good deployment (status `● Ready`, older than the failing one)
3. Click the three-dot menu → **Promote to Production**

**CLI path:**
```bash
vercel ls --prod                       # list production deployments with IDs
vercel rollback <previous-deployment-id>
```

> `vercel rollback` is **instant** — it re-points the production alias to the chosen older deployment without a rebuild. Use this for emergencies; follow up with a `git revert` so `main` reflects reality.

### After rollback

- [ ] Post in `#amph-launch` Slack: "Rolled back from `<bad-sha>` to `<good-sha>` at <UTC time>"
- [ ] File a follow-up story in `docs/sprint-13/PLAN.md` (or whichever sprint is current) with the root cause
- [ ] Keep the bad deploy around (do not delete) for forensic comparison

---

## 8. Appendix — Useful one-liners

```bash
# Tail production logs (last 100 lines, follow mode)
vercel logs amph-v2 --prod --follow

# Inspect a specific env var on production
vercel env pull .env.production --environment=production

# Force a fresh production build (skip cache)
vercel deploy --prod --force
```

---

## 9. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Initial runbook authored (Sprint 12 / STORY-053) | Ryan |