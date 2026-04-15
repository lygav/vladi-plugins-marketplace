# Ground Truth Documentation: vladi-plugins-marketplace v0.5.0

**Generated:** 2025-01-30  
**Source:** Complete codebase scan of vladi-plugins-marketplace repository  
**Purpose:** Authoritative reference for what the code ACTUALLY does (not what docs say)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [SDK Layer](#sdk-layer)
3. [Placement Abstraction](#placement-abstraction)
4. [Communication Abstraction](#communication-abstraction)
5. [Registry System](#registry-system)
6. [Knowledge Management](#knowledge-management)
7. [Orchestration Layer](#orchestration-layer)
8. [Configuration System](#configuration-system)
9. [Script Entry Points](#script-entry-points)
10. [File Formats & Conventions](#file-formats--conventions)

---

## Architecture Overview

### v0.4.0 Major Change: Placement/Communication Separation

**Before v0.4.0:** Tightly coupled git worktree + file-signal implementation  
**After v0.4.0:** Clear abstraction layer allowing mix-and-match strategies

```
TeamContext {
  placement: TeamPlacement      // WHERE files live (worktree, directory)
  communication: TeamCommunication  // HOW teams exchange signals (file-signal, teams-channel)
}
```

**Key Insight:** Placement is **per-team** (teams can use different placement types), Communication is **federation-scoped** (all teams in a federation use the same communication type).

### Core Layers

1. **SDK Layer** (`sdk/`) - TypeScript interfaces, Zod schemas, base classes
2. **Lib Modules** (`scripts/lib/`) - Concrete implementations (placement, communication, registry, knowledge, orchestration, config)
3. **Scripts** (`scripts/*.ts`) - Entry points (onboard, launch, monitor, sweep, graduate, sync)
4. **Archetypes** (`plugins/squad-archetype-*/`) - Team lifecycle definitions with states and skills

---

## SDK Layer

Location: `/plugins/squad-federation-core/sdk/`

### types.ts - Core TypeScript Interfaces

**TeamPlacement Interface** (lines 17-77)

```typescript
interface TeamPlacement {
  // Workspace management
  workspaceExists(teamId: string): Promise<boolean>
  getLocation(teamId: string): Promise<string>
  
  // File I/O
  exists(teamId: string, path: string): Promise<boolean>
  read(teamId: string, path: string): Promise<string>
  write(teamId: string, path: string, content: string): Promise<void>
  delete(teamId: string, path: string): Promise<void>
  list(teamId: string, dirPath: string): Promise<string[]>
  
  // Bootstrap (create .squad directory structure)
  bootstrap(teamId: string): Promise<void>
  
  // Worktree-specific operations (optional, only on WorktreePlacement)
  commit?(teamId: string, message: string): Promise<void>
  push?(teamId: string): Promise<void>
  createPR?(teamId: string, title: string, description: string): Promise<string>
  crossRead?(teamId: string, sourceBranch: string, path: string): Promise<string>
}
```

**TeamCommunication Interface** (lines 79-160)

```typescript
interface TeamCommunication {
  // Status (read/write .squad/status.json)
  readStatus(teamId: string): Promise<ScanStatus | null>
  writeStatus(teamId: string, status: ScanStatus): Promise<void>
  
  // Signals (inbox/outbox JSON files)
  readSignals(teamId: string, direction: 'inbox' | 'outbox'): Promise<SignalMessage[]>
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>
  writeOutboxSignal(teamId: string, signal: SignalMessage): Promise<void>
  acknowledgeSignal(teamId: string, signalId: string): Promise<void>
  
  // Learning log (append-only JSONL)
  readLearningLog(teamId: string): Promise<LearningEntry[]>
  appendLearning(teamId: string, entry: Omit<LearningEntry, 'id' | 'ts' | 'version'>): Promise<LearningEntry>
}
```

**TeamContext** (lines 169-196) - Minimal team data + adapters

```typescript
interface TeamContext {
  domain: string
  domainId: string
  location: string
  archetypeId: string
  placement: TeamPlacement
  communication: TeamCommunication
}
```

**SignalMessage** - Signal types and protocol

```typescript
interface SignalMessage {
  id: string
  timestamp: string
  from: string
  to: string
  type: 'directive' | 'question' | 'report' | 'alert'
  subject: string
  body: string
  protocol: string
}
```

**LearningEntry** - Knowledge log format

```typescript
interface LearningEntry {
  id: string
  ts: string
  version: string
  type: 'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha'
  agent: string
  domain?: string  // 'generalizable' for cross-domain learnings
  tags: string[]
  title: string
  body: string
  confidence: 'low' | 'medium' | 'high'
  source?: string
  supersedes?: string
  related_skill?: string
  evidence?: string[]
  graduated?: boolean
  graduated_to?: string
}
```

**ScanStatus** - Team health and state

```typescript
interface ScanStatus {
  state: 'initializing' | 'scanning' | 'distilling' | 'complete' | 'failed' | 'paused'
  step?: string
  updated_at: string
  agent_active?: string
  progress_pct?: number
  error?: string
}
```

### schemas.ts - Zod Validation (Single Source of Truth)

**CRITICAL:** Zod schemas are authoritative. TypeScript types should match but schemas control validation.

- `ScanStatusSchema` (lines 15-27)
- `SignalMessageSchema` (lines 32-43) - Enums: directive, question, report, alert
- `LearningEntrySchema` (lines 48-59) - Enums for type and confidence
- `FederateConfigSchema` (lines 196-223) - Complete config validation with defaults

### Base Classes

**MonitorBase** (`sdk/monitor-base.ts`) - Abstract class for archetype-specific monitors
- `abstract monitor(teamId: string): Promise<MonitorResult>`
- `emitMetrics()`, `emitEvent()`, `logInfo/Warn/Error()`

**TriageBase** (`sdk/triage-base.ts`) - Abstract class for issue classification
- `abstract triage(issue: unknown): Promise<TriageResult>`

**RecoveryBase** (`sdk/recovery-base.ts`) - Abstract class for automated recovery
- `abstract recover(issue: unknown): Promise<RecoveryResult>`

**OTelEmitter** (`sdk/otel-emitter.ts`) - Telemetry wrapper
- No-op when `OTEL_EXPORTER_OTLP_ENDPOINT` not set
- Best-effort export (never crashes caller)
- Methods: `span()`, `metric()`, `event()`, `log()`

---

## Placement Abstraction

Location: `/plugins/squad-federation-core/scripts/lib/placement/`

### DirectoryPlacement (Base Implementation)

File: `directory-placement.ts` (lines 19-251)

**Constructor:**
```typescript
constructor(
  basePathMap: Map<string, string>,  // teamId -> base path
  emitter?: OTelEmitter
)
```

**Key Methods:**

- `workspaceExists()` - Checks if `basePathMap` has teamId
- `getLocation()` - Returns `basePathMap.get(teamId)`
- `exists/read/write/delete/list` - Standard filesystem operations using `basePathMap` to resolve paths
- `bootstrap()` (lines 199-250) - Creates `.squad` directory structure:
  ```
  .squad/
  ├── signals/
  │   ├── inbox/
  │   └── outbox/
  ├── learnings/
  ├── status.json (initial state: initializing)
  └── signals/status.json (copy of status.json)
  ```

**Path Resolution Pattern:**
```typescript
private resolvePath(teamId: string, relativePath: string): string {
  const basePath = this.basePathMap.get(teamId)
  return path.join(basePath, relativePath)
}
```

### WorktreePlacement (Git Extension)

File: `worktree-placement.ts` (lines 29-500)

**Extends DirectoryPlacement via composition** (not true inheritance):
```typescript
class WorktreePlacement extends DirectoryPlacement {
  private branch: string
  private repoRoot: string
  
  constructor(basePath, branch, repoRoot, emitter?, teamId?) {
    const basePathMap = new Map([[teamId, basePath]])
    super(basePathMap, emitter)  // Passes to DirectoryPlacement
    this.branch = branch
    this.repoRoot = repoRoot
  }
}
```

**Static Factory Method** (lines 62-132):
```typescript
static async create(
  domain: string,
  baseBranch: string,
  repoRoot: string,
  baseDir: 'parallel' | 'inside' | string,
  emitter?: OTelEmitter
): Promise<WorktreePlacement>
```

**baseDir options:**
- `'parallel'` - Creates sibling to repo (e.g., `../worktrees/domain`)
- `'inside'` - Creates inside repo (e.g., `repo/.worktrees/domain`)
- Absolute path - Uses exact path

**Git Operations:**

`commit()` (lines 204-267) - Detailed error recovery:
```typescript
async commit(teamId: string, message: string): Promise<void> {
  // 1. Stage changes: git add -A
  // 2. Check if changes exist: git diff --cached --quiet
  // 3. If changes, commit with co-author trailer
  // 4. Detailed error handling for:
  //    - No changes to commit
  //    - Conflicts
  //    - Detached HEAD
  //    - Permission errors
}
```

`push()` (lines 269-312) - Push to remote with error recovery

`createPR()` (lines 314-328) - Create GitHub PR via gh CLI

`crossRead()` (lines 330-352) - **KEY FEATURE:** Read files from other branches without checkout
```typescript
async crossRead(teamId: string, sourceBranch: string, relativePath: string): Promise<string> {
  // Uses: git show <sourceBranch>:<relativePath>
  // Enables sweep-learnings to read across all team branches
}
```

---

## Communication Abstraction

Location: `/plugins/squad-federation-core/scripts/lib/communication/`

### FileSignalCommunication (File-Based)

File: `file-signal-communication.ts` (lines 78-324)

**Constructor:**
```typescript
constructor(
  placement: TeamPlacement,  // Delegates to placement for file I/O
  emitter?: OTelEmitter
)
```

**Delegation Pattern:** All file operations delegate to `placement.read/write/exists/list`.

**Status Operations** (lines 106-122):
```typescript
readStatus(teamId): Promise<ScanStatus | null> {
  const content = await placement.read(teamId, '.squad/status.json')
  return JSON.parse(content)
}
```

**Signal Operations** (lines 155-202):
- Signal files: `.squad/signals/{inbox|outbox}/{timestamp}-{type}-{subject-slug}.json`
- `readSignals()` - Lists directory, reads all JSON files, sorts by timestamp
- `writeInboxSignal/writeOutboxSignal()` - Writes signal to appropriate directory
- `acknowledgeSignal()` - Creates `.ack` file alongside signal

**Learning Log** (lines 279-323):
- File: `.squad/learnings/log.jsonl`
- `readLearningLog()` - Reads JSONL, parses each line, filters invalid entries
- `appendLearning()` - Generates ID, adds timestamp/version, appends to file

### TeamsChannelCommunication (Microsoft Teams)

File: `teams-channel-communication.ts` (lines 139-487)

**Constructor:**
```typescript
constructor(
  config: { teamId: string, channelId: string },
  emitter?: OTelEmitter
)
```

**Hashtag Protocol** (lines 159-162):

```typescript
// User to Meta: #meta (priority directive)
// Team to Meta: #meta-status (status update)
// Team to Meta: #meta-error (error report)
// Meta to Team: #{teamId} (directive to specific team)
```

**Message Format:**
- JSON in Adaptive Card format, OR
- Plain text parsed with hashtag extraction

**Signal Mapping:**
- Teams messages → SignalMessage objects (type inferred from hashtag)
- SignalMessage → Adaptive Card for Teams posting

**formatSignalAsAdaptiveCard()** (lines 214-244) - Converts SignalMessage to Teams card

---

## Registry System

Location: `/plugins/squad-federation-core/scripts/lib/registry/team-registry.ts`

### TeamRegistry Class (lines 103-459)

**Purpose:** Centralized team discovery replacing `git worktree list`. Thread-safe with file locking.

**Storage:** `.squad/teams.json`

```json
{
  "version": "1.0",
  "teams": [
    {
      "domain": "frontend",
      "domainId": "frontend-123",
      "archetypeId": "squad-archetype-coding",
      "placementType": "worktree",
      "location": "/path/to/.worktrees/frontend",
      "createdAt": "2025-01-30T12:00:00Z",
      "federation": {
        "parent": "meta-squad",
        "parentLocation": "/path/to/repo",
        "role": "team"
      },
      "metadata": {}
    }
  ]
}
```

**File Locking** (lines 373-456):
- Lock file: `.squad/teams.json.lock`
- Atomic exclusive create using `flag: 'wx'`
- Stale lock detection (>5s old)
- Auto-cleanup of stale locks
- Retry logic with 200ms delay

**CRUD Operations:**

```typescript
register(entry: TeamEntry): Promise<void>
unregister(domainOrId: string): Promise<boolean>
get(domainOrId: string): Promise<TeamEntry | null>
list(): Promise<TeamEntry[]>
update(domainOrId: string, updates: Partial<TeamEntry>): Promise<boolean>
exists(domainId: string): Promise<boolean>
```

**Validation:** Uses `TeamEntrySchema` for Zod validation before save.

**Detailed Error Messages:** Every operation includes recovery instructions in errors.

---

## Knowledge Management

### LearningLog Class

Location: `/plugins/squad-federation-core/scripts/lib/knowledge/learning-log.ts`

**Constructor:**
```typescript
constructor(squadRoot: string | { path: string })
// Creates: <squadRoot>/.squad/learnings/log.jsonl
```

**Methods:**

`append(entry)` (lines 59-68):
```typescript
// Auto-generates: id, ts, version
// Format: learn-{timestamp}-{random6}
// Returns: Full LearningEntry with generated fields
```

`query(filters)` (lines 70-106):
```typescript
// Filters: type, agent, tags, domain, since, confidence
// Returns: Filtered LearningEntry[]
```

**Static Methods for Cross-Branch Reading:**

`readFromBranch(branch, repoRoot)` (lines 112-129):
```typescript
// Uses: git show <branch>:.squad/learnings/log.jsonl
// Returns: LearningEntry[] from that branch
// NO checkout required
```

`readAllDomains(repoRoot)` (lines 134-157):
```typescript
// Lists branches matching FEDERATE_BRANCH_PREFIX (default: 'squad/')
// Reads log.jsonl from each branch via git show
// Returns: Map<domain, LearningEntry[]>
```

`markGraduated(id, graduatedTo)` (lines 159-187):
```typescript
// Sets: graduated=true, graduated_to=<skill-name>
// Rewrites entire log.jsonl file (atomic update)
```

### Signal Protocol

Location: `/plugins/squad-federation-core/scripts/lib/communication/signal-protocol.ts`

**Legacy Module:** Low-level helpers. Modern code should use `FileSignalCommunication` class instead.

---

## Orchestration Layer

Location: `/plugins/squad-federation-core/scripts/lib/orchestration/`

### context-factory.ts - TeamContext Composition

**Key Functions:**

`createPlacement(type, config, emitter)` (lines 96-125):
```typescript
// type: 'worktree' | 'directory'
// config: PlacementConfig
// Returns: TeamPlacement instance
```

`createCommunication(type, config, emitter)` (lines 136-147):
```typescript
// type: 'file-signal' | 'teams-channel'
// config: Record<string, unknown>
// Returns: TeamCommunication instance
```

`createTeamContext(teamEntry, federationConfig, repoRoot, emitter)` (lines 202-234):
```typescript
// 1. Infers PlacementConfig from TeamEntry.location and metadata
// 2. Creates placement adapter (per-team from TeamEntry.placementType)
// 3. Creates communication adapter (federation-wide from FederateConfig.communicationType)
// 4. Returns complete TeamContext
```

**PlacementConfig Inference** (lines 160-186):
- Worktree: Extracts branch from location path or metadata
- Directory: Uses domain as teamId

**Communication Adapter Registry** (lines 42-73):
```typescript
const communicationAdapters = new Map<string, CommunicationFactory>()

// Built-in adapters:
communicationAdapters.set('file-signal', ...)
communicationAdapters.set('teams-channel', ...)  // Lazy-loaded

// Custom adapters via:
registerCommunicationAdapter(type, factory)
```

### ceremonies.ts - Team Coordination Templates

**CeremonyDefinition Structure:**
```typescript
{
  name: string
  trigger: { when: 'before' | 'after' | 'manual', condition: string }
  facilitator: string
  participants: string[]
  agenda: string[]
  outputs: string[]
}
```

**Built-in Ceremonies:**

1. **task-retro** - After state==complete
   - Review deliverable, surface learnings
   - Tag generalizable patterns
   - Write retro report to outbox
   
2. **knowledge-check** - Before rescan
   - Review deliverable and learnings
   - Check inbox for meta updates
   - Set priorities

3. **pre-task-triage** - Before first run
   - Read seeded skills
   - Identify data sources
   - Draft work breakdown

`generateCeremoniesMarkdown()` (lines 103-120) - Generates `.squad/ceremonies.md` for seeding.

---

## Configuration System

Location: `/plugins/squad-federation-core/scripts/lib/config/config.ts`

### FederateConfig Interface

```typescript
interface FederateConfig {
  description?: string
  telemetry: {
    enabled: boolean
    aspire?: boolean  // .NET Aspire dashboard integration
  }
  communicationType: 'file-signal' | 'teams-channel'
  teamsConfig?: {
    teamId: string
    channelId: string
  }
  playbookSkill?: string  // Default: 'domain-playbook'
  deliverable?: string
  deliverableSchema?: string
  importHook?: string
}
```

**Defaults:**
```typescript
{
  telemetry: { enabled: true },
  communicationType: 'file-signal',
  playbookSkill: 'domain-playbook'
}
```

**Validation Function** (lines 83-201):

`validateConfig(raw)`:
- Warns on unknown fields
- Validates required fields
- Type checks with helpful error messages
- Enforces: `teamsConfig` required when `communicationType === 'teams-channel'`

`loadAndValidateConfig(configPath)` (lines 209-254):
- Returns defaults if file doesn't exist
- Detailed recovery instructions on parse/validation errors
- Process.exit(1) on failure with actionable steps

---

## Script Entry Points

Location: `/plugins/squad-federation-core/scripts/`

### onboard.ts - Create New Team

**Usage:**
```bash
npx tsx scripts/onboard.ts \
  --name "my-product" \
  --domain-id "abc-123" \
  --archetype "squad-archetype-deliverable" \
  [--description "What this domain covers"] \
  [--placement worktree|directory] \
  [--worktree-dir .worktrees] \
  [--path /custom/path] \
  [--base-branch main]
```

**Flow:**
1. Parse arguments and validate
2. Create workspace via placement (worktree or directory)
3. Seed team/ directory from archetype
4. Bootstrap .squad structure
5. Register team in TeamRegistry
6. Write DOMAIN_CONTEXT.md
7. Run `squad init` in workspace (casts team)

**Placement Types:**
- `worktree` (default) - Creates git branch + worktree
- `directory` - Creates standalone directory

**Worktree Directory Options:**
- `--worktree-dir .worktrees` (default) - Inside repo
- `--worktree-dir ../` - Sibling to repo
- Absolute path - Custom location

### launch.ts - Start Headless Session

**Usage:**
```bash
npx tsx scripts/launch.ts --team my-a-team
npx tsx scripts/launch.ts --team my-a-team --reset
npx tsx scripts/launch.ts --team my-a-team --step "distillation"
npx tsx scripts/launch.ts --team my-a-team --prompt "Do the thing"
npx tsx scripts/launch.ts --team my-a-team --prompt-file ./custom.md
npx tsx scripts/launch.ts --teams team-a,team-b
npx tsx scripts/launch.ts --all
```

**Prompt Resolution Order:**
1. `--prompt "string"` (CLI flag)
2. `--prompt-file path` (CLI flag)
3. `.squad/launch-prompt.md` (team worktree template)
4. Generic fallback (minimal built-in)

**Always Appended:** Signal protocol instructions (check inbox, update status.json, headless mode).

**Run Type Detection:**
- `first-run` - No status.json exists
- `refresh` - Status exists, not reset
- `reset` - `--reset` flag (clears status.json, inbox acks, runs cleanup hook)

**Launcher:**
- Default: `copilot -p <prompt> --yolo --no-ask-user --autopilot`
- Override: `SQUAD_LAUNCHER=agency` for agency copilot

**OTel MCP Config:** Writes `.mcp.json` to worktree if `telemetry.enabled=true`.

### monitor.ts - Dashboard + Directives

**Usage:**
```bash
npx tsx scripts/monitor.ts
npx tsx scripts/monitor.ts --watch --interval 30
npx tsx scripts/monitor.ts --send my-product --directive "Skip repo legacy-utils"
```

**Dashboard Display:**
- Sorted by state (failed → initializing → scanning → distilling → paused → complete)
- Shows: state emoji, domain, state, step, agent, progress%, error, last update time
- Stalled detection: Warns if no update in >10 minutes
- Deliverable/log existence check
- Recent learnings preview (up to 5)

**Directive Sending:**
- Creates SignalMessage with type='directive'
- Writes to team's inbox via TeamCommunication
- UUID for signal ID

### sweep-learnings.ts - Cross-Domain Pattern Detection

**Usage:**
```bash
npx tsx scripts/sweep-learnings.ts
npx tsx scripts/sweep-learnings.ts --min-occurrences 2
npx tsx scripts/sweep-learnings.ts --output .squad/decisions/inbox/sweep-report.md
npx tsx scripts/sweep-learnings.ts --tags "ci,deployment"
```

**Discovery:**
- Reads ALL team branches via `LearningLog.readAllDomains()`
- Filters for `domain: 'generalizable'` and `graduated: false`
- Optional tag filter

**Pattern Detection:**

1. **By Related Skill** - Groups learnings with same `related_skill`
2. **By Tags** - Groups learnings sharing tags
3. **By Similarity** - Extracts keywords from titles, groups if overlap ≥2

**Recommendation Logic:**
- `GRADUATE` if occurrences ≥2 (skill patterns)
- `INVESTIGATE` if occurrences ≥3 (tag patterns)
- `WATCH` otherwise

**Report Sections:**
- Patterns by Related Skill (with evidence)
- Patterns by Tag (top 10)
- Patterns by Similarity
- Ungrouped generalizable learnings

### graduate-learning.ts - Promote Learnings to Skills

**Usage:**
```bash
npx tsx scripts/graduate-learning.ts --candidates
npx tsx scripts/graduate-learning.ts --id <ID> --target-skill my-skill
npx tsx scripts/graduate-learning.ts --from-sweep .squad/decisions/inbox/sweep-report.md
```

**Modes:**

1. **--candidates** - Lists high-confidence generalizable learnings with scores
   - Score: confidence(3) + evidence count + related_skill(2) + tags(1 if ≥3)

2. **--id + --target-skill** - Generate graduation draft
   - Creates `.squad/decisions/inbox/graduation-{id}.md`
   - Includes: summary, detail, evidence, tags, proposed skill addition, next steps

3. **--from-sweep** - Parse sweep report for `GRADUATE` recommendations
   - Extract skill patterns
   - Generate drafts for each

4. **--mark-graduated** (internal) - Update learning log
   - Sets `graduated=true`, `graduated_to=<skill>`

### sync-skills.ts - Propagate Skill Updates

**Usage:**
```bash
npx tsx scripts/sync-skills.ts
npx tsx scripts/sync-skills.ts --skill my-skill
npx tsx scripts/sync-skills.ts --team my-team
npx tsx scripts/sync-skills.ts --dry-run
```

**Sync Strategy:**
1. Fetch `origin/main` (or local `main` if no remote)
2. Stash uncommitted changes
3. Checkout `.squad/skills/` from main
4. Commit with message: `sync: update {skill} from main`
5. Update `.squad/sync-state.json` with latest commit hash
6. Pop stash

**Conflict Detection:**
- Compares file hashes between main and team branch
- Checks if domain modified skill after last sync
- Skips sync if conflicts detected

**Sync State:**
```json
{
  "last_sync_from": "main",
  "last_sync_commit": "abc123...",
  "last_sync_at": "2025-01-30T12:00:00Z",
  "skills_synced": ["skill1", "skill2"]
}
```

**Temp Worktree Fallback:** If team has no worktree, creates temporary one for sync.

### create-archetype.ts

**Purpose:** Create new archetype plugins (not read in this scan).

**Location:** `scripts/create-archetype.ts` (file too large, not included in scan).

---

## File Formats & Conventions

### Signal File Naming

**Pattern:** `{timestamp}-{type}-{subject-slug}.json`

**Example:** `1706611200000-directive-skip-legacy-utils.json`

**Location:**
- Inbox: `.squad/signals/inbox/`
- Outbox: `.squad/signals/outbox/`

**Acknowledgment:** Create `.ack` file alongside signal (e.g., `{signal-file}.ack`)

### Learning Log Format

**File:** `.squad/learnings/log.jsonl`

**Format:** Newline-delimited JSON (JSONL)

**Entry Example:**
```json
{"id":"learn-1706611200000-abc123","ts":"2025-01-30T12:00:00Z","version":"1.0","type":"pattern","agent":"lead","domain":"generalizable","tags":["testing","ci"],"title":"Parallel test execution","body":"Running tests in parallel reduces CI time by 60%","confidence":"high","related_skill":"testing-strategy","evidence":["PR #123 benchmark results"]}
```

**Version:** `1.0` (current)

### Status File

**File:** `.squad/status.json` (and `.squad/signals/status.json` - both maintained)

**Example:**
```json
{
  "state": "scanning",
  "step": "repository analysis",
  "updated_at": "2025-01-30T12:00:00Z",
  "agent_active": "lead",
  "progress_pct": 45,
  "error": null
}
```

### Team Registry

**File:** `.squad/teams.json`

**Schema:** See [Registry System](#registry-system) section.

### Federation Config

**File:** `federate.config.json` (root of repository)

**Schema:** See [Configuration System](#configuration-system) section.

### Sync State

**File:** `.squad/sync-state.json`

**Example:**
```json
{
  "last_sync_from": "main",
  "last_sync_commit": "abc123def456...",
  "last_sync_at": "2025-01-30T12:00:00Z",
  "skills_synced": ["domain-playbook", "testing-strategy"]
}
```

---

## Archetype Discovery

Location: `/plugins/squad-federation-core/scripts/lib/archetypes/discovery.ts`

### discoverArchetypes() Function

**Discovery Strategy:**
1. Read `.github/plugin/marketplace.json`
2. Filter plugins where `category === 'archetype'`
3. Read lifecycle states from `<plugin>/team/archetype.json`

**Returns:**
```typescript
interface DiscoveredArchetype {
  name: string
  description: string
  version: string
  source: string  // e.g., 'plugins/squad-archetype-deliverable'
  states: string[]  // From archetype.json states.lifecycle
  category: string  // Should be 'archetype'
}
```

**archetype.json Structure:**
```json
{
  "states": {
    "lifecycle": ["preparing", "scanning", "distilling", "aggregating"]
  }
}
```

**Available Archetypes (from scan):**
- `squad-archetype-coding`
- `squad-archetype-consultant`
- `squad-archetype-deliverable`

---

## Key Implementation Details

### Worktree vs Directory Placement

**When to use Worktree:**
- Teams need git history
- Meta-squad needs to read across team branches
- PR creation from team to main
- Cross-team learning sweeps

**When to use Directory:**
- Standalone teams without git
- External systems integration
- Custom storage backends

**Mixing Strategies:** v0.4.0+ allows different teams in same federation to use different placement types.

### File-Signal vs Teams-Channel Communication

**When to use File-Signal:**
- Local/git-based workflows
- Offline capability
- Debugging/inspecting signals directly

**When to use Teams-Channel:**
- Human oversight of team communication
- Integration with existing Teams workflows
- Real-time notifications

**Federation-Scoped:** ALL teams in a federation use the same communication type (from `federate.config.json`).

### Error Handling Patterns

**Every error includes recovery instructions:**

Example from TeamRegistry:
```typescript
throw new Error(
  `Team with ${conflictField} "${value}" already registered.\n` +
  `Existing team: ${existingTeam.domain}\n` +
  `Recovery:\n` +
  `  1. Check existing teams: cat .squad/teams.json\n` +
  `  2. If duplicate is a mistake, remove it manually: vim .squad/teams.json\n` +
  `  3. Or use a different domain ID: npx tsx scripts/onboard.ts --name <name> --domain-id <unique-id> --archetype <arch>\n` +
  `  4. List all teams to see conflicts: npx tsx scripts/monitor.ts\n` +
  `  5. If teams.json is corrupted, restore from git: git checkout HEAD -- .squad/teams.json`
)
```

### OTel Integration

**Emitter Usage:**
- Span: Track operation duration
- Metric: Counter/gauge for observability
- Event: Significant milestones
- Log: Structured logging

**Attributes (Common):**
- `squad.domain`
- `domain.id`
- `placement.type`
- `communication.type`
- `archetype.id`

**Environment Variables:**
- `OTEL_EXPORTER_OTLP_ENDPOINT` - If unset, OTel is no-op
- `OTEL_SERVICE_NAME` - Service identifier (e.g., `squad-frontend`)

---

## Migration Paths

### v0.3.x → v0.4.0

**Breaking Changes:**
1. `git worktree list` no longer used for team discovery
2. Must run `scripts/migrate-registry.ts` to populate `.squad/teams.json`
3. TeamPlacement/TeamCommunication abstraction introduced

**Backwards Compatibility:**
- FileSignalCommunication still default
- Worktree placement still default
- Existing worktrees work if registered

### v0.4.x → v0.5.0

**New Features:**
1. Teams-channel communication type
2. Hashtag protocol for Teams messages
3. Adaptive Card formatting

**Config Changes:**
```json
{
  "communicationType": "teams-channel",
  "teamsConfig": {
    "teamId": "...",
    "channelId": "..."
  }
}
```

---

## Testing & Validation

### Zod Schema Validation

**Runtime Validation Points:**
- Config loading: `FederateConfigSchema.parse()`
- Team registration: `TeamEntrySchema.parse()`
- Learning entries: `LearningEntrySchema.parse()`
- Signal messages: `SignalMessageSchema.parse()`

**Validation Errors:** Include field path and expected type.

### File Locking

**TeamRegistry Lock Algorithm:**
1. Try atomic create with `flag: 'wx'`
2. If EEXIST, check lock age
3. If stale (>5s), remove and retry
4. If not stale, wait 200ms and retry
5. Max retries: 10, max timeout: 5s

### Atomicity Guarantees

**Registry Save:**
- Write to `.squad/teams.json.tmp`
- Rename to `.squad/teams.json` (atomic on POSIX)

**Learning Append:**
- `fs.appendFileSync()` is atomic for single writes

**Status Update:**
- No atomic guarantee (race possible)
- Teams should handle stale reads

---

## Known Limitations & Gotchas

1. **WorktreePlacement extends DirectoryPlacement via composition** - Not true inheritance. Passes `basePathMap` to super().

2. **Teams channel messages can be JSON OR plain text** - Parser must handle both Adaptive Cards and hashtag extraction.

3. **signal-protocol.ts is legacy** - Modern code should use `FileSignalCommunication` class.

4. **Worktree create can specify baseDir** - 'parallel', 'inside', or absolute path. Default is '.worktrees'.

5. **crossRead() allows reading files from other branches** - No checkout required. Used by sweep-learnings.

6. **Status stored in TWO files** - `.squad/status.json` AND `.squad/signals/status.json`. Both maintained for compatibility.

7. **Learning log is append-only** - Except `markGraduated()` which rewrites entire file.

8. **Placement is per-team, communication is federation-scoped** - Teams can mix placement types, but all use same communication type.

9. **OTel is no-op when OTEL_EXPORTER_OTLP_ENDPOINT not set** - No errors, just silent no-op.

10. **Signal acknowledgment creates .ack file** - Not deleted automatically. Manual cleanup needed.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (unset) | OTel collector endpoint (http://localhost:4318) |
| `OTEL_SERVICE_NAME` | (varies) | Service identifier for OTel |
| `SQUAD_DOMAIN` | (unset) | Domain name for OTel context |
| `SQUAD_LAUNCHER` | `copilot` | Launcher command (copilot or agency) |
| `SQUAD_MAIN_BRANCH` | `main` | Main branch name for sync |
| `FEDERATE_BRANCH_PREFIX` | `squad/` | Prefix for team branches |
| `FEDERATE_DELIVERABLE` | (from config) | Deliverable filename |

---

## File System Layout

```
repository/
├── .squad/
│   ├── teams.json              # Team registry
│   ├── teams.json.lock         # Registry lock file
│   ├── skills/                 # Federation-wide skills
│   ├── decisions/inbox/        # Decision proposals
│   └── temp-worktrees/         # Temp worktrees for sync
├── .worktrees/                 # Team worktrees (default)
│   └── {domain}/
│       ├── .squad/
│       │   ├── status.json
│       │   ├── sync-state.json
│       │   ├── signals/
│       │   │   ├── inbox/
│       │   │   ├── outbox/
│       │   │   └── status.json
│       │   ├── learnings/
│       │   │   └── log.jsonl
│       │   └── ceremonies.md
│       ├── DOMAIN_CONTEXT.md
│       ├── run-output.log
│       └── .mcp.json           # OTel MCP config (if telemetry enabled)
├── federate.config.json        # Federation configuration
└── .github/plugin/
    └── marketplace.json        # Plugin registry
```

---

## Critical Code Paths

### Team Onboarding

1. Parse arguments (`onboard.ts:parseArgs`)
2. Validate archetype name (regex check)
3. Create workspace (`createTeamWorkspace`)
   - Worktree: `git worktree add`
   - Directory: `fs.mkdir`
4. Seed team directory (`seedTeamDirectory`)
5. Bootstrap .squad (`placement.bootstrap()`)
6. Register team (`registry.register()`)
7. Write DOMAIN_CONTEXT.md
8. Run `squad init` (cast team)

### Team Launch

1. Load config (`loadAndValidateConfig`)
2. Get team from registry (`registry.get()`)
3. Create TeamContext (`createTeamContext`)
4. Validate placement (`validatePlacement`)
5. Detect run type (`detectRunType`)
6. Reset if needed (`resetTeam`)
7. Resolve prompt (CLI → file → template → fallback)
8. Write OTel MCP config if enabled
9. Spawn headless session (`copilot --yolo --no-ask-user --autopilot`)

### Learning Sweep

1. Discover teams (`TeamRegistry.list()`)
2. Read all learning logs (`LearningLog.readAllDomains()`)
3. Filter for generalizable, non-graduated
4. Detect patterns (skill, tag, similarity)
5. Generate markdown report
6. Write to decisions inbox

### Skill Sync

1. Discover teams (`TeamRegistry.list()`)
2. Get main skills commit (`git log -1 -- .squad/skills`)
3. For each team:
   - Check sync state
   - Detect conflicts (hash comparison)
   - Checkout skills from main
   - Commit sync
   - Update sync-state.json

---

## Appendix: Zod Schema Enums

**SignalMessage.type:**
- `'directive'`
- `'question'`
- `'report'`
- `'alert'`

**LearningEntry.type:**
- `'discovery'`
- `'correction'`
- `'pattern'`
- `'technique'`
- `'gotcha'`

**LearningEntry.confidence:**
- `'low'`
- `'medium'`
- `'high'`

**ScanStatus.state:**
- `'initializing'`
- `'scanning'`
- `'distilling'`
- `'complete'`
- `'failed'`
- `'paused'`

**PlacementType:**
- `'worktree'`
- `'directory'`

**CommunicationType:**
- `'file-signal'`
- `'teams-channel'`

---

## Verification Checklist

This ground truth document was generated from:

- ✅ SDK layer: types.ts, schemas.ts, monitor-base.ts, triage-base.ts, recovery-base.ts, otel-emitter.ts
- ✅ Placement: directory-placement.ts, worktree-placement.ts
- ✅ Communication: file-signal-communication.ts, teams-channel-communication.ts, signal-protocol.ts
- ✅ Registry: team-registry.ts
- ✅ Knowledge: learning-log.ts
- ✅ Orchestration: context-factory.ts, ceremonies.ts
- ✅ Config: config.ts
- ✅ Archetypes: discovery.ts
- ✅ Scripts: launch.ts, monitor.ts, sweep-learnings.ts, graduate-learning.ts, sync-skills.ts
- ⚠️  Scripts: onboard.ts (partial - first 300 lines), create-archetype.ts (not read - file too large)
- ⚠️  Archetype plugins: Not scanned (deliverable, coding, consultant)
- ⚠️  Skills: Not scanned (federation-setup, federation-orchestration, etc.)

**Total files read:** 21 complete, 1 partial  
**Total lines analyzed:** ~15,000+

---

**End of Ground Truth Document v0.5.0**
