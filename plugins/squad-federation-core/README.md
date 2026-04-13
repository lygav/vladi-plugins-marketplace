# squad-federation-core

Manage multiple permanent AI teams from a single leadership squad. Each team gets its own git worktree, agents, and accumulated knowledge. The meta-squad coordinates, monitors, and flows knowledge across teams.

> **Built on [Squad](https://github.com/bradygaster/squad).** This plugin extends Squad with multi-team orchestration. Squad provides the agent framework and casting — this plugin adds the federation layer.

## Before You Start

1. **Install [Squad](https://github.com/bradygaster/squad)** and initialize it in your project:
   ```bash
   npm install -g @bradygaster/squad-cli
   cd your-project
   git init  # if not already a git repo
   squad init
   ```

2. **Verify prerequisites:**
   - Git 2.20+ (worktree support)
   - Node.js 20+
   - Docker *(optional — for the OTel monitoring dashboard)*

3. **Install the federation plugin:**
   ```bash
   copilot plugin install squad-federation-core@vladi-plugins-marketplace
   ```
   If the marketplace isn't registered yet:
   ```bash
   copilot plugin marketplace add lygav/vladi-plugins-marketplace
   ```

## Quick Start

### First time: Set up federation + first team

Start a Copilot session and say any of these:

```
> go multi-team
> federate this project
> I need multiple teams
> @federation set up a team organization
```

The setup wizard walks you through:
1. Describe your goal
2. Pick work pattern for your first team (deliverable, coding, research, task)
3. Auto-installs the right archetype plugin
4. Configure MCP stack, telemetry, branch prefix
5. Cast your meta-squad (leadership team)
6. Onboard your first team — archetype setup wizard fine-tunes it

### Later: Add more teams

```
> spin up a team for [something]
> @federation onboard a new team
```

Each new team picks its own archetype. A coding team and a deliverable team can coexist under the same meta-squad.

### Day-to-day

```
> launch the payments team
> how are my teams doing?
> tell the frontend team to use Tailwind
> sync skills to all teams
> what did the research team learn?
> @federation aggregate results
```

> **`@federation`** — dedicated agent for multi-team operations. Use it anytime, especially if the regular Squad coordinator handles your request as single-team work instead.

> **📖 Full walkthrough:** See [EXAMPLE.md](EXAMPLE.md) — from empty project to running federated teams.

## Three-Layer Architecture

This plugin is the **Core layer** in a three-layer composition model:

```
┌────────────────────────────────────────────────────┐
│  PROJECT LAYER                                     │
│  Domain playbook skills · schemas · import hooks   │  ← Your expertise
├────────────────────────────────────────────────────┤
│  ARCHETYPE LAYER                                   │
│  Team playbook · state machine · aggregation       │  ← Work pattern (deliverable/coding/research)
│  Auto-installed: squad-archetype-deliverable       │
│                  squad-archetype-coding            │
├────────────────────────────────────────────────────┤
│  CORE LAYER (this plugin)                          │
│  Worktrees · signals · knowledge · OTel · launch   │  ← Infrastructure
└────────────────────────────────────────────────────┘
```

### What each layer owns

| Layer | Owns | Example config |
|-------|------|----------------|
| **Core** | `federate.config.json` | Branch prefix, MCP stack, telemetry, worktree location |
| **Archetype** | `.squad/archetype-config.json` (per team) | Deliverable schema, PR strategy, team playbook, state machine |
| **Project** | `.squad/` skills, schemas, import hooks | Domain-specific playbook skills, validation rules |

**Key design:** Core is **archetype-unaware**. It doesn't know what teams produce — just how to launch, monitor, and coordinate them. Archetypes define the work pattern and state machine. Your project brings domain expertise.

> **Deep dive:** [ARCHITECTURE.md](ARCHITECTURE.md) — schemas, protocols, flows, and CLI commands.

### Setup flow

```
Describe your goal → Core setup wizard
        │
        ▼
Select work pattern → Core auto-installs archetype plugin
        │
        ▼
Archetype setup wizard → fine-tune state machine, playbook, schemas
        │
        ▼
Configure MCP stack + OTel dashboard
        │
        ▼
Cast meta-squad → Squad framework handles agent creation
        │
        ▼
Onboard first team → persistent worktree, archetype state machine
        │
        ▼
Launch → headless session runs autonomously
Monitor → real-time signals + OTel traces
```

## Features

| Feature | Description |
|---------|-------------|
| **Conversational setup** | Describe your goal — *"federate this project"*, *"go multi-team"*. The wizard configures everything. |
| **`@federation` agent** | Dedicated agent for explicit multi-team control. Bypasses Squad's coordinator when needed. |
| **Three-layer architecture** | Core (infrastructure) → Archetype (work pattern) → Project (domain). Each layer owns its config. Archetypes install as plugins. |
| **Archetype state machines** | Each archetype defines its own lifecycle (e.g., deliverable: draft→validate→finalize; coding: spec→implement→review→merge). Teams transition through archetype-specific states. |
| **Persistent worktrees** | Each team gets a permanent git worktree with its own branch, agents, and accumulated knowledge. |
| **Signal protocol** | File-based IPC between meta-squad and teams. Status, directives, reports, alerts via `.squad/signals/`. |
| **Knowledge lifecycle** | Three flows: seed (main→team), sync (periodic), graduate (team→main). Cross-team pattern detection. |
| **Headless launch** | Teams run in detached Copilot sessions. Prompt resolved from archetype templates. |
| **OTel monitoring** | Copilot CLI has no built-in telemetry. This plugin bridges the gap — custom MCP server gives agents trace/metric/event/log tools. Aspire dashboard included. |
| **Marketplace discovery** | During onboarding, suggests relevant skills from installed marketplaces based on team purpose. |
| **Non-homogeneous teams** | Meta-squad manages coding, research, and deliverable teams simultaneously. |
| **Ceremonies** | Built-in coordination rituals: retro, knowledge-check, pre-task-triage. |

## Components

### Skills (auto-activated by context)

| Skill | When it activates |
|-------|-------------------|
| `federation-setup` | No config exists + user mentions federation |
| `federation-orchestration` | Config exists + user asks about managing teams |
| `inter-squad-signals` | Working with signals, status, directives |
| `knowledge-lifecycle` | Learning, syncing, graduating knowledge |
| `otel-observability` | Telemetry, traces, dashboard |

### Agents

| Agent | Purpose |
|-------|---------|
| `@federation` | Explicit entry point for all multi-team operations |
| `onboard` | Autonomous team creation |
| `sweeper` | Cross-team pattern detection |

### Core Config (`federate.config.json`)

| Field | Default | Description |
|-------|---------|-------------|
| `description` | — | What this federation is for |
| `branchPrefix` | `"squad/"` | Git branch prefix for team worktrees |
| `worktreeDir` | `"parallel"` | Where worktrees live: `"parallel"` (sibling dirs), `"inside"` (`.worktrees/`), or custom path |
| `mcpStack` | `[]` | MCP servers available to team sessions |
| `telemetry.enabled` | `true` | OTel monitoring dashboard |

That's it — 4 fields. Everything else is archetype or team-level config.

> **Scripts reference:** See [ARCHITECTURE.md](ARCHITECTURE.md) §10 for all CLI commands.

## License

MIT
