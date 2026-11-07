# Integration assessment

Audit date: 2026-11-05

## Sources inspected

- [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit), main at `9bb42e10ece3b7b0f2e6c2d1384e023d73e278b3`.
- [AI for Accessibility Extension](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Extension), main at `bf574b7f864437d5e76ef0044ec21c84b25d42f4`.

The starter ViAble repository contained only a README, so there was no existing extension implementation or package manifest to merge. The assessment therefore treats the upstream repositories as reference and future integration sources rather than vendored dependencies.

## Findings

| Capability | Source evidence | ViAble strategy |
| --- | --- | --- |
| AbilityModel and profiles | Toolkit controller/presentation and Librarian APIs | Integrate behind `AccessibilityProfilePort`; persist only user-approved preferences. |
| Librarian and consent | Toolkit controller, onboarding, and extension security docs | Preserve model-first updates, explicit consent, pause/delete controls, and no default page-content memory. |
| Skills and adapters | Toolkit `tools/adapters`, registry, adapter protocol | Selectively expose reader mode, focus locator, labels, tables, language tags, and confirmation adapters through a typed boundary. |
| Auditors | Toolkit WCAG auditors and tests | Run audits against extracted page context and surface actionable issues, not as a substitute for human testing. |
| MV3 extension patterns | Extension manifests, service worker, side panel/voice docs | Use MV3 side panel, background message routing, active-tab extraction, and explicit execution ports. |
| Voice interaction | Personalized extension voice-mode docs | Adapt the voice state machine and consent-guarded function calls; keep typed text as a peer input. |
| Gemini integration | Extension voice routes and Toolkit Librarian caller | Add provider abstraction and structured output validation; keep secrets out of content scripts. |
| Kenyan language intelligence | Not present as a complete product capability | Build custom language detection, segmentation, pronunciation hints, and a Kenyan evaluation corpus. |
| ElevenLabs TTS | Not a verified upstream dependency | Add a server-side speech adapter; evaluate Kenyan English/Kiswahili/Sheng with real users. |

## Risks and decisions

1. Upstream code is research-oriented and has multiple extension generations. Pin commits and wrap it rather than importing internal modules directly.
2. Existing voice routes demonstrate consent and verification patterns, but do not make ViAble's user experience or language claims production-ready.
3. Browser permissions and provider credentials need a trusted backend/proxy before release. Local-only developer mode can use `.env`; production must not ship private keys in the extension bundle.
4. The reference repositories do not constitute Android support. Android remains a feasibility track.
