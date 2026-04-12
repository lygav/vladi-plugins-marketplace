# squad-archetype-deliverable

Archetype for **scatter-gather teams** that produce file artifacts — inventories, audit reports, compliance checks, or any structured JSON output.

## How It Works

```
Team members work in parallel → produce fragments in raw/fragments/
Lead merges fragments → deliverable.json (or configured name)
Meta-squad aggregates deliverables from all teams → unified result
```

## What's Included

| Component | Actor | Purpose |
|-----------|-------|---------|
| `skills/deliverable-playbook/` | **Team** | Playbook: discovery (scope + data sources) → analysis → deep-dives → validation → distillation. Schema evolution lifecycle. |
| `skills/deliverable-aggregation/` | **Meta-squad** | Collect, validate, and aggregate deliverables from completed teams |
| `agents/aggregator.agent.md` | **Meta-squad** | Autonomous aggregation agent |
| `scripts/aggregate.ts` | **Meta-squad** | Collects deliverables, validates against schema, runs import hook |
| `templates/launch-prompt-*.md` | **Team** | Prompt templates for first run, refresh, and reset |
| `templates/cleanup-hook.sh` | **Team** | Reset cleanup: deletes deliverable + raw/ |
| `templates/merge_fragments.py` | **Team** | Merges per-item JSON fragments into unified deliverable |

## Installation

Typically auto-installed by `squad-federation-core`'s setup wizard. Manual:

```bash
copilot plugin install squad-archetype-deliverable@vladi-plugins-marketplace
```

## Requires

- [squad-federation-core](../squad-federation-core/) — the federation plumbing layer
