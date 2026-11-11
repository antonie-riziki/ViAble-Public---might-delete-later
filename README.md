# ViAble

ViAble is a multilingual web accessibility and interaction assistant for blind and low-vision users. The initial product direction is a Chrome MV3 side panel that helps people understand pages, ask questions, navigate, and complete user-approved tasks safely.

## Current implementation

This repository contains a real MV3 browser-extension foundation: a branded React/Vite side panel, toolbar action, background service worker, user-activated semantic content script, local settings/options page, browser action boundary, and Chrome/Edge/Firefox release manifests. The primary interaction is voice-first: press the microphone, speak a request, and receive a spoken answer. Typed input remains available as an accessible fallback. Gemini reasoning and ElevenLabs speech are reached through the server-only local voice proxy; provider keys are never bundled into the extension.

[![Architecture diagram of antonie-riziki/viable-public---might-delete-later](https://gitdiagram.com/antonie-riziki/viable-public---might-delete-later/diagram.png)](https://gitdiagram.com/antonie-riziki/viable-public---might-delete-later?utm_source=readme&utm_medium=picture)

## Setup

Requires Node.js 20+ and pnpm/npm.

```bash
pnpm install
pnpm dev:extension
pnpm typecheck
pnpm test
pnpm build:chrome
pnpm package:chrome
```

Copy `.env.example` to `.env.local`, add provider credentials, and start the proxy in a second terminal:

```bash
pnpm voice:server
```

The extension falls back to browser speech synthesis if the proxy or ElevenLabs is unavailable. Do not commit credentials. For provider setup, use a valid Google Gemini API key and a current ElevenLabs API key; the proxy uses Gemini `generateContent` and ElevenLabs synchronous text-to-speech calls.

## Extension outputs

Chrome: `release/chrome/` and `release/ViAble-chrome.zip`
Edge: `release/edge/` and `release/ViAble-edge.zip`
Firefox: `release/firefox/` and `release/ViAble-firefox.zip`

Install the Chrome build with [CHROME_INSTALL.md](docs/deployment/CHROME_INSTALL.md). The Vite preview is only a development convenience and is not a substitute for loading the unpacked extension.

## Documentation

- Product requirements: `docs/product/PRD.md`
- Integration assessment: `docs/architecture/INTEGRATION_ASSESSMENT.md`
- Architecture/data flow/security: `docs/architecture/`
- Design and flows: `docs/design/`
- Testing and accessibility plans: `docs/testing/`
- Extension migration: `docs/architecture/EXTENSION_MIGRATION.md`
- Chrome deployment: `docs/deployment/`

## Brand assets

Brand references and generated SVG assets live in `public/brand/`. The supplied logo is used as `logo.png`; the original reference copy and architecture board are retained for development.

## Safety and privacy

Page content is untrusted input. Model output must be schema-validated before any action. Consequential actions require explicit user approval. Full page content is not long-term memory by default. See `docs/architecture/SECURITY.md`.
