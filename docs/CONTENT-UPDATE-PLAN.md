# Content Update Plan — Release 1 (Trust and Safety)

**Purpose:** Turn the remaining unchecked items in issue #24 / Release 1 of
`docs/CONTENT-AUDIT-2026-07-16.md` into a file-by-file, checkable work order.
This plan does not rewrite lesson content. It defines exactly what has to
change, where, and in what order, so the rewrite pass (or a subagent) can
execute without re-deriving the audit.

Source content lives at `content/curriculum/modules/` (31 MDX files, 9
module directories) and `content/curriculum/quiz-questions.json`. Scope of
this plan is those two locations plus the course/module import metadata in
`scripts/import-amph-content.ts`.

Already done: moving curriculum source into the repo (`content/curriculum/`)
— shipped in PR #26. Everything below is what's left in Release 1.

---

## 1. Remove legacy product references

v2 has no AI Mentor and no AdCraft shell — it has five named tools
(Campaign Builder, Bid Elevator, Search Term Triage, Listing Audit, Keyword
Research) inside a platform called Project Amazon PH Academy. Every mention
below sends a learner looking for a feature that isn't there.

| File | Legacy reference | Replace with |
|---|---|---|
| `0-onboarding/0.1-welcome.mdx` | AdCraft, AI Mentor, "simulation" framing | Project Amazon PH Academy; drop AI Mentor entirely; reframe as tool practice, not "simulation" |
| `0-onboarding/0.2-platform-tour.mdx` | AdCraft navigation tour, AI Mentor | Rewrite as a tour of the real nav: Dashboard, Courses, the 5 named tools, Badges/Certificates, Admin (if applicable to role) |
| `0-onboarding/0.3-first-simulation.mdx` | AdCraft, AI Mentor, generic "first simulation" | Point to one real tool (Campaign Builder is the natural Module-0 on-ramp) by name |
| `1-foundations/1.5-metrics-in-practice.mdx` | AI Mentor, Formula Calculator | Formula Calculator doesn't exist in v2 — replace with a plain worked-calculation walkthrough in the lesson itself (no tool hand-off implied) |
| `7-search-term-triage/7.2-negative-keywords.mdx` | "simulation" / STR Triage Arena framing | Rename to Search Term Triage tool, by its actual product name |
| `7-search-term-triage/7.3-str-triage-prep.mdx` | AdCraft, "STR Triage Arena" | Rename to Search Term Triage tool |
| `6-bidding-lab/6.2-placement-adjustments.mdx`, `6.3-bid-elevator-prep.mdx` | Generic "simulation" language | Rename to Bid Elevator tool, by name |
| `4-campaign-architecture/4.4-campaign-architecture-practice.mdx` | Generic "simulation" language | Rename to Campaign Builder tool, by name |

**Rule for the rewrite pass:** grep for `simulation` and `AdCraft` and `AI Mentor` after every edit — the audit's grep (`adcraft`, `ai mentor`, `formula calculator`, `simulation`, `triage arena`) is the acceptance check for this section. Zero hits should remain except in this plan document and the audit itself.

---

## 2. Factual corrections (P0 — Amazon Ads product-behavior claims)

Five claims teach product behavior as a permanent rule. Amazon's own help
docs (linked in the audit) describe something narrower or eligibility-gated.
Fix text below is the audit's "required replacement" column, mapped to the
exact file and line.

### 2a. Portfolios do not carry negative keywords or bid adjustments

**File:** `5-portfolio-strategy/5.1-campaign-portfolios.mdx`, lines 19–27 and 114+ ("Portfolio-Level Negative Keywords" section).

