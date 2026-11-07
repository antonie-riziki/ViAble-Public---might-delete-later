# ViAble product requirements

## Product promise

ViAble is an AI-powered multilingual web accessibility and interaction assistant for blind and low-vision users. It complements screen readers by helping people understand page meaning, find the next step, and complete user-approved browser actions safely.

Initial delivery target: a desktop Chrome side panel. English, Kiswahili, and Kenyan Sheng are first-class language considerations, but Sheng quality remains an evaluation target rather than a claim.

## Personas

- Blind web user: needs natural page reading, contextual explanation, voice/text interaction, navigation, and form support without losing control.
- Low-vision user: needs readable typography, strong contrast, reduced clutter, scalable text, and voice as an additional input/output mode.
- Multilingual Kenyan user: needs code-switch-aware understanding that preserves original terms and meaning rather than silently translating everything.

## Prioritised scope

### P0 — essential MVP

Accessible onboarding, active-page inspection, structured page extraction, mixed-language interpretation seams, English/Kiswahili/Sheng-aware processing, ElevenLabs speech seam, voice and text interaction, page summaries and questions, contextual navigation, basic form understanding, user-approved form assistance, action confirmation, stop/error handling, and local preferences.

### P1 — enhanced experience

Image descriptions, tables/charts, dynamic-content support, reusable accessibility skills, personalised pronunciation, Gemini Live, history, enhanced verification, and more adaptations.

### P2 — future

Android strategy, other browsers, native Android integration, offline capabilities, cross-device profiles, more African languages, and deeper multimodal automation.

## Functional requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-001 | Accessible onboarding and preferences | Keyboard and screen-reader operable; captures language, voice, reading speed, assistance, and memory choices; account not required for local mode. |
| FR-002 | Page understanding | Extract title, main content, headings, links, buttons, forms, labels, tables, images, landmarks, names, and states from DOM/semantics. |
| FR-003 | Multilingual intelligence | Detect language changes, preserve original text, segment speech, and expose uncertainty; never claim Sheng accuracy without evaluation. |
| FR-004 | Natural interaction | Voice and text input; stop, pause, resume, repeat, speed, voice, and interruption controls; no essential voice-only path. |
| FR-005 | Contextual assistant | Answers are grounded in active page context and clearly say when information is unavailable. |
| FR-006 | Intelligent navigation | Supports headings, links, buttons, forms, focus, scrolling, and return to previous positions via voice, keyboard, or UI. |
| FR-007 | Form assistance | Explains fields, required data, validation, and missing information; never submits without explicit confirmation. |
| FR-008 | Controlled browser actions | User request → context → plan → validation → approval → execution → verification; Gemini never directly manipulates DOM. |
| FR-009 | Personalisation | User can inspect, change, pause, and delete preferences; full page content is not long-term memory by default. |
| FR-010 | Adaptations | Adapter boundary supports text simplification, image descriptions, reader mode, tables, headings, contrast, magnification, and focus assistance. |

## Quality bar

ViAble targets WCAG 2.2 AA, semantic HTML, visible focus, 44px preferred controls, keyboard navigation, live announcements, reduced motion, scalable text, and clear recovery from error, timeout, disconnection, interruption, or ambiguous instructions.

## Current delivery slice

This repository contains a branded side-panel proof of the P0 interaction model: active page context, quick actions, conversation, voice-state transitions, mixed-language detection, language preference, privacy copy, settings, and a form-assistance approval dialog. External Gemini, ElevenLabs, DOM extraction, and Chrome message passing are intentionally represented as typed seams and local fixtures until provider credentials and a production backend are configured.
