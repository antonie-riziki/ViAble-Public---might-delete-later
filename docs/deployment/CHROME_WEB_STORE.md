# Chrome Web Store preparation

## Listing metadata

- Name: ViAble
- Short description: Understand, navigate and use the web with a multilingual accessibility companion.
- Category: Productivity / Accessibility
- Version: 0.1.0
- Package: `release/ViAble-chrome.zip`

## Full description draft

ViAble is an AI-powered multilingual web accessibility and interaction assistant for blind and low-vision users. It complements existing screen readers by helping users understand page meaning, ask questions, find headings and links, and receive user-approved form assistance. ViAble is designed for English, Kiswahili, and Kenyan Sheng-aware workflows. It does not disable screen readers and does not submit consequential actions without explicit approval.

## Permission justifications

- `activeTab`: inspect the page only after the user activates ViAble from the toolbar.
- `sidePanel`: provide the primary extension interface beside the current webpage.
- `scripting`: inject the small semantic page inspector into the user-activated tab.
- `storage`: save local accessibility preferences and consent settings.

No history, cookies, downloads, or broad `<all_urls>` permission is requested.

## Submission materials still required

The store listing needs a hosted privacy policy URL, support URL, final store icon/screenshot set, data-use disclosures, and a verified provider/backend deployment. Do not claim Gemini or ElevenLabs availability until real provider calls have been verified with configured credentials.

## Manual submission

Open the Chrome Developer Dashboard, create a new item, upload `release/ViAble-chrome.zip`, enter the metadata above, complete privacy/data disclosures, review permission warnings, and save as draft. Publishing, legal agreements, and payments require the product owner's authorised account.
