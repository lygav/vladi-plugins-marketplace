# squad-federation-core — Architecture

**Author:** Squad Team (Mal, Wash, Zoe, Ripley, Kaylee)
**Version:** 0.4.0
**Status:** Current
**Last Updated:** 2026-04-16

---

## Executive Summary

squad-federation-core is a Copilot plugin that enables federated multi-team coordination. A **meta-squad** orchestrates N permanent **domain squads** via placement and communication abstraction. Teams live in git worktrees or directories (placement), and communicate via file-based signals or Teams channels (communication)—core is location and protocol agnostic. Domain squads accumulate expertise, run autonomously in headless sessions, and coordinate via adapters.

**Core Pillars:**

1. **Placement Abstraction** — Teams can live in worktrees, directories, or remote systems. Where a team lives (placement) is independent of how it communicates.
2. **Communication Abstraction** — Teams communicate via file signals (default), Teams channels (v0.5.0), or custom adapters. Protocol is pluggable, federation-scoped.
3. **SDK Foundation** — Shared types/interfaces at `sdk/` enable archetype development as proper plugin extensions.
4. **Meta/Team Separation** — Archetypes cleanly separate orchestration concerns (meta) from execution concerns (team).
5. **Hybrid Monitoring** — Scripts collect mechanical data → skills interpret and present insights.
6. **Convention-Based Discovery** — Filesystem conventions reduce configuration overhead.
7. **Dynamic Archetype Discovery** — Archetypes auto-discovered from marketplace.json + filesystem at runtime.
8. **Two-Mode Onboarding** — Conversational (interactive discovery) + Mechanical (autonomous setup).

**Design Principles:**

- **Core agnostic** — Core never imports archetype code. Zero coupling.
- **Open/Closed** — New archetypes extend the system without modifying core.
- **Interface-driven** — TypeScript contracts enforce archetype API.
- **Location-neutral** — Team placement is abstracted behind `TeamPlacement` interface.
- **Protocol-neutral** — Team communication is abstracted behind `TeamCommunication` interface.
- **Adapter registry** — Communication adapters register at runtime. Factory composes placement + communication.
- **Start empty, add what's needed** — Onboarding creates minimal bootstrap, not kitchen-sink template.

---

## 1. System Overview

squad-federation-core is a Copilot plugin that implements a federated multi-team model.
A **meta-squad** orchestrates N permanent **domain squads** via a **transport abstraction**.
Teams can exist in git worktrees, standalone directories, remote repos, or cloud storage—core
is transport-agnostic. Domain squads accumulate expertise, run autonomously in headless sessions,
and communicate via file-based signals.

### Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  CORE LAYER — squad-federation-core plugin                         │
│                                                                      │
│  SDK (types, transport, base classes) · Team registry               │
│  Signal protocol · Learning log · Launch mechanics                   │
│  OTel MCP server · Skill sync engine · Hybrid monitoring             │
│                                                                      │
│  Transport-agnostic. Knows nothing about what squads DO or where     │
│  they live — only how they communicate, observe, and share knowledge.│
├──────────────────────────────────────────────────────────────────────┤
│  ARCHETYPE LAYER — e.g. squad-archetype-deliverable                │
│                                                                      │
│  Meta: Orchestration skills · Aggregation scripts · Monitoring       │
│  Team: Execution agents · Playbook skills · Cleanup hooks            │
│  Archetype manifest (states, monitor config, triage, recovery)       │
│                                                                      │
│  Defines the WORK PATTERN for a class of squads. Installed into      │
│  teams during onboarding. Multiple archetypes can coexist in         │
│  a single federation.                                                │
├──────────────────────────────────────────────────────────────────────┤
│  PROJECT LAYER — your repository                                   │
│                                                                      │
│  .squad/teams.json (team registry) · DOMAIN_CONTEXT.md per team      │
│  federate.config.json · Project-specific MCP servers · Custom skills │
│                                                                      │
│  Binds the federation to a concrete codebase and problem domain.     │
└──────────────────────────────────────────────────────────────────────┘
```

### Runtime Topology

**Example with WorktreeTransport:**

```
~/project/ (main branch — meta-squad)
├── .squad/
│   ├── teams.json               ← team registry (source of truth)
│   ├── skills/                  ← authoritative skills
│   └── learnings/log.jsonl      ← cross-cutting patterns
├── federate.config.json         ← federation plumbing config
│
├── project-team-alpha/          ← persistent worktree → squad/team-alpha
│   ├── .squad/
│   │   ├── archetype.json       ← archetype manifest (meta + team)
│   │   ├── signals/             ← IPC with meta-squad
│   │   ├── learnings/           ← domain-specific discoveries
│   │   └── skills/              ← synced from main + local extensions
│   └── DOMAIN_CONTEXT.md
│
├── project-team-beta/           ← persistent worktree → squad/team-beta
│   └── (same structure)
│
└── project-team-gamma/          ← persistent worktree → squad/team-gamma
    └── (same structure)
```

**Example with DirectoryTransport:**

```
~/project/ (meta-squad)
├── .squad/
│   ├── teams.json               ← team registry
│   ├── skills/                  ← authoritative skills
│   └── learnings/log.jsonl
├── federate.config.json
│
└── .squad-teams/                ← standalone team directories
    ├── team-alpha/
    │   ├── .squad/
    │   │   ├── archetype.json
    │   │   ├── signals/
    │   │   ├── learnings/
    │   │   └── skills/
    │   └── DOMAIN_CONTEXT.md
    │
    ├── team-beta/
    └── team-gamma/
