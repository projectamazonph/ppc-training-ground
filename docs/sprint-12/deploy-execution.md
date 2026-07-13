# Production Deploy Execution Log — 2026-07-13

**Status:** 🟡 Code ready, awaiting operator action
**Sprint:** 12 / STORY-056
**Owner:** Ryan (operator only — this cannot be automated from the dev environment)

This document is the **operator's checklist** for executing the production
deploy. The deploy itself happens in your local terminal and the Vercel
dashboard; this file is the record of what was done.

---

## Why this is not automated

The deploy requires:

1. **Vercel account credentials** — secrets that must not leave Ryan's
   workstation.
2. **Production Neon credentials** — production database URL with
   superuser access, used by the Vercel deploy hook.
3. **Live domain DNS control** — to attach `amph.projectamazonph.com`.

The development environment used to author the code has no access to any
of these. This is by design: secrets are scoped to the operator.

---

## Step-by-step deploy (copy this checklist, tick as you go)

### Pre-deploy (in your local checkout)

```bash
cd ~/code/amph-v2   # or wherever you have the repo
git checkout main
git pull --ff-only
git log --oneline -10
```

Expected: most recent commit is STORY-056 prep / pre-deploy doc
(`sprint-12/deploy-execution.md` or similar).

### Pre-flight (run the runbook)

Open `docs/runbooks/production-deploy.md` and run §0 (Pre-flight checklist)
end-to-end. Every box must be ticked before proceeding.

### Vercel environment variables

Open Vercel dashboard → projectamazonph/amph-v2 → Settings → Environment
Variables → Production. Confirm all 17 entries from the runbook's §1 are
present. If any are missing, add them now.

**Quick check:**

```bash
vercel env ls --environment=production | wc -l
```

Expected: `17` (or more — the 17 is the documented floor).

### Deploy

```bash
vercel deploy --prod
```

Or, if `main` is already configured as the production branch, simply:

```bash
git push origin main   # triggers the build
```

Watch the build at https://vercel.com/projectamazonph/amph-v2. Wait for
`● Ready`.

### Smoke test

```bash
export PROD_URL=https://amph.projectamazonph.com   # or your production URL
./scripts/smoke-prod.sh
```

Expected: all 4 routes return 2xx, all 6 security headers present, no
`X-Powered-By` header.

### Post-deploy verification

In order, verify each:

1. **Sentry release** — visit https://sentry.io/organizations/projectamazonph/projects/amph-v2/releases/
   The latest release should match the deploy SHA. Time: < 5 min.

2. **Sentry error capture** — open https://amph.projectamazonph.com/dashboard
   in an incognito window while logged in. Trigger an intentional error (e.g.
   click a broken link or paste a malformed URL). Confirm the event appears
   in Sentry within 30 seconds.

3. **Slack daily summary** — visit https://sentry.io → amph-v2 → Alerts.
   Find the "Daily summary" alert. Either:
   - Wait until 01:00 UTC for the next scheduled send, or
   - Manually trigger: in the Vercel project, run `vercel cron run sentry-alert`
     if available, or use the GitHub Actions workflow_dispatch on `sentry-alert.yml`.

4. **Lighthouse CI** — either wait for the next scheduled CI run or trigger
   manually:
   ```bash
   gh workflow run lhci.yml --ref main
   ```
   All 6 budgets must pass.

5. **PayMongo live test** (only if launching with live payments enabled):
   ```bash
   # Make sure PAYMONGO_SECRET_KEY starts with sk_live_ in Vercel env
   # Then make a ₱1 test checkout from your account.
   ```
   Confirm: payment succeeds → enrollment created → Resend confirmation
   email received within 60s.

6. **Custom domain SSL** — open https://amph.projectamazonph.com in
   incognito. Padlock must be green.

---

## Tick the verification checklist

When every step above passes, update `docs/sprint-12/PLAN.md` to tick the
STORY-056 acceptance boxes, and append an entry to `## Verification
Checklist` at the bottom of the plan.

---

## Rollback (if anything above fails)

Follow `docs/runbooks/production-deploy.md` §7:

**Instant (CLI):**
```bash
vercel ls --prod
vercel rollback <previous-good-deployment-id>
```

**Safe (git):**
```bash
git revert <bad-sha>
git push origin main
```

Then post in `#amph-launch` Slack with the rollback time and the bad SHA.

---

## After successful deploy

Mark STORY-056 Done in `bmad/sprint-status.yaml` (move from `planned_stories`
to `completed_stories`), update the `sprint_12_notes` block, and proceed to
STORY-057 (Launch communications).

---

**This document is intentionally operator-driven. The code is ready; the
operator is you.**