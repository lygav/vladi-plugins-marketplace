---
title: Design Decisions
description: Key architectural choices and their rationale
---

# Design Decisions

This page documents significant architectural decisions in squad-federation-core with rationale and trade-offs.

## Archetype-Specific State Machines

**Decision:** Archetypes declare their own lifecycle state machines in `archetype.json`. Core validates state transitions at runtime but never interprets state semantics.

**Problem:** Generic states (`preparing`, `working`, `complete`, `failed`) are too coarse for meaningful monitoring — "working" could mean anything. Different work patterns have fundamentally different progression models.

**Solution:** Each archetype declares its states:

```json
"states": {
  "lifecycle": ["preparing", "scanning", "distilling", "aggregating"],
  "terminal": ["complete", "failed"],
  "pauseable": true
}
```

Core reads the schema at domain launch and validates each `status.json` write. `ScanStatus.state` is a `string` (not an enum) — archetypes define the valid values.

**Trade-offs:**
- **Gain:** Archetype-specific lifecycles match real work patterns, better observability
- **Cost:** Monitor code becomes archetype-aware (more complex rendering)
- **Verdict:** Worth it — monitoring complexity is centralized in one place, benefits distributed across all teams

**Architecture fit:** Strengthens three-layer separation via Dependency Inversion — both core and archetype layers depend on the `states` schema abstraction, not on each other.

## Placement / Communication Split

**Decision:** Team location (`TeamPlacement`) and communication protocol (`TeamCommunication`) are independent, composable abstractions.

**Problem:** Prior design force-fit communication adapters with unnecessary placement parameters. `FileSignalCommunication` didn't need placement info but the signature included it.

**Solution:** Two separate interfaces composed by a context factory:
- `TeamPlacement` — WHERE teams live (worktree, directory, cloud)
- `TeamCommunication` — HOW teams exchange signals (file-based by default; extensible via adapter registry)
- `createTeamContext()` composes them per team

**Benefits:**
- Different teams can live in different places while using the same communication protocol
- Same team can migrate communication protocol without changing placement
- New adapters implement only `TeamCommunication`, not placement

## No-Merge-Back Principle

**Decision:** Domain branches never merge back to main.

**Problem:** Merge conflicts between domain branches and main would create coordination overhead. Domain-specific content (learnings, signals, deliverables) should not pollute the main branch.

**Solution:** Knowledge flows through explicit channels:
- Graduation proposals (domain learning → main skill)
- Signal outbox reports (meta reads from domain)
- Cross-read via `git show` (read-only)

Main reads FROM domain branches. Domains receive skill updates via cherry-pick sync.

## Start Empty, Add What's Needed

**Decision:** Onboarding creates minimal bootstrap, not kitchen-sink template.

**Problem:** Heavyweight templates with many pre-created files are confusing. Teams don't understand what files do, and archetypes evolve faster than templates can be migrated.

**Solution:** Base structure is minimal:
```
.squad/
├── signals/inbox/
├── signals/outbox/
└── learnings/
```

Archetypes add only what they need. Teams understand what they have (no mystery files), and archetypes evolve without migrating old scaffolding.

## Dynamic Archetype Discovery

**Decision:** Archetypes are auto-discovered at runtime from `marketplace.json` + filesystem, not hardcoded.

**Problem:** Hardcoded archetype lists require core changes for every new archetype — violates Open/Closed principle.

**Solution:**
- `marketplace.json` — npm packages declared in dependencies
- Filesystem — `plugins/*/plugin.json` with `"archetype"` type
- No hardcoded archetype list in core

## Two-Mode Onboarding

**Decision:** Onboarding supports both conversational (interactive wizard) and mechanical (autonomous CLI) modes.

**Problem:** Interactive-only onboarding blocks automation. CLI-only onboarding is poor UX for humans.

**Solution:**
- **Conversational:** Wizard asks questions, infers archetype and placement from answers
- **Mechanical:** Given archetype + config → autonomous setup (used by archetype creators, CI/CD, mass provisioning)

## Related Pages

- [Architecture Overview](/vladi-plugins-marketplace/reference/architecture) — Three-layer design
- [Archetype System](/vladi-plugins-marketplace/reference/archetype-system) — State machines and meta/team split