```

### v0.3.x Evolution

**Key changes from v0.2.0 design to v0.3.x implementation:**

1. **Minimal Federation Config** — `federate.config.json` reduced to just `description` + `telemetry`. Transport concerns (branch prefix, worktree location, MCP stack) moved to team-level decisions during onboarding.

2. **Dynamic Archetype Discovery** — Archetypes auto-discovered from:
   - `marketplace.json` (npm packages declared in dependencies)
   - Filesystem (plugins/*/plugin.json with "archetype" type)
   - No hardcoded archetype list

3. **Two-Mode Onboarding** —
   - **Conversational:** Interactive wizard asks questions, infers archetype
   - **Mechanical:** Autonomous setup given archetype + config (used by archetype creators)

4. **Archetype Creator** — `create-archetype` skill + scaffold scripts enable users to create custom archetypes via conversational discovery (purpose → outputs → lifecycle → failure modes).

5. **Consultant Archetype** — New lightweight archetype for advisory/research teams without deliverables or complex state machines.

6. **Knowledge Accumulation Pattern** — All archetypes now include explicit learning instructions in agent prompts to capture discoveries in `.squad/learnings/`.

7. **Team MCP Inheritance** — Teams inherit MCP servers from project `.mcp.json` automatically; no separate federation-level MCP config.

---

## 2. Team Placement & Communication

### Team Registry (.squad/teams.json)

The **team registry** is the source of truth for team discovery. It declaratively records
team placement and communication settings:

```json
{
  "version": "1.0",
  "teams": [
    {
      "domain": "team-alpha",
      "domainId": "alpha-001",
      "archetypeId": "deliverable",
      "placement": "worktree",
      "location": "/Users/user/project-team-alpha",
      "branch": "squad/team-alpha",
      "createdAt": "2025-01-15T10:00:00Z",
      "metadata": {}
    },
    {
      "domain": "team-beta",
      "domainId": "beta-002",
      "archetypeId": "coding",
      "placement": "directory",
      "location": ".squad-teams/team-beta",
      "createdAt": "2025-01-16T14:30:00Z",
      "metadata": {}
    }
  ]
}
```

**Benefits:**
- Multi-placement federations (worktree + directory in same project)
- Fast team lookup (no git subprocess calls)
- Extensible metadata (store custom team properties)
- Placement is independent of communication (same team can move to Teams channel v0.5.0)

### TeamPlacement Interface

Team workspace location is abstracted by `TeamPlacement`, defined in `sdk/placement.ts`:

```typescript
export interface TeamPlacement {
  // File operations — delegated to placement implementation
  readFile(teamId: string, filePath: string): Promise<string | null>;
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  exists(teamId: string, filePath: string): Promise<boolean>;
  
  // Workspace queries
  workspaceExists(teamId: string): Promise<boolean>;
  getLocation(teamId: string): Promise<string>;
  listFiles(teamId: string, directory?: string): Promise<string[]>;
  bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void>;
}
```

### TeamCommunication Interface

Team communication protocol is abstracted by `TeamCommunication`, defined in `sdk/communication.ts`:

```typescript
export interface TeamCommunication {
  // Signal protocol
  readStatus(teamId: string): Promise<ScanStatus | null>;
  readInboxSignals(teamId: string): Promise<SignalMessage[]>;
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;
  readOutboxSignals(teamId: string): Promise<SignalMessage[]>;
  
  // Learning log (shared across adapters)
  readLearningLog(teamId: string): Promise<LearningEntry[]>;
  appendLearning(teamId: string, entry: LearningEntry): Promise<void>;
}
```

**Key design:** Placement knows WHERE teams live (filesystem, git worktree). Communication knows HOW they receive signals (file-based, Teams channel). Neither interface is tightly coupled.

### WorktreePlacement (lib/placement/worktree-placement.ts)

Git worktree adapter. Teams live on permanent branches:

**Branch naming:** `{branchPrefix}{team-name}` (default: `squad/team-alpha`)

**Lifecycle:**
```bash
# Create
git branch squad/team-alpha main
git worktree add ~/project-team-alpha squad/team-alpha

# Discovery
# Read .squad/teams.json, get placement from entry

# Removal (manual)
git worktree remove ~/project-team-alpha
git branch -D squad/team-alpha
```

**No-merge-back principle:** Domain branches never merge to main. Knowledge flows via:
- Graduation proposals (learning log → skill)
- Signal outbox reports (meta reads)
- Cross-read: `git show squad/team-alpha:.squad/learnings/log.jsonl`

**Isolation:** Each worktree has independent `.squad/` directory. Shared git object store
(disk-efficient), but zero coordination overhead between concurrent sessions.

### DirectoryPlacement (lib/placement/directory-placement.ts)

Standalone directory adapter. Teams exist in `.squad-teams/{teamName}/`:

**Benefits:**
- No git required (works in monorepos, cloud sync, etc.)
- Simpler setup for non-git users
- File-based backups (just copy directory tree)

**Tradeoffs:**
- No version control for team workspace
- No cross-read via `git show` (use direct file reads)

### Adapter Registry Pattern

Communication adapters register at runtime. Core provides a registry factory:

```typescript
import { CommunicationRegistry } from './lib/communication-registry.js';

const registry = new CommunicationRegistry(config);

// Register default adapter (FileSignalCommunication)
registry.register('file-signal', FileSignalCommunication);

// v0.5.0: Register Teams channel adapter when available
// registry.register('teams-channel', TeamsChannelCommunication);

const adapter = registry.get(config.communicationType || 'file-signal');
```

**Adding a new communication adapter requires:**
1. Implement `TeamCommunication` interface
2. Call `registry.register(name, implementation)` during bootstrap
3. Update `federate.config.json` communicationType field if desired
4. No changes to core scripts, signals, or knowledge lifecycle

### FileSignalCommunication (lib/communication/file-signal-communication.ts)

Default adapter. Signals stored as JSON files in `.squad/signals/`:

```
.squad/signals/
├── inbox/
│   ├── {messageId}.json     ← meta-squad sends to team
│   └── {messageId}.json
├── outbox/
│   ├── {messageId}.json     ← team sends to meta-squad
│   └── {messageId}.json
└── status.json              ← last scan status
```

**Lifecycle:** Meta-squad writes to `.squad/signals/inbox/`, team consumes. Team writes to `.squad/signals/outbox/`, meta-squad consumes.

### Future Communication Adapters

**v0.5.0 — TeamsChannelCommunication**

Teams channels as first-class signal protocol:

- **Hashtag protocol:** All signal types use structured hashtags
  - `#meta` — humans discuss federation strategy
  - `#meta-status` — teams report status
  - `#meta-error` — teams report errors/blockers
  - `#{teamId}` — team-specific channel for human oversight
  
