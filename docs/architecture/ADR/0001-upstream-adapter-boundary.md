# ADR 0001: Keep upstream accessibility code behind ports

## Status

Accepted

## Context

The upstream Toolkit and Extension repositories contain valuable profiles, adapters, Librarian, controller, voice, consent, and verification patterns. They are active research-oriented codebases with multiple extension surfaces and internal module boundaries.

## Decision

ViAble will integrate selectively through narrow ports for profile, skills, adaptations, audits, speech, AI, and browser execution. The first UI slice ships without vendoring upstream code. Upstream commits are documented and pinned when an implementation integration begins.

## Consequences

This adds a small amount of adapter code, but keeps the product testable, lets us swap providers, and prevents a Toolkit change from destabilising the browser UI or safety boundary.
