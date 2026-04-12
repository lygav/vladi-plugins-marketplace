# Team Worktree

This branch is a **permanent team worktree** managed by the federated squad model. It persists across sessions — agent histories, learnings, and domain context survive resets and re-launches.

## What Goes Here

`DOMAIN_CONTEXT.md` at the worktree root describes this team's mission, boundaries, and key domain knowledge. It is the first thing the squad reads on every session.

If an **archetype** is installed (deliverable, coding, research, task), it provides the team's playbook — work pattern, steps, completion criteria, and any hooks. Archetype config lives at `.squad/archetype.yaml` inside this worktree, not in the federation-level config.

## .squad/ Structure

```
.squad/                 # Team state (managed automatically)
  team.md               # Current team composition
  signals/              # Inter-squad communication
    status.json         # Current phase and progress
    inbox/              # Directives from meta-squad
    outbox/             # Reports to meta-squad
  learnings/
    log.jsonl           # Accumulated learning log
  agents/               # Agent charters and histories
  skills/               # Inherited + domain-specific skills
  ceremonies.md         # Coordination ceremonies
  archetype.yaml        # Archetype config (when installed)
```

## Core Mechanics

### Signals
Every team writes `status.json` and communicates through `inbox/` (directives from meta-squad) and `outbox/` (reports back). This is the universal coordination protocol — it works the same regardless of what the team produces.

### Knowledge Flow
- **Seed:** Teams inherit shared knowledge at creation
- **Sync:** Cross-team learnings propagate during ceremonies
- **Graduate:** Proven learnings promote to the shared knowledge base

### Ceremonies
- **Retro:** Reflect on what worked and what didn't
- **Knowledge-check:** Surface and share new learnings
- **Triage:** Re-prioritize based on new signals

### Delta Mode
When re-launched on an existing worktree, the squad reads prior state and focuses on **what changed** rather than rebuilding from scratch.
