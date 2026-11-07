# Install the Chrome extension locally

The installable extension is built to `release/chrome/`.

1. Run `npm install` or `pnpm install`.
2. Run `npm run build:chrome`.
3. Open Google Chrome.
4. Navigate to `chrome://extensions/`.
5. Enable **Developer mode**.
6. Select **Load unpacked**.
7. Choose the repository's `release/chrome/` directory.
8. Pin ViAble to the toolbar.
9. Add provider credentials to ignored `.env.local` and start the local voice proxy with `pnpm voice:server`.
10. Open any webpage, click the ViAble toolbar icon, and open the side panel.
11. Press the microphone. ViAble opens a short permission tab because Chrome does not show the first microphone prompt inside a side panel.
12. Choose **Allow** in that tab. It closes automatically and ViAble starts listening in the side panel.
13. Speak a request such as “What is this page about?” or “Find the deadline.”
14. ViAble requests active-tab access only after the user activates it. Typed input remains available if microphone access is unavailable.

The extension falls back to browser speech synthesis if the voice proxy or ElevenLabs is unavailable. Replace the localhost proxy with an authenticated HTTPS backend before production publishing.
