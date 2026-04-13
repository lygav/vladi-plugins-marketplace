# squad-federation-core — Architecture

**Author:** Ripley (Lead Architect)
**Version:** 0.1.0
**Status:** Shipped

---

## 1. System Overview

squad-federation-core is a Copilot plugin that implements a federated multi-team model.
A **meta-squad** on the main branch orchestrates N permanent **domain squads**, each
living on a dedicated git branch in a persistent worktree. Domain squads accumulate
expertise, run autonomously in headless sessions, and communicate via file-based signals.

### Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  CORE LAYER — squad-federation-core plugin                         │
│                                                                      │
│  Git worktree lifecycle · Signal protocol · Learning log             │
│  Launch mechanics · OTel MCP server · Skill sync engine              │
│  Ceremony definitions · Monitoring dashboard                         │
│                                                                      │
│  Domain-agnostic. Knows nothing about what squads DO — only how      │
│  they are created, communicate, observe, and share knowledge.        │
├──────────────────────────────────────────────────────────────────────┤
│  ARCHETYPE LAYER — e.g. squad-archetype-inventory                  │
│                                                                      │
│  Prompt templates · Playbook skills · Deliverable schemas            │
│  Cleanup hooks · Domain-specific ceremonies                          │
│                                                                      │
│  Defines the WORK PATTERN for a class of squads. Installed into      │
│  worktrees during onboarding. Multiple archetypes can coexist in     │
│  a single federation.                                                │
├──────────────────────────────────────────────────────────────────────┤
│  PROJECT LAYER — your repository                                   │
│                                                                      │
│  federate.config.json · DOMAIN_CONTEXT.md per team                   │
│  Project-specific MCP servers · Custom skills                        │
│                                                                      │
│  Binds the federation to a concrete codebase and problem domain.     │
└──────────────────────────────────────────────────────────────────────┘
```

### Runtime Topology

```
~/project/ (main branch — meta-squad)
├── .squad/skills/              ← authoritative skills
├── .squad/learnings/log.jsonl  ← cross-cutting patterns
├── federate.config.json        ← federation plumbing config
│
├── project-team-alpha/         ← persistent worktree → squad/team-alpha
│   ├── .squad/
│   │   ├── signals/            ← IPC with meta-squad
│   │   ├── learnings/          ← domain-specific discoveries
│   │   └── skills/             ← synced from main + local extensions
│   └── DOMAIN_CONTEXT.md
│
├── project-team-beta/          ← persistent worktree → squad/team-beta
│   └── (same structure)
│
└── project-team-gamma/         ← persistent worktree → squad/team-gamma
    └── (same structure)
```

---

## 2. Git Mechanics

### Branch Naming

All domain branches follow the pattern `{branchPrefix}{team-name}`. The default
prefix is `squad/`, configurable via `federate.config.json`.

```
main                        ← meta-squad: skills, aggregation, governance
squad/team-alpha             ← permanent domain branch
squad/team-beta              ← permanent domain branch
squad/team-gamma             ← permanent domain branch
```

### Worktree Lifecycle

**Creation** — during `onboard.ts`:

```bash
git branch squad/team-alpha main
git worktree add ~/project-team-alpha squad/team-alpha
```

The worktree directory is named `{repoName}-{teamName}`, placed as a sibling
of the main repository directory.

**Discovery** — `discoverDomains()` in `signals.ts`:

```bash
git worktree list --porcelain
```

Parses output for branches matching `{branchPrefix}*`. Returns an array of
`DomainWorktree` objects:

```typescript
interface DomainWorktree {
  domain: string;    // "team-alpha"
  branch: string;    // "squad/team-alpha"
  path: string;      // "/home/user/project-team-alpha"
}
```

**Validation** — `validateWorktree()` checks for:
- Worktree path exists on disk
- `.squad/team.md` present (squad initialized)
- `.squad/signals/` directory present (signal protocol initialized)

**Removal** — manual (domain squads are permanent by design):

```bash
git worktree remove ~/project-team-alpha
git branch -D squad/team-alpha
```

### No-Merge-Back Principle

Domain branches **never** merge back to main. Knowledge flows via:
- Graduation proposals (domain → main learning log → main skill)
- Signal outbox reports (meta-squad reads)
- `git show squad/team-alpha:.squad/learnings/log.jsonl` (cross-read)

The main branch reads FROM domain branches. Domain branches receive skill
updates via cherry-pick sync, never via `git merge main`.

### Isolation Model

Each worktree has a complete, independent `.squad/` directory:
- **Skills** — seeded from main at creation, synced periodically
- **Learnings** — independent append-only log per domain
- **Signals** — independent inbox/outbox/status per domain
- **Agents** — independently cast team per domain
- **Decisions** — independent decision log per domain

Worktrees share the git object store (disk-efficient) but have fully
independent working directories. Multiple domain sessions run concurrently
with zero coordination overhead.

---

## 3. Signal Protocol

File-based IPC for meta-squad ↔ domain squad communication. Designed for
headless orchestration where domain squads run in detached Copilot sessions.

### File Layout

```
.squad/signals/
├── status.json         ← current state of the domain squad
├── inbox/              ← messages FROM meta-squad TO this domain
│   └── {timestamp}-{type}-{subject}.json
└── outbox/             ← messages FROM this domain TO meta-squad
    └── {timestamp}-{type}-{subject}.json
