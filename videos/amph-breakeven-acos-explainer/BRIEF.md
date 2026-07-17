---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "Know your break-even ACoS before you judge a bid, then use a target ACoS to calculate the maximum CPC you can afford."
destination: web
aspect: 1920x1080
language: en
length: 5min
angle: concept
style_preset: blue-professional
---

## Intent

Screen-led explainer teaching the economics behind ACoS judgment: break-even ACoS (profit before ads divided by selling price) sets the ceiling where advertising merely pays for itself, and a separate target ACoS (chosen by the client, informed by but not equal to break-even) feeds a maximum CPC formula (selling price times target ACoS times conversion rate). Walks a worked example ($30 price, $21 costs, $9 margin, 30% break-even ACoS; 25% target ACoS, 10% CVR, $0.75 max CPC) against a $1.20 market bid, then shows why the answer changes when any input changes. Confident, calm, professional; no talking head; the numbers and formulas carry the lesson. Source script: docs/VIDEO-EXPLAINER-SCRIPTS.md, script 3 "Break-Even ACoS and Maximum CPC" (Module 1, after the Big Six overview).

## Notes

- Fully silent build: no narration audio, no music. Narration text from the source script is burned in as on-screen captions instead of TTS, since the script's own per-scene timestamps are already authoritative and more precise than anything a TTS-timing pass would produce.
- Production rules from docs/VIDEO-EXPLAINER-SCRIPTS.md apply: one decision per screen, high contrast, large numbers, no tiny screenshots, one clear closing action.
- IMPORTANT (repo-specific): this course distinguishes "maximum CPC at a target ACoS" from "true break-even CPC" — they are the same number only if target ACoS equals the product's real break-even margin. This build keeps break-even ACoS (30%, from the product economics) and the worked max-CPC example's target ACoS (25%, a client-chosen input) visibly distinct; it never implies 25% is the break-even figure.
- Part of an 8-video pack; the pilot (script 1, amph-va-role-explainer) already validated the pipeline. This is script 3 of that pack.
