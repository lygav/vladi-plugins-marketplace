---
agent: mal
role: Lead, Architecture & Code Review
model: claude-sonnet-4.5 (opus-4.6 for user-facing docs review)
updated: 2025-07-14
---

# mal — History

## Three-Pass Review
Structure → Accuracy → Verification. Each pass catches different defect classes.
- Opus for user-facing docs (catches accuracy issues Sonnet/Haiku miss).
- Sonnet for code review (fast, focused).

## ADR-001 — Script-Drives-Skill
- "Scripts are functions. Skills are wrappers. If logic can be in the script, it MUST be in the script."
- Testable, deterministic scripts. Error handling is structured JSON, not LLM interpretation.

## Interface Factory Design ⚠️
Factory method params must be UNIVERSAL across ALL implementations.
Never add adapter-specific params to generic factory signatures.

## ACP Review Lessons (v0.8.0)
- **Timer leaks:** Any `setInterval`/`setTimeout` must have a corresponding cleanup path.
  Status-publisher must clear its timer on dispose; missing cleanup = leaked interval.
- **Watermark safety:** Presence writes must check a freshness watermark before publishing.
  Stale agent overwriting a newer status = data loss. Last-write-wins needs a guard.
- **Dead-process detection:** Presence TTL alone is insufficient. A crashed agent leaves
  stale "Available" status. Require an expiry heartbeat *in the data*, not just a timer.
- **Regex injection:** User-supplied domain IDs flow into status messages. If those are
  ever used in regex or template interpolation, sanitize first.

## SDLC Rules
1. Docs with code — same PR, not follow-up.
2. No backward compat pre-1.0 — breaking changes OK.
3. Zod schemas are authoritative.
4. Bootstrap must be idempotent.
5. Attribution trailers on all commits.

