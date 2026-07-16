# Content Audit. Project Amazon PH Academy v2

**Audience:** Filipino aspiring virtual assistants with little or no Amazon experience.

**Audit date:** 16 July 2026.

**Purpose:** Turn AMPH from a well-built learning platform with imported lesson text into a current, job-ready Amazon PPC training product.

## Executive finding

AMPH has a strong delivery foundation. It has a mobile-first student experience, quizzes, five practice tools, progress tracking, certificates, payments, and a capable admin area. Its source curriculum also has useful explanations, worked examples, and three simulator-prep lessons.

The learning product is not ready to make the promise on the landing page by itself. It needs a content migration, a factual correction pass, short visual explainers, practice that produces employer-ready work, and a real course-to-tier structure.

The priority is not adding more theory. It is helping a learner move through this chain:

`understand the number → make the PPC decision → explain the decision → document the work → show evidence to a client or employer`

## What was reviewed

- The current v2 course, lesson, progress, quiz, tool, and tier-gating implementation.
- The import script that supplies v2 with lesson content.
- The 31 legacy MDX lessons and quiz fixture that the importer references.
- Current Amazon Ads support guidance for portfolios, budgets, bidding, and attribution.

### Evidence snapshot

| Area | Finding |
|---|---|
| Curriculum volume | 31 lessons, about 38,048 words across 9 modules including onboarding. |
| Learning modes | 28 lessons are `reading`; 3 are simulator preparation. There are no embedded video lessons or video URLs in the source curriculum. |
| Practice | The platform now exposes five tools: Campaign Builder, Bid Elevator, Search Term Triage, Listing Audit, and Keyword Research. |
| Assessment | Quizzes are standard multiple-choice. The current flow does not capture learner reasoning, written client communication, or a reviewable work product. |
| Content source | v2 imports content from a hard-coded Android path outside the repository. The actual lesson source is not versioned with the v2 application. |
| Tier promise | Product copy presents three course levels, but the imported catalog is one course tied to PPC Foundations. Course access is checked at course level, not module level. |

## What is working

1. **The subject sequence is sensible.** Metrics, targeting, listing quality, campaign structure, bidding, search terms, and competitive analysis are logical foundations.
2. **The lessons use concrete examples.** The Big Six metrics lesson and bidding scenarios make abstract PPC calculations easier to follow.
3. **Simulator preparation is a good instinct.** Campaign Builder, Bid Elevator, and STR Triage prep give learners context before they make decisions.
4. **The voice already aims at Filipino VAs.** Explanations are mostly plain-spoken and include Philippine peso context.
5. **The platform can support a much better course.** `Lesson.videoUrl`, resources, tool sessions, quizzes, progress, badges, and certificates are already modeled in the product.

## Critical issues

### P0. Content is not owned by the v2 repository

`scripts/import-amph-content.ts` reads from `/storage/emulated/0/Hermes Projects/projects/AMPH-Academy/project`. This makes v2 dependent on one device and leaves the production curriculum outside the repository, pull-request review, backups, and release history.

**Fix:** Move all authored content into `content/curriculum/` inside v2. Keep one MDX or structured-content file per lesson, version quiz data beside the lesson, and import from a repository-relative path. Treat curriculum changes like product changes: review, test, publish, and record the version.

### P0. The current lesson renderer cannot faithfully display the existing curriculum

The imported lessons contain Markdown tables, numbered workflows, and references to visual diagrams. `src/lib/mdx.ts` only renders headings, paragraphs, bold and italic text, inline and code blocks, bullet lists, blockquotes, and horizontal rules. It does not render Markdown tables, numbered lists, links, images, video, or interactive components. A learner will see table pipes as text and cannot use embedded visual content even when an author adds it.

**Fix:** Replace the lightweight parser with a safe, tested Markdown or MDX renderer that supports tables, ordered lists, links, images, callouts, and video embeds. Keep raw HTML disabled. Do not start the video programme until a lesson can render and track a video correctly.

### P0. Imported copy describes a different product

The legacy lessons repeatedly refer to **AdCraft**, an **AI Mentor**, a **Formula Calculator**, and only **three simulations**. v2 explicitly forbids AI features and offers five tools. This will break learner trust the first time a learner follows the lesson and cannot find the feature.

