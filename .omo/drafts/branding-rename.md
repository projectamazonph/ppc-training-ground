# Draft — branding-rename (Project Amazon PH Academy)
intent: clear
review_required: false
slug: branding-rename

## Explored surface (facts)
- Root cause: brand string "AMPH Academy" is hardcoded across ~15 user-facing src files. No central brand constant. No image/logo/favicon asset (branding is a text wordmark) — confirmed via glob for favicon/icon/logo/og in src/app (0 hits).
- No tests assert "AMPH Academy" (grep *.test.* returned 0) -> test suite won't hard-break, but worker must still run full suite + build + lint + typecheck to catch stragglers.
- `businessName` DB default "AMPH Academy" exists in prisma/schema.prisma:793 and migration.sql, but is NOT referenced anywhere in src/ (grep returned 0). Config-only, not rendered.

## Visible (user-facing) branding locations
1. src/app/layout.tsx:21 title.default, :22 title.template, :32 openGraph.siteName, :79 header nav wordmark
2. src/components/ui/NavSidebar.tsx:31 "AMPH Admin"
3. src/app/page.tsx:10 eyebrow "AMPH ACADEMY", :15 hero sub, :128 footer "AMPH Academy"
4. src/lib/email.tsx:66 subject, :108/:261/:449 eyebrow, :150/:348/:546 footer "AMPH Academy · projectamazonph.com"
5. src/lib/cert-pdf.tsx:178 author, :185 eyebrow
6. src/app/verify/[hash]/page.tsx:15/:18 title, :39/:57 brand bar + eyebrow, :82 cert no prefix "AMPH-", :101 "Visit AMPH Academy"
7. src/app/admin/page.tsx:54 "AMPH Academy Admin" subtitle
8. Page <title> strings: pricing, checkout/complete, live-classes, live-classes/[id], payments, payments/[id]/request-refund, certificates, certificates/[hash]/pdf/route.ts
(worker must grep exhaustively for any further occurrences before editing)

## Internal (not user-visible) — out of default scope
README.md, FEATURES.md, docs/*, bmad/*.yaml, AGENTS.md, CHANGELOG.md, prisma/seed.ts, prisma/schema.prisma default, prisma/migration.sql, scripts/import-amph-content.ts ("ProjectAMPH Academy"), src/lib/enums.ts comment, src/lib/mdx.ts.

## Target name (adopted, user-stated)
"Project Amazon PH Academy" — exact. Domain "projectamazonph.com" in email footers stays.

## Open forks (owner-decisions)
- Q1 scope: user-facing only / + DB default / full rebrand everywhere
- Q2 compact marks: full name everywhere (incl. sidebar/eyebrows/cert prefix) vs. short wordmark in tight UI

## Topology (components that can succeed/fail independently)
- C1 nav + metadata (layout.tsx)
- C2 landing page (page.tsx)
- C3 emails (email.tsx)
- C4 certificate PDF (cert-pdf.tsx)
- C5 verify page (verify/[hash]/page.tsx)
- C6 admin + dashboard page titles + sidebar
- C7 (if full scope) docs/internal

## Approach (recommended, adopted defaults)
- Introduce src/lib/brand.ts with BRAND_NAME = 'Project Amazon PH Academy' (+ BRAND_NAME_UPPER, BRAND_SHORT if needed) and reference it everywhere to prevent drift. Reversible internal decision; adopting default.
- Replace per exact from->to mapping; run tsc --noEmit, lint, test, test:e2e, build; final grep verifies zero "AMPH Academy" remain in scope.

## Approval gate
status: in-progress (awaiting fork answers, then brief)
