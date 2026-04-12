# squad-archetype-deliverable

Archetype for **scatter-gather teams** that produce file artifacts — inventories, audit reports, compliance checks, or any structured JSON output.

## How It Works

```
Team members work in parallel → produce fragments in raw/fragments/
Lead merges fragments → deliverable.json (or configured name)
Meta-squad aggregates deliverables from all teams → unified result
```

## What's Included

| Component | Purpose |
|-----------|---------|
| `skills/deliverable-playbook/` | Playbook: discovery (scope + data sources) → analysis → deep-dives → validation → distillation |
| `templates/launch-prompt-*.md` | Prompt templates for first run, refresh, and reset |
| `templates/cleanup-hook.sh` | Reset cleanup: deletes deliverable + raw/ |
| `templates/merge_fragments.py` | Merges per-item JSON fragments into unified deliverable |
| `scripts/aggregate.ts` | Collects deliverables from all team worktrees |
| `agents/aggregator.agent.md` | Autonomous aggregation agent |

## Installation

Typically auto-installed by `squad-federation-core`'s setup wizard. Manual:

```bash
copilot plugin install squad-archetype-deliverable@vladi-plugins-marketplace
```

## Requires

- [squad-federation-core](../squad-federation-core/) — the federation plumbing layer
