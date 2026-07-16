# branding-rename - Work Plan

## TL;DR (For humans)

**What you'll get:** Every user-facing and internal occurrence of the brand "AMPH Academy" (and its variants "AMPH ACADEMY", "AMPH Admin", cert prefix "AMPH-") replaced with **"Project Amazon PH Academy"** across the entire `amph-v2` repo, exactly as you chose: full name everywhere, including the admin sidebar ("Project Amazon PH Academy Admin"), uppercase eyebrows ("PROJECT AMAZON PH ACADEMY"), and the certificate number/PDF prefix ("PAPH-").

**Why this approach:**
- A single source of truth `src/lib/brand.ts` is introduced so future copy changes are one-line, not a 50-file hunt. All product code references it; markdown docs get a literal string pass (they can't import TS).
- Three strings need manual handling, not blind replace: `ProjectAMPH Academy` (script), `Project Amazon PH AMPH Academy v2` (product brief), and the `AMPH-Academy` (hyphen) external repo references which must be LEFT ALONE.
- `amph-academy.com` fallback domain and the `AMPH-Certificate-` download filename are brought in line with the rebrand since they are user-visible.

**What it will NOT do:** Rename code identifiers, file names, or the `amph-v2` directory (e.g. `importAmphContent`, `amph-v2/`). Those are repo/slug names, not branding. No image/logo work is needed (branding is a pure text wordmark — confirmed no favicon/logo assets exist). The `AMPH-Academy` (hyphen) old-GitHub-repo references are intentionally kept.

**Effort:** ~15 product-code files + ~38 docs/config files + 1 new constant + 1 Prisma default migration. Mechanical, low logic risk.

**Risk:** Low. No tests assert the old name, so the only failure modes are (a) a missed string (caught by the final grep audit) and (b) the two double-up special cases (handled explicitly below).

**Decisions (you confirmed):**
- Scope: **Full rebrand everywhere** (user-facing + internal docs/config/comments/Prisma default).
- Compact marks: **Full name everywhere**, cert prefix `AMPH-` → `PAPH-`.
- Target string (exact): `Project Amazon PH Academy`. Domain `projectamazonph.com` in email footers is kept.

---

## Scope

**IN — replace `AMPH Academy` / `AMPH ACADEMY` / `AMPH Admin` / `AMPH-` with the new brand:**
1. Product UI: `layout.tsx` (nav + metadata + OG), `NavSidebar.tsx`, `page.tsx` (hero + footer), `admin/page.tsx`, `verify/[hash]/page.tsx`, `certificates/[hash]/pdf/route.ts`.
2. Outbound email: `email.tsx` (enrollment, refund, live-class templates).
3. Generated PDF: `cert-pdf.tsx`.
4. All route `<title>` metadata strings (pricing, checkout/complete, live-classes, live-classes/[id], payments, payments/[id]/request-refund, certificates) AND the cert-number display on the certificates list page (`:63`).
5. Prisma `businessName` default in `schema.prisma` (+ a new migration).
6. All internal docs/prose: README.md, FEATURES.md, AGENTS.md, CHANGELOG.md, SESSION-HANDOVER.md, docs/* (all, except `docs/product-brief.md` which is handled manually in T13), bmad/*.yaml, src/styles/README.md, src/lib/mdx.ts, src/lib/enums.ts comments, prisma/seed.ts, scripts/import-amph-content.ts, docs/product-brief.md.

**OUT — Must-NOT-Have (do NOT touch):**
- Code identifiers / variable / function / type names (`importAmphContent`, `amphAcademy` if any, etc.).
- File or directory names, including the repo folder `amph-v2/`.
- The `AMPH-Academy` (hyphen) external GitHub repo / source-directory references — these are old-repo names, NOT the product brand. See keepers below.
- Product copy/descriptions that mention "Amazon advertising training" etc. but not the brand name.

**Special-case handling (manual, NOT blind substring replace):**
- `scripts/import-amph-content.ts` lines 10 + 40 (`ProjectAMPH Academy`) → `'Project Amazon PH Academy'`. Blind replace would yield `ProjectProject Amazon PH Academy`. The `AMPH-Academy` (hyphen) references on lines 3, 5, 33, 351 are KEPT (external repo paths).
- `docs/product-brief.md` line 3 (`Project Amazon PH AMPH Academy v2 (v2)`) → `Project Amazon PH Academy v2 (v2)`. Blind replace would yield `Project Amazon PH Project Amazon PH Academy v2`.
- `src/app/(dashboard)/certificates/[hash]/pdf/route.ts` line 40 fallback `'https://amph-academy.com'` → `'https://projectamazonph.com'` (user-visible in cert verification URL; not the brand phrase, handled explicitly).
- `route.ts` line 53 download filename `AMPH-Certificate-` → `PAPH-Certificate-`.
- **Keepers (do NOT replace):** `AMPH-Academy` (hyphen) references in `scripts/import-amph-content.ts` (lines 3, 5, 33, 351), `docs/build-spec.md` (13, 24), `docs/design-brief.md` (257). These are external GitHub repo / source-directory names, not the product brand.

---

## Verification strategy

- **Type safety:** `pnpm tsc --noEmit` after introducing `brand.ts` and rewiring imports.
- **Lint:** `pnpm lint` (includes `local/no-ai-slop`; no new violations expected).
- **Unit/integration:** `pnpm test` (Vitest). Confirmed no test asserts "AMPH Academy", so suite should stay green; any failure is a real regression.
- **E2E:** `pnpm test:e2e` (Playwright). No e2e assertion references the brand, but the user is currently running this suite — the worker must run it post-change to confirm no collateral breakage.
- **Build:** `pnpm build` (production build must succeed).
- **Grep audit (primary gate):** a final `grep -rn` for `AMPH Academy|AMPH ACADEMY|AMPH Admin|AMPH-` across `src docs bmad prisma scripts README.md FEATURES.md AGENTS.md CHANGELOG.md SESSION-HANDOVER.md` must return ONLY the intentional keepers listed in the Success criteria. Any other hit = incomplete.
- **Agent-executed QA is included on every todo** (happy + failure paths with evidence) below.

---

## Execution strategy

1. Branch off `main`: `git checkout -b feat/branding-rename` (per AGENTS.md branching rules). Ensure clean tree; do not disturb the user's in-flight e2e run (separate process).
2. Introduce `src/lib/brand.ts` once; every product-code todo imports from it (single source of truth).
3. Execute product-code todos (T2–T10) using the constant; keep literal only where a constant cannot be used (markdown).
4. Prisma default via a NEW migration (never edit the historical `migration.sql`).
5. Docs/config literal pass (T12–T13) with the two manual special cases + the keeper exclusions.
6. Verification wave (T14–T15) + Final verification wave.
7. Conventional commits per wave, squashed-PR back to `main`.

**Brand constant contract:**
```ts
// src/lib/brand.ts
export const BRAND_NAME = 'Project Amazon PH Academy';
export const BRAND_NAME_UPPER = 'PROJECT AMAZON PH ACADEMY';
export const BRAND_CERT_PREFIX = 'PAPH';
```

---

## Todos

### Wave 1 — Foundation: brand constant
- **T1: Create `src/lib/brand.ts`.**
  - References: new file at `src/lib/brand.ts`.
  - Acceptance: file exports `BRAND_NAME`, `BRAND_NAME_UPPER`, `BRAND_CERT_PREFIX` with the exact strings above; `tsc --noEmit` and `lint` pass.
  - QA happy: `import { BRAND_NAME } from '@/lib/brand'` resolves in a scratch import; value === 'Project Amazon PH Academy'. Evidence: `tsc` output clean.
  - QA failure: missing/renamed export → downstream todos fail to compile; caught by `tsc`. Evidence: build error names the missing symbol.
  - Commit: `feat: add central brand constant`.

### Wave 2 — Product UI / metadata (src), all referencing `@/lib/brand`
- **T2: Rebrand `src/app/layout.tsx` (nav + metadata + OG).**
  - References: `layout.tsx:21` (title.default), `:22` (title.template), `:32` (openGraph.siteName), `:79` (header nav `<Link>` text).
  - Acceptance: `title.default = BRAND_NAME`; `title.template = '%s | ' + BRAND_NAME`; `openGraph.siteName = BRAND_NAME`; nav `<Link>{BRAND_NAME}</Link>`; zero `AMPH` literals remain in file.
  - QA happy: load `/` → tab title "Project Amazon PH Academy"; nav shows "Project Amazon PH Academy". Evidence: rendered DOM text + title.
  - QA failure: any `AMPH Academy` literal left in source → grep audit (T15) fails. Evidence: grep hit.
  - Commit: `refactor: rebrand root layout nav and metadata`.

- **T3: Rebrand `src/components/ui/NavSidebar.tsx`.**
  - References: `NavSidebar.tsx:31` (`AMPH Admin`).
  - Acceptance: `brandText` renders `${BRAND_NAME} Admin` → "Project Amazon PH Academy Admin"; no `AMPH` literal.
  - QA happy: visit `/admin` → sidebar brand "Project Amazon PH Academy Admin". Evidence: DOM text.
  - QA failure: leftover `AMPH Admin` → grep audit fails.
  - Commit: `refactor: rebrand admin sidebar`.

- **T4: Rebrand `src/app/page.tsx` (hero + footer).**
  - References: `page.tsx:10` (eyebrow `AMPH ACADEMY`), `:15` (hero sub "AMPH Academy teaches"), `:128` (footer `<strong>AMPH Academy</strong>`).
  - Acceptance: eyebrow = `BRAND_NAME_UPPER`; hero sub = `${BRAND_NAME} teaches ...`; footer = `BRAND_NAME`; no `AMPH` literal.
  - QA happy: load `/` → eyebrow "PROJECT AMAZON PH ACADEMY", footer "Project Amazon PH Academy". Evidence: DOM text.
  - QA failure: leftover literal → grep audit fails.
  - Commit: `refactor: rebrand landing page`.

- **T5: Rebrand `src/lib/email.tsx` (3 templates, 7 spots).**
  - References: `email.tsx:66` (enrollment subject), `:108` (enrollment eyebrow), `:150` (enrollment footer), `:261` (refund eyebrow), `:348` (refund footer), `:449` (live-class eyebrow `AMPH Academy · Live Class`), `:546` (live-class footer).
  - Acceptance: subject = `You're enrolled — ${tierName} on ${BRAND_NAME}`; eyebrows = `BRAND_NAME` (live-class eyebrow = `${BRAND_NAME} · Live Class`); footers = `${BRAND_NAME} · projectamazonph.com`; no `AMPH` literal.
  - QA happy: call `sendEnrollmentConfirmationEmail` (or existing email test) → rendered HTML contains "Project Amazon PH Academy" and "Project Amazon PH Academy · projectamazonph.com". Evidence: email body snapshot / existing email test output.
  - QA failure: any template still renders "AMPH Academy" → grep audit + visual check fails.
  - Commit: `refactor: rebrand transactional emails`.

- **T6: Rebrand `src/lib/cert-pdf.tsx`.**
  - References: `cert-pdf.tsx:178` (`author="AMPH Academy"`), `:185` (`<Text>AMPH ACADEMY</Text>` eyebrow), `:211` (`<Text>AMPH-{refNumber}</Text>` cert number).
  - Acceptance: `author = BRAND_NAME`; eyebrow = `BRAND_NAME_UPPER`; cert number = `${BRAND_CERT_PREFIX}-{refNumber}` (→ "PAPH-XXXXXXXX"); no `AMPH` literal.
  - QA happy: render `CertificatePdf` → PDF text contains "Project Amazon PH Academy", "PROJECT AMAZON PH ACADEMY", and a cert number beginning "PAPH-". Evidence: rendered PDF text extract.
  - QA failure: leftover literal → grep audit fails.
  - Commit: `refactor: rebrand certificate PDF`.

- **T7: Rebrand `src/app/verify/[hash]/page.tsx`.**
  - References: `:15` (title default), `:18` (description), `:39` (brand bar `AMPH ACADEMY`), `:57` (eyebrow `AMPH ACADEMY`), `:82` (`AMPH-${hash}` cert no), `:101` (`Visit AMPH Academy` button).
  - Acceptance: title default = `Certificate not found — ${BRAND_NAME}`; description = `${BRAND_NAME} certificate of completion ...`; brand bar + eyebrow = `BRAND_NAME_UPPER`; cert no = `${BRAND_CERT_PREFIX}-${hash8}` (→ "PAPH-XXXXXXXX"); button = `Visit ${BRAND_NAME}`; no `AMPH` literal.
  - QA happy: render verify page for a valid cert → brand "PROJECT AMAZON PH ACADEMY", cert no begins "PAPH-". Evidence: DOM text.
  - QA failure: leftover `AMPH-` or `AMPH ACADEMY` → grep audit fails.
  - Commit: `refactor: rebrand certificate verify page`.

- **T8: Rebrand `src/app/(dashboard)/certificates/[hash]/pdf/route.ts`.**
  - References: `route.ts:40` (fallback `'https://amph-academy.com'`), `:53` (filename `AMPH-Certificate-`).
  - Acceptance: fallback URL = `'https://projectamazonph.com'`; filename = `${BRAND_CERT_PREFIX}-Certificate-${courseSlug}.pdf` (→ "PAPH-Certificate-<course>.pdf"); no `amph-academy` / `AMPH-` literal.
  - QA happy: GET the PDF route → `Content-Disposition: attachment; filename="PAPH-Certificate-*.pdf"`. Evidence: response header.
  - QA failure: filename still "AMPH-Certificate-" → grep audit fails.
  - Commit: `refactor: rebrand certificate download filename and fallback domain`.

- **T9: Rebrand `src/app/admin/page.tsx`.**
  - References: `admin/page.tsx:54` (`AMPH Academy Admin — ...`).
  - Acceptance: subtitle = `${BRAND_NAME} Admin — {activeUsers} active users, {publishedCourses} published courses`; no `AMPH` literal.
  - QA happy: load `/admin` → header "Project Amazon PH Academy Admin — N active users". Evidence: DOM text.
  - QA failure: leftover literal → grep audit fails.
  - Commit: `refactor: rebrand admin dashboard header`.

- **T10: Rebrand route `<title>` metadata strings + certificates-list cert number (7 files).**
  - References: `src/app/(public)/pricing/page.tsx`, `src/app/(public)/checkout/complete/page.tsx`, `src/app/(dashboard)/live-classes/page.tsx`, `src/app/(dashboard)/live-classes/[id]/page.tsx`, `src/app/(dashboard)/payments/page.tsx`, `src/app/(dashboard)/payments/[id]/request-refund/page.tsx`, `src/app/(dashboard)/certificates/page.tsx` (title at `:9`, AND cert-number display `AMPH-{cert.verificationHash...}` at `:63`). Each title has a `title: '... — AMPH Academy'` (or `Class not found — AMPH Academy`).
  - Acceptance: each `title` uses `BRAND_NAME` (e.g. `'Pricing — ' + BRAND_NAME`, `'Class not found — ' + BRAND_NAME`); the `:63` cert-number display uses `${BRAND_CERT_PREFIX}-` (→ "PAPH-"); no `AMPH` literal in any of the 7 files.
  - QA happy: navigate each route → tab title suffix "Project Amazon PH Academy"; certificates list shows cert numbers beginning "PAPH-". Evidence: `document.title` per route + DOM text.
  - QA failure: any route still shows "AMPH Academy" in title, or list cert no still "AMPH-" → grep audit fails.
  - Commit: `refactor: rebrand page title metadata and cert numbers`.

### Wave 3 — Prisma default + migration
- **T11: Update `businessName` default + add migration.**
  - References: `prisma/schema.prisma:793` (`businessName String @default("AMPH Academy")`), `prisma/migrations/20260708042743_sprint6_payments_foundation/migration.sql` (immutable — DO NOT edit).
  - Acceptance: `schema.prisma` default = `@default("Project Amazon PH Academy")`; a NEW migration created via `npx prisma migrate dev --name update_business_name_default` (or `--create-only` then applied) that `ALTER`s the column default to `'Project Amazon PH Academy'`; `npx prisma validate` passes; `npx prisma migrate status` clean.
  - FALLBACK (if `migrate dev` fails or generates unexpected SQL): (1) first run `npx prisma migrate dev --create-only --name update_business_name_default` and inspect the generated SQL; (2) if it is wrong or errors, apply the default directly with `npx prisma db execute --stdin` containing `ALTER TABLE "Invoice" ALTER COLUMN "businessName" SET DEFAULT 'Project Amazon PH Academy';` (table/column names must match the actual schema); (3) if the local DB is unreachable, edit `schema.prisma` only and document the pending migration for production deploy. Never edit the historical `migration.sql`.
  - QA happy: inspect generated migration SQL → contains `ALTER COLUMN "businessName" SET DEFAULT 'Project Amazon PH Academy'`. Evidence: migration file content.
  - QA failure: historical `migration.sql` edited (breaks reproducibility) OR no new migration generated → revert and regenerate. Evidence: git diff shows migration.sql untouched except new file.
  - Commit: `chore: update businessName default to Project Amazon PH Academy`.

### Wave 4 — Internal docs / config / code-prose (literal pass + 2 manual fixes + keepers)
- **T12: Literal rebrand across all markdown docs (except product-brief.md).**
  - References: README.md, FEATURES.md, AGENTS.md, CHANGELOG.md, SESSION-HANDOVER.md, src/styles/README.md, and every `docs/**/*.md` EXCEPT `docs/product-brief.md` (handled manually in T13) — i.e. design-brief, decisions, db-schema, voice-guide, business-layer, build-spec, ai-removal, admin-backend, security/tenant-isolation, stories/STORY-041/048/051/057, stitch-prompts, sprint-plan, sprint-9/PLAN, sprint-12/PLAN, sprint-12/launch-comms, sprint-12/preview-deploy, sprint-12/deploy-execution, runbooks/README, runbooks/production-deploy.
  - Acceptance: every `AMPH Academy` → `Project Amazon PH Academy` and (automatically) `AMPH Academy v2` → `Project Amazon PH Academy v2` via substring replace; the `AMPH-Academy` (hyphen) repo references in `docs/build-spec.md` (13, 24) and `docs/design-brief.md` (257) are LEFT UNTOUCHED (they are not matched by the `AMPH Academy` [space] replace); zero `AMPH Academy` literals remain in these files.
  - QA happy: `grep -rn "AMPH Academy" README.md FEATURES.md AGENTS.md CHANGELOG.md SESSION-HANDOVER.md docs src/styles` (excluding `docs/product-brief.md`) → 0 hits. Evidence: grep output.
  - QA failure: any hit → manual fix. Evidence: grep hit path.
  - Commit: `docs: rebrand docs to Project Amazon PH Academy`.

- **T13: Config + code-prose rebrand (incl. 2 manual special cases + keeper exclusions).**
  - References: `bmad/project.yaml`, `bmad/workflow-status.yaml`, `bmad/sprint-status.yaml` (`name: "AMPH Academy v2"`); `prisma/seed.ts` (`console.log('Seeding AMPH Academy v2...')`); `src/lib/mdx.ts`; `src/lib/enums.ts` (comment); `scripts/import-amph-content.ts` (lines 10 + 40 `ProjectAMPH Academy` — MANUAL); `docs/product-brief.md` line 3 (`Project Amazon PH AMPH Academy v2` — MANUAL).
  - KEEPER NOTE: `AMPH-Academy` (hyphen) in `scripts/import-amph-content.ts` (lines 3, 5, 33, 351), `docs/build-spec.md` (13, 24), `docs/design-brief.md` (257) are EXTERNAL GitHub repo / source-directory names, NOT branding — leave them untouched. Only the `ProjectAMPH Academy` strings (lines 10/40) change.
  - Acceptance: bmad yaml `name` → `"Project Amazon PH Academy v2"`; seed log → `Seeding Project Amazon PH Academy v2...`; mdx.ts/enums.ts comments updated; **import-amph-content.ts lines 10/40 → `'Project Amazon PH Academy'` (NOT double-up); lines 3/5/33/351 `AMPH-Academy` repo refs LEFT UNTOUCHED**; **product-brief.md → `Project Amazon PH Academy v2 (v2)` (NOT double-up)**; zero `AMPH Academy` literals remain (except intentional keepers).
  - QA happy: `grep -rn "AMPH Academy" bmad prisma scripts docs/product-brief.md src/lib/mdx.ts src/lib/enums.ts` → 0 hits; and `grep -rn "ProjectProject\|Project Amazon PH Project Amazon PH" .` → 0 hits (proves no double-up); and `grep -rn "AMPH-Academy" scripts/import-amph-content.ts docs/build-spec.md docs/design-brief.md` still returns the 7 expected repo refs (proves keepers preserved). Evidence: grep outputs.
  - QA failure: double-up string present, or leftover literal, or a keeper was wrongly changed → fix. Evidence: grep hit.
  - Commit: `docs: rebrand config, seed log, and code comments`.

### Wave 5 — Verification & audit
- **T14: Run full CI-equivalent suite locally.**
  - References: package.json scripts (`tsc --noEmit`, `lint`, `test`, `test:e2e`, `build`).
  - Acceptance: all five pass. (No test asserts the brand, so green is expected; any red is a real regression to fix before proceeding.)
  - QA happy: `pnpm tsc --noEmit && pnpm lint && pnpm test && pnpm test:e2e && pnpm build` exit 0. Evidence: combined command output (exit code 0, summary lines).
  - QA failure: any command non-zero → read the actual error, fix root cause, re-run. Evidence: failing command output.
  - Commit: `test: verify rebrand passes full CI suite`.

- **T15: Final grep audit (primary completeness gate).**
  - References: whole repo (src, docs, bmad, prisma, scripts, README*, AGENTS.md, CHANGELOG.md, FEATURES.md, SESSION-HANDOVER.md).
  - Acceptance: `grep -rn "AMPH Academy\|AMPH ACADEMY\|AMPH Admin\|AMPH-"` returns ONLY intentional keepers:
    - the `amph-v2/` directory name and any path references to it,
    - the `scripts/import-amph-content.ts` **file name** (kept; its content is rebranded),
    - code identifiers containing `Amph`/`amph` (e.g. `importAmphContent`) — NOT branding,
    - `AMPH-Academy` (hyphen) external GitHub repo / source-directory references in `docs/build-spec.md`, `docs/design-brief.md`, `scripts/import-amph-content.ts` (lines 3/5/33/351) — NOT branding, kept as-is.
    Everything else must be zero.
  - QA happy: audit command output lists only the four keeper categories above. Evidence: grep output.
  - QA failure: any brand-phrase hit outside keepers → return to the responsible todo, fix, re-run audit. Evidence: grep hit.
  - Commit: none (audit is verification only).

---

## Final verification wave

Runs in parallel after T15; ALL must APPROVE before declaring done:
- **F1 Plan compliance audit:** every file in Scope IN was touched; every Must-NOT-Have was respected (no identifiers/dir names renamed; `AMPH-Academy` repo refs preserved). Evidence: git diff stat vs. scope list.
- **F2 Code quality review:** `tsc` + `lint` clean; `brand.ts` is the sole source of the brand string in `src/`; no inline duplicate literals introduced. Evidence: lint/tsc output.
- **F3 Real manual QA:** load `/`, `/pricing`, `/admin`, a certificate verify page, the certificates list, trigger one enrollment email (dev), download a cert PDF → confirm "Project Amazon PH Academy" / "PROJECT AMAZON PH ACADEMY" / "PAPH-" render everywhere; confirm email footers keep `projectamazonph.com` and `AMPH-Academy` repo refs are unchanged. Evidence: screenshots / email snapshot / PDF text.
- **F4 Scope fidelity:** full-rebrand confirmed — docs, bmad yaml, seed log, product brief, import script all say "Project Amazon PH Academy" with NO double-ups. Evidence: targeted greps from T12/T13 + F1.

Surface results and wait for the user's explicit okay before declaring complete.

---

## Commit strategy

Branch `feat/branding-rename` off `main`; squash-PR back to `main`. One concern per commit (per AGENTS.md):
1. `feat: add central brand constant` (T1)
2. `refactor: rebrand root layout nav and metadata` (T2)
3. `refactor: rebrand admin sidebar` (T3)
4. `refactor: rebrand landing page` (T4)
5. `refactor: rebrand transactional emails` (T5)
6. `refactor: rebrand certificate PDF` (T6)
7. `refactor: rebrand certificate verify page` (T7)
8. `refactor: rebrand certificate download filename and fallback domain` (T8)
9. `refactor: rebrand admin dashboard header` (T9)
10. `refactor: rebrand page title metadata and cert numbers` (T10)
11. `chore: update businessName default to Project Amazon PH Academy` (T11)
12. `docs: rebrand docs to Project Amazon PH Academy` (T12)
13. `docs: rebrand config, seed log, and code comments` (T13)
14. `test: verify rebrand passes full CI suite` (T14)

Never leave uncommitted changes (AGENTS.md). Do not commit `.env*` (only `.env.example` is allowed and is not changed here).

---

## Success criteria

- **User-facing:** Every rendered surface (nav, hero, footer, admin header/sidebar, emails, certificate PDF, verify page, certificates list, all page `<title>`s) shows "Project Amazon PH Academy" / "PROJECT AMAZON PH ACADEMY" / "PAPH-" as applicable.
- **Internal:** README, FEATURES, AGENTS.md, CHANGELOG, SESSION-HANDOVER, all `docs/*` (incl. manual product-brief fix), bmad yaml, seed log, `src/lib` comments, `scripts/import-amph-content.ts` (lines 10/40), all read "Project Amazon PH Academy" with NO double-up artifacts.
- **Data:** Prisma `businessName` default is "Project Amazon PH Academy" with a matching migration.
- **Keepers preserved:** `amph-v2/` dir name, `import-amph-content.ts` file name, non-branding code identifiers, and the 7 `AMPH-Academy` (hyphen) external repo references are unchanged.
- **Completeness:** `grep -rn "AMPH Academy|AMPH ACADEMY|AMPH Admin|AMPH-"` returns only the four intentional keeper categories above.
- **Quality gates green:** `tsc --noEmit`, `lint`, `test`, `test:e2e`, `build` all pass.
- **No collateral:** code identifiers, file names, and the `amph-v2` directory are unchanged except where explicitly listed.
