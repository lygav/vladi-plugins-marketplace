# squad-federated

**Federated Squad Model** — permanent per-domain expert squads with orchestration, knowledge lifecycle, OTel observability, and headless automation.

## What It Does

Transforms a single Squad team into a federation of permanent domain expert squads, each with its own git worktree, team composition, and accumulated knowledge. A central meta-squad orchestrates onboarding, coordination, and knowledge flow.

**Supports multiple squad archetypes** — not just scatter-gather:

| Archetype | Output | Example |
|-----------|--------|---------|
| `deliverable` | File artifact (JSON) | Service inventory, audit report |
| `coding` | Pull requests | Feature implementation, bug fixes |
| `research` | Design docs / PRDs | Architecture research, feasibility study |
| `task` | Status + follow-up | Migration tasks, cleanup, one-off work |

A meta-squad can manage **non-homogeneous** squads — mixing archetypes in the same federation.

```
┌─────────────────────────────────────────────┐
│              META-SQUAD (main)              │
│  Orchestrates • Aggregates • Governs        │
└────────┬──────────┬──────────┬─────────────┘
         │          │          │
    ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
    │Domain A│ │Domain B│ │Domain C│   ← Persistent worktrees
    │ Squad  │ │ Squad  │ │ Squad  │      (scan/domain-a, etc.)
    └────────┘ └────────┘ └────────┘
```

Each domain squad:
- Lives in a persistent git worktree (`scan/{domain-name}`)
- Has its own team composition and agent histories
- Accumulates deep domain knowledge across runs
- Produces a configurable deliverable (JSON output)
- Communicates with meta-squad via file-based signal protocol

## Installation

```bash
# From marketplace
copilot plugin marketplace add lygav/vladi-plugins-marketplace
copilot plugin install squad-federated@vladi-plugins-marketplace

# Or directly from GitHub
copilot plugin install lygav/vladi-plugins-marketplace:plugins/squad-federated

# Or from local path
copilot plugin install ./path/to/squad-federated
```

## Quick Start

1. **Configure** — create `federate.config.json` in your project root:

```json
{
  "domain": "my project domain",
  "deliverable": "output.json",
  "playbookSkill": "my-playbook",
  "mcpStack": ["teams", "enghub"],
  "steps": ["discovery", "analysis", "distillation"],
  "telemetry": { "enabled": true, "aspire": true }
}
```

2. **Onboard a domain squad**:

```bash
npx tsx scripts/onboard.ts \
  --name "my-product" \
  --domain-id "abc-123" \
  --team-size 4 \
  --roles "lead,data-engineer,sre,research-analyst" \
  --agents "Alpha,Beta,Gamma,Delta"
```

3. **Launch a scan**:

```bash
npx tsx scripts/launch.ts --team my-product
```

4. **Monitor progress**:

```bash
npx tsx scripts/monitor.ts --watch
```

5. **Aggregate results**:

```bash
npx tsx scripts/aggregate.ts
```

## Plugin Components

### Skills (auto-activated)

| Skill | Triggers On |
|-------|-------------|
| `federation-orchestration` | "federate", "domain squad", "meta-squad" |
| `inter-squad-signals` | "signal", "status", "inbox", "directive" |
| `knowledge-lifecycle` | "knowledge", "learning", "seed", "sync", "graduate" |
| `otel-observability` | "observability", "telemetry", "otel", "traces" |
| `federation-setup` | "set up federation", "configure federation" |

### Agents

| Agent | Purpose |
|-------|---------|
| `onboard` | Autonomous domain onboarding |
| `aggregator` | Collect and merge results |
| `sweeper` | Cross-domain pattern detection |

### Scripts

| Script | Purpose |
|--------|---------|
| `onboard.ts` | Create domain branch, worktree, squad |
| `launch.ts` | Headless Copilot session with MCP stack |
| `monitor.ts` | Status dashboard for all domains |
| `aggregate.ts` | Collect deliverables + run import hook |
| `sync-skills.ts` | Propagate skills main → domains |
| `sweep-learnings.ts` | Cross-domain pattern detection |
| `graduate-learning.ts` | Promote domain learning → main |
| `learn.ts` / `query-learnings.ts` | Learning log CLI |
| `dashboard.ts` | Aspire OTel dashboard |
| `mcp-otel-server.ts` | OTel MCP server (auto-started) |

### MCP Server

The OTel MCP server auto-starts via `.mcp.json` and provides 4 tools to agents:
- `otel_span` — trace spans for duration tracking
- `otel_metric` — counters and gauges
- `otel_event` — milestone events
- `otel_log` — structured logging

### Hooks

- **SessionStart** — detects federation context and notifies the user

## Configuration Reference

See `templates/federate.config.example.ts` for the full `FederateConfig` interface.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `domain` | string | — | Human-readable domain description |
| `archetype` | string | `"deliverable"` | Squad type: `deliverable`, `coding`, `research`, `task` |
| `deliverable` | string? | `"deliverable.json"` | Output filename (deliverable archetype only) |
| `deliverableSchema` | string? | — | JSON schema path for validation |
| `mcpStack` | string[] | `[]` | MCP servers for domain sessions |
| `playbookSkill` | string | `"domain-playbook"` | Playbook skill name |
| `steps` | string[] | varies by archetype | Playbook step names |
| `branchPrefix` | string | `"squad/"` | Git branch prefix (matches script defaults) |
| `telemetry.enabled` | boolean | `true` | OTel observability |
| `importHook` | string? | — | Custom import script (deliverable only) |
| `completionHook` | string? | — | Script run when a squad completes |

## Architecture

The federation system has three layers:

### Core plugin (`squad-federated`) — domain-agnostic machinery
- Federation orchestration: onboard, launch, monitor
- Knowledge lifecycle: seed, sync, sweep, graduate, learning log
- Signal protocol: status.json, inbox/outbox IPC
- Ceremony templates: retro, knowledge-check, pre-task-triage
- OTel observability: MCP server, Aspire dashboard

### Archetype plugins (middle layer) — work-pattern specific
Archetypes define how a squad operates and what it produces. They are auto-installed by the setup wizard (Step 1.6).

| Plugin | Archetype | Output |
|--------|-----------|--------|
| `squad-archetype-deliverable` | deliverable | File artifact — includes aggregation agent + scripts |
| `squad-archetype-coding` | coding | Pull requests |

### What stays in YOUR project (domain-specific)
- Your playbook skill (the domain-specific workflow)
- Your deliverable schema
- Your import/triage hooks
- Your seed skills (domain expertise)
- Your UI or reporting tools

## Knowledge Lifecycle

```
SEED (onboard)        SYNC (periodic)       GRADUATE (review)
main → domain         main → domain         domain → main
skills, schema        updated skills        discovered pattern
at creation time      via sync-skills.ts    via graduate-learning.ts
```

## Signal Protocol

Domain squads communicate with meta-squad via the filesystem:
- `.squad/signals/status.json` — current progress
- `.squad/signals/inbox/` — directives from meta-squad
- `.squad/signals/outbox/` — reports from domain squad

## License

MIT
