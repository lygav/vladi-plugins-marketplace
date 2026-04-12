# squad-federation-core

**Core plumbing for federated Squad teams** — launches squads, manages worktrees, runs the knowledge lifecycle, and provides the signal protocol. Archetype-unaware by design.

> **Built on [Squad](https://github.com/bradygaster/squad).** This plugin extends Squad with federation capabilities. Squad must be installed in your project (`squad init`) before using federation. The `squad.agent.md` coordinator, casting system, and agent framework are provided by Squad — this plugin adds the multi-team orchestration layer on top.

## Prerequisites

- **[Squad](https://github.com/bradygaster/squad)** — installed in your project (`squad init` or `squad init --sdk`)
- **Git 2.20+** — worktree support
- **Node.js 20+** — scripts runtime
- **Docker** *(optional)* — for Aspire OTel dashboard

## Installation

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```

## Features

| Feature | Description |
|---------|-------------|
| **Conversational setup** | Describe your goal in natural language. The setup skill configures everything — meta-squad, archetypes, config. |
| **Persistent team worktrees** | Each team gets a permanent git worktree with its own branch, agents, and accumulated knowledge. |
| **Archetype system** | Install goal-specific behavior (deliverable, coding, research) as plugins. Teams learn new capabilities on install — like Neo downloading skills. |
| **Signal protocol** | File-based IPC between meta-squad and teams. Status tracking, directives, reports, alerts — all via `.squad/signals/`. |
| **Knowledge lifecycle** | Learnings flow three ways: seed (main→team), sync (periodic), graduate (team→main). Cross-team pattern detection included. |
| **Headless launch** | Spin up teams in detached Copilot sessions with configurable MCP stacks. Prompt resolution from archetype templates. |
| **OTel observability** | Copilot CLI has no built-in telemetry. This plugin bridges the gap with a custom MCP server that gives agents span, metric, event, and log tools — making headless sessions observable. Aspire dashboard included. |
| **Marketplace skill discovery** | During onboarding, browses installed marketplaces for skills matching the team's domain. Suggests and installs on approval. |
| **Non-homogeneous federation** | Meta-squad can manage coding teams, research teams, and deliverable teams simultaneously — each with its own archetype. |
| **Ceremony templates** | Built-in coordination rituals: task-retro, knowledge-check, pre-task-triage. Trigger automatically based on state. |
| **Monitoring dashboard** | Real-time status of all teams — state, current step, progress, staleness. Watch mode with configurable interval. |
| **Schema-first deliverables** | Deliverable archetype drives schema evolution from first run. Validation at aggregation time. Schema becomes institutional knowledge. |

## Quick Start

Install the plugin, start a Copilot session, and describe your goal:

```
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```

```
> I want to set up a team organization for [your goal]
```

The `federation-setup` skill handles everything conversationally:
1. Asks about your domain and work pattern
2. Auto-installs the right archetype plugin
3. Generates `federate.config.json`
4. Casts your meta-squad
5. Offers to onboard your first team

From there, use natural language to manage your federation:
- *"Spin off a backend team for the payments service"*
- *"Launch the payments team"*
- *"How are my teams doing?"*
- *"Sync skills to all teams"*

> **Power users:** All operations are also available as scripts (`scripts/onboard.ts`, `scripts/launch.ts`, `scripts/monitor.ts`, etc.). See [ARCHITECTURE.md](ARCHITECTURE.md) §10 for CLI reference.

> **📖 Full walkthrough:** See [EXAMPLE.md](EXAMPLE.md) for a complete end-to-end example — from empty project to running federated teams.

## Three-Layer Architecture

```
┌──────────────────────────────────────────────────┐
│  YOUR PROJECT (top layer)                        │
│  Domain skills · schemas · hooks · UI            │
├──────────────────────────────────────────────────┤
│  ARCHETYPE PLUGIN (middle layer)                 │
│  Goal-specific behavior, agents, scripts         │
│  e.g. squad-archetype-deliverable                │
├──────────────────────────────────────────────────┤
│  squad-federation-core (this plugin)             │
│  Pure plumbing — launch, onboard, signals, know- │
│  ledge lifecycle, observability, templates        │
└──────────────────────────────────────────────────┘
```

### Core plugin (this) — pure plumbing

The core plugin has **zero knowledge of what a squad produces**. It provides:

- Federation orchestration: onboard, launch, monitor
- Knowledge lifecycle: seed, sync, sweep, graduate
- Signal protocol: `status.json`, inbox/outbox IPC
- Prompt templates & ceremony templates
- OTel observability (MCP server + Aspire dashboard)

There is **no `aggregate.ts`** and **no aggregator agent** in core — those are archetype-specific (the deliverable archetype provides them).

### Archetype plugins (middle layer) — goal-specific behavior

Archetypes define *how* a squad works and *what* it produces. They are **auto-installed by the `federation-setup` skill** — you don't install them manually.

| Plugin | Archetype | Adds |
|--------|-----------|------|
| `squad-archetype-deliverable` | deliverable | Aggregator agent, `aggregate.ts`, JSON output |
| `squad-archetype-coding` | coding | PR workflow, review agents |

### Your project (top layer) — domain expertise

- Playbook skill (your domain-specific workflow)
- Deliverable schema & import hooks
- Seed skills (domain expertise)
- UI, reporting, or custom tooling

> For a deep dive into how the layers compose at runtime, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Components

### Skills

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
| `sweeper` | Cross-domain pattern detection |

### Scripts

| Script | Purpose |
|--------|---------|
| `onboard.ts` | Create team branch, worktree, squad |
| `launch.ts` | Headless Copilot session (`--team`, prompt resolution) |
| `monitor.ts` | Status dashboard for all teams |
| `sync-skills.ts` | Propagate skills main → team worktrees |
| `sweep-learnings.ts` | Cross-domain pattern detection |
| `graduate-learning.ts` | Promote team learning → main |
| `learn.ts` / `query-learnings.ts` | Learning log CLI |
| `dashboard.ts` | Aspire OTel dashboard |
| `mcp-otel-server.ts` | OTel MCP server (auto-started) |

### MCP Server

The OTel MCP server auto-starts via `.mcp.json` and exposes:

- `otel_span` — trace spans
- `otel_metric` — counters and gauges
- `otel_event` — milestone events
- `otel_log` — structured logging

## Configuration

See `templates/federate.config.example.ts` for the full `FederateConfig` interface.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `domain` | string | — | Human-readable domain description |
| `archetype` | string | `"deliverable"` | Squad archetype (selects middle-layer plugin) |
| `mcpStack` | string[] | `[]` | MCP servers for team sessions |
| `playbookSkill` | string | `"domain-playbook"` | Playbook skill name |
| `steps` | string[] | varies | Playbook step names |
| `branchPrefix` | string | `"squad/"` | Git branch prefix |
| `telemetry.enabled` | boolean | `true` | OTel observability |
| `completionHook` | string? | — | Script run when a squad completes |

## License

MIT
