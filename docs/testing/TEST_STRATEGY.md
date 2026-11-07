# Test strategy

## Unit

Test language detection, code-switch segmentation, normalization, page extraction, element references, risk classification, action validation, profile persistence, speech states, and provider response schemas.

## Integration

Mock Gemini and ElevenLabs. Test side-panel ↔ service-worker messaging, context transfer, approval gating, form fill, verification, preference persistence, timeouts, and interruption.

## End to end

Use Playwright against representative pages containing English, Kiswahili, Sheng, mixed paragraphs, dynamic content, forms, tables, images, and login-like flows. Consequential actions must remain blocked until approved.

## Human validation

Run sessions with blind and low-vision co-designers. Measure task completion, independence, comprehension, speech intelligibility, mixed-language understanding, unwanted actions, and recovery from mistakes. Automated accessibility checks are necessary but not sufficient.