- **Async human participation:** Humans @mention teams in channel to send directives; teams read channel as signal input

- **Example flow:**
  ```
  [Meta-squad]: "Team Alpha, investigate inventory discrepancies"
     (posts in #inventory-team)
  
  [Team Alpha]: Receives as signal in session, processes
  [Team Alpha]: "Discrepancy found in region-3 data"
     (posts in #meta-status)
  
  [Meta-squad]: Reads #meta-status, aggregates findings
  [Human]: Reviews in #meta, replies with guidance
  ```

### Context Factory (lib/orchestration/context-factory.ts)

Composes placement + communication at runtime:

```typescript
export function createTeamContext(
  team: TeamMetadata,
  placementType: string,
  communicationType: string,
  config: FederateConfig
): TeamContext {
  const placement = selectPlacement(placementType, config);
  const communication = selectCommunication(communicationType, config);
  
  return {
    domain: team.domain,
    placement,
    communication,
    // convenience methods
    async readSignals() { return communication.readInboxSignals(team.domain); },
    async writeStatus(status) { return communication.readStatus(team.domain); },
    async readFile(path) { return placement.readFile(team.domain, path); }
  };
}
```

**Benefits:**
- Placement and communication chosen independently
- Same team can migrate communication protocol (e.g., add Teams channel in v0.5.0)
- Federation can have mixed communication types (FileSignal + Teams coexist)

---

## 2a. Git Mechanics (WorktreeTransport only)

This section applies **only** to WorktreeTransport. For other transports, see their
respective implementation docs.

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

**Discovery** — via team registry (`.squad/teams.json`), not `git worktree list`.
Registry stores the worktree path and branch name.

**Validation** — `validateWorktree()` checks for:
- Worktree path exists on disk
- `.squad/archetype.json` present (archetype initialized)
- `.squad/signals/` directory present (signal protocol initialized)

**Removal** — manual (domain squads are permanent by design):

```bash
git worktree remove ~/project-team-alpha
git branch -D squad/team-alpha
# Also remove from .squad/teams.json
```

### No-Merge-Back Principle (WorktreeTransport)

Domain branches **never** merge back to main. Knowledge flows via:
- Graduation proposals (domain → main learning log → main skill)
- Signal outbox reports (meta-squad reads)
- `git show squad/team-alpha:.squad/learnings/log.jsonl` (cross-read)

The main branch reads FROM domain branches. Domain branches receive skill
updates via cherry-pick sync, never via `git merge main`.

### Isolation Model (WorktreeTransport)

Each worktree has a complete, independent `.squad/` directory:
- **Archetype manifest** — defines states, monitor config, triage, recovery
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
  archetype_id: string;    // archetype identifier (for multi-archetype dashboards)
}
```

**Archetype-Specific State Machines**

The `state` field is a string validated against the archetype's declared state
schema in `archetype.json`. Core validates but never interprets state semantics —
archetypes own their lifecycle definitions.

**Validation mechanism:**
- Core reads `states` schema from `.squad/archetype.json` in the team workspace
- Validates state transitions: state must be in `lifecycle` or `terminal` array
- Falls back to generic defaults if no schema exists (backward compatible)
- See §8 for archetype.json schema details

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

**v0.2.0 updates:**
- Added `to` field for mesh routing (team-to-team signals)
- Added `protocol` version field for forward compatibility

```typescript
interface SignalMessage {
  id: string;              // UUID v4
  timestamp: string;       // ISO 8601 (renamed from 'ts' for clarity)
  from: string;            // "meta-squad" or domain name
  to: string;              // recipient identifier (enables mesh routing)
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;         // short summary
  body: string;            // full message content
  protocol: string;        // protocol version (e.g., "1.0")
  acknowledged?: boolean;  // set to true when receiver processes it
  acknowledged_at?: string; // ISO 8601
}
```

**Mesh routing (v0.2.0):**
The `to` field enables team-to-team signals, not just meta ↔ team. Example:
- `from: "team-alpha", to: "team-beta"` — cross-team coordination
- `from: "meta-squad", to: "*"` — broadcast to all teams
- `from: "team-gamma", to: "meta-squad"` — escalation to meta

**Protocol versioning:**
The `protocol` field allows future signal format changes without breaking compatibility.
Current version: `"1.0"`. Receivers should validate and handle unknown protocols gracefully.

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

**v0.2.0 update:** Added `version` field for forward compatibility and schema evolution.

```typescript
type LearningType = 'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha';