Examples:

- `0.2-platform-tour.mdx` describes the AI Mentor and AdCraft navigation.
- `0.3-first-simulation.mdx` tells students to use the AI Mentor.
- `1.5-metrics-in-practice.mdx` sends learners to a Formula Calculator that v2 does not expose.
- `7.3-str-triage-prep.mdx` calls the experience the "STR Triage Arena" in AdCraft.

**Fix:** Replace all platform-tour, navigation, next-step, and tool naming copy before importing the next content release. Never ask a learner to find a feature that does not exist.

### P0. The course-to-tier promise is not represented in the curriculum

Pricing says PPC Foundations includes five core modules, Accelerated Mastery includes all eight, and Ultimate adds support and portfolio review. The importer creates one 25-hour course with nine modules, then binds it to the PPC Foundations tier. The current gate can allow or deny a whole course only. It cannot hold individual advanced modules behind higher tiers.

**Fix:** Choose one of these product models before content production begins:

1. **Three real courses. Recommended.** Foundations, Accelerated Mastery, and Client-Ready Portfolio each have their own course record and tier requirement.
2. **One course with module entitlements.** Add a minimum-tier field to `Module` and enforce it in the course, lesson, quiz, resource, and tool routes.

Do not sell an advanced path until the content, route gates, and learner catalog all agree.

### P0. Several lessons teach product behaviour as permanent rules

Amazon Ads changes. Learners need principles and a habit of checking the console, not brittle rules that can cause bad client work.

| Existing claim | Risk | Required replacement |
|---|---|---|
| Portfolios apply negative keywords and placement or schedule adjustments to every campaign. | This teaches controls that portfolios do not provide as standard portfolio features. Amazon documents portfolios as campaign grouping, budget control, reporting, and, where eligible, unspent campaign-budget sharing. | Teach campaign-level negative targeting and bid or budget rules. Use portfolios for grouping, reporting, and budget governance. |
| Sponsored Products receives 7-day attribution while Sponsored Brands receives 14-day attribution. | The current public guidance describes a generally 14-day lookback where applicable and differs by advertiser, campaign, report, and attribution eligibility. | Teach attribution windows as a reporting setting or policy to verify before analysis. Add a source and "check your account" step. |
| Amazon uses a modified second-price auction and a winner normally pays one cent above the next bid. | It gives beginners false confidence about CPC. Auction, relevance, targeting, placement modifiers, and bidding strategy affect the outcome. | Teach the actionable rule: set a defensible maximum bid, understand bid multipliers, and monitor actual CPC and outcome. |
| A named "Listing Quality Score" directly lowers CPC. | Amazon does not expose a universal score that a VA can inspect or optimize directly. | Use "listing and ad relevance signals" as a teaching shorthand. Diagnose observable inputs: retail readiness, price, stock, featured offer, images, review strength, relevance, CTR, and CVR. |
| Manual dayparting is a universal Amazon Ads workflow. | Availability and controls vary. | Teach scheduled bidding or budget rules where eligible, with a console-validation step and a non-automation fallback. |

Use an "Amazon Ads Fact Card" in every release: product, retailer or marketplace scope, access requirement, source URL, owner, last verified date, and next review date.

Useful official references:

