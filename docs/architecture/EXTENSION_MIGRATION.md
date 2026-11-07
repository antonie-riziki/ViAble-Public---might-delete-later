# Extension migration assessment

## Audit summary

The original ViAble repository was a greenfield React/Vite UI prototype. It contained a polished side-panel-like interface, local demo page data, brand assets, a static MV3 manifest, and a minimal service-worker placeholder. It did not contain Gemini or ElevenLabs integrations, backend endpoints, content scripts, options pages, browser adapters, or packaged extension output.

## Migration map

| Existing piece | Decision | Extension destination |
| --- | --- | --- |
| `src/App.tsx` | Reuse and narrow | Chrome/Edge side panel at `index.html`; local preview fallback remains only for development. |
| `src/styles.css` | Reuse tokens, refactor layout | Responsive 350–450px side-panel layout with hidden dashboard navigation and accessible focus states. |
| `src/lib/domain.ts` | Reuse and extend | Shared page context, action, language, and voice-state contracts. |
| `src/lib/language.ts` | Reuse as offline seam | Future Gemini language service boundary; no unsupported provider claim. |
| `public/brand/*` | Reuse | Toolbar icons, symbol, wordmark, and reference assets. |
| `manifest.json` | Replace static prototype manifest | Target manifests under `scripts/manifests/`, copied into `release/<target>/`. |
| `public/background/service-worker.js` | Replace placeholder | MV3 orchestration: side-panel activation, active-tab context, settings, and validated page actions. |
| New `public/content/page-context.js` | Add | User-activated semantic DOM extraction and deterministic focus/scroll/fill operations. |
| New options page | Add | Local settings at `options.html`; no account required. |
| `docs/*` | Keep and expand | Add deployment, store preparation, and migration documentation. |

## Removed from primary product

There was no true landing page or backend to remove. The large dashboard navigation and secondary cards are hidden in the extension layout so the side panel stays task-first. The standalone Vite preview remains a development convenience only; the packaged extension is the product deliverable.

## Known integration gaps

Gemini, ElevenLabs, Toolkit/Librarian, and persistent provider proxying are not present in the starter repo. The extension now has the runtime seams and truthful local fallback needed to integrate them without shipping secrets, but production provider calls still require a trusted backend and credentials.