```

### ScanStatus Interface

```typescript
interface ScanStatus {
  domain: string;          // "team-alpha"
  domain_id: string;       // external identifier (project ID, etc.)
  state: string;           // archetype-specific state string (validated at runtime)
  step: string;            // current step description (free-form)
  started_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601, auto-set on every write
  completed_at?: string;   // ISO 8601, set when terminal state reached
  progress_pct?: number;   // 0-100, optional progress indicator
  error?: string;          // error description when state == failed
  agent_active?: string;   // name of currently active agent
}
```

**Archetype-Specific State Machines**

The `state` field is a string validated against the archetype's declared state
schema in `archetype.json`. Core validates but never interprets state semantics —
archetypes own their lifecycle definitions.

**Validation mechanism:**
- Core reads `states` schema from `.squad/archetype.json` in the worktree
- Validates state transitions: state must be in `lifecycle` or `terminal` array
- Falls back to generic defaults if no schema exists (backward compatible)
- See §7 for archetype.json schema details

**Example state progressions by archetype:**

**Deliverable Archetype:**
```
preparing → scanning → distilling → aggregating → reviewing → complete/failed
```

**Coding Archetype:**
```
preparing → implementing → testing → pr-open → pr-review → pr-approved → merged → complete/failed
```

**Pipeline Archetype (ETL):**
```
preparing → extracting → transforming → loading → validating → complete/failed
```

**Research Archetype:**
```
preparing → exploring → synthesizing → validating → documenting → complete/failed
```

**Pauseable states:** If `pauseable: true` in the archetype schema, teams can
transition to `paused` from any lifecycle state and resume later.

### SignalMessage Interface

```typescript
interface SignalMessage {
  id: string;              // UUID v4
  ts: string;              // ISO 8601
  from: string;            // "meta-squad" or domain name
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;         // short summary
  body: string;            // full message content
  acknowledged?: boolean;  // set to true when receiver processes it
  acknowledged_at?: string; // ISO 8601
}
```

**Message types:**

| Type | Direction | Purpose |
|------|-----------|---------|
| `directive` | meta → domain | Instructions, priorities, focus areas |
| `question` | domain → meta | Requests for guidance or information |
| `report` | domain → meta | Status updates, findings, deliverables |
| `alert` | either | Urgent issues requiring attention |

### Message File Naming

Files are named for chronological sorting and human readability:

```
{ISO-timestamp}-{type}-{truncated-subject}.json
```

Example: `2025-07-20T14-30-00-000Z-directive-focus-on-api-layer.json`

Timestamp colons and dots are replaced with hyphens. Subject is kebab-cased
and truncated to 40 characters.

### Message Lifecycle

```
1. WRITE:  sendMessage() creates file in inbox/ or outbox/
           (meta-squad writes → inbox/; domain writes → outbox/)
           Assigns UUID and timestamp automatically.

2. READ:   readMessages() lists all .json files in the box, sorted by name.
           Returns parsed SignalMessage array.

3. ACK:    acknowledgeMessage() finds message by ID, sets
           acknowledged=true and acknowledged_at timestamp.
           File is updated in-place (not moved or deleted).
```

Messages are persistent. Acknowledged messages remain in their directory
as an audit trail. Ceremonies (knowledge-check) process and acknowledge
pending inbox messages.

---

## 4. Knowledge Lifecycle

### Overview — Three Flows

```
                    ┌────────────────────────┐
                    │   META-SQUAD (main)    │
                    │                        │
                    │  skills/  ← authority  │
                    │  learnings/log.jsonl   │
                    │                        │
                    └──┬───────────┬─────────┘
          SEED (1)     │           │    SYNC (2)
          (branch      │           │    (push updated
           create)     │           │     skills)
                       │           │
                  ┌────▼──┐   ┌───▼───┐
                  │Team-A │   │Team-B │   ...N domain squads
                  │       │   │       │
                  │skills/ │   │skills/ │
                  │learn/  │   │learn/  │
                  └───┬────┘   └───┬───┘
                      │            │
                      └─────┬──────┘
                    GRADUATE (3)
                    (learning → main skill)
