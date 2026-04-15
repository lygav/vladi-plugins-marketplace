### 2026-04-15T05:48Z: User directive — Docs must update with code changes

**By:** Vladi Lyga (via Copilot)
**What:** Every PR that changes behavior, config, or public interfaces MUST include doc updates (README, ARCHITECTURE.md) in the same PR. Not a follow-up.
**Why:** Documentation drifts when updated separately. README still referenced removed features from v0.3.x.
**Impact:** Add to SDLC and enforce in reviews. "Same PR or it's not done."