interface LearningEntry {
  id: string;              // "learn-{timestamp}-{random6}"
  timestamp: string;       // ISO 8601 (renamed from 'ts')
  version: string;         // schema version (e.g., "1.0")
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

**Version field:** Enables schema evolution. Current version: `"1.0"`. Future versions
can add/remove fields without breaking old readers (they ignore unknown fields).

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

## 5. SDK Organization

**v0.2.0 introduces a formal SDK** at `squad-federation-core/sdk/` — the contract
layer between core and archetypes. Archetypes import from SDK, never from core internals.

### SDK Barrel Export (sdk/index.ts)

All types and utilities exposed through a single entry point:

```typescript
export * from './types.js';
export * from './transport.js';
export * from './monitor-base.js';
export * from './triage-base.js';
export * from './recovery-base.js';
export * from './schemas.js';
```

**Usage:**
```typescript
import {
  MonitorCollector,
  TeamContext,
  ScanStatus,
  TeamTransport,
  selectTransport
} from '@squad/federation-core/sdk';
```

### SDK Files

**sdk/types.ts** — Core interfaces:
- `ArchetypeManifest` — archetype.json schema
- `StateSchema` — state machine declaration
- `MonitorConfig`, `TriageConfig`, `RecoveryConfig` — dashboard/diagnostic metadata
- `TeamContext` — team identification and transport
- `ScanStatus` — current team state
- `SignalMessage` — IPC message format
- `LearningEntry` — learning log entry format

**sdk/transport.ts** — `TeamTransport` interface (see §2)

**sdk/monitor-base.ts** — `MonitorCollector` abstract base class:
```typescript
export abstract class MonitorCollector {
  abstract collect(team: TeamContext): Promise<StatusData>;
  
  protected async readStatus(team: TeamContext): Promise<ScanStatus | null> {
    return team.transport.readStatus(team.domain);
  }
  
  protected async readInboxSignals(team: TeamContext): Promise<SignalMessage[]> {
    return team.transport.readInboxSignals(team.domain);
  }
  
  protected async readLearnings(team: TeamContext): Promise<LearningEntry[]> {
    return team.transport.readLearningLog(team.domain);
  }
}
```

**sdk/triage-base.ts** — `TriageAnalyzer` abstract base class:
```typescript
export abstract class TriageAnalyzer {
  abstract diagnose(team: TeamContext, statusData: StatusData): Promise<DiagnosisResult>;
  
  // Helper methods for common diagnostic patterns
  protected isStalled(status: ScanStatus, thresholdMinutes: number): boolean {
    const updatedAt = new Date(status.updated_at);
    const now = new Date();
    return (now.getTime() - updatedAt.getTime()) / 60000 > thresholdMinutes;
  }
}
```

**sdk/recovery-base.ts** — `RecoveryEngine` abstract base class:
```typescript
export abstract class RecoveryEngine {
  abstract suggestActions(diagnosis: DiagnosisResult): Promise<RecoveryAction[]>;
  
  // Execute a recovery action (if automated)
  async execute(action: RecoveryAction, team: TeamContext): Promise<void> {
    if (!action.automated) {
      throw new Error(`Action ${action.id} requires manual execution`);
    }
    // Delegate to subclass
    await this.executeAutomated(action, team);
  }
  
  protected abstract executeAutomated(action: RecoveryAction, team: TeamContext): Promise<void>;
}
```

**sdk/schemas.ts** — Zod schemas for runtime validation:
```typescript
import { z } from 'zod';

export const ScanStatusSchema = z.object({
  domain: z.string(),
  domain_id: z.string(),
  state: z.string(),
  step: z.string(),
  started_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  progress_pct: z.number().optional(),
  error: z.string().optional(),
  agent_active: z.string().optional(),
  archetype_id: z.string(),
});

export const SignalMessageSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(['directive', 'question', 'report', 'alert']),
  subject: z.string(),
  body: z.string(),
  protocol: z.string(),
  acknowledged: z.boolean().optional(),
  acknowledged_at: z.string().optional(),
});

export const LearningEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  version: z.string(),
  type: z.enum(['discovery', 'correction', 'pattern', 'technique', 'gotcha']),
  agent: z.string(),
  domain: z.string().optional(),
  tags: z.array(z.string()),
  title: z.string(),
  body: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  source: z.string().optional(),
  supersedes: z.string().optional(),
  related_skill: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  graduated: z.boolean().optional(),
  graduated_to: z.string().optional(),
});
```

### Extension Points

Archetypes extend the SDK to implement custom behavior:

1. **Custom monitors** — extend `MonitorCollector`, implement `collect()`
2. **Custom triage** — extend `TriageAnalyzer`, implement `diagnose()`
3. **Custom recovery** — extend `RecoveryEngine`, implement `suggestActions()` and `executeAutomated()`
4. **Custom transports** — implement `TeamTransport` interface

Core discovers and loads these via archetype.json manifest, never via direct imports.

---

## 6. Launch Mechanics

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

## 7. Hybrid Monitoring & Observability

**v0.2.0 introduces hybrid monitoring** — scripts collect mechanical data,
skills interpret and present insights. This replaces the pure-OTel approach.

### Design Philosophy

Old (v0.1.0): Agents instrument themselves with `otel_span`, `otel_metric` calls.
- Problem: Instrumentation noise in agent code.
- Problem: No archetype-specific dashboards.

New (v0.2.0): Scripts collect, skills interpret.
- **Scripts** run outside agents, collect status/signals/learnings, write to `.squad/monitor/data/`.
- **Skills** read that data, run analyses, present human-readable dashboards.
- **Archetypes** implement both: `meta/scripts/monitor.ts` + `meta/skills/monitor-dashboard.md`.

### Monitor + Triage + Recovery Pattern

Each archetype provides three components:

**1. MonitorCollector** — Mechanical data collection (SDK base class):

```typescript
import { MonitorCollector, TeamContext, StatusData } from '@squad/federation-core/sdk';

export class BackendMonitor extends MonitorCollector {
  async collect(team: TeamContext): Promise<StatusData> {
    const status = await this.readStatus(team);
    const signals = await this.readInboxSignals(team);
    const learnings = await this.readLearnings(team);
    
    // Archetype-specific data gathering
    const buildStatus = await this.checkBuildHealth(team);
    const testResults = await this.checkTestResults(team);
    
    return {
      status,
      signals,
      learnings,
      custom: { buildStatus, testResults }
    };
  }
}
```

**2. TriageAnalyzer** — Diagnose issues (SDK base class):

```typescript
import { TriageAnalyzer, TeamContext, StatusData, DiagnosisResult } from '@squad/federation-core/sdk';

export class BackendTriage extends TriageAnalyzer {
  async diagnose(team: TeamContext, data: StatusData): Promise<DiagnosisResult> {
    const issues: Issue[] = [];
    
    // Check for stalled state
    if (this.isStalled(data.status, 30)) {
      issues.push({
        severity: 'high',
        title: `Team ${team.domain} stalled in ${data.status.state}`,
        details: `No progress for 30+ minutes`,
        category: 'state-machine'
      });
    }
    
    // Archetype-specific checks
    if (data.custom.buildStatus === 'broken') {
      issues.push({
        severity: 'critical',
        title: 'Build broken',
        details: data.custom.buildStatus.error,
        category: 'build'
      });
    }
    
    return { issues, healthy: issues.length === 0 };
  }
}
```

**3. RecoveryEngine** — Suggest/execute fixes (SDK base class):

```typescript
import { RecoveryEngine, DiagnosisResult, RecoveryAction } from '@squad/federation-core/sdk';

export class BackendRecovery extends RecoveryEngine {
  async suggestActions(diagnosis: DiagnosisResult): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];
    
    for (const issue of diagnosis.issues) {
      if (issue.category === 'state-machine' && issue.title.includes('stalled')) {
        actions.push({
          id: `restart-${Date.now()}`,
          title: 'Restart team agent',
          description: 'Kill existing process and relaunch',
          automated: true,
          risk: 'low'
        });
      }
      
      if (issue.category === 'build' && issue.title.includes('broken')) {
        actions.push({
          id: `fix-build-${Date.now()}`,
          title: 'Fix build errors',
          description: 'Send directive to team to fix compilation errors',
          automated: false,  // requires human review
          risk: 'medium'
        });
      }
    }
    
    return actions;
  }
  
  protected async executeAutomated(action: RecoveryAction, team: TeamContext): Promise<void> {
    if (action.title === 'Restart team agent') {
      // Kill and relaunch team process
      await team.transport.sendDirective(team.domain, {
        subject: 'System restart',
        body: 'Your agent was restarted due to stall detection.'
      });
      // (actual restart logic here)
    }
  }
}
```

### Dashboard Skill Pattern

Skills present monitoring data to users:

```markdown
---
name: monitor-dashboard
description: Show federation health and team status
---

# Monitor Dashboard

Displays current health of all teams in the federation.

## How it works

1. Reads `.squad/monitor/data/*.json` (written by monitor script)
2. Runs triage analysis on each team
3. Presents table with state, health, issues, suggested actions

## Usage

User: "show me the dashboard"
Agent: (reads monitor data, runs triage, displays table)
```

The skill reads cached data (fast), interprets it, presents it.

### Archetype.json Manifest

Archetypes declare their monitoring components:

```json
{
  "id": "backend",
  "version": "1.0.0",
  "monitoring": {
    "collector": "meta/scripts/monitor.ts",
    "triage": "meta/scripts/triage.ts",
    "recovery": "meta/scripts/recovery.ts",
    "skills": ["meta/skills/monitor-dashboard.md", "meta/skills/diagnose.md"]
  }
}
```

Core discovers and loads these automatically.

### OTel Observability (Optional)

v0.1.0's OTel instrumentation is still supported for low-level tracing:

```
Domain A (worktree) ──► mcp-otel-server (stdin/stdout) ──┐
Domain B (worktree) ──► mcp-otel-server (stdin/stdout) ──┼──► OTLP/HTTP ──► Aspire Dashboard
Domain C (worktree) ──► mcp-otel-server (stdin/stdout) ──┘   :4318          :18888
```

Each headless session can spawn `mcp-otel-server.ts` for span/metric/event/log export.

**Tools:** `otel_span`, `otel_metric`, `otel_event`, `otel_log` (see v0.1.0 docs).

**Export:** OTLP/HTTP to Aspire Dashboard (port 4318).

**Resource attributes:**
```typescript
[
  { key: 'service.name', value: 'squad-{domain}' },
  { key: 'squad.domain', value: '{domain}' },
]
```

Most archetypes prefer the hybrid pattern. OTel is useful for deep debugging.

---

## 8. Archetype System

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

### Meta vs Team Directory Convention

**v0.2.0 introduces the meta/team split** — archetypes now organize code
by audience and deployment location:

```
squad-archetype-backend/
  ├── meta/                   # Stays in plugin, orchestration code
  │   ├── agents/
  │   │   └── aggregator.md  # Meta-squad agent for collecting team output
  │   ├── skills/
  │   │   ├── aggregate-results.md
  │   │   ├── monitor-dashboard.md
  │   │   └── triage-teams.md
  │   ├── scripts/
  │   │   ├── monitor.ts
  │   │   ├── triage.ts
  │   │   └── recovery.ts
  │   └── commands/
  │       └── deploy-backend.md
  │
  └── team/                   # Copied to team workspace at onboarding
      ├── skills/
      │   ├── backend-playbook.md
      │   ├── testing-guide.md
      │   └── deployment-checklist.md
      ├── templates/
      │   ├── api-endpoint.ts.template
      │   └── test-spec.ts.template
      └── hooks/
          └── cleanup-hook.sh
```

**Meta directory** — Orchestration layer (meta-squad POV):
- Runs in plugin, has access to full Node.js environment
- Can import SDK: `import { MonitorCollector, TeamTransport } from '@squad/federation-core/sdk'`
- Implements monitoring, triage, recovery, aggregation
- Never copied to team workspaces

**Team directory** — Execution layer (team agent POV):
- Copied to team workspace during onboarding
- Becomes `.squad/archetype/*` in team's workspace
- Skills, templates, hooks for the team agent to use
- No imports, pure markdown/shell/templates

**Onboarding workflow:**

```typescript
// Core onboard command
const archetype = loadArchetypePlugin('squad-archetype-backend');

// Copy team/ to new workspace
await transport.writeFiles(teamDomain, {
  '.squad/archetype/skills/': archetype.team.skills,
  '.squad/archetype/templates/': archetype.team.templates,
  '.squad/archetype/hooks/': archetype.team.hooks,
});

// Meta/ stays in plugin, accessed by meta-squad only
```

**Why this split:**
- Meta code needs Node.js, npm deps, SDK imports → stays in plugin
- Team code needs zero deps, portable → copied to workspace
- Clean separation of orchestration (meta) vs execution (team)
- Teams never import from plugin or SDK, they're self-contained

### .squad/archetype.json Schema

Installed into each team workspace by the archetype plugin's setup skill:

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

## 9. Ceremony Protocol

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

## 10. Configuration

### federate.config.json Schema

Located at the project root. Controls federation communication and telemetry only — team-specific
placement configuration lives in `.squad/teams.json`.

```typescript
interface FederateConfig {
  /** Brief description of what this federation does */
  description?: string;