```

### Flow 1: Seed (main → new team at onboarding)

**When:** `onboard.ts` creates a new domain squad.

**What seeds:**
- Git branch inherits all `.squad/skills/` from main
- Empty `.squad/learnings/log.jsonl` (zero entries)
- Signal protocol directories (inbox/, outbox/, status.json)
- Ceremony definitions (`.squad/ceremonies.md`)
- Telemetry config (`.squad/telemetry.json`)
- Domain context (`DOMAIN_CONTEXT.md`)

**Mechanism:** `git branch squad/team-alpha main` inherits main's `.squad/`
content. `onboard.ts` then scaffolds federation-specific directories on top.

**What does NOT seed:** Agent histories (created fresh), domain-specific
skills (don't exist yet), learning log entries (start empty).

### Flow 2: Sync (main → existing teams via sync-skills.ts)

**When:** After meta-squad updates a skill on main.

**Mechanism:** `sync-skills.ts` discovers all `squad/*` branches, checks out
updated skill files from `origin/main` into each worktree, commits the update,
and records sync state.

```
Meta-squad updates skill on main
       │
       ▼
  npx tsx scripts/sync-skills.ts
       │
       ▼
  Discover all squad/* branches via git worktree list
       │
       ▼
  For each domain:
    git checkout origin/main -- .squad/skills/
    git commit -m "sync: update skills from main"
    Write .squad/sync-state.json
       │
       ▼
  Report: { synced: N, conflicts: M, up-to-date: K }
```

**Sync state tracking** — each domain maintains `.squad/sync-state.json`:

```typescript
interface SyncState {
  last_sync_from: string;      // "main"
  last_sync_commit: string;    // commit SHA of main's skills
  last_sync_at: string;        // ISO 8601
  skills_synced: string[];     // ["domain-playbook", "kql-patterns", ...]
}
```

**Conflict handling:** If a domain modified a synced skill after the last sync,
the file is flagged as a conflict. The domain squad resolves conflicts manually.
Domain-specific skill extensions (new files, not modifications) never conflict.

**CLI:**

```bash
npx tsx scripts/sync-skills.ts                      # all skills → all domains
npx tsx scripts/sync-skills.ts --skill my-skill     # specific skill
npx tsx scripts/sync-skills.ts --team team-alpha     # specific domain
npx tsx scripts/sync-skills.ts --dry-run             # preview only
```

### Flow 3: Graduate (team → main via review)

**When:** A domain squad discovers a generalizable pattern.

```
Step 1: Agent appends learning with confidence: "high"
        ↓
Step 2: Domain lead reviews, confirms graduation candidate
        ↓
Step 3: Domain squad writes graduation proposal
        (npx tsx scripts/graduate-learning.ts)
        ↓
Step 4: Meta-squad reviews proposal
        ↓
Step 5: If approved → merged to main skill, tagged for sync
        ↓
Step 6: Learning entry marked graduated=true
```

**Graduation criteria:**
- 2+ independent evidence points
- Clear, reproducible trigger condition
- Not tied to one domain's specifics (must be generalizable)
- Produces a concrete, actionable check or step
- Not already captured in an existing skill

### Learning Log Format

The learning log is an append-only JSONL file at `.squad/learnings/log.jsonl`.
One JSON object per line.

```typescript
type LearningType = 'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha';

interface LearningEntry {
  id: string;              // "learn-{timestamp}-{random6}"
  ts: string;              // ISO 8601
  type: LearningType;
  agent: string;           // agent who logged this
  domain?: string;         // domain name (for cross-reads)
  tags: string[];          // free-form tags for grouping
  title: string;           // one-line summary
  body: string;            // full details
  confidence: 'low' | 'medium' | 'high';
  source?: string;         // origin context
  supersedes?: string;     // ID of entry this replaces
  related_skill?: string;  // skill this relates to
  evidence?: string[];     // supporting references
  graduated?: boolean;     // true when promoted to a skill
  graduated_to?: string;   // target skill name
}
```

**Entry types:**

| Type | When | Example |
|------|------|---------|
| `discovery` | Agent finds something new | "Found hidden config override pattern" |
| `correction` | Prior assumption was wrong | "API uses v3, not v2 as assumed" |
| `pattern` | Recurring structure across data | "All clusters follow {name}-{env}-{region}" |
| `technique` | New effective approach | "Querying by namespace first is 10x faster" |
| `gotcha` | Trap others should avoid | "Source list returns consumed items too" |

**Confidence levels:**

| Level | Meaning | Graduation eligible? |
|-------|---------|---------------------|
| `low` | Hunch, single data point | No |
| `medium` | Validated against 2+ sources | Only if 3+ similar entries exist |
| `high` | Battle-tested across runs | Yes, strong candidate |

### Cross-Team Reading

Domain squads can read other squads' learning logs without checking out
their branches:

```typescript
// Read from a specific branch
LearningLog.readFromBranch('squad/team-beta');
// Internally: git show squad/team-beta:.squad/learnings/log.jsonl

// Read from ALL domain branches
LearningLog.readAllDomains();
// Internally: git branch --list "squad/*" → git show each
```

This is **read-only**. A domain squad cannot write to another squad's log.
Cross-domain writes flow through graduation to main, then sync back out.

---

## 5. Launch Mechanics

`launch.ts` is the entry point for starting headless domain squad sessions.
It resolves a prompt, initializes the signal protocol, and spawns a detached
Copilot session in the domain's worktree.

### Prompt Resolution Chain (4 tiers)

```
Priority 1: --prompt "string"          CLI flag, literal prompt
     │
     │  (not set?)
     ▼
Priority 2: --prompt-file ./path.md    CLI flag, file contents
     │
     │  (not set?)
     ▼
Priority 3: .squad/launch-prompt.md    Team-level template in worktree
     │
     │  (not found?)
     ▼
Priority 4: Generic fallback           Built-in minimal prompt
```

The first tier that produces a non-empty string wins. No fallthrough chaining.

### Template Interpolation

Tier 3 (`.squad/launch-prompt.md`) supports placeholder interpolation:

| Placeholder | Replaced with | Example value |
|-------------|---------------|---------------|
| `{team}` | Domain name | `team-alpha` |
| `{runType}` | Detected run type | `first-run` |
| `{playbookSkill}` | Config playbook skill | `domain-playbook` |

### RunType Detection

```typescript
type RunType = 'first-run' | 'refresh' | 'reset';
```

Detection logic in `detectRunType()`:

```
.squad/signals/status.json exists?
  ├── NO  → 'first-run'  (never been launched)
  └── YES
       └── --reset flag passed?
            ├── YES → 'reset'   (clear state, start fresh)
            └── NO  → 'refresh' (prior state exists, incremental)
```

**Reset mode** (`--reset`) clears:
1. Removes `status.json`
2. Clears inbox `.ack` files (not the directives themselves)
3. Runs cleanup hook if present (`.squad/cleanup-hook.sh` or `.squad/cleanup-hook.ts`)
4. Commits the cleanup

### MCP Stack Injection

The `mcpStack` array in `federate.config.json` lists MCP server identifiers.
Each entry becomes a `--mcp <name>` argument to the Copilot launcher:

```json
{ "mcpStack": ["github", "bluebird"] }
```

Produces: `copilot --mcp github --mcp bluebird -p "..." --yolo`

### OTel MCP Injection

When `telemetry.enabled` is true in config, the launch script injects an
additional MCP server configuration for the OTel server:

```typescript
const mcpConfig = {
  mcpServers: {
    otel: {
      command: 'npx',
      args: ['tsx', 'scripts/mcp-otel-server.ts'],
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
        OTEL_SERVICE_NAME: `squad-${domain}`,
        SQUAD_DOMAIN: domain,
      },
    },
  },
};
// Passed via: --additional-mcp-config <JSON>
```

This gives every domain session access to `otel_span`, `otel_metric`,
`otel_event`, and `otel_log` tools without any per-team configuration.

### CLI Reference

```bash
npx tsx scripts/launch.ts --team <name>                    # launch single team
npx tsx scripts/launch.ts --team <name> --reset            # clear state, relaunch
npx tsx scripts/launch.ts --team <name> --step <step>      # run single step
npx tsx scripts/launch.ts --team <name> --prompt "do X"    # override prompt
npx tsx scripts/launch.ts --team <name> --prompt-file X.md # prompt from file
npx tsx scripts/launch.ts --teams a,b,c                    # launch multiple
npx tsx scripts/launch.ts --all                            # launch all teams
```

---

## 6. OTel Observability

### Architecture

```
Domain A (worktree) ──► mcp-otel-server (stdin/stdout) ──┐
Domain B (worktree) ──► mcp-otel-server (stdin/stdout) ──┼──► OTLP/HTTP ──► Aspire Dashboard
Domain C (worktree) ──► mcp-otel-server (stdin/stdout) ──┘   :4318          :18888
```

Each headless Copilot session spawns its own `mcp-otel-server.ts` process.
The agent calls OTel tools via MCP protocol. The server exports OTLP/HTTP
to a shared collector.

### MCP Server Protocol

The OTel MCP server communicates via **JSON-RPC 2.0 over stdin/stdout**
(newline-delimited). It implements the MCP 2024-11-05 protocol:

- `initialize` → returns server capabilities (tools)
- `tools/list` → returns the 4 OTel tool definitions
- `tools/call` → executes a tool, returns result

### Four Tools

**`otel_span`** — Trace span lifecycle

```typescript
interface OtelSpanParams {
  action: 'start' | 'end';  // start begins timing, end exports
  name: string;              // "step-2-classification", "agent:DataEngineer"
  status?: 'ok' | 'error';  // only on action=end
  attributes?: Record<string, any>;
}
```

Spans are tracked in-memory between start and end. On end, the span is
formatted as OTLP and exported.

**`otel_metric`** — Point-in-time gauge

```typescript
interface OtelMetricParams {
  name: string;              // "squad.items.discovered"
  value: number;
  attributes?: Record<string, any>;
}
```

**`otel_event`** — Timeline event (implemented as OTLP log record)

```typescript
interface OtelEventParams {
  name: string;              // "scan-started", "learning-logged"
  attributes?: Record<string, any>;
}
```

**`otel_log`** — Structured log

```typescript
interface OtelLogParams {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  attributes?: Record<string, any>;
}
```

Severity mapping: debug=5, info=9, warn=13, error=17 (OTLP severity numbers).

### OTLP/HTTP Export Format

All data is exported as JSON to the collector's HTTP endpoints:

| Data type | Endpoint | Body format |
|-----------|----------|-------------|
| Traces | `POST /v1/traces` | `{ resourceSpans: [...] }` |
| Metrics | `POST /v1/metrics` | `{ resourceMetrics: [...] }` |
| Logs/Events | `POST /v1/logs` | `{ resourceLogs: [...] }` |

Export is best-effort. If the collector is down, errors are logged to stderr
but do not fail the agent's operation.

### Aspire Dashboard Port Mapping

Default deployment uses .NET Aspire dashboard:

```yaml
services:
  aspire-dashboard:
    image: mcr.microsoft.com/dotnet/aspire-dashboard:9.0
    ports:
      - "18888:18888"     # Aspire UI (browser)
      - "4317:18889"      # OTLP/gRPC (host:4317 → container:18889)
      - "4318:18890"      # OTLP/HTTP (host:4318 → container:18890)
```

| Host port | Container port | Protocol | Purpose |
|-----------|---------------|----------|---------|
| 18888 | 18888 | HTTP | Aspire dashboard UI |
| 4317 | 18889 | gRPC | OTLP/gRPC receiver |
| 4318 | 18890 | HTTP | OTLP/HTTP receiver (used by mcp-otel-server) |

### Resource Attributes

All spans, metrics, and logs carry:

```typescript
[
  { key: 'service.name', value: 'squad-{domain}' },
  { key: 'squad.domain', value: '{domain}' },
]
```

These attributes enable filtering in the Aspire dashboard by domain squad.

---

## 7. Archetype System

Archetypes define **what a squad does** — the work pattern, deliverable
structure, playbook, cleanup behavior, and **lifecycle state machine**. Core
defines **how squads operate** — git mechanics, signals, telemetry, knowledge
flow.

Archetypes now own their lifecycle state definitions, not just work patterns.
Core validates state transitions at runtime but never interprets state semantics.
This strengthens the three-layer separation via **Dependency Inversion**: both
core and archetype layers depend on the `states` schema abstraction, not on
each other's implementations.

### On-Demand Skill Acquisition

Archetype plugins teach the federation new capabilities on install — like
Neo downloading helicopter piloting in The Matrix. When the meta-squad
installs `squad-archetype-deliverable`, it instantly gains:

- **Team-facing skills**: the deliverable playbook (discovery → distillation, schema evolution)
- **Meta-squad-facing skills**: aggregation workflow (collect, validate, import)
- **Agents**: aggregator agent for autonomous collection
- **Templates**: prompt templates, cleanup hooks, merge tools

No configuration or wiring needed — Copilot auto-discovers skills from
installed plugins. The meta-squad can immediately say *"aggregate results
from all teams"* and the aggregation skill activates.

Archetypes provide skills for **both actors**:

| Actor | Gets | Example |
|-------|------|---------|
| **Team** | Playbook, prompt templates, cleanup hook | "How to produce a deliverable" |
| **Meta-squad** | Aggregation, validation, review guidance | "How to collect and validate team output" |

Multiple archetypes can coexist — a meta-squad managing coding teams AND
deliverable teams has skills from both archetypes available simultaneously.

### Marketplace Skill Discovery at Onboarding

During team onboarding, core browses installed marketplaces for skills
relevant to the new team's domain and purpose. Keywords from the team
description are matched against plugin names and descriptions:

```
User: "Spin off a backend team for the payments API"
                    │
                    ▼
    Core browses installed marketplaces
    Keywords: "backend", "payments", "API"
                    │
                    ▼
    "Found 'api-testing' and 'security-guidance'
     in awesome-copilot marketplace.
     Install for this team?"
```

This happens automatically in the onboard agent (step 5). Marketplace
skills are always team-scoped — they get installed into the team's
worktree. Meta-squad skills come exclusively from archetype plugin
installs (global), not from marketplace discovery. If no marketplaces
are registered or no matches found, the step is skipped silently.

### .squad/archetype.json Schema

Installed into each worktree by the archetype plugin's setup skill:

```json
{
  "archetype": "squad-archetype-inventory",
  "version": "0.2.0",
  "installed_at": "2025-07-20T10:00:00Z",
  "playbook_skill": "service-onboarding-playbook",
  "deliverable_schema": "docs/schemas/domain.schema.json",
  "cleanup_hook": ".squad/cleanup-hook.sh",
  "states": {
    "lifecycle": [
      "preparing",
      "scanning",
      "distilling",
      "aggregating",
      "reviewing"
    ],
    "terminal": ["complete", "failed"],
    "pauseable": true
  }
}
```

**State machine schema (optional):**
- `lifecycle`: Ordered array of progression states the archetype moves through
- `terminal`: Final states that end the team's work
- `pauseable`: Whether teams can pause mid-lifecycle and resume later

If `states` section is missing, core falls back to generic default states
(preparing, working, complete, failed, paused, waiting for feedback, finished).

### Prompt Template Resolution

When an archetype is installed, it may provide `.squad/launch-prompt.md`
in the worktree. This template is tier 3 in the prompt resolution chain
(see §5). It can reference archetype-specific concepts:

```markdown
You are team {team}. Follow the {playbookSkill} skill.
This is a {runType}. Read DOMAIN_CONTEXT.md for your mission.
Check .squad/signals/inbox/ for directives first.
Report progress to .squad/signals/status.json.
```

If the archetype does not provide a launch prompt, the generic fallback
(tier 4) is used.

### Cleanup Hooks

On `--reset`, `launch.ts` checks for and runs cleanup hooks:

```
.squad/cleanup-hook.sh   ← tried first (run with bash)
.squad/cleanup-hook.ts   ← tried second (run with npx tsx)
```

Only the first found hook runs. The archetype provides these hooks to
clear archetype-specific state (deliverables, raw data, caches) while
core handles clearing signal state and inbox acknowledgments.

Example cleanup hook from an inventory archetype:

```bash
#!/bin/bash
# .squad/cleanup-hook.sh — clear deliverables for fresh run
rm -f distilled.json SCAN_SUMMARY.md
rm -rf raw/
echo "✓ Inventory artifacts cleared"
```

### Setup Skill Auto-Installation

An archetype plugin declares a setup skill that `squad init` executes.
The setup skill:

1. Copies archetype-specific skills into `.squad/skills/`
2. Writes `.squad/archetype.json` metadata
3. Optionally provides `.squad/launch-prompt.md`
4. Optionally provides `.squad/cleanup-hook.sh`
5. Seeds any archetype-specific directory structure

### Per-Team Archetype Binding (Non-Homogeneous Federations)

A single federation can contain teams with **different** archetypes.
Each worktree's `.squad/archetype.json` is independent:

```
squad/team-alpha  →  archetype: squad-archetype-inventory
squad/team-beta   →  archetype: squad-archetype-audit
squad/team-gamma  →  archetype: squad-archetype-inventory
```

Core operations (launch, sync, signals, learnings) work identically
regardless of archetype. The archetype only affects:
- Which prompt template is used
- Which playbook skill the team follows
- What cleanup hook runs on reset
- What deliverable schema is expected

---

## 8. Ceremony Protocol

Ceremonies are structured coordination points triggered by squad state
transitions. They provide reflection, knowledge sharing, and planning.

### CeremonyDefinition Interface

```typescript
interface CeremonyDefinition {
  name: string;
  trigger: {
    when: 'before' | 'after' | 'manual';
    condition: string;      // human-readable trigger condition
  };
  facilitator: string;      // role (e.g., "lead")
  participants: string[];   // roles or ["all"]
  agenda: string[];         // ordered list of agenda items
  outputs: string[];        // expected artifacts
}
```

### Built-In Templates

**pre-task-triage** — Scope setting before first run

```
Trigger:      before — first run (no deliverable exists)
Facilitator:  lead
Participants: all
Agenda:
  1. Review domain context and project description
  2. Read all seeded skills thoroughly
  3. Identify primary data sources and access requirements
  4. Draft initial work breakdown by agent
  5. Set quality criteria for the deliverable
Outputs:
  - Work breakdown in status.json step field
  - Access requirements documented
```

**knowledge-check** — Pre-rescan review

```
Trigger:      before — rescan requested
Facilitator:  lead
Participants: all
Agenda:
  1. Review what we already know — read deliverable and learnings
  2. Check inbox for meta-squad updates (skill syncs, directives)
  3. Acknowledge all pending inbox messages
  4. Identify gaps and set priorities for this run
  5. Assign focus areas to team members
Outputs:
  - Updated status.json with priorities
  - Acknowledged inbox messages
```

**task-retro** — Reflection after task completion

```
Trigger:      after — status.json state == complete
Facilitator:  lead
Participants: all
Agenda:
  1. Review deliverable quality and completeness
  2. Surface new learnings — read log.jsonl entries from this run
  3. Tag generalizable patterns (domain: "generalizable") for graduation
  4. Write retro report to outbox
  5. Update domain-specific skill extensions if new patterns discovered
Outputs:
  - outbox/retro-report.json
  - Updated learnings with graduation tags
```

### Ceremony Seeding

During onboarding, `generateCeremoniesMarkdown()` produces a
`.squad/ceremonies.md` file from the ceremony definitions. This markdown
is included in the squad's context so agents know when and how to run
each ceremony.

Projects can extend the ceremony set via `federate.config.json` or
archetype-provided ceremony definitions.

---

## 9. Configuration

### federate.config.json Schema

Located at the project root. Controls federation plumbing only — team-specific
configuration lives inside each worktree.

```typescript
interface FederateConfig {
  /** Git branch prefix for team worktrees. Default: "squad/" */
  branchPrefix: string;

  /** MCP servers to load for every team session */
  mcpStack: string[];

  /** OTel observability settings */
  telemetry: {
    enabled: boolean;    // inject otel MCP server into sessions
    aspire: boolean;     // use Aspire dashboard defaults
  };
}
```

**Minimal example:**

```json
{
  "branchPrefix": "squad/",
  "mcpStack": [],
  "telemetry": { "enabled": true, "aspire": true }
}
```

**With MCP servers:**

```json
{
  "branchPrefix": "squad/",
  "mcpStack": ["github", "bluebird"],
  "telemetry": { "enabled": true, "aspire": true }
}
```

### Environment Variable Overrides

| Variable | Overrides | Default |
|----------|-----------|---------|
| `FEDERATE_BRANCH_PREFIX` | `branchPrefix` | `squad/` |
| `SQUAD_MAIN_BRANCH` | Main branch name in sync-skills | `main` |
| `SQUAD_LAUNCHER` | Copilot launcher binary | `copilot` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel collector URL | `http://localhost:4318` |
| `OTEL_SERVICE_NAME` | Service name for telemetry | `squad-{domain}` |
| `SQUAD_DOMAIN` | Domain name for OTel attributes | (from worktree) |

