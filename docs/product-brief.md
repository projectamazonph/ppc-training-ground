# Project Brief — Project Amazon PH Academy v2

**Project:** Project Amazon PH Academy v2 (v2)
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07
**Status:** Approved (build phase)

---

## What This Is

A paid training platform where Filipino virtual assistants learn Amazon advertising through structured courses, interactive tools, gamified learning, and downloadable resources.

## Why This Exists

Filipino VAs working in the Amazon advertising niche can charge ₱60k–₱80k/month. The training to get there is fragmented, expensive, or English-only with no Filipino context. This platform closes that gap.

## Audience

**Primary:** Filipino virtual assistants, age 22–40, earning ₱15k–₱30k/month, looking to specialize.

**Secondary:** Existing PPC specialists wanting to expand into Amazon. Agency staff upskilling. Self-paced learners who prefer practice over video.

**Not the audience:** People outside the Philippines. People already at ₱80k+/month (they're competitors, not customers).

## Value Proposition

Three courses. One outcome: the VA becomes the Amazon ads specialist clients retain at ₱60k–₱80k/month.

Unlike competitors, this platform:
- Speaks the audience's language (real ₱ amounts, real cities, real VA scenarios)
- Practices with real tools (Campaign Builder, Bid Elevator, STR Triage simulators)
- Earns certifications recognized in the ProjectAmazonPH hiring pipeline

## Pricing Tiers

| Tier | Price | What they get |
|------|-------|---------------|
| **PPC Foundations** | ₱2,999 | 5 core modules, basic tools, quizzes, badges |
| **Accelerated Mastery** | ₱5,999 | 8 modules, all scenario packs, all resources, recordings |
| **Ultimate Transformation** | ₱9,999 | Everything + weekly live classes, 1-on-1 portfolio review, priority certificates |

## Key Features

1. **Course Curriculum** — Structured Amazon Ads training
2. **Campaign Builder** — Interactive campaign structure tool
3. **Bid Elevator** — Bid optimization practice
4. **Search Term Triage** — Keyword analysis practice
5. **Badges** — Gamified achievements
6. **Certificates** — Course completion certificates with verification
7. **Live Classes** — Scheduled sessions with Ryan (Ultimate tier)
8. **Resources** — Downloadable templates and guides

## What This Is Not

- Not a marketplace. Ryan owns the content.
- Not multi-tenant. Single organization.
- Not AI-powered. Zero external AI APIs (ADR-003).
- Not a CMS. Content ships with the app.
- Not multi-language. English UI with Filipino cultural references in copy.

## Success Metrics

| Metric | Target (Year 1) |
|--------|------------------|
| Paid enrollments | 500 |
| Ultimate tier ratio | ≥ 15% |
| Course completion rate | ≥ 60% |
| Monthly refund rate | < 5% |
| NPS | ≥ 50 |
| Time to first badge | < 2 hours |

## Stakeholders

- **Ryan Roland Dabao** — owner, content author, sole admin
- **Students** — paying customers
- **No team.** Solo operator. All decisions made by Ryan.

## Constraints

- **Solo developer.** One person, 11-week build, then ongoing maintenance.
- **No AI features.** Hard constraint, per ADR-003.
- **Philippine peso only.** No multi-currency.
- **PHP audience.** Default copy is English; voice guide permits Filipino cultural references.

## Risks

- **Solo burnout.** Mitigated by sprint-based scope decisions.
- **Payment integration delays.** Mitigated by PayMongo + PayMongo fallback.
- **Content quality regression.** Mitigated by voice guide + lint rule.
- **Production scaling surprise.** Mitigated by Vercel + managed Postgres + early observability.

## Open Questions (deferred)

- Affiliate program
- Subscription pricing
- B2B / corporate seats
- White-label
- Multi-language UI

See `docs/decisions.md` for the full ADR set.