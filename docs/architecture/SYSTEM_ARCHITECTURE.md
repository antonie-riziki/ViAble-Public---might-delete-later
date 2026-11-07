# System architecture

```text
Chrome side panel
  ├─ accessible UI, onboarding, conversation, playback controls
  └─ local preferences + consent state
          │ typed runtime messages
MV3 orchestration
  ├─ service worker / active tab / permissions
  ├─ page-context extraction (content script)
  └─ action approval + execution boundary
          │ minimum relevant context
Provider services
  ├─ Gemini: language understanding, summarisation, planning, structured output
  ├─ ElevenLabs: speech output
  └─ optional speech-to-text provider
```

## Boundaries

- `src/lib/domain.ts` contains stable domain contracts and demo context.
- `src/lib/language.ts` is the first independently testable multilingual seam.
- The side panel owns presentation and user approval, not arbitrary DOM execution.
- The service worker is the only extension runtime boundary for tab access and provider requests.
- Future Toolkit integration should implement ports rather than import Toolkit internals throughout the UI.

## Action lifecycle

`User request → page context → Gemini plan → schema validation → risk classification → user approval → deterministic browser API → verification → spoken/text feedback`.

Low-risk reading and locating actions may proceed immediately. Moderate-risk navigation/fill operations are reviewable. High-risk submission, payment, purchase, legal declaration, and account changes always require explicit approval and read-back.