### Config Loading Precedence

`launch.ts` and `onboard.ts` both call `loadConfig()`:

1. Read `federate.config.json` from project root
2. Merge with `DEFAULT_CONFIG` (missing fields filled with defaults)
3. Environment variables override at point of use (not merged into config)

---

## 10. Scripts Reference

All scripts live in `scripts/` and are invoked via `npx tsx scripts/<name>.ts`.

**launch.ts** — Headless team session launcher. Resolves prompt via 4-tier chain, initializes signal protocol, spawns detached Copilot session in domain worktree. Supports single team, multi-team, and all-teams modes. Handles `--reset` cleanup with hook execution and `--step` for single-step runs.
`npx tsx scripts/launch.ts --team <name> [--reset] [--step <step>] [--prompt "..."] [--prompt-file <path>] [--all] [--teams a,b,c]`

**onboard.ts** — Domain squad creation. Creates git branch, persistent worktree, scaffolds federation state (signals, learnings, ceremonies, telemetry, domain context), runs `squad init` for team casting, cleans up meta-squad files, and commits initial state.
`npx tsx scripts/onboard.ts --name <name> --domain-id <id> [--description "..."] [--base-branch main]`

**sync-skills.ts** — Skill propagation from main to domain worktrees. Discovers all `squad/*` branches, checks out updated skill files from main, commits sync, and updates `.squad/sync-state.json`. Handles worktree and bare-branch targets. Detects conflicts with locally modified skills.
`npx tsx scripts/sync-skills.ts [--skill <name>] [--team <name>] [--dry-run]`

