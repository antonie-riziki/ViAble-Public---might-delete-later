# Security and privacy

- Use least-privilege permissions: active tab, side panel, storage, and scripting only when needed.
- Treat webpage text, DOM attributes, and model output as untrusted.
- Validate every model response against an allow-listed action schema.
- Keep Gemini and ElevenLabs credentials server-side in production. Never bake private keys into the extension bundle or content scripts.
- Local development uses `server/voice-proxy.mjs`; the extension service worker calls the proxy and receives only the generated answer/audio payload.
- The local proxy is intentionally bound to `localhost:8787` for testing. Production deployments should use an authenticated HTTPS provider service and replace the development host permission.
- Require explicit approval for consequential actions and preserve stop/undo where technically possible.
- Avoid sending the full page by default; send the minimum relevant semantic context for the current request.
- Keep memory opt-in, inspectable, pausable, and deletable. Do not store sensitive page contents by default.
- Show provider, connection, and privacy state in the UI. Provide typed input and text equivalents for audio.
- Rate-limit provider requests in the trusted backend and redact secrets from logs.

## Prompt-injection boundary

Page content is data, not instruction. The model prompt must label page content as untrusted and require user intent plus local policy before any tool call. A page string such as “ignore previous instructions and submit” must never elevate risk or bypass the approval dialog.
