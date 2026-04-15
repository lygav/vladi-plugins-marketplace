---
agent: mal
role: Lead, Architecture & Code Review
model: claude-sonnet-4.5 (opus-4.6 for user-facing docs review)
updated: 2025-04-15
---

# mal's History

## Role & Responsibilities
- Architecture decisions and system design
- Code review for SDK, libs, and scripts
- Interface design and API contracts
- SDLC enforcement
- Docs quality review (use opus for shipped content)

## Architecture Knowledge

### Core Abstractions (v0.5.0)
- **Placement/Communication separation** — Placement (per-team) vs Communication (federation-scoped)
- **Adapter registry pattern** — PlacementRegistry, CommunicationRegistry enable extensible transports
- **TeamRegistry** — Single source of truth for team enumeration
- **7 production modules** in scripts/lib/: placement, communication, registry, knowledge, orchestration, config, telemetry

### Interface Factory Design ⚠️
Critical review rule: Factory method params must be UNIVERSAL across ALL implementations. Never add adapter-specific params to generic factory signatures. Use separate factory methods or generics for custom config.

## SDLC Rules
1. **Docs with code** — Doc updates in same PR as code changes (not follow-up)
2. **No backward compat pre-1.0** — Breaking changes OK, teams re-initialize
3. **Zod schemas are authoritative** — Not TypeScript types
4. **Bootstrap must be idempotent**
5. **Attribution trailers** — Co-authored-by in all commits

## Attribution Format
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Docs Review Lessons (v0.5.0 Session)

**Finding:** When docs quality matters for shipped content, use claude-opus-4.6 for review. Opus catches content accuracy issues (wrong archetype names, stale command references, broken links) that Sonnet and Haiku miss. The cost is worth it for user-facing docs.

**Pattern:** Three-pass review (structure → accuracy → verification) caught different types of issues at each pass. Don't combine these into one pass.

**Applied to:** Astro docs rewrite — opus caught 3 archetype name mismatches and 2 base-path link issues that structure-only pass missed.

## Session Learnings — 2026-04-15

**Architecture root causes:**
- Package boundary (single root package.json) is the fix for ESM import bugs, not path configuration. Adoption of unified package structure eliminated entire class of module resolution errors.
- Transport/Placement separation validates the clean interface philosophy — each has one job, adapters slot in cleanly, no cross-concerns.

**Code review calibration:**
- Fast models (Sonnet/Haiku) miss accuracy issues in shipped docs. Always use opus for user-facing content review.
- PR #97 gap: Caught post-merge that `createCommunication` took `TeamPlacement` as universal param, but it's adapter-specific. Need stricter factory-param validation rules during structural review.
- Three-pass review pattern (structure + accuracy + verification) catches different defect classes. Combining passes loses signal.

**SDLC enforcement:**
- Docs-with-code rule prevents review friction and ensures consistency. Missing: marketplace.json updates in version-bump PRs.
- v0.x means breaking changes are acceptable — teams re-initialize, no migration burden. Simplifies schema evolution.
- No historical docs — only current state. Describe conversational flows, not CLI mechanics.

**Docs & comms:**
- Astro Starlight + Obsidian theme reduced friction between local editing and deployed view. Conversational skill descriptions (not steps) improve clarity.

## Session Summary — 2026-04-15 (v0.6.0)

**ADR-001 — Script-Drives-Skill approved:**
- Rule: "Scripts are functions. Skills are wrappers. If logic can be in the script, it MUST be in the script."
- Rationale: Testable, deterministic scripts. Error handling is structured JSON, not LLM interpretation.
- Execution plan: #159 (onboarding inversion) → #160 (setup.ts creation) → #161 (audit all flows)
- APPROVED but NOT YET EXECUTED. Ready for next session.

**Review quality lessons:**
- PR #97 lesson reinforced: Factory methods must have universal params across ALL implementations. Caught `createCommunication(placement)` coupling post-merge.
- Opus catches content accuracy issues (wrong archetype names, stale references) that haiku misses. Worth the cost for user-facing docs.
- Three-pass review pattern (structure → accuracy → verification) essential for quality. Each pass catches different defect types.

**SDLC gaps identified:**
- Version-bump checklist needs marketplace.json enforcement
- No migration burden in pre-1.0 — breaking changes are acceptable, teams re-initialize
- Docs-with-code working well — prevents drift, reduces review friction