**monitor.ts** — Federation status dashboard. Reads `status.json` from all domain worktrees. Displays archetype-specific state progressions, progress, active agent, and timing for each domain. Groups teams by archetype when multiple archetypes coexist. Supports watch mode for continuous monitoring.
`npx tsx scripts/monitor.ts [--watch]`

**learn.ts** — CLI wrapper for appending learning log entries. Agents call this during scans to record discoveries, patterns, corrections, techniques, and gotchas.
`npx tsx scripts/learn.ts --type <type> --title "..." --body "..." --tags "a,b" [--confidence medium] [--agent <name>]`

**query-learnings.ts** — Query and filter learning log entries. Supports filtering by type, agent, tags, domain, confidence, and date range. Can query local log or cross-read other domains.
`npx tsx scripts/query-learnings.ts [--type <type>] [--tags "a,b"] [--domain <name>] [--since <date>]`

**sweep-learnings.ts** — Cross-domain pattern detection. Reads learning logs from all domain branches, groups by tags, detects recurring patterns, and produces a sweep report for meta-squad review.
`npx tsx scripts/sweep-learnings.ts [--min-occurrences 2] [--output <path>]`

**graduate-learning.ts** — Promote a learning entry to a skill. Marks the entry as graduated in the learning log and prepares a graduation proposal for meta-squad review.
`npx tsx scripts/graduate-learning.ts --id <learning-id> --target-skill <skill-name>`