  /** Communication settings */
  communication: {
    /** Default communication adapter type (e.g., "file-signal", "teams-channel") */
    defaultType: string;
    
    /** Per-adapter configuration */
    adapters: {
      "file-signal"?: {
        signalsDir: string;  // Default: ".squad/signals"
      };
      "teams-channel"?: {
        tenantId: string;
        clientId: string;
        graphApiEndpoint: string;
      };
      // Custom adapters can add their own config
      [key: string]: any;
    };
  };

  /** OTel observability settings */
  telemetry: {
    enableTracing: boolean;           // Default: false
    enableMetrics: boolean;           // Default: false
    otelServiceName: string;          // Default: "squad-federation"
  };
}
```

**Minimal example (file signals):**

```json
{
  "description": "Multi-team inventory federation",
  "communication": {
    "defaultType": "file-signal",
    "adapters": {
      "file-signal": {
        "signalsDir": ".squad/signals"
      }
    }
  },
  "telemetry": {
    "enableTracing": false,
    "enableMetrics": false,
    "otelServiceName": "squad-federation"
  }
}
```

**v0.5.0 example (Teams channels):**

```json
{
  "description": "Multi-team federation with Teams channel communication",
  "communication": {
    "defaultType": "teams-channel",
    "adapters": {
      "teams-channel": {
        "tenantId": "{{ TENANT_ID }}",
        "clientId": "{{ CLIENT_ID }}",
        "graphApiEndpoint": "https://graph.microsoft.com/v1.0"
      }
    }
  },
  "telemetry": {
    "enableTracing": true,
    "enableMetrics": true,
    "otelServiceName": "squad-federation"
  }
}
```

**Schema Notes:**

- **communication.defaultType** — All teams in federation use same protocol by default. Teams can migrate communication protocols as new adapters become available (e.g., add Teams channel v0.5.0 alongside file signals).
- **communication.adapters** — Runtime-registered adapters. Supports custom implementations (e.g., `"redis-pubsub"` for high-throughput federations).
- **Placement is per-team** — Not in federate.config.json. Each team's placement (worktree, directory, cloud) is in `.squad/teams.json` entry.
- **No branchPrefix/worktreeDir** — These were federation-level in v0.2.0. Now team-level (in teams.json) to support multi-placement federations.
- **No mcpStack** — Archetypes auto-discovered from marketplace.json. MCP servers inherited from project `.mcp.json`.

### Environment Variable Overrides

| Variable | Overrides | Default |
|----------|-----------|---------|
| `SQUAD_COMMUNICATION_TYPE` | `communication.defaultType` | `file-signal` |
| `SQUAD_MAIN_BRANCH` | Main branch name in sync-skills | `main` |
| `SQUAD_LAUNCHER` | Copilot launcher binary | `copilot` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel collector URL | `http://localhost:4318` |
| `OTEL_SERVICE_NAME` | Service name for telemetry | `squad-{domain}` |
| `SQUAD_DOMAIN` | Domain name for OTel attributes | (from teams.json) |

