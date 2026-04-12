# Domain Worktree

This branch is a **permanent domain expert squad** worktree managed by the federated squad model.

## Squad Archetypes

Domain squads come in different shapes depending on the work:

| Archetype | Output | Completion Criteria |
|-----------|--------|---------------------|
| **Deliverable** | JSON/file artifact | File produced, aggregated by meta-squad |
| **Coding** | Pull request(s) | PR opened/merged |
| **Research** | Design doc, PRD, ADR | Document written and approved |
| **Task** | Work items completed | Status updated, follow-up requested |

Your squad's archetype is configured in `federate.config.json` at the project root. Mixed federations (non-homogeneous) are supported — the meta-squad can manage squads of different archetypes.

## File Structure

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

# — Archetype-specific files (vary by squad type) —

# Deliverable squads:
deliverable.json        # Output artifact (name configurable)
raw/                    # Working data collected during analysis
  fragments/            # Per-item fragments produced by agents

# Coding squads:
# (output is PRs — no local deliverable)

# Research squads:
docs/                   # Design docs, PRDs, ADRs
```

## How It Works

### For Deliverable Squads (scatter-gather)
1. Squad analyzes the domain, agents produce fragments in `raw/fragments/`
2. Lead merges fragments into the deliverable (`merge_fragments.py` or manual)
3. Meta-squad aggregator reads the deliverable via `git show`

### For Coding Squads
1. Squad receives task description via launch prompt or inbox directive
2. Agents implement changes, write tests, open PR(s)
3. Completion = PR opened. Meta-squad tracks PR status.

### For Research Squads
1. Squad receives research question or design brief
2. Agents investigate, draft documents
3. Completion = document written. Meta-squad reviews and approves.

### For Any Squad — Universal Mechanics
- **Signals:** All squads write `status.json` and use inbox/outbox
- **Learnings:** All squads maintain a learning log
- **Ceremonies:** Retro, knowledge-check, triage apply to all archetypes
- **Knowledge:** Seed/sync/graduate flows work regardless of archetype

## Re-running (Delta Mode)

When re-launched on an existing worktree:
- The squad reads prior state (deliverable, docs, history)
- Focuses on **what changed** rather than rebuilding from scratch
- Agent histories and learning log survive resets

## Meta-Squad Coordination

The meta-squad does NOT need homogeneous squads. It can manage:
- Squad A producing a deliverable (inventory)
- Squad B coding a feature (PR)
- Squad C researching architecture (design doc)

Each reports status via the same signal protocol. The meta-squad reads status and sends directives regardless of archetype.