**dashboard.ts** — Rich terminal dashboard for federation oversight. Aggregates data from signals, learnings, and telemetry across all domain squads.
`npx tsx scripts/dashboard.ts`

**mcp-otel-server.ts** — OTel MCP server process. Implements JSON-RPC 2.0 stdin/stdout protocol. Exposes `otel_span`, `otel_metric`, `otel_event`, `otel_log` tools. Exports OTLP/HTTP to collector. One instance per Copilot session, spawned automatically by `launch.ts` when telemetry is enabled.
`npx tsx scripts/mcp-otel-server.ts` (not invoked directly — launched by Copilot via MCP config)

### Library Modules (scripts/lib/)

**signals.ts** — Signal protocol implementation. Provides `ScanStatus`, `SignalMessage`, and `DomainWorktree` types. Functions: `readStatus`, `writeStatus`, `validateStatus` (runtime state validation against archetype schema), `loadArchetypeMetadata`, `initializeSignals`, `sendMessage`, `readMessages`, `acknowledgeMessage`, `discoverDomains`, `validateWorktree`.

**learning-log.ts** — `LearningLog` class. Append-only JSONL storage with `append()`, `query()` (with filters), `markGraduated()`, `count()`. Static methods `readFromBranch()` and `readAllDomains()` for cross-team reads via `git show`.