### Config Loading Precedence

`launch.ts` and `onboard.ts` both call `loadConfig()`:

1. Read `federate.config.json` from project root
2. Merge with `DEFAULT_CONFIG` (missing fields filled with defaults)
3. Environment variables override at point of use (not merged into config)
4. Load `.squad/teams.json` for per-team placement and communication metadata

---

## 11. Scripts Reference

All scripts live in `scripts/` and are invoked via `npx tsx scripts/<name>.ts`.

**launch.ts** — Headless team session launcher. Resolves prompt via 4-tier chain, initializes signal protocol, spawns detached Copilot session in team workspace. Supports single team, multi-team, and all-teams modes. Handles `--reset` cleanup with hook execution and `--step` for single-step runs.
`npx tsx scripts/launch.ts --team <name> [--reset] [--step <step>] [--prompt "..."] [--prompt-file <path>] [--all] [--teams a,b,c]`

**onboard.ts** — **v0.2.0: Now a conversational wizard.** Team creation is interactive, not CLI-arg driven. Guides the user through questions to build team specification (name, domain-id, archetype, transport, description). Defaults to "start empty, add what's needed" — no archetype required. Creates team workspace via selected transport (worktree or directory), scaffolds federation state (signals, learnings, team registry entry), copies archetype team/ files if archetype selected, and commits initial state. CLI mode still supported for automation.
`npx tsx scripts/onboard.ts [--name <name>] [--domain-id <id>] [--archetype <id>] [--transport <type>] [--description "..."]`

**Conversational onboarding flow:**
```
User: "onboard a new team"
         │
         ▼
Wizard: "What's the team name?" → (user enters "backend-api")
         │
         ▼
Wizard: "Team ID?" → (suggests "backend-api", user confirms)
         │
         ▼
Wizard: "Choose archetype: [backend, deliverable, inventory, none]" → (user picks "backend")
         │
         ▼
Wizard: "Transport: [worktree, directory]" → (user picks "worktree")
         │
         ▼
Wizard: "Description?" → (user enters "Payments API backend service")
         │
         ▼
Core: Creates team, registers in .squad/teams.json, copies archetype team/ files, commits
         │
         ▼
Done: "Team 'backend-api' ready. Run 'launch --team backend-api' to start."
```

**Start empty approach:** Users can skip archetype selection. Team gets minimal federation
scaffolding (.squad/signals/, .squad/learnings/) with no archetype.json, no predefined states,
no monitoring. Meta-squad can later install archetype via "assign archetype" command.

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

**signal-protocol.ts** — Signal protocol implementation. Provides `ScanStatus`, `SignalMessage`, and `DomainWorktree` types. Functions: `readStatus`, `writeStatus`, `validateStatus` (runtime state validation against archetype schema), `loadArchetypeMetadata`, `initializeSignals`, `sendMessage`, `readMessages`, `acknowledgeMessage`, `discoverDomains`, `validateWorktree`.

**learning-log.ts** — `LearningLog` class. Append-only JSONL storage with `append()`, `query()` (with filters), `markGraduated()`, `count()`. Static methods `readFromBranch()` and `readAllDomains()` for cross-team reads via `git show`.

