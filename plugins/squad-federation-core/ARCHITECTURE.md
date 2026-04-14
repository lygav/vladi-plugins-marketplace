# squad-federation-core — Architecture

**Author:** Ripley (Lead Architect)
**Version:** 0.2.0
**Status:** Current

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

---

## 2. Team Discovery & Transport Abstraction

### Team Registry (.squad/teams.json)

The **team registry** is the source of truth for team discovery. It replaces hardcoded
`git worktree list` calls with a declarative manifest:

```json
{
  "version": "1.0",
  "teams": [
    {
      "domain": "team-alpha",
      "domainId": "alpha-001",
      "archetypeId": "deliverable",
      "transport": "worktree",
      "location": "/Users/user/project-team-alpha",
      "branch": "squad/team-alpha",
      "createdAt": "2025-01-15T10:00:00Z",
      "metadata": {}
    },
    {
      "domain": "team-beta",
      "domainId": "beta-002",
      "archetypeId": "coding",
      "transport": "directory",
      "location": ".squad-teams/team-beta",
      "createdAt": "2025-01-16T14:30:00Z",
      "metadata": {}
    }
  ]
}
```

**Benefits:**
- Multi-transport federations (worktree + directory + remote in same project)
- Fast team lookup (no git subprocess calls)
- Extensible metadata (store custom team properties)
- Enables future mesh routing (team-to-team signals)

### TeamTransport Interface

All team workspace operations go through the `TeamTransport` interface, defined in `sdk/transport.ts`:

```typescript
export interface TeamTransport {
  // File operations
  readFile(teamId: string, filePath: string): Promise<string | null>;
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  exists(teamId: string, filePath: string): Promise<boolean>;
  
  // Status & signals
  readStatus(teamId: string): Promise<ScanStatus | null>;
  readInboxSignals(teamId: string): Promise<SignalMessage[]>;
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;
  readOutboxSignals(teamId: string): Promise<SignalMessage[]>;
  
  // Learning log
  readLearningLog(teamId: string): Promise<LearningEntry[]>;
  appendLearning(teamId: string, entry: LearningEntry): Promise<void>;
  
  // Workspace management
  workspaceExists(teamId: string): Promise<boolean>;
  getLocation(teamId: string): Promise<string>;
  listFiles(teamId: string, directory?: string): Promise<string[]>;
  bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void>;
}
```

**Core never imports transport implementations.** Transport selection happens at runtime
via the registry's `transport` field.

### WorktreeTransport (lib/worktree-transport.ts)

Git worktree adapter for v0.1.0 compatibility. Teams live on permanent branches:

**Branch naming:** `{branchPrefix}{team-name}` (default: `squad/team-alpha`)

**Lifecycle:**
```bash
# Create
git branch squad/team-alpha main
git worktree add ~/project-team-alpha squad/team-alpha

# Discovery (replaced by registry)
# OLD: git worktree list --porcelain
# NEW: Read .squad/teams.json

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

### DirectoryTransport (lib/directory-transport.ts)

Standalone directory adapter. Teams exist in `.squad-teams/{teamName}/`:

**Benefits:**
- No git required (works in monorepos, cloud sync, etc.)
- Simpler setup for non-git users
- File-based backups (just copy directory tree)

**Tradeoffs:**
- No version control for team workspace
- No cross-read via `git show` (use direct file reads)

### Future Transports (v0.3.0+)

- **RemoteTransport** — Teams in separate repos (HTTP/SSH)
- **CloudTransport** — Azure Blob Storage / S3 (serverless orchestration)
- **TeamsChannelTransport** — Microsoft Teams channels (human-in-loop coordination)
- **EventHubTransport** — Azure Event Hub (pub-sub mesh)

See DESIGN.md §4.2 for transport roadmap.

### Transport Selection

Scripts use `selectTransport()` helper from `lib/team-registry.ts`:

```typescript
import { selectTransport } from './lib/team-registry.js';

const team = registry.teams.find(t => t.domain === 'team-alpha');
const transport = selectTransport(team.transport, config);

const status = await transport.readStatus(team.domain);
```

Core is **100% transport-agnostic**. Adding a new transport requires:
1. Implement `TeamTransport` interface
2. Register in `selectTransport()` factory
3. Document in DESIGN.md

No changes to core scripts, signals, or knowledge lifecycle.

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

Located at the project root. Controls federation plumbing only — team-specific
configuration lives inside each worktree.

```typescript
interface FederateConfig {
  /** Brief description of what this federation does */
  description?: string;

  /** Git branch prefix for team worktrees. Default: "squad/" */
  branchPrefix: string;

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
  "description": "Inventory all Azure services across the organization",
  "telemetry": { "enabled": true }
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

**signals.ts** — Signal protocol implementation. Provides `ScanStatus`, `SignalMessage`, and `DomainWorktree` types. Functions: `readStatus`, `writeStatus`, `validateStatus` (runtime state validation against archetype schema), `loadArchetypeMetadata`, `initializeSignals`, `sendMessage`, `readMessages`, `acknowledgeMessage`, `discoverDomains`, `validateWorktree`.

**learning-log.ts** — `LearningLog` class. Append-only JSONL storage with `append()`, `query()` (with filters), `markGraduated()`, `count()`. Static methods `readFromBranch()` and `readAllDomains()` for cross-team reads via `git show`.

**ceremonies.ts** — Ceremony template definitions and markdown generator. Exports `CeremonyDefinition` interface, three built-in templates (`task-retro`, `knowledge-check`, `pre-task-triage`), and `generateCeremoniesMarkdown()`.

---

## 12. Design Decisions

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

