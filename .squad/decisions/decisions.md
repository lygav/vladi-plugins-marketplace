# Architecture Decisions Log

## ADR-001: Script-Drives-Skill Inversion

**Date:** 2025-07-22
**Status:** Proposed — awaiting Vladi's decision
**Author:** Mal (Lead)
**Requested by:** Vladi Lyga

---

### Context

Vladi identified a fundamental architectural tension: our skills (conversational LLM layer) currently orchestrate scripts (mechanical layer). This creates non-determinism, untestability, and duplicated logic. The proposal is to invert this: scripts drive the flow deterministically, and skills become thin input/output wrappers.

### Full Analysis

See: `.squad/decisions/adr-001-script-drives-skill.md`

### Decision

**RECOMMEND: Yes, do it. Start with team-onboarding → onboard.ts as the pilot.**

The evidence from the codebase strongly supports inversion. The skill duplicates decision logic already in the script, the skill is untestable, and the script is already 90% self-sufficient.

### Consequences

- Skills shrink from orchestrators to parameter-extractors
- Scripts become the single source of truth for flow logic
- End-to-end testing becomes possible without LLM in the loop
- Issue #155 (automation blocking) resolved by design
- Issue #154 (param drift) eliminated — script CLI is the contract