**ceremonies.ts** — Ceremony template definitions and markdown generator. Exports `CeremonyDefinition` interface, three built-in templates (`task-retro`, `knowledge-check`, `pre-task-triage`), and `generateCeremoniesMarkdown()`.

---

## 12. Onboarding Patterns

### Conversational Discovery

The onboarding wizard uses natural conversation to discover team requirements without forcing users to understand transport internals. Think intake interview, not dropdown menu.

**First question is always open-ended:**
```
> What's this team's mission?
```

**Follow-ups branch based on the answer:**

#### Pattern: Coding Team (Same Repo)
```
> Build the payment processing module

"Will they be writing code?" → Yes
"In this repository or different one?" → This one
"Should changes go through pull requests?" → Yes

→ WorktreeTransport auto-selected
→ Creates: squad/payments branch + worktree + .squad/ state
```

**Why Worktree:** Same repo = shared history. Git provides isolation, PRs flow naturally, full audit trail.

#### Pattern: Research Team
```
> Analyze competitor APIs

"Code or research/documents?" → Research and analysis docs
"Where should findings live?" → In this project, under docs/research

→ DirectoryTransport auto-selected
→ Creates: docs/research/ + .squad/ + archetype templates
```

**Why Directory:** Non-code work doesn't need git branch isolation. Deliverables live in team directory, progress tracked via .squad/status.json.

#### Pattern: External Project
```
> Mobile app team

"Working in this repository?" → No, separate repo
"Project location?" → /Users/vladi/devel/mobile-app
"Coordinate with teams here?" → Yes, via signals

→ RemoteTransport (future)
→ Signals connected, but team lives in different repo
```

### Mechanical Mode

For archetype creators and automation. Given archetype + config → autonomous setup:

```bash
npx tsx scripts/onboard.ts --mechanical \
  --archetype deliverable \
  --domain reports \
  --config '{"outputFormat":"markdown","aggregateScript":"summary.ts"}'
```

**Used by:**
- Archetype creator skill (scaffolds new archetypes)
- CI/CD pipelines
- Mass team provisioning scripts

### "Start Empty, Add What's Needed" Model

Onboarding creates minimal bootstrap, not kitchen-sink template:

**Base structure:**
```
.squad/
├── signals/              # Signal protocol directories
│   ├── inbox/
│   └── outbox/
└── learnings/            # Learning log (if enabled)
```

**Archetype adds only what it needs:**
- Deliverable archetype → adds `archetype.json`, monitor script, aggregation logic
- Coding archetype → adds agents, PR templates, test ceremony
- Consultant archetype → adds advisory playbook, no state machine

**Benefits:**
- Teams understand what they have (no mystery files)
- Archetypes evolve without migrating old bloat
- Easy to inspect what archetype provides vs. what's custom

---

## 13. SDK Organization

The SDK provides the contract layer between core and archetypes. All shared types and utilities live at `sdk/`.

### Barrel Export (sdk/index.ts)

Single import point for archetype developers:

```typescript
import {
  TeamTransport,
  MonitorCollector,
  ScanStatus,
  SignalMessage,
  selectTransport
} from '@squad/federation-core/sdk';
```

### Key Interfaces

**TeamTransport** (`sdk/transport.ts`)
```typescript
export interface TeamTransport {
  // File operations
  readFile(teamId: string, filePath: string): Promise<string | null>;
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  exists(teamId: string, filePath: string): Promise<boolean>;
  stat?(teamId: string, filePath: string): Promise<FileStats | null>;
  
  // Signal protocol
  listSignals(teamId: string, direction: 'inbox' | 'outbox', filter?: SignalFilter): Promise<SignalMessage[]>;
  watchSignals?(teamId: string, direction: 'inbox' | 'outbox', callback: (msg: SignalMessage) => void): () => void;
  
  // Workspace operations
  workspaceExists(teamId: string): Promise<boolean>;
  initializeWorkspace(teamId: string, config: WorkspaceConfig): Promise<void>;
  removeWorkspace(teamId: string): Promise<void>;
}
```

**MonitorCollector** (`sdk/monitor-base.ts`)
```typescript
export abstract class MonitorCollector {
  abstract collect(team: TeamContext): Promise<StatusData>;
  
  protected async readStatus(team: TeamContext): Promise<ScanStatus> {
    // Common status read logic
  }
  
  protected async readSignals(team: TeamContext, direction: 'inbox' | 'outbox'): Promise<SignalMessage[]> {
    // Signal access helper
  }
}
```

**Archetype authors extend this:**
```typescript
export class DeliverableMonitor extends MonitorCollector {
  async collect(team: TeamContext): Promise<StatusData> {
    const status = await this.readStatus(team);
    const signals = await this.readSignals(team, 'inbox');
    // Archetype-specific aggregation
    return { /* ... */ };
  }
}
```

### Extension Points

**Adding a New Archetype (No Core Changes):**

1. Create plugin package: `squad-archetype-{name}`
2. Define `meta/archetype.json` with states + monitor config
3. Implement `meta/monitor.ts` extending `MonitorCollector`
4. Add `team/` directory with agents/playbook
5. Publish to npm
6. Users `npm install` it → auto-discovered at runtime

**Transport Abstraction Benefits:**
- Archetype code never touches filesystem directly
- Works with worktrees, directories, future cloud storage
- Testable with mock transport
- Enables remote team coordination (future)

---

## 14. Design Decisions

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
- `lib/communication/signal-protocol.ts`: Add `validateStatus()`, `loadArchetypeMetadata()` (~60 lines)
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


---

## 15. Revision History

### 2026-04-16 — TeamTransport Split & Adapter Registry (v0.4.0)

