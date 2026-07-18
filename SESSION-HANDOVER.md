# SESSION-HANDOVER.md

**Updated:** 2026-07-18 (design-drift remediation + admin audit + branch cleanup; `main` HEAD `daa16e8` after PR #41)

---

## Project Status

| Metric | Value |
|--------|-------|
| Sprints complete | **12 of 12 (100%)** |
| Stories complete | **52 / 52 (100%)** |
| Last closed sprint | Sprint 12 — Launch |
| Last commit SHA | `d23de02405adc79101fac411c9537473576cbf45` (stale-doc cleanup, `tsc` clean) — `main` HEAD |
| Lint | Clean |
| Typecheck | **Clean** — `tsc --noEmit` passes (hotfix `8012071` fixed the TS7006 errors) |
| CI | PostgreSQL service aligned; includes Sentry upload, LHCI, Playwright, gitleaks, db-backup cron |
| Tests | Unit + integration **verified by CI** (no local `pnpm test` in this sandbox; the "3 broken tool-actions mocks" claim was incorrect — `requireAuth` is mocked at lines 21–24 of `tool-actions.test.ts`) |
| Database | PostgreSQL on Neon (dev + production) |
| Production | **Live deploy pending operator execution** — see Sprint 12 / STORY-056 |

---

## Sprint 11 — Observability (DONE, commit `82d181f`)

**Goal:** Production-grade observability before launch: Sentry error tracking, structured logging, server-action tracing, Lighthouse performance budgets, and Slack alerting.

| Story | Pts | Status | Description |
|-------|-----|--------|-------------|
| STORY-048 | 1 | Done | Sentry setup: client/server/edge configs, source maps, release tracking via `@sentry/nextjs@^9`. |
| STORY-049 | 1 | Done | Structured logging (Pino): `src/lib/logger.ts`, AsyncLocalStorage request context, redaction. `console.*` replaced in critical paths. |
| STORY-050 | 1 | Done | Server-action tracing: `withActionTracing` HOC in `src/lib/tracing.ts`, edge-friendly `src/lib/middleware-context.ts`. `getSession` wrapped. |
| STORY-051 | 1 | Done | Lighthouse CI: `.lighthouserc.json` with perf ≥0.85, a11y/bp ≥0.95, seo ≥0.9, LCP ≤4000ms, TBT ≤300ms. |
| STORY-052 | 1 | Done | Slack alerting: `scripts/sentry-slack-alert.ts` (190 lines), summary + spike modes, scheduled cron in CI. |

**Files added (10):** `src/lib/logger.ts`, `src/lib/sentry.ts`, `src/lib/sentry-shared.ts`, `src/lib/tracing.ts`, `src/lib/middleware-context.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `.lighthouserc.json`, `scripts/sentry-slack-alert.ts`.
**Files modified (7):** `package.json`, `next.config.ts`, `.env.example`, `CHANGELOG.md`, `src/app/api/paymongo/webhook/route.ts`, `src/lib/auth.ts`, `.github/workflows/ci.yml`.

---

## Sprint 12 — Launch (DONE — code & runbook complete; deploy execution is operator-side)

**Goal:** Ship Project Amazon PH Academy to production: deploy runbook, backup drill, security audit, production deploy, launch communications.

| Story | Pts | Status | Description |
|-------|-----|--------|-------------|
| STORY-053 | 1 | ✅ Done | Production deploy runbook + smoke script. `docs/runbooks/production-deploy.md` (227 lines), `scripts/smoke-prod.sh` (159 lines, bash+curl+grep). |
| STORY-054 | 1 | 🟡 Code done | Backup runbook + cron + restore drill script. `docs/runbooks/db-backup-restore.md` + `scripts/backup-prod.sh` + `scripts/restore-prod.sh` + `.github/workflows/db-backup.yml`. **Operator action:** run the drill against real Neon + Blob. |
| STORY-055 | 1 | ✅ Done | Security audit. `docs/security/tenant-isolation.md` + `docs/security/security-audit-2026-07-13.md`. 5 open issues tracked, 1 blocker-class (PayMongo HMAC). |
| STORY-056 | 1 | 🟡 Code done | Production deploy. `docs/sprint-12/deploy-execution.md` (operator checklist). **Operator action:** run `vercel deploy --prod` after setting 17 production env vars. |
| STORY-057 | 1 | 🟡 Drafts done | Launch comms. `docs/sprint-12/launch-comms.md` (250 lines of copy + templates + retro template). **Operator action:** approve copy, build the React Email template, schedule broadcasts T+30min after deploy. |

**Total Sprint 12 file inventory:**
- 2 runbooks + 1 runbooks index
- 2 security audit docs
- 2 sprint-12 docs (deploy execution, launch comms)
- 5 STORY-053–057 acceptance docs
- 3 production shell scripts (smoke-prod, backup-prod, restore-prod)
- 1 GitHub Actions workflow (db-backup cron)
- 7 GitHub Actions workflows + 1 config (CI hardening, 2026-07-14): `ci.yml`
  (push/PR only), `sentry-alert.yml` (split from ci), `deploy-preview.yml`,
  `deploy-prod.yml`, `rollback.yml`, `db-backup.yml`, plus `.github/dependabot.yml`

---

## 2026-07-14 — CI/CD Hardening (post-Sprint-12)

Type-safety hotfix `8012071` landed on `main`: fixed the pre-existing TS7006
implicit-any errors in admin/course pages, so `pnpm typecheck` (`tsc --noEmit`)
now passes clean. CI is therefore fully green end-to-end.

Changes:
- **P0 fix:** removed `on.schedule` from `ci.yml`. The `*/30 * * * *` trigger was
  running the full quality + e2e + lighthouse pipeline ~48×/day. CI now runs only
  on push/PR to `main`.
- **Sentry→Slack alert split** into `.github/workflows/sentry-alert.yml` (its own
  schedule: 30-min spike + 01:00 UTC daily summary), preserving the original cadence.
- **Dependabot** (`.github/dependabot.yml`): daily grouped npm updates, weekly
  GitHub Actions updates.
- **Deploy automation** (manual-gated, not auto):
  - `deploy-preview.yml` — Vercel preview per PR + smoke test + PR comment.
  - `deploy-prod.yml` — gated prod deploy (workflow_dispatch / Release) + Sentry
    release + smoke + Slack. NOTE: if Vercel git auto-deploy is on, disable it to
    avoid double production builds.
  - `rollback.yml` — instant Vercel rollback; requires typing `ROLLBACK` to confirm.
- **Stale-doc cleanup:** the "3 broken Vitest mocks in tool-actions.test.ts" item
  was wrong — `requireAuth` is mocked at **lines 21–24** (`vi.mock('@/lib/auth')`),
  and the suite is **verified by CI** (no local `pnpm test` in this sandbox).
  Removed from Sprint 13 candidates.

New repo secrets required for deploy workflows: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID` (set in GitHub → Settings → Secrets and variables → Actions).

---

## Required Secrets for Production Deploy

**All 17 must be set in Vercel → Project Settings → Environment Variables → Production before deploy.**

Sprint 11 + 12 secrets (8 from Sprints 1–11, plus key existing ones for production):

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Sprint 1 | Neon prod pooler with `?sslmode=require` |
| `JWT_SECRET` | Sprint 1 | `openssl rand -base64 32` |
| `PAYMONGO_SECRET_KEY` | Sprint 6 | `sk_live_...` |
| `PAYMONGO_PUBLIC_KEY` | Sprint 6 | `pk_live_...` |
| `PAYMONGO_WEBHOOK_SECRET` | Sprint 6 | PayMongo dashboard |
| `RESEND_API_KEY` | Sprint 8 | Prod key |
| `RESEND_FROM_EMAIL` | Sprint 8 | `noreply@projectamazonph.com` |
| `RESEND_WEBHOOK_SECRET` | Sprint 8 | **Verify in Vercel prod — needed for delivery tracking** |
| `BLOB_READ_WRITE_TOKEN` | Sprint 7 | Vercel Blob prod token (also used by db-backup script) |
| `SENTRY_DSN` | STORY-048 | Sentry project DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | STORY-048 | Public counterpart |
| `SENTRY_AUTH_TOKEN` | STORY-048 | Org-level for source-map upload |
| `SENTRY_ORG` | STORY-048 | `projectamazonph` |
| `SENTRY_PROJECT` | STORY-048 | `amph-v2` |
| `SENTRY_HOST` | STORY-048 | `https://sentry.io` |
| `SENTRY_API_TOKEN` | STORY-052 | API token with `project:read` |
| `SLACK_WEBHOOK_URL` | STORY-052 | Slack Incoming Webhook for `#amph-alerts` |
| `NEXT_PUBLIC_APP_URL` | Required | `https://amph.projectamazonph.com` (or your prod URL) |

GitHub repo secrets (for the `db-backup` and `sentry-alert` cron jobs): same `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `SLACK_WEBHOOK_URL`, `SENTRY_API_TOKEN` set.

All Sprint 11 additions are listed in `.env.example`.

---

## Key Files

- **BMAD state:** `bmad/sprint-status.yaml`, `bmad/workflow-status.yaml`
- **Sprint plan:** `docs/sprint-plan.md`
- **Sprint 11 plan:** `docs/sprint-11/PLAN.md` (SHIPPED)
- **Sprint 12 plan:** `docs/sprint-12/PLAN.md` (SHIPPED 2026-07-13)
- **Stories:** `docs/stories/STORY-038.md` through `STORY-057.md` (S10 + S11 + S12 acceptance ticked)
- **Runbooks:** `docs/runbooks/production-deploy.md`, `docs/runbooks/db-backup-restore.md`
- **Security:** `docs/security/tenant-isolation.md`, `docs/security/security-audit-2026-07-13.md`
- **Launch comms:** `docs/sprint-12/launch-comms.md`
- **Session history:** `SESSION-HANDOVER.md` (this file)

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| `@sentry/nextjs@^9` (not `@sentry/instrumentation` stand-alone) | Matches Next 16; auto-detects `sentry.{client,server,edge}.config.ts`. No `instrumentation.ts` needed for the captured subset. |
| Pino over Winston | Lighter, faster, native JSON, better async-context support via `pino-with-async-storage`. |
| `base_tree` strategy for the Sprint 11 push | Single commit with 17 files via Git Data API (blob → tree → commit → ref). Avoids re-listing ~200 unchanged blobs. |
| `getSession` traced in `src/lib/auth.ts` but `redirect()` left unwrapped | `redirect()` throws `NEXT_REDIRECT`; wrapping in try/catch would break the redirect. |
| Cron at UTC 01:00 for daily Slack summary | 09:00 PHT = 01:00 UTC. Matches existing CI schedule cadence. |
| Skip `instrumentation.ts` reference in CHANGELOG (refine in follow-up) | Functionally irrelevant with `@sentry/nextjs@^9` auto-detection. Wording ahead of files; acceptable. |
| db-backup cron at 02:00 UTC | 10:00 PHT — before peak PH morning traffic, after EU/NA night. Lowest write volume. |
| Pure bash + curl + grep for smoke script | No node/jq dependency; runs in any CI environment. |
| 1 file at a time for Sprint 12 push | User-mandated workflow correction from 2026-07-14. Avoids script-staging fragility. |
| File-by-file Contents API PUT (not Git Data API) for Sprint 12 | Smaller files; less risk of merge conflicts in 17-var tree updates. |
| Pure bash multipart upload to Vercel Blob | Avoids @vercel/blob npm install in CI. Portable. |
| CSP header deferred to Sprint 13 | Sentry tunnel rewrite + Resend image embedding + Vercel Blob CDN need careful allow-listing not yet finalized. |
| CI schedule removed from `ci.yml` | Was running full quality+e2e+lighthouse pipeline ~48×/day; Sentry alert moved to its own scheduled workflow |
| Added dependabot + deploy/rollback workflows | Supply-chain hygiene + gated, revertible deploys; rollback needs manual `ROLLBACK` confirm |
| `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` required | Deploy workflows call Vercel action/CLI from secrets, never from code |

---

## Open Issues

> **2026-07-15 audit note:** the "PayMongo HMAC not verified" items below are
> **stale** — verification is implemented in `src/lib/webhook-signature.ts`
> and wired in the webhook route. The authoritative launch-blocker list is now
> `docs/security/code-audit-2026-07-15.md` (money-unit bug, invoice numbering,
> SQLite migration lock, guest-checkout enrollment loss — fixes applied same
> day, see that doc's status table).

### Operator-side (close before/during launch)

1. ~~PayMongo webhook HMAC not verified~~ — **stale**; implemented + verified 2026-07-15.
2. **Confirm `RESEND_WEBHOOK_SECRET` set in Vercel prod** — STORY-055 finding #3. Also note the webhook now requires real Svix headers (fixed 2026-07-15).
3. **Run the restore drill** — STORY-054 acceptance bullet #3.
4. **Execute the production deploy** — STORY-056 acceptance. Prisma migrations regenerated for PostgreSQL 2026-07-16 (squashed init, `migration_lock.toml` now `postgresql`) — existing dev DBs need `prisma migrate reset`.
5. **Approve launch copy + build React Email template + schedule broadcasts** — STORY-057 acceptance.

### Post-launch (Sprint 13 candidates)

1. ~~PayMongo HMAC verification~~ — stale, done (see above)
2. CSP header (deferred from STORY-055)
3. BottomNav on lesson/quiz pages (S9 carry-over)
4. Verify Resend webhook secret env var set in Vercel prod (STORY-055 finding #3 / S12 audit)
5. Audit follow-ups O1–O6 in `docs/security/code-audit-2026-07-15.md` (field renames, async scrypt, distributed rate limiting, email-verification flow, CSP, Blob receipt storage)

---

## Notas / Status Tagalog-English Mix

- Sprint 12 done, 5/5 punta. 52/52 kwento closed. AMPC v2 ready na for launch.
- Susi: Vercel deploy + Neon backup drill + Resend broadcast. Tatlong operator actions bago live.
- PayMongo HMAC gap lang ang blocker — pwede soft launch muna kung gusto mong i-defer live payments.
- Salamat sa 12 sprints, 52 stories. Tara, mag-launch na tayo. 🇵🇭

---

## 2026-07-15 — E2E "Critical Path" failures (handoff for fixing agent)

**Owner of this section:** Sisyphus (E2E run + diagnosis). Another agent is planning the fix — do not re-diagnose from scratch; the root causes below are confirmed by DOM probes + route/middleware inspection.

### Working-tree state (READ FIRST)
- Dirty with ONE uncommitted edit: `tests/e2e/critical-path.spec.ts` already has `/^password$/i` → `/^password/i` (3 occurrences, lines 27/39/51). This fix is **correct and applied** — do NOT revert or re-edit those lines.
- Nothing committed, nothing pushed.
- Dev server assumed up on `:3000` (portable Postgres `amph_v2`). If running the suite, set `PLAYWRIGHT_BROWSERS_PATH=0` (Chromium cached in `node_modules/.pnpm/.../.local-browsers`).

### Run command
`PLAYWRIGHT_BROWSERS_PATH=0 node_modules/.bin/playwright test --reporter=list` (or `pnpm test:e2e`).

### Current result: 3 passed, 2 failed
Passing: homepage loads · signup creates account · pricing shows tiers.
Failing: `signed-in user sees dashboard link` (line 35) · `dashboard loads and shows courses` (line 47).

### Findings (priority order)

1. **F4 — originally CORRECT, now RESOLVED.** The earlier claim that `src/app/(dashboard)/courses/page.tsx` was missing (causing a 404) was RIGHT. A prior handoff edit wrongly "corrected" this to "the page exists" — that correction was based on `/courses` returning 307 (signin redirect) and was mistaken; a 307 proves nothing about whether the index page compiles. `git status` now shows `src/app/(dashboard)/courses/page.tsx` + `courses.module.css` as **new, untracked files** created by the fixing agent, which confirms the index page was indeed absent and is now added. So: F4 was real, and the fixing agent has resolved it. (F2/F3 stale test expectations remain valid and are being aligned by the fixing agent's test edits.)

2. **F2 — stale test expectation.** Test #4 (line 35) asserts a `/dashboard/i` link after signin. The app has no "dashboard" link — the student entry is a **"Courses"** link. Update assertion to `/courses/i`.

3. **F3 — stale test expectation.** Test #5 (line 47) does `goto('/dashboard')` + `toHaveURL(/\/dashboard/)`. `/dashboard` intentionally redirects to `/` (legacy redirect, by design — `(dashboard)` route group adds no URL segment). Point the test at `/courses` and assert course content instead.

### Key constraints / gotchas
- The `(dashboard)` route group means URLs are `/courses`, `/payments`, `/tools`, etc. — NOT `/dashboard/...`. Any new page goes directly under `src/app/(dashboard)/<name>/page.tsx`.
- Do NOT "fix" the failures by deleting assertions or hard-coding values. The courses index page was genuinely missing (now added by the fixing agent per F4). The real systemic defect to keep surfaced is the `ActionResult` server-action bug below, plus the `pino-pretty` missing-dependency bug below it.
- After fixing the `ActionResult` re-exports, re-run the suite. Tests #4/#5 still need the F2/F3 assertion alignment (student entry is a "Courses" link, not "dashboard"), but they should no longer hit a server 500.

### Recommended plan (updated)
- **F4:** RESOLVED by the fixing agent (added `src/app/(dashboard)/courses/page.tsx` + `courses.module.css`, untracked). No further action except verifying the suite now reaches the Courses page.
- **Real fix A:** the server-action `ActionResult` re-export (detailed in the 2026-07-15 server-action section below: delete the three `export type { ActionResult }` re-exports + drop the unused import in `certificates.ts:19`).
- **Real fix B:** the `pino-pretty` missing-dependency bug (detailed in the section below this one). This is currently the dominant cause of dev-server 500s and would also break `pnpm build`.
- **Plus:** the F2/F3 test-assertion alignment (student entry is a "Courses" link, not "dashboard") is being handled by the fixing agent's test edits.
- End state: suite green for the right reason, with a regression guard on Courses navigation.

---

## 2026-07-15 — Systemic server-action bug: `export type { ActionResult }` in `'use server'` files

**Owner of this section:** Sisyphus (broad route-coverage QA). Confirmed real by a clean `.next` rebuild (cache deleted, dev server restarted cold). The error survived the clean build, so it is genuine source breakage, not a stale dev-cache artifact.

### Root cause
`src/app/actions/certificates.ts` is a `'use server'` module that ends with a type-only re-export:

```ts
// src/app/actions/certificates.ts:99
export type { ActionResult };
```

Next 16's server-action loader scans every `'use server'` file for exports to convert into server references. It treats `ActionResult` as a runtime action. The generated loader `(dashboard)/certificates/page/actions.js` then emits:

```js
export { ActionResult as '7f6279b2657b9afb5bcbb2af34b98aa196759e86b4' } from 'ACTIONS_MODULE0'
```

But `ActionResult` is a type. It was erased at compile time, so the module has no such runtime export. Result: `Export ActionResult doesn't exist in target module`. That broken chunk loads globally, so the console error fires on every page, and any route that executes it during SSR returns 500.

The same dead re-export exists in two sibling files (also unnecessary, same risk):
- `src/app/actions/progress.ts:241` to `export type { ActionResult };`
- `src/app/actions/tools.ts:212` to `export type { ActionResult };`

Confirmed zero files import `ActionResult` from any action module. Consumers pull it from `@/lib/validation` directly. The re-exports are pure dead weight.

### Evidence
- Generated `server-reference-manifest.json` lists `ActionResult` as a server-action export for `app/(dashboard)/certificates/page`.
- Dev server `next.err.log` shows the browser error on every page: `Export ActionResult doesn't exist in target module` (line 3 of the generated `actions.js`).
- Clean rebuild (`.next` deleted, server restarted) reproduced the error identically.

### Impact (clean-server coverage probe, logged-out / student / admin)
- `/` logged-out: 200. `/` signed-in (student or admin): **500**.
- `/certificates`: **500** (any auth state).
- `/verify/abc`: **500** (any auth state).
- `/dashboard`, `/admin/*`, `/courses`, etc.: 307 redirect but still log the console error.
- `/pricing`, `/auth/signin`, `/auth/signup`: 200 but log the console error.
- Secondary symptom: `_clientMiddlewareManifest.js` served as `application/json` (MIME error) is a cascade of the 500, not a separate root cause.

### Note on the earlier logged-out `/` 500
My first probe reported logged-out `/` as 500. After the clean restart it returns 200. That specific 500 was a stale `.next` cache artifact from HMR churn, not the real bug. The real bug is the `ActionResult` error plus the 500s on `/certificates`, `/verify/abc`, and every authenticated page. Restarting the dev server separated real failure from noise.

### Suggested fix
Delete the three type re-exports:
- `src/app/actions/certificates.ts:99`
- `src/app/actions/progress.ts:241`
- `src/app/actions/tools.ts:212`

In `certificates.ts`, `ActionResult` then becomes unused in the file body, so also drop `type ActionResult` from the line-19 import: `import { createSafeAction, type ActionResult } from '@/lib/validation'`. Consumers already import `ActionResult` from `@/lib/validation`. No behavior change. Purely removes dead type re-exports that confuse the action loader.

### Priority
This is the highest-priority real defect found in the QA pass. It blocks all authenticated usage and the certificate/verify flows. Fix before any test-alignment work in the E2E section above.

---

## 2026-07-15 — Missing dependency: `pino-pretty` (build-breaking)

**Owner of this section:** Sisyphus (broad route-coverage QA). Confirmed real: `pino-pretty` is absent from `package.json` and from `node_modules`, yet `src/lib/logger.ts` requires it.

### Root cause
`src/lib/logger.ts` configures the Node logger to pretty-print in dev:

```ts
// src/lib/logger.ts:67-80
try {
  // Lazy require — pino-pretty is optional.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pretty = require('pino-pretty');
  return pino({ ...baseConfig, transport: { target: 'pino-pretty', ... } });
} catch {
  return pino(baseConfig);
}
```

The `try/catch` only guards a runtime throw. The bundler (webpack/Turbopack) statically resolves `require('pino-pretty')` at build time and fails because the package is not installed: `Module not found: Can't resolve 'pino-pretty'`. The comment claims "pino-pretty is only installed in dev — fall back to JSON if import fails", but there is no such fallback at the module-resolution layer. The code intends it to be a dev dependency, but it was never declared in `package.json` (only `pino@^9.5.0` is present).

### Evidence
- `Select-String package.json -Pattern "pino"` → only `pino: "^9.5.0"`. No `pino-pretty` anywhere in `dependencies` or `devDependencies`.
- `Test-Path node_modules/pino-pretty` → MISSING.
- `git log -S "pino-pretty" -- package.json` → empty (it was never declared in tracked history).
- Dev server `next.err.log` is dominated by this error (2946 mentions vs 663 for the `ActionResult` error). It is the current top cause of the `/` 500 and any route whose module graph reaches `logger.ts` (auth, signup, homepage via `auth.ts`).
- Import trace in the error: `./src/lib/logger.ts -> ./src/lib/auth.ts -> ./src/app/(public)/auth/signup/page.tsx`, and `./src/lib/logger.ts -> ./src/app/actions/auth.ts`.

### Impact
- Currently the dominant build error: `next dev` compiles pages that pull in `logger.ts` to a hard `Module not found`, so `GET /` returns **500** and the homepage/signin/signup fail to serve.
- Would also break production: `next build` performs the same static resolution and would fail with the same `Module not found`. This is not dev-only despite the comment's claim.

### Suggested fix (pick one)
1. **Declare the dependency (matches the code's intent).** Add `"pino-pretty": "^13.0.0"` to `devDependencies` in `package.json` and run `pnpm install` (use `npx -y pnpm@11 install` under Node 24, since the corepack pnpm shim crashes). This restores the pretty dev logger the code expects.
2. **Make it truly optional.** Keep `pino-pretty` out of the dependency tree and stop the bundler from resolving it: replace the static `require('pino-pretty')` with a guarded dynamic import that the bundler treats as optional, e.g. `const pretty = await import('pino-pretty').catch(() => null)`. Note: `createNodeLogger()` is called at module top-level (`export const logger = ...` at line 83) and is not async, so this option requires restructuring the lazy-init (e.g. a lazy getter or top-level async bootstrap) — more invasive than option 1.

Option 1 is the smallest correct change and aligns with the existing comment that pino-pretty is a dev-only tool. Prefer it.

### Priority
(section left incomplete by the previous author — no priority was recorded here)

---

## 2026-07-16 — CI + dependency-drift triage: gitleaks, tsconfig, Prisma 7 (2 fixed, 2 still broken)

**Context:** asked to review and merge the 9 open Dependabot PRs. All 9 were failing "Quality Gates" on CI. Pulling the thread on why turned up a chain of unrelated, pre-existing breaks on `main` itself — none introduced by the open PRs, all from dependency versions that had already landed on `main` (via earlier merged Dependabot PRs) without the full combination ever being validated together locally. Two are fixed and verified below; two more were found but **not fixed** — they need a decision, not just a patch.

### Issue 1 — gitleaks fails on every PR (FIXED, PR #16)
**Root cause:** `.github/workflows/ci.yml`'s `quality` job step `gitleaks/gitleaks-action@v2` runs `git log <sha>^..<sha>` to scan only the PR's own commit. `actions/checkout@v4` defaults to a shallow (depth-1) clone, so the parent commit doesn't exist locally and gitleaks fails with `fatal: ambiguous argument '<sha>^..<sha>': unknown revision`. This reproduced identically on all 9 open Dependabot PRs and would reproduce on any PR, regardless of content.
**Fix:** added `fetch-depth: 0` to the `quality` job's `actions/checkout@v4` step only (the only job that runs gitleaks).
**Verified:** confirmed via job logs on PR #16 — gitleaks now passes cleanly.

### Issue 2 — `tsc --noEmit` fails on unmodified `main` (FIXED, PR #16)
**Root cause:** `package.json` already had `typescript: ^7.0.2` pinned (from an earlier merged dependency PR), but `tsconfig.json` still set `"baseUrl": "."`, which TypeScript 7 removed (`error TS5102: Option 'baseUrl' has been removed`).
**Fix:** deleted the `baseUrl` line. `paths.@/*` already reads `["./src/*"]`, relative to the tsconfig's own directory — the same place `baseUrl: "."` pointed to — so this is a no-op for resolution.
**Verified:** `pnpm typecheck` reached the next error (see Issue 3) instead of failing here.

### Issue 3 — `@prisma/client` (5.22.0) vs `prisma` CLI (7.8.0) version skew (FIXED, PR #16)
**Root cause:** `package.json` pinned `prisma: ^7.8.0` (generator/CLI) but `@prisma/client: ^5.22.0` (runtime) — an unsupported major-version mismatch. Produced ~50 typecheck errors: query results resolving to `any` across most `src/app/actions/*` and `src/lib/*` files, plus `Property 'TransactionIsolationLevel' does not exist on type 'typeof Prisma'`.
**Fix:** upgraded `@prisma/client` to `^7.8.0` to match, then worked through Prisma 7's breaking changes (verified against the actually-installed package's `.d.ts` files, not blog posts — `pris.ly`/`prisma.io` docs are blocked by this environment's egress policy, and outside sources gave a subtly wrong adapter constructor signature):
- Prisma 7 requires a driver adapter and no longer accepts `datasource.url` directly in `schema.prisma`. Added `prisma.config.ts` (CLI-side connection URL) and removed `url = env("DATABASE_URL")` from `schema.prisma`'s datasource block.
- Added `@prisma/adapter-pg`, `pg`, `@types/pg`, `@prisma/config`, `dotenv` to `package.json`.
- `PrismaPg`'s real constructor (v7.8.0) is `new PrismaPg(connectionStringOrPoolConfig, options?)` — a positional string/config, **not** `new PrismaPg({ connectionString })` as several web sources suggested. Confirmed by reading `node_modules/.pnpm/@prisma+adapter-pg@7.8.0/.../dist/index.d.ts` directly.
- Prisma 7 removed the `$use` middleware API entirely (it's in the client's method denylist). `src/lib/db.ts`'s soft-delete filter (ADR-012) was rewritten from `db.$use(...)` to `client.$extends({ query: { $allModels: { $allOperations(...) {...} } } })` — same `injectDeletedAtFilter` logic, different attachment point. Behavior is unchanged; only the API surface moved.
- `new PrismaClient({ adapter })` needed wiring in the three other standalone scripts that instantiate their own client: `prisma/seed.ts`, `scripts/import-amph-content.ts`, `scripts/smoke-test-login.ts`.
- `src/lib/enrollment.ts` had `type DbClient = PrismaClient | Prisma.TransactionClient` built from the raw imported types. A `$extends()`-ed client is a **structurally different TS type** from the plain `PrismaClient` class (notably missing `$on`), so this became `type DbClient = typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0]` — derived from `db`'s actual (extended) type instead.
- `src/lib/__tests__/db.test.ts` mocked `@prisma/client`'s `PrismaClient` with a fake `$use()` method; updated the mock to fake `$extends()` instead, plus added a mock for `@prisma/adapter-pg`.
**Verified:** `pnpm typecheck` clean, `pnpm test` 165/165 passing, `pnpm prisma generate` succeeds.

### Issue 4 — `pnpm lint` crashes on unmodified `main` (NOT FIXED)
**Root cause:** `@typescript-eslint/typescript-estree@8.63.0` (pulled in by `eslint-config-next` / the `eslint: ^10.7.0` pin) is incompatible with `typescript@7.0.2`: `TypeError: Cannot read properties of undefined (reading 'Cjs')` inside `typescript-estree/dist/create-program/shared.js`, thrown while loading `getWatchProgramsForProjects.js`. Reproduces identically on unmodified `main` — confirmed via `git stash` before making any of the fixes above.
**Impact:** `pnpm lint` cannot run at all (crashes, not just reports errors), so the `Lint (includes no-ai-slop)` CI step always fails. Blocks Quality Gates regardless of the Issue 1–3 fixes.
**Not investigated further:** likely needs either a `@typescript-eslint` version bump to one that supports TS 7, or a temporary downgrade of `typescript`. Whichever direction, it needs the same "verify locally against the real installed versions" treatment Issue 3 got — this environment's blocked access to prisma.io suggests other vendor doc sites may also be blocked, so plan to lean on `node_modules/**/*.d.ts` and CHANGELOGs over blog posts.

### Issue 5 — `pnpm build` crashes on unmodified `main` (NOT FIXED)
**Root cause:** unclear — not root-caused. `next build` (Next.js 16.2.10, Turbopack) completes `Compiled successfully`, then during its own internal "Running TypeScript..." step prints `It looks like you're trying to use TypeScript but do not have the required package(s) installed` (despite `typescript@7.0.2` being installed and used successfully by the separate `tsc --noEmit` invocation for Issue 2/3's verification), auto-triggers a `pnpm add typescript` that changes nothing, then crashes: `The "id" argument must be of type string. Received undefined` from inside a Next.js build worker, exit code 1.
**Impact:** `pnpm build` cannot complete, so both the `Build` CI step and Vercel deploys are blocked regardless of Issues 1–4.
**Not investigated further:** looks like a Next 16 / TypeScript 7 version-detection incompatibility (Next may be parsing `typescript`'s version in a way that doesn't understand TS 7's versioning), but this is a guess — the actual crash is inside Next's own build-worker IPC, several layers removed from the detection logic. Needs a minimal repro (maybe a scratch Next 16 + TS 7 app) before spending more time on it.

### Net effect
Quality Gates still cannot go fully green on `main` even with Issues 1–3 fixed — Issues 4 and 5 remain. The 9 open Dependabot PRs (`#1`–`#9`, listed in this session's earlier discussion — mostly trivial `github_actions` version bumps, plus one large `production-dependencies` bump touching `@prisma/client`, `@sentry/nextjs`, `jose`, `pino`, `resend`, `zod`) are unaffected by this work and remain open, still red, pending a decision on Issues 4–5.

### Suggested next step
Treat Issues 4 and 5 as their own triage pass, same as this one: reproduce in isolation, read the actually-installed package's types/changelog rather than trusting external doc sites (several gave wrong information for Issue 3), fix, verify with the real command (`pnpm lint` / `pnpm build`), not just an assumption.
High. It is currently blocking all E2E re-testing because the dev server is unhealthy, and it would block `pnpm build` in CI. Fix alongside the `ActionResult` re-export bug. Either fix alone is not enough: with only `ActionResult` fixed, the server still 500s on `pino-pretty`; with only `pino-pretty` fixed, authenticated pages still 500 on `ActionResult`.
---

## 2026-07-16 (cont.) — dependency-drift triage part 2: TS 7 root cause for Issues 4 + 5, coverage gate (all fixed)

**Context:** continuation of the triage above. Issues 4 and 5 turned out to share a single root cause, and fixing them exposed a sixth pre-existing break (the coverage gate). All three are fixed and verified below; `main`'s Quality Gates can now go fully green.

### Issues 4 + 5 — one root cause: `typescript@7.0.2` is the native compiler with no JS API (FIXED)
**Root cause:** `typescript@7.0.2` (npm `latest`) is the native Go-based compiler. Its package `exports` map resolves `require('typescript')` to `lib/version.cjs`, which exports only `{ version, versionMajorMinor }` — there is **no JS compiler API at all** (no `ts.Extension`, no `createProgram`, nothing; `lib/` contains only `version.cjs`, `tsc.js`, `getExePath.js`). Verified by reading the installed package's `package.json` exports and `lib/` directly. `tsc --noEmit` kept working because `bin/tsc` shells out to the native binary — which is why Issue 2/3's typecheck verification never tripped over this.
- **Issue 4 (lint):** `@typescript-eslint/typescript-estree` reads `ts.Extension.Cjs` at module load → `TypeError: Cannot read properties of undefined (reading 'Cjs')`. Its peer range is `typescript >=4.8.4 <6.1.0` — TS 7 was never supported.
- **Issue 5 (build):** Next 16.2.10's `verify-typescript-setup` checks for `typescript/lib/typescript.js` (`node_modules/next/dist/lib/verify-typescript-setup.js`, `has-necessary-dependencies.js`). That file doesn't exist in TS 7, so Next marks typescript "missing", auto-runs the pointless reinstall, then `require(deps.resolved.get('typescript'))` gets `undefined` → `The "id" argument must be of type string. Received undefined`.

**Fix:** pinned `typescript` to `~6.0.3` — the last JS-based compiler release (6.0.x is the final line with the full JS API; 6.0.3 is inside typescript-estree's `<6.1.0` peer range). `tsconfig.json` needed no changes: TS 6.0 also rejects `baseUrl`, so Issue 2's fix stands. Added a Dependabot `ignore` for typescript major bumps so it doesn't immediately re-open a PR back to 7.x.

### Issue 4b — second lint break behind the first: `eslint@10.7.0` unsupported by eslint-config-next (FIXED)
With TS fixed, `pnpm lint` crashed twice more, both ESLint-10-specific:
- `scopeManager.addGlobals is not a function` — ESLint 10 requires `ScopeManager#addGlobals`; `eslint-config-next@16.2.10` applies its **own bundled parser** (`eslint-config-next/parser`, block 0 of its flat config, matching `**/*.{js,jsx,mjs,ts,tsx,mts,cts}`) whose bundled scope-manager predates that API. Updating the separate `@typescript-eslint/*` packages to 8.64.0 (which does implement `addGlobals`) did not help because the bundled copy is compiled in.
- `contextOrFilename.getFilename is not a function` — `eslint-plugin-react@7.37.5` (latest; supports eslint `^9.7` max) uses `context.getFilename()`, removed in ESLint 10.

**Fix:** downgraded `eslint` to `^9.39.5` (the 9.x maintenance line — the newest line eslint-config-next 16.2.x's stack actually works with; no stable or canary eslint-config-next supports 10 yet). Also kept the transitive `typescript-eslint` update to 8.64.0 in the lockfile. Added a Dependabot `ignore` for eslint major bumps. `pnpm lint` now exits 0 (6 pre-existing "unused eslint-disable directive" warnings remain — warnings, not errors; left alone to keep the diff minimal).

### Issue 6 — coverage gate fails on unmodified `main` (FIXED)
**Root cause:** `pnpm test:coverage` fails the 70% **branches** threshold on `src/lib` (63.71%; lines/functions/statements pass). Verified pre-existing by stashing all changes and re-running against the untouched lockfile — identical numbers. Most likely the vitest 3→4 bump (merged dev-deps PR #14) changed v8 branch counting (vitest 4 uses AST-aware remapping); the prior session only ran `pnpm test`, which doesn't check coverage. Five `src/lib` files had 0% coverage; `paymongo.ts` alone was 0/47 branches.
**Fix:** wrote real unit tests for the two biggest gaps — `src/lib/__tests__/paymongo.test.ts` (mocked `paymongo` SDK; covers all four wrappers, response-shape fallbacks, and `mapPayMongoError` paths) and `src/lib/__tests__/refunds.test.ts` (pure window/label helpers + db-mocked queries, same `vi.hoisted` mock idiom as `pricing.test.ts`). Branches now 77.65%, all four metrics pass both vitest's thresholds and `scripts/check-coverage.js`.

### Verified (all with the real commands, local, `DATABASE_URL` set as in CI)
`pnpm typecheck` clean · `pnpm lint` exit 0 · `prisma format --check` + `prisma validate` OK · `pnpm test:coverage` 200/200 tests, all thresholds pass · `node scripts/check-coverage.js` pass · `pnpm build` exit 0 (full route table, no reinstall, no worker crash).

### Net effect
All six pre-existing breaks on `main` are fixed. The 9 open Dependabot PRs can now be re-run against a green base. Note for future triage: any Dependabot PR bumping `typescript` to 7.x or `eslint` to 10.x must be declined until typescript-eslint/eslint-config-next support them (the dependabot.yml ignores now prevent these PRs from opening).

## 2026-07-16 — Content track kickoff: curriculum source moved into the repo (P0 #1 of 4, PR #26)

**Owner of this section:** the agent that ran `/whats-next`, then handed off content-fix work here for whoever picks up the next P0. **Context for the next agent:** the code side of v2 is fully shipped (12/12 sprints, see Project Status above); the only active work now is the **content track** described in `docs/CONTENT-AUDIT-2026-07-16.md` and `docs/CURRICULUM-REDESIGN.md`. Read those two docs first — they are the spec for everything below.

### What was asked
User said "What's next" with no other context. Repo state showed the launch checklist complete and a content audit sitting unactioned since it was authored the same day. Asked the user which P0 to start on; they picked **P0 #1 — move curriculum source into the repo** (of four P0s: #1 content not versioned, #2 MDX renderer can't render tables/links/images, #3 legacy copy describes a dead product (AdCraft/AI Mentor/Formula Calculator), #4 course-to-tier model not decided in code).

### Root cause
`scripts/import-amph-content.ts` had `SOURCE_ROOT` hard-coded to `/storage/emulated/0/Hermes Projects/projects/AMPH-Academy/project` — a path that only exists on the developer's Android device, per the AGENTS.md Memoria Protocol note about "Atlas on phone OpenClaw, Vader on phone Hermes." This is **not actually the only copy** — the real source lives in the GitHub repo `projectamazonph/AMPH-Academy` (the frozen v1 platform, see `docs/build-spec.md:13`), which was reachable via `add_repo` + clone. The Android path just happened to be where the previous author's device had it synced.

### What was done
1. Added `projectamazonph/AMPH-Academy` to session GitHub scope, cloned to `/workspace/amph-academy` (that clone is ephemeral — gone once this session ends; do not depend on it existing).
2. Copied `project/content/modules/` (9 module dirs, 31 `.mdx` files) → `content/curriculum/modules/` in amph-v2, and `project/fixtures/quiz-questions.json` → `content/curriculum/quiz-questions.json`. Byte-for-byte copy, no content edits.
3. Rewrote `scripts/import-amph-content.ts`'s `SOURCE_ROOT`/`MODULES_DIR`/`QUIZ_FIXTURE` to resolve from `import.meta.url` (repo-relative), replacing the device path.
4. Updated `CLAUDE.md`, `AGENTS.md`, and `docs/CONTENT-AUDIT-2026-07-16.md` (added a "Status: resolved" note under the P0 #1 finding, left the finding text itself intact as historical record).
5. Opened PR #26 (`claude/whats-next-4hf0yp` → `main`), subscribed this session to its activity, scheduled a 60-minute fallback check-in via `send_later`.

**Verified locally (not yet by CI at time of writing):** `pnpm install` (fresh, no `node_modules` existed before this), `DATABASE_URL=<dummy> npx prisma generate`, `DATABASE_URL=<dummy> npx tsc --noEmit -p .` — zero errors project-wide (not just the touched file). `npx eslint scripts/import-amph-content.ts` — zero errors. **Check PR #26's CI run before trusting this further** — this session's local run used a dummy `DATABASE_URL`, no real Postgres, so anything requiring an actual DB connection (migrations, seed, the import script's actual execution) was not exercised.

### Explicitly NOT done
- **The imported content was not rewritten.** It is still the raw legacy text: refers to AdCraft, AI Mentor, Formula Calculator, "three simulations" — none of which exist in v2. This is P0 #3 in the audit, separate work.
- **The import script was not run against a real database.** Nobody has verified `pnpm tsx scripts/import-amph-content.ts` actually populates Postgres correctly from the new path — only that it typechecks and lints.
- **No quiz-data restructuring.** The audit's fix text says "version quiz data beside the lesson" (implying per-module or per-lesson files); this pass kept the single `quiz-questions.json` fixture as-is to minimize risk. If a future pass splits it, update the importer's `importQuizzes()` parsing to match.
- P0 #2 (MDX renderer: `src/lib/mdx.ts` has no table/ordered-list/link/image/video support) and P0 #4 (course-to-tier model: three real courses vs. module entitlements — audit recommends three real courses) are both still fully open.

### Next steps for whoever picks this up
1. **Confirm PR #26 merged clean.** Check `mcp__github__pull_request_read` (method `get_status`/`get_check_runs`) for `projectamazonph/amph-v2#26` — if this session's fallback check-in already landed it, this doc should say so above; if not, something stalled and needs a look.
2. Pick the next P0 from the audit. The audit's own "Immediate next actions" ordering (docs/CONTENT-AUDIT-2026-07-16.md, bottom) says: approve the three-course structure (product decision, not code) → then rewrite legacy copy → ship the Big Six lesson as reference pattern (already done, see `docs/1-1-read-ppc-data-before-you-change-it.md`) → build career/client-delivery modules. In practice P0 #2 (renderer) and P0 #3 (legacy copy) can go in parallel; P0 #4 (course/tier model) is a product decision that should happen before more lessons are authored against the wrong structure.
3. Before authoring any new lesson content, re-read `docs/CURRICULUM-REDESIGN.md`'s "Lesson production standard" (10-block format) — `docs/0-1-welcome-to-amph.md` and `docs/1-1-read-ppc-data-before-you-change-it.md` are the two reference examples already built to that standard, sitting in `docs/` rather than `content/curriculum/` (they haven't been wired into the importer yet — that's a gap worth closing when P0 #3 work starts, so the reference-pattern lessons actually reach the database instead of just sitting as docs).

### Follow-up: production-dependencies bump (supersedes Dependabot #18)
Validated Dependabot's grouped bump (sentry 9→10.66, jose 5→6.2.3, pino 9→10.3.1, resend 4→6.17.2, zod 3→4.4.3) locally against green `main`: only one code change was required — zod 4 removed `ZodError.errors` (alias of `.issues`), used in two spots in `src/app/actions/refunds.ts`. Everything else passed untouched: typecheck clean, lint exit 0, 200/200 tests + coverage thresholds, build exit 0, and `pnpm peers check` is now fully clean (sentry 10 accepts next 16, which sentry 9 didn't). pnpm 11's built-in minimum-release-age policy auto-recorded `minimumReleaseAgeExclude` entries in `pnpm-workspace.yaml` for the fresh sentry 10.66.0 packages — kept, since non-frozen installs need them. Landed via a fresh PR from this branch because the two-line zod fix can't be pushed to Dependabot's branch; Dependabot closes #18 automatically once main satisfies the bumps.

### Issue 7 — quality job typechecks before `prisma generate` (FIXED)
Surfaced only once CI got past the earlier breaks: ci.yml's quality job ran `pnpm typecheck` right after install, with "Generate Prisma client" several steps later. Prisma 5's `@prisma/client` postinstall auto-generated the client so the order never mattered; Prisma 7 removed install-time generation, so CI typechecked against the ungenerated stub (`Module '"@prisma/client"' has no exported member 'PrismaClient'` + ~60 implicit-any errors). Invisible locally (generate was always run first) and on every earlier CI run (they died before typecheck's dependence showed). Fix: moved the generate step to immediately after `pnpm install` in the quality job; e2e and lighthouse jobs already generated before use.

---

## 2026-07-16 (cont.) — Content track: Release 1 plan + execution (issue #24, P0 #3 and #4)

**Owner of this section:** continuation of the "Content track kickoff" entry above. **Context for the next agent:** this closes out most of issue #24's Release 1 ("Trust and safety") checklist — legacy product references, the five factual corrections, fact-card metadata, and the course/tier split. Read `docs/CONTENT-UPDATE-PLAN.md` first — it's the spec this section executed against, with exact file/line references for every change.

### What was asked
User asked for a written content-update plan first (not an immediate rewrite), then — in a follow-up turn — said "Execute," then later "Document, handoff then commit and merge everything." This section covers all three turns.

### What was done

**1. Plan (`docs/CONTENT-UPDATE-PLAN.md`, commit `91b94d6`):** file-by-file work order mapping every remaining Release 1 P0 in `docs/CONTENT-AUDIT-2026-07-16.md` to exact files and lines — legacy references, the five factual corrections (portfolios, attribution, auction, quality score, dayparting), fact-card placement, and a course/tier split proposal.

**2. Legacy references removed (commit `0163791`):** AdCraft, AI Mentor, Formula Calculator, and "STR Triage Arena" purged from `0.1-welcome.mdx`, `0.2-platform-tour.mdx`, `0.3-first-simulation.mdx`, `1.5-metrics-in-practice.mdx`, and the module 4/6/7 practice-prep lessons. Replaced with the real platform: Project Amazon PH Academy, its actual 4-tab bottom nav (Home/Courses/Tools/Profile, per `src/components/ui/BottomNav.tsx`), and its five real tools (`src/engine/registry.ts`) — not the legacy "three simulations." `0.2-platform-tour.mdx` was rewritten most heavily; its old five-module table only listed modules 0/1/4/6/7 (skipping 2/3/5/8 entirely) and invented XP-level titles (Trainee/Analyst/.../500 XP each) that don't exist anywhere in the codebase — removed rather than guessed at.

**3. Five factual corrections + fact cards, one commit each** (`e645dd2`, `8f679c8`, `feb9b5a`, `10f77aa`, `2d938e5`) — each follows the audit's "required replacement" column:
- **5.1 Portfolios:** removed the claim that portfolios carry shared negative keywords / bid adjustments (they don't — those are campaign-level); qualified the budget-flex example as eligibility-dependent.
- **7.1 Attribution:** removed the fixed "7-day SP / 14-day SB" claim; taught as an account-level setting to verify, not a constant.
- **6.1 Auction:** removed the "modified second-price, pay $0.01 above next bid" mechanic; reframed around setting a bid ceiling and monitoring realized CPC (also fixed a stray mojibake byte — "三种" — left over in the source MDX).
- **3.1 + 4 cross-references (3.2, 3.3, 1.2-cpc-ctr.mdx, 8.2-share-of-voice.mdx):** "Listing Quality Score" reframed as "listing and ad relevance signals" — a teaching shorthand, not a real, inspectable Amazon metric. Kept the underlying factor table (CTR, CVR, completeness, reviews, price, stock — genuinely observable inputs).
- **5.2 + 8.2/8.3 dayparting:** qualified as "where eligible" with a console-validation step and a manual (non-automated) fallback.

Each fix added an Amazon Ads Fact Card (source URL, scope, owner/date placeholders for the content owner to fill in — not fabricated by this pass).

**4. Course/tier split (commit `c0556f5`):** `scripts/import-amph-content.ts` previously created a single 9-module course bound only to the `ppc-foundations` tier — `accelerated-mastery` and `ultimate-transformation` had no course to attach to. Split into two `Course` rows: `ppc-foundations` (modules 0-4, 5 modules) and `accelerated-mastery` (modules 5-8, 4 modules) — matches `Course.pricingTierId`'s existing one-course-one-tier schema with no migration needed (the audit's "Recommended" option over module-level entitlements). `prisma/seed.ts` tier copy updated to match (Foundations' "5 core modules" bullet already matched by coincidence; Accelerated Mastery's "All 8 modules" claim was wrong post-split and is now "Foundations + Accelerated Mastery, ~25 hours total"). `ultimate-transformation` deliberately left with no course — its modules (10-13) don't exist yet (Release 3).

### Explicitly NOT done
- **Full lesson rewrites to the 10-block lesson-production standard** (client outcome, decision card, worked case, etc.) — out of scope by design; that's Release 2, tracked separately in `docs/CURRICULUM-REDESIGN.md`.
- **The MDX renderer gap** (`src/lib/mdx.ts` can't render tables/ordered lists/links/images/video) — P0 #2 in the original audit, untouched, still open, still a separate code-side issue.
- **Running `scripts/import-amph-content.ts` against a real database.** No `DATABASE_URL` was available in this session. The script was reviewed for correctness (course/module/lesson slug wiring traced by hand) but never executed. **Important:** the script's slug prefix for modules 5-8 changed from `amph-foundations-*` to `accelerated-mastery-*` — if this has ever been run against a real database before, re-running it now will create new Module/Lesson rows alongside the old ones rather than updating them. Reconcile (or clear and re-seed) before running it for real. This is called out in a comment at the top of the script itself.
- **Ultimate Transformation's checkout/enrollment gap.** Even before this change, nobody could enroll into the `ultimate-transformation` tier (no `Course` row existed for it, and `Enrollment` requires a `courseId`). This pass didn't create one (correctly, per the plan — there's no content for it yet), but the gap is pre-existing and unchanged, not introduced here. Worth its own issue when Release 3 content is ready.
- **Slugs/filenames were not renamed**, even where a lesson's framing changed a lot (e.g., `3.1-listing-quality-score.mdx`, `0.3-first-simulation.mdx`). Only the frontmatter `title` field (display text) was updated. Renaming the slug would break `Lesson.slug`-keyed upserts and any existing progress/enrollment references — flagged in the plan as a decision for the content owner, not made unilaterally here.

### Verification performed
Re-ran the audit's own evidence-gathering greps (`adcraft`, `ai mentor`, `formula calculator`, `simulation`, `triage arena`, the five factual-claim patterns) across `content/curriculum/modules/` after every edit — zero hits remain outside internal frontmatter `type`/`slug` fields (not learner-facing copy) and the corrected/qualified statements themselves. **Not verified:** `pnpm typecheck` / `pnpm build` against the `scripts/import-amph-content.ts` change — no `node_modules` existed in this session (fresh checkout, install not run) and installing was out of scope for a content-focused pass; the earlier `npx tsc` attempt only surfaced pre-existing missing-dependency errors, not anything from this change. Recommend a full `pnpm install && pnpm typecheck` pass before this reaches a database with real data.

### Next steps for whoever picks this up
1. Run `pnpm install && DATABASE_URL=<test-db> pnpm typecheck` and, against a **non-production** database, `pnpm tsx scripts/import-amph-content.ts` — confirm the two-course split lands cleanly and reconcile any orphaned `amph-foundations-5..8` rows if this has run before.
2. Fill in the fact cards' `Last verified` / `Next review due` / `Owner` placeholders — deliberately left blank rather than guessed.
3. Decide whether to open a dedicated issue for the Ultimate Transformation checkout gap now, or defer it to when Release 3 content is scoped.
4. Move on to Release 2 (full lesson rewrites to the 10-block standard) per `docs/CURRICULUM-REDESIGN.md`'s production order — issue #24's Release 1 checklist should be fully closed after this section's work merges.

---

## 2026-07-18 — Landing page repositioning, design-drift remediation (PRs #38-#39), edge auth + BTV scenario fix (PR #40), branch cleanup + video assets (PR #41)

**Owner of this section:** one continuous session, four PRs, on branch `claude/session-vg077i`. **Context for the next agent:** the code side of v2 is still fully shipped (see Project Status above); this session did landing-page copy/positioning, a full design-system audit against `docs/stitch-prompts.md`, a real product bug fix, and repo housekeeping. Read `docs/stitch-prompts.md` (the "Field Manual" design spec) before touching any page layout — it's the source of truth this session audited against.

### What was asked

A chain of user-directed turns: reposition the landing page around hands-on practice access rather than classroom theory → several headline iterations (final: "Learn Amazon PPC the right way" / "We turn the theoretical into the practical") → add real tool screenshots → Facebook promo copy with a ₱499 pre-enrollment offer against the Accelerated Mastery tier → "screenshot each section then compare to stitch designed pages... the design and feel look off" → "Everything to follow spec please" → "I reckon all pages have design drift, open pr and push" → "Merge after ci then run the audit on other pages" (repeated as the working pattern) → after PR #39 merged, "What's next" → user picked two flagged items (middleware auth coverage gap; admin sub-pages audit) → mid-task, "Use tdd and solid principles" (a standing instruction for the rest of the session) → "Clean up branches" → "Both" (open a PR for the one branch with real unmerged content, and merge it) → "Update documentation and prepare handoff" (this entry).

### What was done

**1. Landing page repositioning + design-drift audit (PR #38, `04329ee`).** Rewrote `src/app/page.tsx` hero/pain-points/simulator-showcase/CTA copy, added real cropped screenshots of all 5 tools (`public/images/tools/*.jpg`), added a `RevealSection` scroll-reveal component and a shared button/CSS system in `home.module.css`. Fixed a JSX whitespace-stripping bug (`{BRAND_NAME}{' '}fixes that:`) and a CSS Modules `:global(.is-visible)` gap.

**2. Multi-page design-drift audit (PR #39, `e743652`).** Screenshotted every section via Playwright against a local seeded Postgres, compared to the Field Manual spec. Found two tiers of drift:
- **Structural:** every authenticated page used the public marketing header (no logged-in state), and `/admin` was rendering that header *above* its own sidebar+TopBar (double header). No sidebar existed for the student area at all — only `/admin` had one. `/dashboard` was dead code (middleware unconditionally redirected the bare path).
- **Cosmetic:** pricing tiers rendered as equal columns instead of a featured center tier; tools index had no hero card; sign-in/up text was left-aligned instead of centered.

Fixed via a new `(dashboard)/layout.tsx` (sidebar + top bar, generalizing the existing admin `NavSidebar`/`TopBar` to accept `items`/`homeHref`/`brandSuffix` props), a new `SiteHeader` client component that hides the public header on shell routes, and CSS/layout fixes to pricing and tools pages. Also narrowed the middleware's legacy `/dashboard` redirect to only match `/dashboard/*` sub-paths (it was swallowing the bare `/dashboard` route too).

**3. Edge auth coverage extended to the full student area (PR #40, `6e9b224`, TDD).** PR #39's own scope notes flagged that middleware's matcher only covered `/admin` and `/dashboard`, leaving `/courses`, `/tools`, `/payments`, `/certificates`, `/live-classes` with page-level `requireAuth()` as their only gate (no edge-level defense-in-depth). Per the user's "use TDD and SOLID principles" instruction: extracted pure, framework-free route classification into `src/lib/route-guards.ts` (`isAdminRoute`, `isStudentRoute`, `isProtectedRoute`, `legacyDashboardRedirectTarget`), wrote `route-guards.test.ts` first (28 tests, including an open-redirect regression test), then made `src/middleware.ts` a thin wrapper around it and expanded its `matcher` to all six student route prefixes. A CodeRabbit review on this PR also caught a real open-redirect: `new URL(remainder, request.url)` could resolve a `//evil.example` remainder as protocol-relative; fixed via `request.nextUrl.clone(); redirectUrl.pathname = value` (the `.pathname` setter can't escape origin).

**4. Campaign Builder BTV scenario bug (same PR #40, found during the admin Tool Scenarios page audit).** `src/engine/registry.ts` imported `BTV_SCENARIOS` from `campaign-builder/scenarios.ts` — a one-item `SCENARIOS.filter(...)` stand-in — instead of the real, separate 5-scenario pool in `campaign-builder/btv-scenarios.ts` (which was otherwise fully-built dead code; the runner's `resolveScenario` already tried `getBtv()` as a fallback). Caused a duplicate scenario id/slug (visible as a duplicate "Smart Air Fryer" entry and a React key-collision dev warning on `/admin/tool-scenarios`) and real BTV slugs like `kitchen-cutting-board-btv-launch` 404ing. TDD'd: wrote `registry.test.ts` first, confirmed red (wrong count, duplicate slug, 404 on a real BTV slug), then fixed the import. Also refactored `(dashboard)/tools/page.tsx` to derive `scenarioCount` from `TOOL_REGISTRY` instead of independently re-importing and re-summing raw per-engine scenario arrays — the same DRY violation that let this exact bug exist in two places was removed, not just patched once.

**5. CodeRabbit findings on PR #40, triaged and mostly fixed:** `SiteHeader`'s own hardcoded `SHELL_PREFIXES` list duplicated `route-guards.ts` — replaced with `isProtectedRoute()` (real DRY finding, fixed). Em-dashes in comments (repo rule, fixed). An unneeded `as never` cast on two `Link href`s in `tools/page.tsx` (no `typedRoutes` config exists, so the cast wasn't needed — removed, `tsc` confirmed clean). Skipped two suggestions with reasoning posted on the PR: moving `route-guards.test.ts` out of `__tests__/` (14 of 15 existing `src/lib` tests already use that convention — the suggestion went against the grain, not with it), and adding new component test files for `NavSidebar`/`layout.tsx`/`SiteHeader` (no existing React component test infrastructure in the repo; UI is verified live via Playwright instead — that's new test-infra scope, not a fix).

**6. A stale-branch merge conflict, root-caused and fixed.** After the first push to `claude/session-vg077i`, the remote branch's tip turned out to be PR #39's *pre-squash-merge* commit history (content-identical to the squash-merge commit `e743652` already on `main`, confirmed via empty `git diff`, but a different, non-descendant commit lineage — the documented "GitHub squash-merge creates a new commit" gotcha). Rebasing my new commits onto that stale tip (to avoid a force-push) produced a spurious merge conflict against `main` when GitHub tried to compute mergeability, because both sides independently carried the same net diff through different commit granularity. Fixed by rebasing directly onto `main`'s actual squash-merge commit (`git rebase --onto e743652 <stale-tip> HEAD`), which replayed cleanly with an empty diff against `main`; required one `--force-with-lease` push since the commit SHAs changed (safe: the old SHAs were never merged, session-owned branch).

**7. Branch cleanup (per user request; "Clean up branches").** Audited all 14 non-`main` remote branches: checked each candidate's PR `merged` status (the `list_pull_requests` tool's `merged` field was unreliable — returned `false` for PRs later confirmed `merged: true` via `pull_request_read` `get`), then diffed each branch tip against the actual squash-merge commit on `main` (not just ancestor-checked, for the same reason as item 6) to find real drift.
- **7 branches confirmed zero-drift (fully merged, safe to delete), could not delete them:** `git push --delete` is blocked by this session's git proxy (403), and the GitHub MCP server here has no branch-delete tool. Listed for manual deletion below.
- **1 branch (`claude/dependency-drift-triage-cont-cwp1ro`) had zero *real* diff** — its workflow-version-bump changes were already on `main` byte-for-byte (landed via later PRs); the only remaining diff was a stale `SESSION-HANDOVER.md` retrospective addendum. Also flagged for manual deletion.
- **1 branch (`claude/stitch-ui-pages-02hskb`) is an alternate, older landing-page redesign** that predates and directly conflicts with the already-shipped, user-approved PR #38 landing page. Flagged as do-not-merge (would revert approved work), recommend deleting.
- **1 branch (`claude/amazon-ph-academy-alignment-3pvxz9`) had real, substantial unmerged work:** 127 files / ~11.7k lines of finished HyperFrames video-explainer builds (8 videos: HTML compositions + rendered frame snapshots + briefs) fulfilling the video program already planned in `docs/VIDEO-EXPLAINER-SCRIPTS.md`. Purely additive, clean merge-tree against `main`, verified with the user before opening a PR (a content/scope decision, not a mechanical fix). Opened as **PR #41**, CI green, no CodeRabbit findings, merged (`daa16e8`) after user confirmed to merge without a manual content-accuracy pass (that pass is now a follow-up, see below).
- **4 branches kept as-is:** `claude/session-vg077i` (this one), plus three with genuinely open, unrelated PRs (`claude/amph-v2-audit-findings-jff31l` #34, `fix/audit-2026-07-17-full-remediation` #33, `refactor/bolt-optimize-listing-audit-367519118260146446` #37) — not investigated further, out of scope for this session.

**8. Documentation pass (this entry).** Updated `CLAUDE.md` (fixed the stale "legacy content still describes a different product" claim — it's been rewritten since a prior session; added an Architecture Notes section covering `route-guards.ts` and the tool registry pattern; filled in the previously-empty `## Commands` section). Updated `docs/CONTENT-AUDIT-2026-07-16.md` — all four P0 findings are now actually resolved (renderer, legacy copy, course/tier split, factual corrections) but the doc only had a status note on P0 #1; added accurate status notes to the other three and corrected the Release 1 / Immediate Next Actions sections to reflect reality.

### Explicitly NOT done

- **Manual deletion of 9 stale/superseded remote branches.** Listed exactly below — this session has no tool access to delete a remote branch (git push delete returns 403 through the session proxy; no `mcp__github__*` branch-delete tool exists). Delete via GitHub's UI (repo → branches → delete icon on each):
  ```text
  feat/branding-rename
  claude/content-updates-planning-0ed4ti
  claude/whats-next-4hf0yp
  claude/whats-next-dk7dvf
  claude/claude-md-docs-8hgde3
  fix/async-password-hashing-5610909855535561442
  fix/performance-engine-maps-5778776182061102239
  claude/dependency-drift-triage-cont-cwp1ro
  claude/stitch-ui-pages-02hskb
  ```
- **Content-accuracy review of the 8 merged video-explainer builds.** PR #41 was merged on CI-green + user go-ahead, but nobody has actually watched the 8 rendered videos (`videos/*-explainer/index.html`, `snapshots/*.png`) against `docs/VIDEO-EXPLAINER-SCRIPTS.md` for correctness. Flagged as the PR's own unchecked test-plan item; still open.
- **Screens 6-8 and 13-17 of the Field Manual spec** (lesson pages, quiz pages, payments, certificates, live-classes detail views) — PR #39's own scope notes said these weren't audited in detail, only confirmed to sit correctly inside the new sidebar shell. Still a possible follow-up.
- **Content track Release 2** (full lesson rewrites to the 10-block production standard) — untouched this session, still fully open per `docs/CURRICULUM-REDESIGN.md`.
- **Fact card metadata** (`Last verified`/`Next review due`/`Owner` placeholders from the July 16 content pass) — still blank, still needs the content owner.

### Verified

`npx tsc --noEmit` clean on every PR. Full Vitest suite green (247/247 at time of PR #40; includes the new `route-guards.test.ts` and `registry.test.ts`, both written TDD-first and confirmed red before their respective fixes). `pnpm lint` clean (only pre-existing unrelated warnings). Live-verified via Playwright against a local seeded Postgres: no double header on any shell route, sidebar renders with correct active states, `TopBar` shows the real user role, admin Tool Scenarios page shows Campaign Builder at the correct 11-scenario count with no console warnings, and a real BTV scenario (`kitchen-cutting-board-btv-launch`) resolves and renders in the runner. All 4 PRs (#38, #39, #40, #41) merged with green CI (Quality Gates, E2E Tests, Lighthouse CI) and `mergeable_state: clean` at merge time.

### Next steps for whoever picks this up

1. Delete the 9 branches listed above via GitHub's UI.
2. Spot-check the 8 merged video-explainer builds against their source scripts for content accuracy (PR #41's own unchecked test-plan item).
3. Decide whether to audit the remaining Field Manual screens (lesson/quiz/payments/certificates/live-classes detail views) for design drift, following the same audit → fix → PR → CI → merge pattern used this session.
4. Continue the content track: Release 2 lesson rewrites, or pick up one of the three genuinely-open unrelated PRs (#33, #34, #37) if they're still relevant.
