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

## How It Works

```
Describe your goal → Core setup wizard
        │
        ▼
Select work pattern (archetype) → Auto-install archetype plugin
        │
        ▼
Archetype setup wizard (deliverable: filename, schema | coding: PR branch, tests)
        │
        ▼
Configure MCP stack + monitoring dashboard
        │
        ▼
Cast meta-squad (leadership team)
        │
        ▼
Onboard first team → persistent worktree, Squad casts agents
        │
        ▼
Launch → headless session runs autonomously
Monitor → real-time signals dashboard
```

Each layer owns its config:
- **Core** writes `federate.config.json` (4 fields: description, branchPrefix, mcpStack, telemetry)
- **Archetypes** write `.squad/archetype-config.json` in each team's worktree
- **Squad** handles all casting

## Creating Teams

The onboard wizard asks about the **work**, not the tech. Based on your answers, it auto-selects the right transport and location.

### The Happy Path: Code in this repo

Most teams work on the same codebase. The wizard asks:

```
> What will this team work on?
  1. Features/code in THIS repository  ← Choose this

> How should this team's work integrate?
  a. Via pull requests to main (Recommended)  ← Choose this
```

**Result:**
- **Transport:** Git worktree (automatic choice)
- **Location:** `.worktrees/{team-name}/` with branch `squad/{team-name}`
- **Integration:** Team creates PRs → you review → merge to main
- **Isolation:** Each team has its own `.squad/` directory, no conflicts

**Why worktree:**
Same repository means shared dependencies and git history. Worktree provides perfect isolation — each team works independently, no coordination overhead. PRs flow through standard git merge.

**Example:**

```
> @federation spin up a team for payment processing

What will this team work on?
  → Features/code in THIS repository

How should this team's work integrate?
  → Via pull requests to main

📋 Team Setup Summary:
   Name: payments
   Archetype: squad-archetype-coding
   Location: .worktrees/payments (branch: squad/payments)
   Transport: Worktree
   
   The team will create pull requests to main.
   
   Proceed? [Y/n]
```

### Alternative Paths

**Different codebase** — Team works on a separate repo (or external project):

```
> What will this team work on?
  2. A different codebase or external project

> Where is the project?
  a. Local path: /Users/alex/other-project
  OR
  b. Git repo URL: git@github.com:org/repo.git
```

→ **Transport:** Directory (points to that location)  
→ Team works there, meta-squad tracks via `.squad/` in that directory

---

**Research/analysis** — Team produces documents, not code:

```
> What will this team work on?
  3. Research, analysis, or document creation

> Where should outputs be stored?
  a. In a subfolder of this project (Recommended)
```

→ **Transport:** Directory  
→ Deliverables stored in team directory, meta-squad aggregates results

---

**Coordination** — Team coordinates with humans or across machines:

```
> What will this team work on?
  4. Coordination across teams or with people

> How should this team communicate?
  a. Microsoft Teams channel (Recommended if Teams available)
```

→ **Transport:** Teams channel *(v0.2.0 stretch goal)*  
→ Signals visible to humans, meta-squad + team + people all see same stream  
→ Fallback: local directory if Teams unavailable

---

### Transport Comparison

| Transport | When to use | Example |
|-----------|-------------|---------|
| **Worktree** | Same repo, multiple teams building features | Frontend team, backend team both work on monorepo |
| **Directory** | Different repo, research, analysis | Team analyzes external project, deliverable team produces JSON output |
| **Teams Channel** | Human coordination, distributed work | Architecture review team with human approvals |

**Bottom line:** The wizard handles transport selection. Just describe the work — it'll set up the right structure.

## Features

| Feature | Description |
|---------|-------------|
| **Conversational setup** | Describe your goal — *"federate this project"*, *"go multi-team"*. The wizard configures everything. |
| **`@federation` agent** | Dedicated agent for explicit multi-team control. Bypasses Squad's coordinator when needed. |
| **Persistent worktrees** | Each team gets a permanent git worktree with its own branch, agents, and accumulated knowledge. |
| **Archetype system** | Goal-specific behavior as installable plugins. Teams gain capabilities on install — like Neo downloading skills. |
| **Signal protocol** | File-based IPC between meta-squad and teams. Status, directives, reports, alerts via `.squad/signals/`. |
| **Knowledge lifecycle** | Three flows: seed (main→team), sync (periodic), graduate (team→main). Cross-team pattern detection. |
| **Headless launch** | Teams run in detached Copilot sessions. Prompt resolved from archetype templates. |
| **OTel monitoring** | Copilot CLI has no built-in telemetry. This plugin bridges the gap — custom MCP server gives agents trace/metric/event/log tools. Aspire dashboard included. |
| **Marketplace discovery** | During onboarding, suggests relevant skills from installed marketplaces based on team purpose. |
| **Non-homogeneous teams** | Meta-squad manages coding, research, and deliverable teams simultaneously. |
| **Ceremonies** | Built-in coordination rituals: retro, knowledge-check, pre-task-triage. |
| **Schema-first deliverables** | Deliverable archetype drives schema evolution from first run. Validation at aggregation. |

## Three-Layer Architecture

```
┌──────────────────────────────────────────────────┐
│  YOUR PROJECT                                    │
│  Domain playbook skill · schemas · import hooks  │
├──────────────────────────────────────────────────┤
│  ARCHETYPE PLUGIN (auto-installed)               │
│  Team playbook · meta-squad skills · templates   │
│  e.g. squad-archetype-deliverable                │
├──────────────────────────────────────────────────┤
│  squad-federation-core (this plugin)             │
│  Worktrees · signals · knowledge · OTel · launch │
└──────────────────────────────────────────────────┘
```

**Core** has zero knowledge of what teams produce. **Archetypes** define the work pattern. **Your project** provides domain expertise.

> Deep dive: **[ARCHITECTURE.md](ARCHITECTURE.md)** (schemas, protocols, flows)

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
