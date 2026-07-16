# Voice Guide — Project Amazon PH Academy v2

**Audience:** Filipino virtual assistants learning Amazon advertising
**Tone:** Direct, plain-spoken, no-BS
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

---

## The Voice

Project Amazon PH Academy talks like a senior PPC specialist who's been doing this for 10 years and has zero patience for jargon, fluff, or hedging. It's warm because the audience is learning a hard skill under pressure, but it's never condescending and never oversells.

If a Pinoy VA in Cebu reads this on their phone at 11pm after a 9-hour VA shift, they should feel like the platform respects their time.

## Voice in Three Sentences

1. **Say what it does, not what it represents.** "Save your campaign" not "Persist your campaign structure to the database."
2. **Use real numbers, not abstractions.** "₱2,999 one-time, unlock everything for life" not "Affordable tier-based access."
3. **Talk to the reader, not about them.** "You'll see this every week" not "Users may encounter this scenario."

## Banned Phrases (enforced by ESLint)

These never ship. Anywhere. UI copy, lessons, error messages, marketing pages.

### The Obvious Ones

- "leverage" → use "use"
- "delve into" → use "look at" or "dive into"
- "navigate the complexities of" → delete the phrase, write what you mean
- "in today's rapidly evolving landscape" → delete the phrase, write what you mean
- "cutting-edge" → delete
- "game-changing" → delete
- "revolutionize" → delete
- "unlock the power of" → delete
- "seamless" → unless literally describing a transition with zero seam
- "robust" → unless describing actual physical robustness (it's not)
- "comprehensive" → describe what's actually included
- "holistic" → delete
- "synergy" → delete
- "paradigm" → delete
- "ecosystem" → unless literally about ecology
- "empower" → except in literal sense (giving someone power)

### The Sneaky Ones

- "It's not just X, it's Y" — every AI rewrite uses this. Restate X.
- "Whether you're a beginner or an expert..." — pick one audience and write to them
- "Let's dive in" / "Let's explore" / "Let's break this down" — just start
- "Here's what you need to know" — just say what they need to know
- "I hope this helps" — delete
- "Of course!" / "Certainly!" — delete
- "Great question!" — delete
- "Without further ado" — delete
- "In conclusion" / "To summarize" — just end
- "delve" — see above
- "tapestry" — never
- "vibrant" — never for UI
- "bustling" — never
- "nestled" — never
- "renowned" — never
- "breathtaking" — never

### The Pinoy-Culture-Aware List

Don't use:

- "Mabuhay!" as a generic greeting (it's ceremonial)
- "Po" and "opo" in UI copy (that's for elders/parents)
- Fake Filipino words to seem relatable
- Code-switching mid-sentence without rhythm

Do use:

- Real city names: Cebu, Davao, Iloilo, Bacolod, Pampanga, General Santos
- Real money: ₱2,999 not "around three thousand pesos"
- Real time references: "first client" not "your journey"
- Real skills: "₱15k/month ceiling" not "income plateau"

## The Four Contexts

### Marketing / Landing Page

**Tone:** Aspirational but honest. Specific outcomes.

Examples:

- ❌ "Unlock your potential with our comprehensive Amazon advertising course."
- ✅ "Three courses. One outcome: you're the Amazon ads person your clients keep on retainer."

- ❌ "Learn from industry experts with decades of experience."
- ✅ "Ryan has managed ₱50M+ in Amazon ad spend across 200+ client accounts since 2014."

- ❌ "Join thousands of successful graduates."
- ✅ "183 VAs who took this course in 2025 are now charging ₱60k–₱80k/month for Amazon ads work."

### Lessons (long-form content)

**Tone:** Teacher at a whiteboard, not a textbook. Patient, specific, real.

Rules:

- Define every acronym the first time it appears. Every. Single. Time.
- Use real numbers in every example. "₱60,000 ad spend on a ₱1,200 AOV product" not "a typical product with average spend."
- Walk through the reasoning, not just the conclusion. "If your ACoS is over 50%, your bid is too high for this keyword. Here's why..."
- Use analogies from the audience's world. "Think of your campaign budget like a load cell — too much weight breaks it."
- End sections with "What to read next" links to the next lesson in the module.

### UI Copy (buttons, labels, toasts, errors)

**Tone:** Direct, action-oriented, never clever.

| Don't | Do |
|-------|-----|
| "Submit" | "Save Campaign" |
| "Cancel" | "Keep Editing" |
| "OK" | "Got It" |
| "Yes / No" | "Delete Campaign / Keep It" |
| "Loading..." | "Saving your changes..." |
| "Error" | "Couldn't save. Check your connection and try again." |
| "Success" | "Campaign saved. Badge earned." |
| "Click here" | "Download PDF" |
| "Invalid input" | "Email needs an @ symbol. Example: [email protected]" |
| "Are you sure?" | "Delete this campaign? You can't undo this." |

### Error Messages

Every error message answers three questions:
1. What happened?
2. Why?
3. How do I fix it?

Templates:

- **Format error:** "[Field] needs [format]. Example: [example]"
- **Missing required:** "Enter [what's missing]"
- **Permission denied:** "You don't have access to [thing]. [What to do instead]"
- **Network error:** "Couldn't reach [thing]. Check your connection and try again."
- **Server error:** "Something went wrong on our end. We're looking into it. [Alternative action]"

Never blame the user. "Please enter a date in MM/DD/YYYY format" not "You entered an invalid date."

### Empty States

Every empty state is an onboarding moment:

1. Acknowledge briefly (one line)
2. Explain what filling it gives them
3. Provide a clear action

Examples:

- ❌ "No campaigns"
- ✅ "No campaigns yet. Build your first one in the Campaign Builder. You'll see exactly how a Sponsored Products structure should look."

- ❌ "No badges earned"
- ✅ "Badges unlock as you complete modules and tool challenges. Your first badge appears after finishing Module 1."

- ❌ "0 results"
- ✅ "No quizzes passed yet. Module 1 has 3 quizzes. Start with the first one."

### Tooltips and Helper Text

Concise, instructional, no jargon.

| Don't | Do |
|-------|-----|
| "Bid" | "Max cost-per-click. Higher = more visibility, more spend." |
| "Match Type" | "How closely a search term must match your keyword. Exact > Phrase > Broad for control." |
| "ACoS" | "Ad spend ÷ sales. 25% = you spent ₱25 to make ₱100 in sales." |
| "Daily Budget" | "Max spend per day, in pesos. Amazon won't exceed this even if bids would allow it." |
| "Negative Keyword" | "A search term you don't want to show ads for. Keeps budget from wasting on junk clicks." |

## Jargon Buster (mandatory in lesson content)

Every PPC term gets explained on first use. Format: "term (plain English meaning)".

| Term | Plain English |
|------|---------------|
| ACoS | Ad Cost of Sale — your ad spend divided by ad sales. 30% ACoS means you spent ₱30 to make ₱100 in ad sales. |
| ROAS | Return on Ad Spend — ad sales divided by ad spend. 3.0 ROAS means you made ₱3 for every ₱1 spent. |
| CPC | Cost Per Click — what you pay each time someone clicks your ad. |
| CTR | Click-Through Rate — clicks ÷ impressions, as a percentage. 1% means 1 in 100 people who saw your ad clicked it. |
| Keyword | The search term you want your ad to show for. "wireless earbuds" is a keyword. |
| Search Term | What the shopper actually typed into Amazon. "best cheap wireless earbuds under 1000" is a search term. |
| Match Type | How closely a search term must match your keyword to trigger your ad. Exact = exact match. Phrase = keyword in the search. Broad = related. |
| Bid | Max cost-per-click you're willing to pay. |
| Campaign Budget | Daily limit on what Amazon will spend on this campaign. |
| Negative Keyword | A search term you specifically don't want to show for. |
| ASIN | Amazon's product ID for a specific product. B08N5WRWNW is an ASIN. |
| Sponsored Products | The basic ad type. Shows individual product listings in search results. |
| Sponsored Brands | The banner-style ad at the top of search. Shows your brand logo and 3 products. |
| Sponsored Display | Ads that follow shoppers around Amazon and off-Amazon (retargeting). |
| Conversion Rate | Orders ÷ clicks. 10% conversion means 1 in 10 clicks became a sale. |

## Tone Do's and Don'ts

### Do

- "Save and continue" not "Submit your response"
- "₱2,999 one-time, unlock everything for life" not "Flexible payment options available"
- "You'll need: a brand registry account, 5+ ASINs, and a Sponsored Products campaign ready to go" not "Prerequisites may include various account configurations"
- "Wrong. The correct answer is B — auto campaigns need lower bids because they cast a wider net" not "Incorrect. Please review the relevant material"
- "Drag the slider to see how bid changes affect CPC" not "Adjust the input parameter to observe effects on cost-per-click"

### Don't

- Use exclamation marks unless something is genuinely exciting (badge earned, course complete)
- Use ellipses for suspense ("Save your work...") — say what's happening
- Use question marks in CTAs ("Ready to start?")
- Use "we" when you mean "you" ("We recommend..." → "Start with...")
- Use passive voice to dodge responsibility ("Mistakes were made" → "You picked the wrong match type")

## Lesson Content Template

Every lesson follows this structure:

```markdown
# [Lesson Title]

[Opening hook — 1-2 sentences. Concrete, specific, sets up what they're about to learn.]

## What you'll learn

- [Specific outcome 1]
- [Specific outcome 2]
- [Specific outcome 3]

## [Section 1: The concept]

[Plain English explanation. Define any new terms inline. Use real numbers.]

### Example

[Concrete scenario with real product, real spend, real numbers. Walk through the calculation.]

## [Section 2: How to do it]

[Step-by-step. Numbered list. Each step is one action.]

1. Go to Campaign Manager
2. Click "Create Campaign"
3. ...

## [Section 3: What to watch for]

[Common mistakes. Specific failure modes. How to recognize them.]

- **Mistake:** Bidding ₱50 on a keyword that converts at ₱10. You'll burn budget.
- **Why it happens:** Beginners think higher bids always get more sales.
- **Fix:** Start at the suggested bid. Increase only after 50+ clicks with no conversions.

## Quick check

[One question to confirm they got it. Multiple choice with explanations.]

## What to read next

- [Next lesson in module]
- [Related tool practice]
```

## Quiz Question Voice

Wrong-answer explanations are teaching moments, not scolding:

- ❌ "Incorrect. The correct answer is B."
- ✅ "Not quite. Auto campaigns need lower starting bids because Amazon shows your ad on broader matches. Try again with a ₱0.30 bid."

- ❌ "Wrong."
- ✅ "Close. But exact match isn't always best — phrase match gives you more reach while still controlling irrelevant clicks."

Right-answer confirmations are brief and human:

- ✅ "Right. Sponsored Products is the right starting point — it has the lowest learning curve and the most data."
- ✅ "Correct. ACoS of 25% on a ₱1,000 product means ₱250 in ad spend to make ₱1,000 in sales."

No "Great job!" No "Awesome!" No emoji.

## ESLint Rule (mechanical enforcement)

Add to `eslint-rules/no-ai-slop.js`:

```javascript
const BANNED = [
  'leverage', 'delve', 'navigate the complexities',
  'cutting-edge', 'game-changing', 'revolutionize',
  'unlock the power', 'seamless', 'robust', 'comprehensive',
  'holistic', 'synergy', 'paradigm', 'ecosystem', 'empower',
  "it's not just", 'whether you\'re a beginner',
  "let's dive in", "let's explore", "let's break this down",
  'here\'s what you need to know', 'i hope this helps',
  'of course!', 'certainly!', 'great question!',
  'without further ado', 'in conclusion', 'to summarize',
  'tapestry', 'vibrant', 'bustling', 'nestled', 'renowned',
  'breathtaking', 'mabuhay', // ceremonial Filipino, not for UI
];

module.exports = {
  meta: { type: 'problem', docs: { description: 'no AI slop phrases' } },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          const lower = node.value.toLowerCase();
          for (const phrase of BANNED) {
            if (lower.includes(phrase)) {
              context.report({
                node,
                message: `Banned AI-slop phrase: "${phrase}". See docs/bmad/voice-guide.md`,
              });
            }
          }
        }
      },
      TemplateElement(node) {
        if (node.value && node.value.raw) {
          const lower = node.value.raw.toLowerCase();
          for (const phrase of BANNED) {
            if (lower.includes(phrase)) {
              context.report({
                node,
                message: `Banned AI-slop phrase: "${phrase}". See docs/bmad/voice-guide.md`,
              });
            }
          }
        }
      },
    };
  },
};
```

Wire up in `.eslintrc.json`:

```json
{
  "plugins": ["local"],
  "rules": {
    "local/no-ai-slop": "error"
  }
}
```

CI fails on any banned phrase in any committed file.

## Voice Audit (run before each sprint ships)

Manual checklist:

- [ ] Every acronym defined on first use in lesson content
- [ ] Every UI string uses real verbs, not generic ones
- [ ] Every error message answers what/why/how-to-fix
- [ ] Every empty state has CTA
- [ ] No emoji in headings or body copy
- [ ] No em-dashes used for "punchy" effect (use periods, commas, or parentheses)
- [ ] No fake Filipino or performative code-switching
- [ ] ESLint passes

Automated:

- [ ] `pnpm lint` returns zero `no-ai-slop` errors
- [ ] Coverage on copy helpers ≥ 80%
- [ ] Snapshot test on every toast, modal, empty state