- Remove: "Apply portfolio-level negative keywords" and "Set portfolio-level bid adjustments" as portfolio features.
- Replace with: negative targeting and bid/budget rules are **campaign-level** controls. Portfolios provide grouping, reporting, and (where eligible) budget management/unspent-budget sharing across campaigns in the group — not shared negatives or shared bid multipliers.
- Keep the budget-flex example (lines ~87–110) but caveat it as eligibility-dependent, and cite [Understand portfolios](https://advertising.amazon.com/help/GPEJN2E6R52G7C2T) and [Portfolio budgets](https://advertising.amazon.com/help/GU7E77PGF96FMW3X).
- Add a fact card (see §3) at the end of this lesson.

### 2b. Attribution windows are not a fixed 7-day SP / 14-day SB rule

**File:** `7-search-term-triage/7.1-search-term-analysis.mdx`, line 45.

- Current claim: "Amazon only attributes sales within 7 days of an ad click (Sponsored Products) or 14 days (Sponsored Brands)."
- Replace with: attribution windows are an account/report setting that varies by ad product, campaign, and eligibility — teach it as "check your account's current reporting window before you draw conclusions from attributed sales," not a fixed number.
- Keep the underlying lesson (reported ACoS runs slightly high because of attribution lag) — that reasoning is sound; only the fixed-number claim is wrong.
- Cite [Conversion attribution](https://advertising.amazon.com/help/G3BB9TWP5KC375TJ).
- Add a fact card.

### 2c. Amazon's auction is not a strict modified-second-price auction with a fixed "$0.01 above" outcome

**File:** `6-bidding-lab/6.1-bid-strategies.mdx`, lines 24, 30, 152–153.

- Remove the "$0.01 more than the second-highest bid" mechanic as a taught rule.
- Replace with the actionable version: set a defensible max bid, understand how bid strategies (Dynamic bids down only / up and down, Fixed bids) and placement modifiers change what you actually pay, and monitor realized CPC against your max — don't teach learners to predict CPC from auction mechanics they can't see.
- Cite [Bidding strategies for Sponsored Products](https://advertising.amazon.com/help/GCU2BUWJH2W3A8Z7).
- Add a fact card.

### 2d. "Listing Quality Score" is not a named, inspectable Amazon metric

**File:** `3-listing-optimization/3.1-listing-quality-score.mdx` (whole lesson is built around this), plus references in `3.2-listing-anatomy.mdx`, `3.3-aplus-content.mdx`, `1-foundations/1.2-cpc-ctr.mdx`, `8-competitive-intelligence/8.2-share-of-voice.mdx`.

- Amazon does not expose a single named "Quality Score" a VA can look up. Reframe the lesson around **listing and ad relevance signals** as a teaching shorthand, not a product feature.
- Keep the factor table (CTR, CVR, listing completeness, review rating, price competitiveness, inventory) — those are genuine, observable inputs. Just stop calling it "Amazon's Listing Quality Score" as if it were a documented, retrievable number.
- Consider renaming the lesson file/title from "How Listing Quality Score Affects Your Ads" to something like "Listing and Ad Relevance Signals" — flag this as a slug change (breaks existing `Lesson.slug` upserts/enrollment progress references) for the rewrite owner to confirm before renaming the file.
- Add a fact card.

### 2e. Dayparting availability and mechanics vary — don't teach it as universal

**Files:** `5-portfolio-strategy/5.2-budget-pacing.mdx` (lines 117, 180–182), `8-competitive-intelligence/8.2-share-of-voice.mdx`, `8-competitive-intelligence/8.3-competitor-benchmarking.mdx`.

- Replace "dayparting" as a guaranteed universal workflow with: scheduled bidding/budget rules **where eligible**, plus a console-validation step ("confirm this control is available on your account before you plan around it") and a manual, non-automated fallback (e.g., manual bid check at known peak hours).
- Note: the **7-day daily-budget-averaging** claim in `5.2-budget-pacing.mdx` (lines 27–47) is a different, currently-accurate Amazon Ads mechanic (daily budget as a rolling average, not attribution) — do not confuse it with the attribution-window fix in §2b. No change needed there beyond a source citation if one isn't already present.
- Add a fact card to `5.2-budget-pacing.mdx` for the dayparting claim specifically.

**Acceptance check for §2:** none of the five claims in the audit's factual-issues table appear unqualified anywhere in `content/curriculum/modules/` after the rewrite. Re-run the audit's evidence-gathering grep, don't just check the six files above — `share-of-voice.mdx` and `competitor-benchmarking.mdx` also touch dayparting and quality score in passing.

---

## 3. Fact-card metadata

Add the audit's "Amazon Ads Fact Card" block (template already defined in
`docs/CURRICULUM-REDESIGN.md` under "Fact card") to every lesson touched in
§2, plus any other lesson that states a product behavior likely to change.
Minimum set for Release 1:

- `5-portfolio-strategy/5.1-campaign-portfolios.mdx` — portfolio negatives/bid-adjustment claim
- `7-search-term-triage/7.1-search-term-analysis.mdx` — attribution window
- `6-bidding-lab/6.1-bid-strategies.mdx` — auction mechanics
- `3-listing-optimization/3.1-listing-quality-score.mdx` — relevance-signal framing
- `5-portfolio-strategy/5.2-budget-pacing.mdx` — dayparting availability

Each card needs: product/feature, what the learner can do, who can access
it, marketplace scope, official source URL, last-verified date, next-review
date, owner. Source URLs are already identified in §2 above (audit's
"Useful official references" list) — carry them into the cards verbatim.
Last-verified/next-review dates and owner are for the content owner to fill
in at rewrite time, not to be fabricated by whoever executes this plan.

---

## 4. Align three pricing tiers with course structure

**Current state** (`scripts/import-amph-content.ts`, `prisma/schema.prisma`):
one `Course` row (`amph-foundations`) holds all 9 modules and is bound to a
single `pricingTierId` (`ppc-foundations`). `Course.pricingTierId` is
singular — there is no per-module tier field. The three pricing tiers
(`ppc-foundations`, `accelerated-mastery`, `ultimate-transformation`)
already exist in `prisma/seed.ts` but only the first one has a course
attached to it.

**Decision (per audit recommendation, and cheaper against the current
schema):** go with **three real courses**, not module-level entitlements.
`Course.pricingTierId` already exists and does exactly what's needed — no
schema migration required. Module-level entitlements would mean adding a
minimum-tier field to `Module` and threading a check through every course,
lesson, quiz, resource, and tool route; that's a separate, larger
engineering change and shouldn't block a Release-1 content pass.

**Interim mapping** (current 9 modules → 2 of the 3 target courses; modules
for course 3 don't exist yet — that's Release 3 net-new content per
`CURRICULUM-REDESIGN.md`):

| New course | Slug / tier | Modules (current numbering) |
|---|---|---|
| PPC Foundations | `ppc-foundations` | 0 Onboarding, 1 PPC Foundations, 2 Keyword Research, 3 Listing Optimization, 4 Campaign Architecture |
| Accelerated Mastery | `accelerated-mastery` | 5 Portfolio Strategy, 6 Bidding Lab, 7 Search Term Triage, 8 Competitive Intelligence |
| Ultimate Transformation | `ultimate-transformation` | none yet — Release 3 builds modules 10–13 per `CURRICULUM-REDESIGN.md` |

**Implementation steps for whoever picks this up:**

1. Split `COURSE` (singular) in `scripts/import-amph-content.ts` into two
   `Course` entries — `ppc-foundations` (modules 0–4) and
   `accelerated-mastery` (modules 5–8) — each with its own slug, title,
   description, and `pricingTierSlug`.
2. Re-point `MODULE_META` module numbers 0–4 at the Foundations course id
   and 5–8 at the Accelerated Mastery course id (the importer currently
   assumes one `courseId` for all modules — this loop needs to branch by
   module number).
3. Leave `ultimate-transformation` with no course row until Release 3
   content exists — do not attach an empty/placeholder course to it (that
   would let the pricing page imply content that isn't there, which is
   exactly the P0 this section exists to close).
4. Update the pricing/landing copy (wherever `ppc-foundations` /
   `accelerated-mastery` tier descriptions are rendered) to describe 5
   modules and 4 modules respectively, matching this split — currently the
   copy says "Foundations includes five core modules, Accelerated Mastery
   includes all eight," which will no longer match once the split lands.
5. Re-run `scripts/import-amph-content.ts` against a non-production database
   first — the quiz importer (`importQuizzes`) currently attaches each
   module's quiz to "the last lesson in the module" by module number; verify
   quiz-to-lesson attachment still resolves correctly once modules are
   spread across two courses.

This step is a code + data change, not a prose rewrite — flag it as its own
PR separate from the MDX content edits in §1–§3, since it touches
`scripts/import-amph-content.ts`, pricing copy, and needs a DB re-import to
verify.

---

## 5. Suggested execution order

1. §1 legacy references in the three onboarding files first — highest
   trust-breakage risk, smallest diff (3 files).
2. §2 factual corrections, in the order listed (portfolios → attribution →
   auction → quality score → dayparting) — these can be done one lesson at
   a time and PR'd independently.
3. §3 fact cards, added alongside each §2 fix in the same PR (not a
   separate pass — the card belongs with the corrected claim).
4. §1 remaining tool-naming cleanups in modules 4, 6, 7 (lower risk, can
   ride along with §2 edits to the same files where they overlap, e.g.
   `6.1-bid-strategies.mdx` gets both a §2c fix and isn't in the §1 table,
   but `6.2`/`6.3` are §1-only).
5. §4 course/tier split last — it's the only item here that touches code
   and the database, and it depends on nothing in §1–§3 being unfinished
   (the content can move to new course rows regardless of rewrite status).

## Out of scope for this plan

- Actual lesson rewrites to the full lesson-production standard (client
  outcome, decision card, worked case, etc.) — that's Release 2, tracked by
  `docs/CURRICULUM-REDESIGN.md` §"Production order".
- The MDX renderer gap (no tables, ordered lists, links, images, video) —
  a P0 in the audit but a code issue, not a content issue; per issue #24's
  own notes, it should get its own tracking issue if one doesn't exist yet.
- Video explainer production — scripts exist in `VIDEO-EXPLAINER-SCRIPTS.md`,
  production is Release 2.