- [Understand portfolios](https://advertising.amazon.com/help/GPEJN2E6R52G7C2T)
- [Portfolio budgets](https://advertising.amazon.com/help/GU7E77PGF96FMW3X)
- [Conversion attribution](https://advertising.amazon.com/help/G3BB9TWP5KC375TJ)
- [Bidding strategies for Sponsored Products](https://advertising.amazon.com/help/GCU2BUWJH2W3A8Z7)
- [Understand budgets](https://advertising.amazon.com/help/GTGPQGUXNCTHE2DS)

### P1. Reading dominates, while the stated audience needs visual confidence

Thirty-eight thousand words is substantial, but the source has no video lessons, no screen recordings, and no embedded visual walkthroughs. A new Filipino VA has to imagine an unfamiliar US marketplace and Amazon Ads Console while reading long lessons on a phone.

**Fix:** Add short visual explainers before high-stakes tasks. Keep each video focused on one decision, 4 to 7 minutes, with captions, a downloadable one-page guide, and a direct transition to a tool or practice task. The accompanying script pack is in `VIDEO-EXPLAINER-SCRIPTS.md`.

### P1. The course produces answers, not client-ready evidence

Passing multiple-choice questions proves recognition. It does not prove a learner can read a search-term report, choose an action, explain trade-offs, or hand over clean work.

**Fix:** Add a graded artifact after each skill cluster:

- a break-even ACoS and maximum-CPC calculation sheet;
- a keyword map with match type, intent, bid range, and negative plan;
- a campaign-build rationale;
- an STR action log;
- a one-page weekly client update;
- a final account audit and 30-day plan.

Each artifact needs a rubric, an example, a blank template, and a self-review checklist. The Ultimate tier portfolio review should assess these artifacts, not just completion badges.

### P1. The Filipino context is present, but it is not yet operational

Peso examples and familiar analogies help. The course still lacks the moments that make a Filipino beginner employable: a client brief, expected response time, a clear escalation, written English for a client update, a sample Loom-style walkthrough, and a portfolio handover.

**Fix:** Put client work inside every advanced module. Give learners realistic remote-work briefs and require concise, professional English deliverables. Do not make them sound American. Make them clear, careful, and dependable.

### P1. Lessons need a repeatable learning pattern

Existing lessons often open with explanation and use helpful analogies, but outcomes, decision rules, practice, and transfer tasks are inconsistent.

**Use this lesson pattern everywhere:**

1. What you will be able to do for a client.
2. The decision in one sentence.
3. A short visual or annotated screen.
4. The rule, formula, or process.
5. One worked case.
6. A "you decide" checkpoint with feedback.
7. A tool task or downloadable artifact.
8. A two-sentence client explanation.
9. A short knowledge check.

## Content architecture recommendation

Build three explicit courses, not one long catalog. This makes the tier promise clear and gives beginners an early, credible win.

| Course | Outcome | Suggested modules | Required evidence |
|---|---|---|---|
| PPC Foundations | Read basic performance, research targets, build a safe Sponsored Products launch plan. | Start Here, PPC economics, listing readiness, keyword research, campaign building. | Campaign plan plus metric worksheet. |
| Accelerated Mastery | Run a weekly optimization workflow across SP, SB, and SD using data and guardrails. | Search-term triage, bidding, budgets, SB and SD, reporting, diagnostics. | STR action log plus weekly report. |
| Ultimate Transformation | Present, defend, and document PPC work like a junior account manager. | Client delivery, portfolio capstone, audit-to-plan, interview and handover. | Reviewed portfolio with recorded walkthrough. |

See `CURRICULUM-REDESIGN.md` for the module map, assessments, and production order.

## Release plan

### Release 1. Trust and safety

- Move curriculum source into v2.
- Remove legacy names and nonexistent feature references.
- Correct the portfolio, attribution, auction, budget, quality-signal, and dayparting lessons.
- Align three pricing tiers with access rules and actual content.
- Add factual-review metadata to time-sensitive lessons.

### Release 2. Foundations that lead to action

- Rewrite the 15 foundation and campaign-building lessons with the standard learning pattern.
- Launch five short video explainers and five matching practice sheets.
- Add calculation, keyword-map, and campaign-rationale artifacts.

### Release 3. Operator and client readiness

- Build the advanced optimization, reporting, and client-delivery modules.
- Add rubric-based assessments and a portfolio capstone.
- Add human review workflows for Ultimate learners.

## Success measures

Track learning quality, not only logins and XP.

- 80% of enrolled Foundations learners complete their first campaign artifact.
- 70% correctly diagnose a metric pattern in a scenario after the relevant module.
- 60% complete at least two tool sessions before certificate issue.
- 50% of Ultimate learners submit a portfolio capstone.
- 90% of content marked time-sensitive has a current fact card.
- Lesson drop-off declines after every video-plus-practice replacement.

## Immediate next actions

1. Approve the three-course structure and tier model.
2. Move source content into v2 before any further authoring.
3. Replace all legacy product references in the onboarding sequence.
4. Ship the revised Big Six lesson and its video as the reference pattern.
5. Build the career and client-delivery modules before expanding theory further.
