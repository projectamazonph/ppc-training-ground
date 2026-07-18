---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "When performance drops, diagnose whether the problem is traffic (targeting/click appeal) or the listing (product fit) before touching bids."
destination: web
aspect: 1920x1080
language: en
length: 4min
angle: concept
style_preset: blue-professional
---

## Intent

Screen-led explainer for Filipino aspiring virtual assistants in Module 3 (Listing Optimization), alongside 3.1 Listing and Ad Relevance Signals. Teaches the diagnostic split between a traffic problem (low CTR: targeting and click appeal) and a listing problem (clicks but low conversion: product fit) using the ad funnel (impression, click, product page, order) as the throughline, then a decision rule for high CTR/low conversion vs. high conversion/high cost, closing on the Listing Audit simulator. Source script: docs/VIDEO-EXPLAINER-SCRIPTS.md, script 4 "Traffic Problem or Listing Problem?"

## Notes

- Fully silent build: no narration audio, no music. Narration text from the source script is burned in as on-screen captions instead of TTS, since the script's own per-scene timestamps are already authoritative and more precise than anything a TTS-timing pass would produce.
- Production rules from docs/VIDEO-EXPLAINER-SCRIPTS.md apply: one decision per screen, high contrast, large numbers, no tiny screenshots, one clear closing action.
- This repo's Module 3 does not use the term "Quality Score" (Amazon does not publish one) — this composition does not reference that term anywhere.
- Part of an 8-video pack; follows the established blue-professional visual system from the pilot (script 1, amph-va-role-explainer).
