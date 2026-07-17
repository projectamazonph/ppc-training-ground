# Content Audit — Modules 2 through 8

**Status:** this document is a pre-fix baseline, written before any of its own findings were addressed. The P0 factual/arithmetic bugs, the stale terminology, and the Module 8 frontmatter bug listed below have since been fixed in the same PR that introduced this document (and its immediate follow-up commits), including Module 8's frontmatter and lesson content. Treat every finding below as "this is what was wrong as of 2026-07-16," not as a live list of open issues. Check the PR history and the voice-guide cleanup pass for current status rather than assuming anything here is still outstanding.

**Date:** 2026-07-16
**Scope:** the 23 MDX lesson files in `content/curriculum/modules/2-keyword-research` through `8-competitive-intelligence`, plus `content/curriculum/quiz-questions.json`'s coverage of those modules. Modules 0 and 1 are out of scope here — they were fully rebuilt in PR #31 (see `docs/CONTENT-AUDIT-2026-07-16.md` and issue #24 for that history).

**Method:** every file read in full (not sampled), cross-checked against `docs/voice-guide.md`, against PR #29's claimed fixes (verified against the actual PR #29 diff, not assumed), and against the terminology PR #31 just established in Module 1. Every worked numeric example was recomputed by hand or by script.

**Headline:** PR #29's legacy-reference purge (AdCraft, AI Mentor, Formula Calculator, STR Triage Arena) genuinely held across Modules 2–7 on re-verification. **Module 8 has never been touched by any cleanup pass** — it is raw imported content, and it has its own fabricated-Amazon-feature problem plus a real data-import bug. All 23 files share the same systemic voice-guide violations Modules 0–1 had before their rewrite.

---

## P0 — Factual and arithmetic bugs (learner-facing wrong answers)

These are lessons currently teaching numbers or claims that don't hold up. Priority order below is the fix order.

| # | File | Lines | Bug | Fix |
|---|---|---|---|---|
| 1 | `8-competitive-intelligence/8.2-share-of-voice.mdx` | 78–83 | Tells learners to use a "Bid Simulator" in the campaign manager. Amazon Ads doesn't expose this for Sponsored Products; it's Google Ads terminology. | Remove/reframe: teach checking impression share via the actual available reports, not a named tool that doesn't exist. Add a fact card, matching the treatment given to the auction/quality-score claims elsewhere. |
| 2 | `8.2-share-of-voice.mdx` | 28–34 | Treats "Eligible Impressions" as a pullable Sponsored Products report metric. Likely borrowed from Google Ads; not a real Amazon Ads report field. | Reframe the Impression Share formula around what's actually reportable, or clearly label it as an estimation method, not a report you can pull directly. |
| 3 | `8.2-share-of-voice.mdx` | 40–46, 50–55, 89–111 | Three different, mutually inconsistent SOV percentage-threshold schemes presented back to back in the same lesson (`<10/10-30/30-50/50-70/>70`, `0-15/15-30/30-50/50+`, `<15/15-35/>35`). | Pick one threshold scheme and use it consistently through the whole lesson. |
| 4 | `8.2-share-of-voice.mdx` | 14 | PR #29's commit message claims a fact card was added here for the Quality Score reframe; it wasn't (only 3.1 got one). The word-level fix itself is present and correct. | Add the fact card PR #29's commit message already claims exists. |
| 5 | `3-listing-optimization/3.1-listing-quality-score.mdx` | 100–107 | Listing A's stated ACoS (26%) doesn't follow from its own CPC $0.52 / CVR 12.5% / price $24.99 — actual value is ~16.6%. This cascades into two more wrong derived numbers: "B's ACoS is 2.2x higher" (true ratio ~3.5x) and "A gets 4.5x more sales per ad dollar" (true ratio ~3.5x). | Correct Listing A's ACoS to ~17% and both derived multipliers to ~3.5x. |
| 6 | `5-portfolio-strategy/5.1-campaign-portfolios.mdx` | 91–104 | Worked example: 800 + 200 + 700 + 400 = ₱2,100, but the text claims the ₱2,000 daily cap is "never exceeded." Only ₱100 of headroom actually exists, not ₱200. | Change "₱200 more" to "₱100 more" (or adjust B/C spend) so the math stays under the stated cap. |
| 7 | `5.2-budget-pacing.mdx` | 27–47 | Internally contradictory: claims "Amazon eats the extra ₱200, you only pay ₱1,000" in the same breath as summing the literal daily-spend column (which includes the full uncapped ₱1,200) as the real weekly total. Also: this "budget is a 7-day rolling average" mechanic has no fact card and no hedge, unlike this same file's (correctly hedged) dayparting claim. Amazon's actual over-delivery policy is generally described as monthly reconciliation, not a rolling 7-day average — needs verification against current Amazon Ads documentation. | Pick one mechanic and make the numbers agree with it. Add a fact card / hedge to the budget-averaging claim, matching the dayparting treatment in the same file. |
| 8 | `5.3-seasonal-strategy.mdx` | 118–129 | "Gross Profit" figures imply two different, unstated margins (~50% vs ~65%) for the same product across two rows of one table. | State the assumed margin explicitly and derive both Gross Profit figures from it, or explain why margin itself changes seasonally. |
| 9 | `4-campaign-architecture/4.2-sponsored-brands-display.mdx` | 80–85 | SP row pairs ACoS 20–40% with ROAS "3–5x." Since ROAS = 1 ÷ ACoS, a 40% ACoS is a 2.5x ROAS, not 3x. | Correct the SP row's ROAS range to 2.5x–5x. |
| 10 | `8.3-competitor-benchmarking.mdx` | 66–79 | Gap Analysis Matrix contradicts its own stated scoring rule (`Opportunity = competitor avg ≤ 1.5 AND our avg ≥ 2`); 4 of 6 rows use qualitative labels ("Flat," "Fast," "Testing") that don't fit the defined 4-point scale at all, so no score is computable for them. | Either rewrite the rule to match the table's real logic, or rewrite the table to only use the defined Strong/Medium/Weak/Not-using scale and recompute which rows qualify. |
| 11 | `2-keyword-research/2.3-negative-keywords.mdx` | 29–32 | Four rows show ACoS = "100%" on $0 in sales. ACoS = spend ÷ sales is undefined/infinite at zero sales, not 100%. | Replace "100%" with "no sales" / "undefined" framing in all four rows. |
| 12 | `3.3-aplus-content.mdx` | 138–145 | Table column labeled "Ad Spend" is actually sales/revenue (base × ACoS). A single month's savings figure (₱30,000) is then called an annual total, when the table's own numbers escalate monthly. | Relabel the column correctly; compute a real cumulative annual figure or drop the "/year" framing. |
| 13 | `3.3-aplus-content.mdx` | 29 | Claims Brand Registry lets you "replace main image with video." Amazon's video placement is an additional gallery asset, not a substitute for the compliant static main image. | Reword to "add video to the image gallery." |
| 14 | `3.3-aplus-content.mdx` | 37 | "A+ Content improves conversion by 5–17% on average" stated as flat fact with no source, unlike the hedged treatment given to similar claims elsewhere. | Add the same "directional estimate, not a verified figure" hedge used in 3.1. |

