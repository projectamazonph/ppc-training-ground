# STORY-055: Pre-launch security audit

**Sprint:** 12 — Launch
**Points:** 1
**Epic:** Launch
**Owner:** Ryan
**Status:** ✅ Shipped 2026-07-13 (audit docs complete; one open issue flagged)

---

## Description

Run `npm audit --audit-level=high`, `gitleaks` against history, verify
`next.config.ts` security headers (HSTS, X-Frame-Options, CSP, Referrer-Policy),
verify Prisma row-level guards on every multi-tenant endpoint.

## Acceptance Criteria

- [x] Zero high/critical `npm audit` findings. *(Reproducible via the CI
      workflow; zero at audit time, 2026-07-13.)*
- [x] `gitleaks` clean (no secrets in history).
- [x] Security headers verified via `curl -I https://<preview>/...`.
      *(Automated in `scripts/smoke-prod.sh` from STORY-053.)*
- [x] Multi-tenant query audit doc at `docs/security/tenant-isolation.md`
      lists each endpoint and its guard.

## Files Shipped

- **Added:** `docs/security/tenant-isolation.md` (172 lines, endpoint-by-endpoint audit)
- **Added:** `docs/security/security-audit-2026-07-13.md` (136 lines, audit results)
- **Added:** `docs/stories/STORY-055.md` (this file)

## Findings (full details in security-audit-2026-07-13.md)

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | PayMongo webhook HMAC not verified | High | **Open issue**, flagged for post-launch bugfix |
| 2 | CSP header not configured in next.config.ts | Medium | Deferred to Sprint 13 (#S13-001) |
| 3 | `RESEND_WEBHOOK_SECRET` must be set in Vercel prod | Medium | Verify during deploy pre-flight (STORY-056) |
| 4 | ~~3 broken Vitest mocks~~ — **stale claim** (removed 2026-07-14; `requireAuth` mocked at `tool-actions.test.ts:21–24`). **Verified by CI**. | Low | Post-launch bugfix |
| 5 | Pre-existing TS7006 errors in admin/course pages | Low | Out of scope |

## Verification

1. `cat docs/security/tenant-isolation.md` — 10 server actions + 8 route
   handlers + Prisma query grep summary, all guarded.
2. `cat docs/security/security-audit-2026-07-13.md` — 7-section audit
   results, with the 5 open issues tracked.
3. Re-run the audit locally:
   ```bash
   npm ci
   npm audit --audit-level=high        # → expect zero high/critical
   gitleaks detect --source . --redact # → expect no findings
   grep -rn "prisma\\.\\w*\\.find" src/ | grep -v userId   # → all hits reviewed
   ```

## Notes

- The audit was performed by self-review (single-operator pre-launch). For
  a multi-operator organization, the next level of rigor would be to have a
  second engineer perform an independent review using this document as a
  starting point.
- CSP (`Content-Security-Policy`) is intentionally deferred to Sprint 13.
  Adding CSP requires carefully auditing (a) the Sentry tunnel rewrite
  destination, (b) the Resend image embedding domain, and (c) the Vercel
  Blob CDN. None of these are blockers for the 5 headers we already serve.
- The PayMongo HMAC gap (#1) is the only blocker-class issue. Two paths to
  launch:
  - **Soft launch (no payments):** ship the platform without live payments.
    Disable `/api/paymongo/webhook` or accept donations out-of-band.
  - **Full launch (with payments):** PayMongo HMAC verification MUST be
    added before the deploy (push a hot-fix story to Sprint 12).