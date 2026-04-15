# squad-archetype-deliverable

Archetype for **scatter-gather teams** that produce file artifacts — inventories, audit reports, compliance checks, or any structured JSON output.

## Structure

This archetype follows the **meta/team split pattern**:

```
squad-archetype-deliverable/
├── archetype.json           # Top-level manifest declaring meta/team structure
├── plugin.json              # Plugin metadata with meta/team sections
├── README.md                # This file
├── meta/                    # Meta-squad orchestration
│   ├── skills/
│   │   ├── deliverable-setup/        # Setup wizard (meta runs this)
│   │   └── deliverable-aggregation/  # Aggregation (meta collects results)
│   ├── agents/
│   │   └── aggregator.agent.md       # Autonomous aggregation agent
│   └── scripts/
│       └── aggregate.ts              # Aggregation script
└── team/                    # Domain team execution
    ├── archetype.json       # Team-level archetype metadata with state machine
    ├── skills/
    │   └── deliverable-playbook/     # Playbook teams follow
    └── templates/
        ├── launch-prompt-first.md
        ├── launch-prompt-refresh.md
        ├── launch-prompt-reset.md
        ├── cleanup-hook.sh
        └── merge_fragments.py
```

## How It Works

```
Team members work in parallel → produce fragments in raw/fragments/
Lead merges fragments → deliverable.json (or configured name)
Meta-squad aggregates deliverables from all teams → unified result
```

## Components

### Meta-Squad (Orchestration)

| Component | Purpose |
|-----------|---------|
| `meta/skills/deliverable-setup/` | Setup wizard — meta-squad runs this to configure all teams |
| `meta/skills/deliverable-aggregation/` | Collect, validate, and aggregate deliverables from completed teams |
| `meta/agents/aggregator.agent.md` | Autonomous aggregation agent |
| `meta/scripts/aggregate.ts` | Collects deliverables, validates against schema, runs import hook |

### Domain Teams (Execution)

| Component | Purpose |
|-----------|---------|
| `team/skills/deliverable-playbook/` | Playbook: discovery (scope + data sources) → analysis → deep-dives → validation → distillation. Schema evolution lifecycle. |
| `team/templates/launch-prompt-*.md` | Prompt templates for first run, refresh, and reset |
| `team/templates/cleanup-hook.sh` | Reset cleanup: deletes deliverable + raw/ |
| `team/templates/merge_fragments.py` | Merges per-item JSON fragments into unified deliverable |

## Installation

Typically auto-installed by `squad-federation-core`'s setup wizard. Manual:

```bash
copilot plugin install squad-archetype-deliverable@vladi-plugins-marketplace
```

## Requires

- [squad-federation-core](../squad-federation-core/) — the federation plumbing layer (>=0.7.0)