**Author:** Mal (Lead)  
**Issue:** [#89](https://github.com/lygav/vladi-plugins-marketplace/issues/89)  
**Changes:**

1. **Split TeamTransport into two concerns:**
   - `TeamPlacement` — WHERE teams live (worktree, directory, cloud)
   - `TeamCommunication` — HOW teams communicate (file signals, Teams channels, pub-sub)
   - Both are federation-scoped; factory (`createTeamContext()`) composes them per team

2. **Adapter Registry Pattern:**
   - Communication adapters register at runtime via `CommunicationRegistry`
   - Default: `FileSignalCommunication` (signals in `.squad/signals/`)
   - Future: `TeamsChannelCommunication` (v0.5.0 roadmap)
   - Core 100% adapter-agnostic; no import of adapter implementations

3. **FileSignalCommunication (current):**
   - Signal files in `.squad/signals/inbox/` and `.squad/signals/outbox/`
   - Status in `.squad/signals/status.json`
   - Learning log in `.squad/learnings/log.jsonl`
   - Works with any placement (worktree, directory, cloud)

4. **TeamsChannelCommunication (v0.5.0 roadmap):**
   - Teams channels as first-class signal protocol
   - Hashtag-based: `#meta` (federation discussion), `#meta-status` (team status), `#meta-error` (team errors), `#{teamId}` (oversight)
   - Humans @mention teams in channels; teams read channel as signal input
   - Enables hybrid human-AI coordination at federation scale

5. **Configuration schema update:**
   - Added `communication.defaultType` and `communication.adapters` section
   - Supports per-adapter configuration (e.g., Teams tenant/client ID)
   - Placement remains per-team in `.squad/teams.json` metadata

6. **Documentation updates:**
   - §2 "Team Placement & Communication" — explains split, shows interfaces, documents adapter registry
   - §3 "Configuration" — documents communicationType field and adapter configuration
   - §6 "Onboarding Patterns" — clarifies placement is per-team, communication is federation-scoped

**Rationale:** 

Prior design force-fit communication adapters with unnecessary placement parameters (e.g., `FileSignalCommunication` didn't need placement but signature included it). This PR cleanly separates orthogonal concerns:
- Different teams can live in different places (placement) while using same communication protocol
- Same team can migrate communication protocol without changing placement (e.g., add Teams channel to project)
- New adapters (Redis pub-sub, Slack, Discord, etc.) implement only `TeamCommunication`, not placement

**Benefits:**

- **Separation of concerns** — Location and protocol independent
- **Protocol extensibility** — Add TeamsChannelCommunication v0.5.0 without team rebootstrap
- **Multi-protocol federations** — Gradual rollout of Teams channels alongside file signals
- **Design improvement** — Fixes Issue #97 design flaw (TeamPlacement not needed by all adapters)

**Impact:** Low-risk internal refactor. Public API unchanged (same `TeamContext` interface). Team onboarding and registry format (`teams.json`) unchanged. Federation-level config gains `communication` section.

---

### 2026-04-15 — DESIGN.md Consolidation (v0.3.2)

**Author:** Mal (Lead)  
**Issue:** [#78](https://github.com/lygav/vladi-plugins-marketplace/issues/78)  
**Changes:**

- Consolidated DESIGN.md (v0.2.0 design spec) into ARCHITECTURE.md
- Updated version from 0.2.0 to 0.3.2 to reflect shipped implementation
- Added "v0.3.x Evolution" section documenting key changes:
  - Minimal federation config (description + telemetry only)
  - Dynamic archetype discovery (marketplace.json + filesystem scan)
  - Two-mode onboarding (conversational + mechanical)
  - Archetype creator tool
  - Consultant archetype
  - Knowledge accumulation pattern
  - Team MCP inheritance
- Added comprehensive "Onboarding Patterns" section with conversational discovery flows
- Added "SDK Organization" section with interface details and extension points
- Added Executive Summary with design principles from DESIGN.md
- Removed DESIGN.md (served its purpose for v0.2.0 design phase)

**Rationale:** DESIGN.md was the technical design spec for v0.2.0. Now that v0.3.2 is shipped and stable, maintaining two large architectural docs creates confusion. ARCHITECTURE.md is the living doc—it should reflect what was built, not just what was designed. Unique technical content from DESIGN.md (SDK interfaces, onboarding patterns, design principles) has been absorbed here.

**Impact:** Single source of truth for squad-federation-core architecture. Future updates go here.

---

### 2026-04-14 — MCP Stack Removal (v0.3.2)

**Author:** Kaylee (Dev)  
**PR:** [#77](https://github.com/lygav/vladi-plugins-marketplace/pull/77)  
**Changes:**

- Removed `mcpStack` field from `federate.config.json`
- Teams inherit MCP servers from project `.mcp.json` automatically
- OTel MCP written directly to team worktree `.mcp.json` by launch.ts
- Updated all config examples and documentation
- Federation config reduced to 2 core fields: `description` + `telemetry`

**Rationale:** MCP servers configured at project level via `.mcp.json` are automatically inherited by all Copilot sessions (including headless team sessions). Separate federation-level MCP config was redundant.

---

### 2026-04-14 — Transport Concerns Moved to Onboarding (v0.3.0)

**Author:** Kaylee (Dev)  
**PR:** [#69](https://github.com/lygav/vladi-plugins-marketplace/pull/69)  
**Changes:**

- Removed `branchPrefix` and `worktreeDir` from federation-setup skill
- Transport selection (worktree vs. directory vs. remote) moved to onboarding wizard
- Federation-setup now only handles federation-level concerns (description, telemetry)
- Transport-specific settings (branch prefix, worktree location) configured per-team

**Rationale:** Different teams in same federation may use different transports. Branch prefix and worktree location are team-level decisions, not federation-level config.

---

### 2026-04-13 — Archetype State Machines (v0.2.0)

**Author:** Mal (Lead)  
**PR:** [#23](https://github.com/lygav/vladi-plugins-marketplace/pull/23)  
**Changes:**

- Archetypes now declare custom lifecycle states in `archetype.json`
- Core validates state transitions at runtime but never interprets semantics
- Monitor scripts render archetype-specific dashboards
- Added `StateSchema` interface to SDK

**Rationale:** Generic states ("working", "complete") too coarse for meaningful monitoring. Archetypes know their own lifecycles better than core. Enables richer observability (e.g., "Team Alpha 80% through distilling" vs. "Team Alpha working at 80%").

---

**End of Architecture Document**
