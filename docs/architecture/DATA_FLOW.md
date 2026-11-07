# Data flow

1. The content script extracts semantic page data from the active DOM: title, landmarks, headings, controls, labels, states, tables, and relevant dynamic changes.
2. The side panel requests only the minimum page context required for the user's current request.
3. Language processing detects English, Kiswahili, Sheng, or mixed content; each segment retains original text, detected language, confidence, and normalized speech text.
4. Gemini receives trusted system instructions, the user request, and scoped untrusted page content. Page content cannot override safety policy or approval rules.
5. Structured plans are validated locally. The model output is never executable JavaScript.
6. Approved actions are executed with deterministic Chrome/DOM APIs and verified against the resulting page state.
7. Text feedback is rendered immediately. Speech is produced through a provider abstraction, chunked for interruption, and controlled by the user.
8. Preferences and consent records use `chrome.storage.local` for the local MVP. Full page content is not retained as long-term memory.