**ceremonies.ts** — Ceremony template definitions and markdown generator. Exports `CeremonyDefinition` interface, three built-in templates (`task-retro`, `knowledge-check`, `pre-task-triage`), and `generateCeremoniesMarkdown()`.

---

## 11. Design Decisions

### Archetype-Specific State Machines (Approved 2026-04-13)

**Decision:** Archetypes declare their own lifecycle state machines in `archetype.json`.
Core validates state transitions at runtime but never interprets state semantics.

**Why:**
- Generic states (`preparing`, `working`, `complete`, `failed`, `paused`, `waiting for feedback`, `finished`) are too coarse
  for meaningful monitoring — "working" could mean anything
- Archetypes know their own lifecycle better than core
- Different work patterns have fundamentally different progression models:
  - Deliverable: scanning → distilling → aggregating
  - Coding: implementing → testing → pr-open → pr-review → pr-approved → merged
  - ETL Pipeline: extracting → transforming → loading
- Better monitoring: meta-squad sees "Team Alpha 80% through distilling" instead
  of generic "Team Alpha working at 80%"

**How (Option C — Fully Agnostic Core):**
- Archetype declares states in `archetype.json`:
  ```json
  "states": {
    "lifecycle": ["preparing", "scanning", "distilling", "aggregating"],
    "terminal": ["complete", "failed"],
    "pauseable": true
  }
  ```