## P0 — Stale terminology (Module 1 rewrite didn't propagate)

Module 1's rewrite (PR #31) retired "break-even CPC" in favor of "maximum CPC at target ACoS" — they're only the same number if the target equals the product's real break-even margin. These files still teach the retired term:

- `6-bidding-lab/6.1-bid-strategies.mdx` — lines 28, 132, 155
- `6-bidding-lab/6.2-placement-adjustments.mdx` — lines 74, 83
- `4-campaign-architecture/4.4-campaign-architecture-practice.mdx` — lines 47, 88 ("break-even bid")

`6.3-bid-elevator-prep.mdx` already uses "Max CPC" correctly and consistently — the fix pattern already exists in the repo, it just needs to be applied to the other three files.

Also: `4.4-campaign-architecture-practice.mdx:108` tells learners to go to "Module 6" next, skipping Module 5 (the real order, per `0.2-platform-tour.mdx`, is 4 → 5 → 6).

## P0 — Data-import bug (not a content issue, a code/data issue)

`8-competitive-intelligence`'s three files use frontmatter keys `description` and lowercase `xpreward`, and omit `type`/`estimatedMinutes` entirely — modules 6 and 7 use `type`, `estimatedMinutes`, and camelCase `xpReward`. `scripts/import-amph-content.ts`'s frontmatter parser is case-sensitive, so every Module 8 lesson currently imports with the silent default of 50 XP instead of its intended value, and no type/estimatedMinutes override. Confirmed by reading both the parser and the actual files, not assumed.

**Fix:** normalize Module 8's three frontmatter blocks to the same shape as modules 6–7.

---

## P1 — Systemic voice-guide violations (all 23 files)

Present in every one of the 23 files, same categories Modules 0–1 had before their rewrite:

- **Em-dashes** (`—`), banned by `docs/voice-guide.md`: roughly 150–300+ instances across the 23 files. None are clean.
- **Emoji** in headings/body, banned explicitly (🎯💡⚠️📌✅❌ etc.): present in all 23 files. Module 8 is the worst offender — every section heading is emoji-prefixed, and colored-square emoji are used as a literal scoring legend in 8.3. `5.1-campaign-portfolios.mdx` goes further and actively instructs learners to add emoji to portfolio names (lines 164–170).
- **Acronyms used without definition**: ACoS, CPC, CVR, CTR are used undefined throughout modules 2, 6, 7, 8 (only occasional correct exceptions in 3.1 and 7.1). ASIN undefined in 3.2, 3.3, 8.1, 8.3.
- **Missing lesson-template sections**: the voice guide's lesson template requires a closing "Quick check" and "What to read next" section. Modules 2 and 3 have neither section in any file, and correspondingly **have zero quiz coverage** — `quiz-questions.json` only has quizzes for modules 0, 1, 4, 6, 7.
- Banned AI-slop phrases (leverage, delve, "let's dive in," etc.): clean, none found in any of the 23 files.

---

## Fix order

1. Module 8 frontmatter normalization (fast, unambiguous, fixes real data loss).
2. The 14 factual/arithmetic bugs above, file by file.
3. Stale "break-even CPC/bid" terminology in 6.1, 6.2, 4.4, plus the 4.4 Module 6→5 skip.
4. Systemic voice-guide rewrite pass across all 23 files (em-dash, emoji, acronym definitions, Quick check / What to read next sections), plus closing the Module 2/3 quiz-coverage gap. This is the same scope of work Modules 0–1 got in PR #31 and is tracked as its own phase given its size.

## Out of scope for this document

- Modules 10–13 (Ultimate Transformation) don't exist yet — Release 3 per `docs/CURRICULUM-REDESIGN.md`.
- The module-numbering mismatch between `docs/CURRICULUM-REDESIGN.md`'s target structure and the live repo's `MODULE_META` (flagged in the PR #31 handoff) — a product decision, not a content fix, and not resolved here.
- Video explainer production (`docs/VIDEO-EXPLAINER-SCRIPTS.md`) — separate Release 2 checklist item.
