# squad-federation-core

**Core plumbing for federated Squad teams** — launches squads, manages worktrees, runs the knowledge lifecycle, and provides the signal protocol. Archetype-unaware by design.

## Installation

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```

## Quick Start

1. **Set up the federation** (installs core + archetype plugins automatically):

```
> set up federation
```

The `federation-setup` skill walks you through config, onboards domains, and auto-installs the archetype plugin your project needs.

2. **Onboard a team**:

```bash
npx tsx scripts/onboard.ts \
  --name "payments" \
  --team-size 3 \
  --roles "lead,analyst,sre" \
  --agents "Alpha,Beta,Gamma"
```

3. **Launch**:

```bash
npx tsx scripts/launch.ts --team payments
```

`launch.ts` resolves the prompt for the session in this order:

| Priority | Source |
|----------|--------|
| 1 | `--prompt "inline text"` flag |
| 2 | `--prompt-file path/to/file.md` flag |
| 3 | `.squad/launch-prompt.md` in the team worktree |
| 4 | Generic fallback prompt from templates |

4. **Monitor**:

```bash
npx tsx scripts/monitor.ts --watch
```

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