- Core reads schema at domain launch, validates each `status.json` write
- `ScanStatus.state` changes from enum to `string`
- Monitor reads archetype metadata and renders state-aware dashboards
- Backward compatible: falls back to generic default states if no schema exists

**Trade-offs:**
- **Gain:** Archetype-specific lifecycles match real work patterns, much better
  observability granularity, enables archetype-specific ceremony triggers
- **Cost:** Monitor code becomes archetype-aware (more complex rendering logic),
  cross-archetype comparisons require careful grouping
- **Verdict:** Worth it — monitoring complexity is centralized in one place,
  benefits distributed across all teams

**Architecture Fit:**
Strengthens the three-layer separation. This is **Dependency Inversion** —
both core and archetype layers depend on the `states` schema abstraction, not
on each other. Core validates but never interprets. Archetype defines but
never enforces. The schema contract mediates between them.

**Implementation Impact:**
- `lib/signals.ts`: Add `validateStatus()`, `loadArchetypeMetadata()` (~60 lines)
- `scripts/monitor.ts`: Archetype-aware dashboard rendering (~130 lines)
- Archetype plugins: Add `states` section to `archetype.json` (~20 lines each)
- Total: ~170 lines new code, ~40 lines modified

**Success Metrics:**
- Before: Generic "working" state tells nothing about team progress
- After: "Team Alpha 80% through distilling, Team Bravo stuck in testing"
- Developer experience: Define lifecycle in 5 lines of JSON
- Performance: Validation adds <1ms per write (unnoticeable)

**Related Issues:** [#18](https://github.com/lygav/vladi-plugins-marketplace/issues/18)
**Design Document:** `.squad/decisions/inbox/mal-archetype-state-machines.md`

