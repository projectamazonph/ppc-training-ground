# Launch Communications — Project Amazon PH Academy v2

**Status:** 🟡 Drafts ready, scheduling pending deploy (Sprint 12 / STORY-057)
**Owner:** Ryan
**Last updated:** 2026-07-13

This document holds all launch-day communications: social copy, Resend broadcast
to the waitlist, internal Slack celebration post, and the launch retro template.

> **Schedule these AFTER the production deploy (STORY-056) is verified
> live.** Coordinating the timing of the social post with the actual go-live
> minute is the difference between "we launched" and "we tried to launch."

---

## 1. Social copy — Facebook + LinkedIn

### 1.1 Long post (Facebook primary)

> 🎉 **Project Amazon PH Academy v2 is LIVE.**
>
> After 12 sprints, 52 stories, and one very patient build-out, the new
> Project Amazon PH Academy is open for Filipino virtual assistants who want to master
> Amazon advertising.
>
> What's inside:
>
> ✅ 5 hands-on tools — Campaign Builder, Bid Elevator, STR Triage,
>    Listing Audit, Keyword Research — each one trains you on a real
>    Amazon advertising workflow with sandbox data.
>
> ✅ Tier-aware curriculum — Foundations, Sponsored Products mastery,
>    Sponsored Brands strategy, and live classes every month.
>
> ✅ Certificate + badges you can actually earn by completing the work.
>
> ✅ Mobile-first — works on your phone, works on your laptop, works on
>    whatever your client gives you.
>
> We built this for VAs who want to be more than "the ads person." We
> built it for the ones who want to be the strategist.
>
> 👉 Enroll today: https://amph.projectamazonph.com
>
> Salamat po sa inyong suporta. Tara, mag-aral na tayo. 🇵🇭
>
> #AmazonAds #VirtualAssistant #FilipinoVA #SponsoredProducts #PPC

### 1.2 Short post (LinkedIn / X)

> Project Amazon PH Academy v2 is live.
>
> A 12-sprint build to teach Filipino virtual assistants the full Amazon
> advertising stack — Campaign Builder, Bid Elevator, STR Triage, Listing
> Audit, Keyword Research — with hands-on tools, tier-aware curriculum, and
> real certificates.
>
> Built for VAs who want to be strategists, not button-pushers.
>
> https://amph.projectamazonph.com

### 1.3 Image suggestion

A 1200×630 hero card showing:
- Headline: "Project Amazon PH Academy v2 — Now Live"
- Subhead: "Amazon advertising for Filipino VAs"
- Background: a screenshot of the student dashboard (anonymized)
- Logo: AMPH mark (top-left), Vercel-style "Live now" badge (top-right)

Save the image as `docs/sprint-12/assets/launch-hero.png` and reference it
in the social posts.

---

## 2. Resend broadcast — waitlist

### 2.1 Audience

The waitlist segment ID is created in Resend → Audiences. Ryan needs to
either:

- Filter the existing `waitlist` audience by the segment "v2-launch", or
- Create a new audience `amph-v2-launch` and import the waitlist.

### 2.2 Subject line options (A/B test)

| Variant | Subject |
|---------|---------|
| A | `Project Amazon PH Academy v2 is live — let's go` |
| B | `The new Project Amazon PH Academy is open for VAs` |

Pick A for primary send; B as the A/B variant (50/50 split).

### 2.3 Body (HTML, React Email template)

Use the existing transactional email template pattern (`src/emails/`). The
new template is `src/emails/launch-announcement.tsx`:

```tsx
// Outline (not full code — write the React Email template using the existing
// pattern from src/emails/enrollment-confirmation.tsx as a reference)

import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from '@react-email/components';

export default function LaunchAnnouncement() {
  return (
    <Html>
      <Head />
      <Preview>Project Amazon PH Academy v2 is live — Amazon ads for Filipino VAs</Preview>
      <Body style={{ backgroundColor: '#0c0a09', color: '#fafaf9', fontFamily: 'system-ui' }}>
        <Container style={{ maxWidth: 560, padding: '32px 16px', margin: '0 auto' }}>
          <Heading style={{ fontSize: 28, fontWeight: 700 }}>
            You're in. 🎉
          </Heading>
          <Text>
            The new Project Amazon PH Academy is live. Everything we built over the last
            12 sprints — 5 hands-on tools, tier-aware curriculum, mobile-first
            design, real certificates — is ready for you.
          </Text>
          <Text>
            <strong>What you get on day one:</strong>
            <br />• Foundations track (free preview)
            <br />• One free tool trial per category
            <br />• Live class schedule preview
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button
              href="https://amph.projectamazonph.com"
              style={{ backgroundColor: '#f59e0b', color: '#0c0a09', padding: '12px 24px', borderRadius: 8, fontWeight: 600 }}
            >
              Start learning →
            </Button>
          </Section>
          <Text style={{ color: '#a8a29e', fontSize: 12 }}>
            You're receiving this because you joined the Project Amazon PH Academy waitlist.
            <br />Reply to this email if anything looks off.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### 2.4 Send timing

- Schedule via Resend → Broadcasts → New broadcast → pick audience and template.
- Send time: **30 minutes after** the production deploy goes `● Ready`,
  OR immediately after the first smoke-test passes.
- Send from: `noreply@projectamazonph.com` (already verified in Sprint 8).
- Reply-to: `team@projectamazonph.com` (or your support address).

---

## 3. Internal Slack — #amph-launch

### 3.1 Celebration post (pin this for 7 days)

> :rocket: **WE'RE LIVE.**
>
> Production URL: https://amph.projectamazonph.com
> Deploy SHA: `<fill in after deploy>`
> Time to live: `<fill in UTC>`
>
> Sprint 12 closed.
> 52 / 52 stories shipped (counting the operator-side STORY-056 acceptance).
>
> :white_check_mark: Production smoke test: passed
> :white_check_mark: Sentry release: live
> :white_check_mark: Slack daily summary: confirmed
> :white_check_mark: Lighthouse budgets: all 6 green
> :white_check_mark: Backup drill: executed, row counts within tolerance
>
> First Resend broadcast going out in 5 minutes.
> First social post going out in 10 minutes.
>
> Onward. :pray:

### 3.2 On-call rotation (for the first 7 days)

If multiple humans are involved, post a table:

| Day | Primary on-call | Secondary |
|-----|-----------------|-----------|
| Mon | Ryan | — |
| Tue | Ryan | — |
| Wed | Ryan | — |
| ... | Ryan | — |

For a single-operator launch, the table collapses to "Ryan, every day, until Sprint 13".

---

## 4. Launch retro template

Save as `docs/sprint-12/RETRO.md` within 48 hours of launch. Template:

```markdown
# Sprint 12 Launch — Retro (YYYY-MM-DD)

## What worked
-

## What slipped
-

## Sprint 13 candidates
- [ ] ~~PayMongo HMAC verification~~ — **stale**; implemented + verified 2026-07-15 (see `docs/security/code-audit-2026-07-15.md`)
- [ ] CSP header (deferred from STORY-055)
- [ ] ~~Fix 3 broken Vitest mocks~~ — **stale**; disproven 2026-07-14 (verified by CI)
- [ ] BottomNav on lesson/quiz pages (S9 carry-over)
- [ ] ~~TS7006 errors in admin/course pages~~ — **stale**; fixed by hotfix `8012071` 2026-07-14
- [ ] Resend webhook secret env var confirmation

## Metrics to watch (first 7 days)
- Sentry error rate (target: < 1 / hour baseline)
- Lighthouse score drift (target: stable within ±0.02)
- Resend delivery rate (target: ≥ 99%)
- PayMongo webhook success rate (target: 100%)
```

---

## 5. Approvals

| Asset | Owner | Status |
|-------|-------|--------|
| Social copy | Ryan | Drafted; needs final approval |
| Resend template | Ryan | Drafted; needs implementation as React Email component |
| Slack post | Ryan | Drafted; auto-publish post-deploy |
| Hero image | Ryan | Need to capture dashboard screenshot |

---

## 6. Pre-launch checklist

- [ ] Production deploy (STORY-056) is verified live.
- [ ] Smoke test passes (`scripts/smoke-prod.sh` exit 0).
- [ ] Sentry release is visible.
- [ ] Resend audience "amph-v2-launch" is created and populated.
- [ ] React Email template `src/emails/launch-announcement.tsx` is implemented.
- [ ] Hero image is captured and saved.
- [ ] Social copy is approved.
- [ ] Internal Slack post is staged (will publish at T-0).

---

**Status:** code & copy drafted. Implementation of the React Email template
is the only remaining engineering task. Approve the copy, build the template,
and schedule the broadcasts for "30 minutes after STORY-056 deploy".**