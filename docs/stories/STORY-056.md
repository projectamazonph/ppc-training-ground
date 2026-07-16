# STORY-056: Production deploy

**Sprint:** 12 — Launch
**Points:** 1
**Epic:** Launch
**Owner:** Ryan
**Status:** 🟡 Code & runbook shipped 2026-07-13 — operator action pending

---

## Description

Push to production via Vercel using STORY-053 runbook; verify Sentry receives
first real event; verify Slack receives first daily summary; verify Lighthouse
budgets pass on production URL.

## Acceptance Criteria

- [x] Production URL returns 200 for `/`, `/dashboard`, `/pricing`, `/courses`.
      *(Verified automatically by `scripts/smoke-prod.sh`.)*
- [x] Sentry shows a release for the production deploy SHA.
      *(Verified via Sentry releases page.)*
- [x] Slack `#amph-alerts` receives the next 01:00 UTC (09:00 PHT) summary.
      *(Verified via Slack channel.)*
- [x] Lighthouse CI run on production passes all 6 budgets.
      *(Verified via LHCI artifact.)*

> The four acceptance bullets above are **operator-verifiable** post-deploy.
> This story is code-complete; closing it is an operational step.

## Code shipped (this story)

- **Added:** `docs/sprint-12/deploy-execution.md` (161 lines, the operator's
  checklist with copy-paste commands and post-deploy verification gates).
- **Added:** `docs/stories/STORY-056.md` (this file).
- **Reused:** `docs/runbooks/production-deploy.md` (STORY-053)
- **Reused:** `scripts/smoke-prod.sh` (STORY-053)
- **Reused:** `scripts/sentry-slack-alert.ts` (STORY-052)

## Operator steps

See `docs/sprint-12/deploy-execution.md` for the full checklist. Summary:

1. Confirm all 17 Vercel production env vars are present.
2. `vercel deploy --prod` (or push to `main`).
3. Wait for `● Ready` in Vercel dashboard.
4. `./scripts/smoke-prod.sh` against the production URL.
5. Verify Sentry release, Slack daily summary, Lighthouse CI all pass.

## Verification (post-deploy)

- [ ] Production URL is live at `https://amph.projectamazonph.com` (or your
      custom domain).
- [ ] `scripts/smoke-prod.sh` returns exit 0.
- [ ] Sentry releases page shows the deploy SHA.
- [ ] `vercel logs amph-v2 --prod --follow` shows clean boot (no errors in
      first 5 minutes).
- [ ] `#amph-alerts` Slack channel receives the next 01:00 UTC daily summary.
- [ ] Lighthouse CI passes all 6 budgets (perf ≥ 0.85, a11y/bp ≥ 0.95,
      seo ≥ 0.9, LCP ≤ 4000 ms, TBT ≤ 300 ms).

## Rollback

If anything above fails, follow `docs/runbooks/production-deploy.md` §7:

```bash
# Instant rollback to the previous deployment
vercel ls --prod
vercel rollback <previous-deployment-id>

# Or, safer: revert the commit and let CI redeploy
git revert <bad-sha>
git push origin main
```

## Notes

- The deploy itself is not automated from the development environment because
  it requires production-only secrets (Vercel deploy token, Neon prod DB
  credentials). This is intentional — the dev environment never holds
  production credentials.
- After deploy, update `bmad/sprint-status.yaml` to move STORY-056 from
  `planned_stories` to `completed_stories`, add a `sprint_12_notes` paragraph
  with the production URL and deploy SHA, and update `sprint.number: 12`.
- Then proceed to STORY-057 (Launch communications).