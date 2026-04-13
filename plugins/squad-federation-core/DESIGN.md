# Federation v0.2.0: Technical Design Specification

**Status:** Authoritative Technical Design  
**Version:** 0.2.0  
**Date:** 2026-04-13  
**Author:** Squad Team (Mal, Wash, Zoe)  
**Approved by:** Vladi Lyga

---

## Executive Summary

Federation v0.2.0 transforms the squad federation system from a **worktree-specific implementation** into a **general-purpose plugin SDK** for federated team coordination. The architecture introduces transport abstraction, archetype restructuring, and formalized extension points—enabling new archetypes and team deployment strategies without modifying core.

**Core Pillars:**

1. **Transport Abstraction** — Teams can exist anywhere (worktrees, directories, repos, cloud). Core is transport-agnostic.
2. **SDK Foundation** — Shared types/interfaces at `sdk/` enable archetype development as proper plugin extensions.
3. **Meta/Team Separation** — Archetypes cleanly separate orchestration concerns (meta) from execution concerns (team).
4. **Hybrid Monitoring** — Scripts collect mechanical data → skills interpret and present insights.
5. **Convention-Based Discovery** — Filesystem conventions reduce configuration overhead.
6. **Engineering Rigor** — Strict TypeScript, Zod validation, Vitest tests, comprehensive error handling.

**Design Principles:**

- **Core agnostic** — Core never imports archetype code. Zero coupling.
- **Open/Closed** — New archetypes extend the system without modifying core.
- **Interface-driven** — TypeScript contracts enforce archetype API.
- **Transport-neutral** — Team location is abstracted behind `TeamTransport` interface.
- **Start empty, add what's needed** — Onboarding creates minimal bootstrap, not kitchen-sink template.

---

## 1. Architecture Overview

### 1.1 System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT LAYER                          │
│  (Concrete federation: config, teams, domain context)       │
│                  federate.config.json                        │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│                   ARCHETYPE LAYER                           │
│  (Work patterns: deliverable, coding, ETL, research)        │
│                                                              │
│  meta/                      team/                           │
│  ├── skills/                ├── skills/                     │
│  │   ├── setup              │   └── playbook               │
│  │   ├── aggregation        ├── templates/                 │
│  │   ├── monitor            │   ├── launch-prompt-*.md     │
│  │   └── triage             │   └── cleanup-hook.sh        │
│  ├── archetype.json         └── archetype.json             │
│  └── scripts/                                               │
│      └── aggregate.ts                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓ implements
┌─────────────────────────────────────────────────────────────┐
│                      CORE LAYER                             │
│  (Generic federation infrastructure)                        │
│                                                              │
│  sdk/                       lib/                            │
│  ├── types.ts               ├── worktree-transport.ts       │
│  ├── transport.ts           ├── team-registry.ts            │
│  ├── monitor-base.ts        ├── signals.ts                  │
│  ├── triage-base.ts         ├── learning-log.ts             │
│  └── recovery-base.ts       └── config-loader.ts            │
│                                                              │
│  scripts/                   skills/                         │
│  ├── launch.ts              ├── federation-setup/           │
│  ├── onboard.ts             ├── launch-team/                │
│  ├── monitor.ts             ├── monitor-federation/         │
│  ├── sweep-learnings.ts     └── sync-skills/                │
│  └── graduate-learning.ts                                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Dependency Flow

**STRICT RULES:**

- Core → ❌ Archetype (zero imports, only reads manifest via filesystem)
- Core → ✅ SDK (defines interfaces)
- Archetype → ✅ SDK (implements interfaces)
- Archetype → ❌ Core internals (only uses SDK public API)
- Project → ✅ Archetype plugins (installed via package manager)
- Project → ✅ Core plugin (installed via package manager)

**Extension Point:** New archetypes are **discovered at runtime** via plugin.json manifest. Core loads archetype metadata (archetype.json) but never imports archetype code.

---

## 2. SDK Types & Interfaces

The SDK provides the **contract layer** between core and archetypes. All shared types live at `squad-federation-core/sdk/`.

### 2.0 SDK Barrel Export

For archetype developer convenience, the SDK exposes all types and utilities through a single barrel export:

```typescript
// sdk/index.ts

export * from './types.js';
export * from './transport.js';
export * from './monitor-base.js';
export * from './triage-base.js';
export * from './recovery-base.js';
```

**Usage in Archetype Code:**

```typescript
// squad-archetype-deliverable/meta/monitor.ts
import {
  MonitorCollector,
  TeamContext,
  ScanStatus,
  TeamTransport,
  selectTransport
} from '@squad/federation-core/sdk';

export class DeliverableMonitor extends MonitorCollector {
  async collect(team: TeamContext): Promise<StatusData> {
    // Implementation
  }
}
```

This eliminates the need for archetype authors to know the internal module structure — one import gets everything.

### 2.1 Core Interfaces

```typescript
// sdk/types.ts

/**
 * Archetype Manifest — Declares archetype capabilities and metadata.
 * Location: {archetype-plugin}/meta/archetype.json
 */
export interface ArchetypeManifest {
  /** Archetype unique identifier (e.g., "deliverable", "coding") */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Brief description */
  description: string;
  
  /** Semantic version */
  version: string;
  
  /** Core compatibility semver range */
  coreCompatibility?: string;  // e.g., ">=0.2.0 <1.0.0"
  
  /** State machine declaration */
  states: StateSchema;
  
  /** Monitor configuration */
  monitor: MonitorConfig;
  
  /** Triage configuration */
  triage?: TriageConfig;
  
  /** Recovery configuration */
  recovery?: RecoveryConfig;
  
  /** Schema validation (optional) */
  deliverableSchema?: {
    path: string;
    version: string;
  };
  
  /** Custom metadata (extensible) */
  metadata?: Record<string, unknown>;
}

/**
 * State Schema — Archetype-specific state machine.
 * Core validates but doesn't predefine ANY states.
 */
export interface StateSchema {
  /** Ordered lifecycle states */
  lifecycle: string[];
  
  /** Terminal states */
  terminal: string[];
  
  /** Pauseable states (optional) */
  pauseable?: string[];
  
  /** Valid transitions (optional constraints) */
  transitions?: Record<string, string[]>;
  
  /** State descriptions for UI */
  descriptions?: Record<string, string>;
}

/**
 * Monitor Configuration — Dashboard rendering metadata.
 */
export interface MonitorConfig {
  /** Script that collects raw monitoring data */
  script?: {
    path: string;
    outputFormat: 'json' | 'jsonl';
  };
  
  /** Skill that interprets monitoring data */
  skill?: string;
  
  /** Dashboard section metadata */
  display: {
    sectionTitle: string;
    stateProgressFormat: 'percentage' | 'step' | 'custom';
    groupByArchetype: boolean;
    archetypeEmoji?: string;  // Visual identifier for multi-archetype dashboards
  };
}

/**
 * Triage Configuration — Problem detection and diagnosis.
 */
export interface TriageConfig {
  /** Script that detects stalls/failures */
  script?: {
    path: string;
    outputFormat: 'json';
  };
  
  /** Skill that diagnoses root causes */
  skill?: string;
  
  /** Common diagnostic patterns */
  diagnostics: TriageDiagnostic[];
}

/**
 * Triage Diagnostic — Structured problem pattern.
 */
export interface TriageDiagnostic {
  id: string;
  pattern: string;
  indicators: string[];
  suggestedRecovery?: string[];
}

/**
 * Recovery Configuration — Automated/semi-automated fixes.
 */
export interface RecoveryConfig {
  /** Script that executes recovery actions */
  script?: {
    path: string;
  };
  
  /** Skill that recommends recovery actions */
  skill?: string;
  
  /** Predefined recovery actions */
  actions: RecoveryAction[];
}

/**
 * Recovery Action — Structured recovery procedure.
 */
export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  automated: boolean;
  script?: string;
  manualSteps?: string[];
}

/**
 * Team Context — Minimal data needed to interact with a team.
 */
export interface TeamContext {
  /** Team identifier */
  domain: string;
  
  /** Unique team ID */
  domainId: string;
  
  /** Transport-specific location */
  location: string;
  
  /** Archetype identifier */
  archetypeId: string;
  
  /** Transport adapter instance */
  transport: TeamTransport;
}

/**
 * Scan Status — Current team state (from status.json).
 */
export interface ScanStatus {
  domain: string;
  domain_id: string;
  state: string;  // Archetype-specific (no enum)
  step: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  progress_pct?: number;
  error?: string;
  agent_active?: string;
  archetype_id: string;
}
```

---

## 3. Transport Abstraction

### 3.1 TeamTransport Interface

The **single abstraction** for reading/writing to team workspaces. Decouples core from team location strategy.

```typescript
// sdk/transport.ts

/**
 * TeamTransport — Abstract interface for team workspace operations.
 * 
 * Implementations:
 * - WorktreeTransport (lib/worktree-transport.ts) — Git worktree branches
 * - DirectoryTransport (future) — Separate directories
 * - RemoteTransport (future) — Remote repositories
 * - CloudTransport (future) — Cloud storage
 */
export interface TeamTransport {
  /**
   * Read a file from team workspace.
   * @param teamId - Team identifier
   * @param filePath - Relative path from workspace root
   * @returns File contents as string, or null if not found
   */
  readFile(teamId: string, filePath: string): Promise<string | null>;
  
  /**
   * Write a file to team workspace.
   * @param teamId - Team identifier
   * @param filePath - Relative path from workspace root
   * @param content - File content
   */
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  
  /**
   * Check if a file exists in team workspace.
   * @param teamId - Team identifier
   * @param filePath - Relative path from workspace root
   * @returns True if file exists, false otherwise
   */
  exists(teamId: string, filePath: string): Promise<boolean>;
  
  /**
   * Get file/directory metadata (optional).
   * @param teamId - Team identifier
   * @param filePath - Relative path from workspace root
   * @returns Metadata if exists, null otherwise
   */
  stat?(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null>;
  
  /**
   * Read team status (status.json).
   * @param teamId - Team identifier
   * @returns Parsed ScanStatus, or null if not found
   */
  readStatus(teamId: string): Promise<ScanStatus | null>;
  
  /**
   * Read signal messages from inbox.
   * @param teamId - Team identifier
   * @returns Array of signal messages
   */
  readInboxSignals(teamId: string): Promise<SignalMessage[]>;
  
  /**
   * Write signal message to inbox.
   * @param teamId - Team identifier
   * @param signal - Signal message to write
   */
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;
  
  /**
   * Read signal messages from outbox.
   * @param teamId - Team identifier
   * @returns Array of signal messages
   */
  readOutboxSignals(teamId: string): Promise<SignalMessage[]>;
  
  /**
   * Read learning log entries.
   * @param teamId - Team identifier
   * @returns Array of learning entries
   */
  readLearningLog(teamId: string): Promise<LearningEntry[]>;
  
  /**
   * Append entry to learning log.
   * @param teamId - Team identifier
   * @param entry - Learning entry to append
   */
  appendLearning(teamId: string, entry: LearningEntry): Promise<void>;
  
  /**
   * List signals with optional filtering.
   * @param teamId - Team identifier
   * @param direction - Signal direction (inbox or outbox)
   * @param filter - Optional filter criteria
   * @returns Filtered signal messages
   */
  listSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    filter?: {
      type?: string;
      since?: string;
      from?: string;
    }
  ): Promise<SignalMessage[]>;
  
  /**
   * Watch signals for real-time updates (optional, for push-based transports).
   * @param teamId - Team identifier
   * @param direction - Signal direction (inbox or outbox)
   * @param callback - Callback invoked when new signal arrives
   * @returns Unsubscribe function
   */
  watchSignals?(
    teamId: string,
    direction: 'inbox' | 'outbox',
    callback: (signal: SignalMessage) => void
  ): () => void;
  
  /**
   * Check if team workspace exists.
   * @param teamId - Team identifier
   */
  workspaceExists(teamId: string): Promise<boolean>;
  
  /**
   * Get workspace path/location.
   * @param teamId - Team identifier
   * @returns Absolute path or URL
   */
  getLocation(teamId: string): Promise<string>;
  
  /**
   * List all files in workspace (for seeding/copying).
   * @param teamId - Team identifier
   * @param directory - Directory to list (default: root)
   */
  listFiles(teamId: string, directory?: string): Promise<string[]>;
  
  /**
   * Bootstrap a new team workspace.
   * @param teamId - Team identifier
   * @param archetypeId - Archetype to initialize
   * @param config - Initial configuration
   */
  bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void>;
}

/**
 * Signal Message — IPC message shape.
 */
export interface SignalMessage {
  id: string;
  timestamp: string;
  from: string;
  to: string;  // Recipient identifier — enables mesh routing
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;
  body: string;
  protocol: string;  // Protocol version (e.g., "1.0")
  acknowledged?: boolean;
  acknowledged_at?: string;
}

/**
 * Learning Entry — Append-only log entry.
 */
export interface LearningEntry {
  id: string;
  timestamp: string;
  type: 'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha';
  content: string;
  confidence: 'low' | 'medium' | 'high';
  tags?: string[];
  graduated?: boolean;
  graduated_to?: string;
  supersedes?: string;
}
```

### 3.2 WorktreeTransport Implementation

```typescript
// lib/worktree-transport.ts

import { TeamTransport, ScanStatus, SignalMessage, LearningEntry } from '../sdk/transport.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * WorktreeTransport — Git worktree adapter.
 * 
 * Assumptions:
 * - Teams are persistent git worktree branches
 * - Each team has independent .squad/ directory
 * - Worktree path: {repoName}-{teamName}
 * - Branch name: {branchPrefix}{teamName}
 */
export class WorktreeTransport implements TeamTransport {
  constructor(
    private repoRoot: string,
    private branchPrefix: string = 'squad/'
  ) {}
  
  async readFile(teamId: string, filePath: string): Promise<string | null> {
    const location = await this.getLocation(teamId);
    const fullPath = join(location, filePath);
    
    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath, 'utf-8');
  }
  
  async writeFile(teamId: string, filePath: string, content: string): Promise<void> {
    const location = await this.getLocation(teamId);
    const fullPath = join(location, filePath);
    writeFileSync(fullPath, content, 'utf-8');
  }
  
  async readStatus(teamId: string): Promise<ScanStatus | null> {
    const content = await this.readFile(teamId, '.squad/status.json');
    if (!content) return null;
    return JSON.parse(content) as ScanStatus;
  }
  
  async readInboxSignals(teamId: string): Promise<SignalMessage[]> {
    const location = await this.getLocation(teamId);
    const inboxPath = join(location, '.squad/signals/inbox');
    
    if (!existsSync(inboxPath)) return [];
    
    const files = readdirSync(inboxPath).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const content = readFileSync(join(inboxPath, f), 'utf-8');
      return JSON.parse(content) as SignalMessage;
    });
  }
  
  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    const filename = `${signal.timestamp}-${signal.type}-${signal.subject.replace(/\s+/g, '-')}.json`;
    await this.writeFile(teamId, `.squad/signals/inbox/${filename}`, JSON.stringify(signal, null, 2));
  }
  
  async readOutboxSignals(teamId: string): Promise<SignalMessage[]> {
    const location = await this.getLocation(teamId);
    const outboxPath = join(location, '.squad/signals/outbox');
    
    if (!existsSync(outboxPath)) return [];
    
    const files = readdirSync(outboxPath).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const content = readFileSync(join(outboxPath, f), 'utf-8');
      return JSON.parse(content) as SignalMessage;
    });
  }
  
  async readLearningLog(teamId: string): Promise<LearningEntry[]> {
    const content = await this.readFile(teamId, '.squad/learning.log');
    if (!content) return [];
    
    return content.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as LearningEntry);
  }
  
  async appendLearning(teamId: string, entry: LearningEntry): Promise<void> {
    const location = await this.getLocation(teamId);
    const logPath = join(location, '.squad/learning.log');
    const line = JSON.stringify(entry) + '\n';
    
    // Append mode
    writeFileSync(logPath, line, { flag: 'a', encoding: 'utf-8' });
  }
  
  async exists(teamId: string): Promise<boolean> {
    try {
      await this.getLocation(teamId);
      return true;
    } catch {
      return false;
    }
  }
  
  async getLocation(teamId: string): Promise<string> {
    const branchName = `${this.branchPrefix}${teamId}`;
    const output = execSync('git worktree list --porcelain', { 
      cwd: this.repoRoot, 
      encoding: 'utf-8' 
    });
    
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('branch ') && lines[i].includes(branchName)) {
        // Previous line is the worktree path
        const pathLine = lines[i - 1];
        if (pathLine.startsWith('worktree ')) {
          return pathLine.replace('worktree ', '');
        }
      }
    }
    
    throw new Error(`Worktree not found for team: ${teamId}`);
  }
  
  async listFiles(teamId: string, directory: string = ''): Promise<string[]> {
    const location = await this.getLocation(teamId);
    const targetDir = join(location, directory);
    
    if (!existsSync(targetDir)) return [];
    
    return readdirSync(targetDir, { recursive: true })
      .filter(f => typeof f === 'string')
      .map(f => f as string);
  }
  
  async bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void> {
    // Create worktree via git (implementation in onboard.ts)
    // This is a placeholder — actual implementation delegates to git commands
    throw new Error('bootstrap() not implemented in WorktreeTransport — use onboard.ts');
  }
}
```

---

## 4. Team Registry

Replaces `git worktree list` as the **source of truth** for team discovery. Enables multi-transport federations.

```typescript
// lib/team-registry.ts

import { TeamContext, TeamTransport } from '../sdk/transport.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Team Registry Entry
 */
interface TeamEntry {
  domain: string;
  domainId: string;
  archetypeId: string;
  transport: 'worktree' | 'directory' | 'remote';
  location: string;
  createdAt: string;
  federation?: {
    parent: string;           // Parent team identifier (e.g., "meta-squad")
    parentLocation: string;   // Parent team location path
    role: 'team' | 'meta';    // Team role in federation
  };
  metadata?: Record<string, unknown>;
}

/**
 * TeamRegistry — Centralized team discovery and management.
 * 
 * Replaces git worktree list as the source of truth.
 * Stored at: .squad/teams.json
 */
export class TeamRegistry {
  private registryPath: string;
  private transports: Map<string, TeamTransport>;
  private lock: FileLock;  // File lock for concurrent safety
  
  constructor(repoRoot: string) {
    this.registryPath = join(repoRoot, '.squad/teams.json');
    this.transports = new Map();
    this.lock = new FileLock(join(repoRoot, '.squad/.teams.lock'));
  }
  
  /**
   * Register a transport adapter.
   */
  registerTransport(name: string, transport: TeamTransport): void {
    this.transports.set(name, transport);
  }
  
  /**
   * Add a team to the registry.
   * Thread-safe via file lock to prevent concurrent modification during parallel onboards.
   */
  async addTeam(entry: TeamEntry): Promise<void> {
    return this.withLock(async () => {
      const registry = this.load();
      registry.teams.push(entry);
      this.save(registry);
    });
  }
  
  /**
   * Remove a team from the registry.
   * Thread-safe via file lock.
   */
  async removeTeam(domainId: string): Promise<void> {
    return this.withLock(async () => {
      const registry = this.load();
      registry.teams = registry.teams.filter(t => t.domainId !== domainId);
      this.save(registry);
    });
  }
  
  /**
   * Serialize registry operations via file lock for concurrent safety.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.lock.acquire();
    try {
      return await fn();
    } finally {
      this.lock.release();
    }
  }
  
  /**
   * List all teams.
   */
  async listTeams(): Promise<TeamContext[]> {
    const registry = this.load();
    
    return registry.teams.map(entry => {
      const transport = this.transports.get(entry.transport);
      if (!transport) {
        throw new Error(`Transport not registered: ${entry.transport}`);
      }
      
      return {
        domain: entry.domain,
        domainId: entry.domainId,
        location: entry.location,
        archetypeId: entry.archetypeId,
        transport
      };
    });
  }
  
  /**
   * Get a specific team.
   */
  async getTeam(domainId: string): Promise<TeamContext | null> {
    const teams = await this.listTeams();
    return teams.find(t => t.domainId === domainId) || null;
  }
  
  /**
   * Filter teams by archetype.
   */
  async getTeamsByArchetype(archetypeId: string): Promise<TeamContext[]> {
    const teams = await this.listTeams();
    return teams.filter(t => t.archetypeId === archetypeId);
  }
  
  private load(): { teams: TeamEntry[] } {
    if (!existsSync(this.registryPath)) {
      return { teams: [] };
    }
    
    const content = readFileSync(this.registryPath, 'utf-8');
    return JSON.parse(content);
  }
  
  private save(registry: { teams: TeamEntry[] }): void {
    writeFileSync(this.registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  }
}
```

---

## 4.1 Transport Selection

Transport selection happens at team onboard time and is stored in the team registry. Each team can use a different transport based on its deployment requirements.

**Default:** `worktree` — Same repository, tightly coupled, git-native isolation.

**Selection Workflow:**
1. During onboard, user is prompted for transport type
2. Transport-specific configuration is collected (e.g., branch prefix for worktree, directory path for standalone)
3. Registry entry stores transport type + location
4. Meta-squad reads through the transport interface — it doesn't care about implementation details

**Onboard Wizard Transport Options (v0.2.0):**
- **Worktree branch in this repo** (default) — `WorktreeTransport`
- **Separate directory on filesystem** — `DirectoryTransport`
- **Microsoft Teams channel** (stretch goal) — `TeamsChannelTransport`

**Helper Utility:**

```typescript
// sdk/transport.ts

/**
 * Auto-detect and instantiate appropriate transport for a team location.
 * @param location - Team workspace path or URL
 * @returns Configured transport instance
 */
export function selectTransport(location: string): TeamTransport {
  // Check if location is a git worktree
  if (existsSync(join(location, '.git'))) {
    return new WorktreeTransport(location);
  }
  
  // Check if location is a plain directory
  if (existsSync(location) && statSync(location).isDirectory()) {
    return new DirectoryTransport(location);
  }
  
  throw new Error(`Cannot determine transport for location: ${location}`);
}
```

---

## 4.2 Transport Roadmap

The transport interface is designed to support multiple backend strategies without protocol changes. This enables federation across diverse deployment environments.

### v0.2.0 Transports

#### DirectoryTransport (v0.2.0) — Standalone Directories (BASE CASE)
**Status:** Planned  
**Backend:** Separate directories at any arbitrary path (not git worktrees)  
**Signals:** Filesystem-based (inbox/outbox as JSON files)  
**Use Case:** Simple filesystem I/O, base transport class  
**Pros:** No git dependency, works at any path, foundation for other transports  
**Cons:** No automatic versioning, manual state management  
**Inheritance:** Base class — `WorktreeTransport` extends this and adds git operations on top

#### WorktreeTransport (v0.2.0) — Git Worktree Branches
**Status:** Implemented  
**Backend:** Git worktree branches with independent `.squad/` directories  
**Signals:** Filesystem-based (inbox/outbox as JSON files)  
**Use Case:** Tightly coupled teams in same repository, full git isolation  
**Pros:** Zero coordination overhead, permanent state, git-native audit trail  
**Cons:** Requires all teams in same repo, filesystem-only  
**Inheritance:** Extends `DirectoryTransport` — adds git branch/worktree management operations

#### TeamsChannelTransport (v0.2.0 STRETCH GOAL) — Microsoft Teams Integration
**Status:** Stretch Goal for v0.2.0  
**Backend:** Microsoft Teams channel as signal bus via MCP tools  
**Signals:** Teams channel messages with tagged format: `[from→to] type: subject`  
**Use Case:** Distributed teams, human-in-the-loop coordination, cross-machine federations  
**Pros:**
- Human-readable signal history
- Built-in notifications (Teams alerts)
- Supports manual intervention and approvals
- Works across machines/clouds
- No server infrastructure required — runs locally through MCP
- Uses existing Teams MCP tools available in Copilot sessions

**MCP Implementation Details:**
- `writeSignal()` → `PostChannelMessage` with tagged format: `[from→to] type: subject`
- `readSignals()` / `listSignals()` → `ListChannelMessages` or `SearchTeamMessagesQueryParameters` filtered by tags
- `writeStatus()` → Update pinned message in channel
- `readStatus()` → Read pinned message
- `watchSignals()` → **Poll-based** — calls `ListChannelMessages` every N seconds with time filter (NOT push-based)
- Incoming webhook can also be used for `writeSignal()` (simpler, no auth needed)
- Everything runs locally through MCP — no cloud infrastructure required

**Message Format:**
```
[meta-squad→payments] directive: Implement payment retry logic

Body of the directive goes here...

---
Protocol: 1.0
Signal ID: abc-123-def
Timestamp: 2026-04-13T18:30:00Z
```

**Implementation Notes:**
- Messages are posted to channel with structured tags
- `listSignals()` queries channel history with filtering
- `watchSignals()` polls via MCP every N seconds — the interface abstracts this (consumers don't know if it's polling or push)
- Acknowledgment via threaded reply or reaction
- Human operators can intervene by posting messages in same format

### v0.3.0+ Future Vision

#### EventHubTransport (v0.3.0+ Vision) — Azure Event Hub / Pub-Sub
**Status:** Future Vision  
**Backend:** Azure Event Hub or similar pub-sub system  
**Signals:** Push-based via event stream  
**Use Case:** High-throughput, cross-cloud federations, enterprise scale  
**Pros:**
- Designed for massive scale (1M+ signals/sec)
- Cloud-native durability and replay
- Multi-subscriber support
- Real-time push via `watchSignals()`

**Implementation Notes:**
- Signals published as events with routing metadata
- `listSignals()` queries event stream history
- `watchSignals()` subscribes to event stream
- Automatic retention policies

### Transport Interface Design Considerations

The `TeamTransport` interface includes both **pull-based** (filesystem polling) and **push-based** (event subscriptions) primitives:

- **Pull-based:** `readFile`, `writeFile`, `listSignals` — Work for all transports
- **Push-based:** `watchSignals` (optional) — Enables real-time updates for event-driven transports

This dual approach ensures:
1. Filesystem transports (worktree, directory) work without modification
2. Cloud/messaging transports (Teams, EventHub) can provide push notifications
3. Monitoring and orchestration logic doesn't need to know which transport is in use

**watchSignals() Contract — Transport-Agnostic Interface:**

The `watchSignals()` method provides a consistent interface regardless of implementation strategy:

- **Filesystem transports** — May use `fs.watch()` for native filesystem events OR polling (implementation choice)
- **TeamsChannelTransport** — Polls via MCP every N seconds (e.g., calls `ListChannelMessages` with time filter)
- **EventHubTransport (future)** — Real push subscription to event stream

**Key principle:** Consumer code is identical regardless of whether the transport uses native push events, filesystem watchers, or polling. The interface abstracts the mechanism.

**Transport Symmetry:** All transport method names are **non-hierarchical** — they don't imply hub-spoke topology. Methods like `readFile` and `writeFile` are symmetric and work bidirectionally. This supports future mesh architectures where any team can communicate with any other team directly.

---

## 4.3 Onboarding Wizard: Conversational Discovery

**Design Principle:** Users should never need to understand transport internals. The wizard uses natural conversation to reveal intent, then recommends the right transport automatically. Think intake interview, not dropdown menu.

### Conversational Flow

The onboard wizard discovers team requirements through guiding questions that naturally reveal intent. The first question is always open-ended, follow-ups branch based on the answer.

#### Pattern 1: Coding Team (Same Repo)

```
> Spin up a payments team

"What's this team's mission?"
> Build the payment processing module

"Will they be writing code?"
> Yes

"In this repository, or a different one?"
> This one

"Should their changes go through pull requests?"
> Yes

📋 Got it. Setting up:
   Name: payments
   Type: coding team
   Location: branch squad/payments
   Changes via: pull requests to main
   
   Proceed? [Y/n]
```

**→ Transport:** `WorktreeTransport` (auto-selected)  
**→ Creates:**
- Git branch: `squad/payments` (or custom prefix)
- Worktree: `.worktrees/payments/`
- `.squad/` directory in worktree with isolated state
- Team can work independently, create PRs, merge back to main

**Why Worktree:**
- Same repository means shared history, same dependencies
- Git worktree provides perfect isolation — no coordination overhead
- PRs flow naturally through git merge
- Full git audit trail
- Multiple teams can work on different features in parallel

---

#### Pattern 2: Research Team

```
> I need a team to analyze competitor APIs

"Will they be writing code, or producing research/documents?"
> Research and analysis docs

"Where should their findings live?"
> In this project, under docs/research

📋 Got it. Setting up:
   Name: api-research
   Type: research team
   Output: docs/research/
   
   Proceed? [Y/n]
```

**→ Transport:** `DirectoryTransport`  
**→ Creates:**
- Directory at `docs/research/` (or specified location)
- `.squad/` state tracking
- Archetype templates (markdown templates, data analysis scripts)
- Output artifacts stored directly in team directory

**Why Directory:**
- Non-code work doesn't need git branch isolation
- Archetype templates guide deliverable format
- Meta-squad can aggregate outputs by reading team directory
- Clean separation: deliverables live in team directory, meta-squad tracks progress via `.squad/status.json`

---

#### Pattern 3: External Project

```
> Set up a team for the mobile app

"Will they be working in this repository?"
> No, it's a separate repo

"Where's the project?"
> /Users/vladi/devel/mobile-app

"Will they need to coordinate with teams here?"
> Yes, via signals

📋 Got it. Setting up:
   Name: mobile-app
   Type: coding team
   Location: /Users/vladi/devel/mobile-app
   Signals: connected to this federation
   
   Proceed? [Y/n]
```

**→ Transport:** `DirectoryTransport` (pointed at existing directory)  
**→ Creates:**
- `.squad/` directory in target location
- Signal inbox/outbox as JSON files
- Status tracking in target directory
- Team works in existing checkout, changes tracked by existing git setup

**Why Directory:**
- Different codebase means different git history, possibly different organizations
- Directory transport decouples team workspace from meta-squad's repo
- Signals still flow through filesystem (meta-squad can reach team's `.squad/` directory)
- Team can push to its own origin independently

---

#### Pattern 4: Human Coordination

```
> I need an architecture review team with humans

"Will humans be actively participating?"
> Yes, the review board

"How should they communicate — Teams channel or async files?"
> Teams channel would be great

📋 Got it. Setting up:
   Name: arch-review
   Type: coordination team
   Channel: #arch-review in Teams
   
   Proceed? [Y/n]
```

**→ Transport:** `TeamsChannelTransport` (v0.2.0 stretch goal)  
**→ Creates:**
- Teams channel for human-readable signal history
- Meta-squad posts directives as channel messages
- Team posts status updates and reports back
- Humans can intervene by posting in structured format
- Signal format: `[from→to] type: subject` with body

**Why Teams:**
- Human-in-the-loop coordination requires visibility
- Built-in notifications (Teams alerts)
- Works across machines (not filesystem-bound)
- Meta-squad and humans both see same signal stream

**Fallback:** If Teams unavailable, automatically falls back to `DirectoryTransport` with local signal files.

---

### Branching Logic for Implementers

The conversational flow uses this decision logic:

| First Answer Contains | Follow-up Path |
|----------------------|----------------|
| "code", "build", "implement" | Ask: same repo or different? → same: PR or direct? → **WorktreeTransport** or **DirectoryTransport** |
| "research", "analysis", "document" | Ask: where should outputs live? → **DirectoryTransport** |
| "coordinate", "humans", "review board" | Ask: Teams channel or files? → **TeamsChannelTransport** or **DirectoryTransport** |
| repo path, directory path | Infer external project → **DirectoryTransport** |

The system infers transport based on natural language cues. Users never see "WorktreeTransport" or "DirectoryTransport" — they see plain language: "branch", "pull requests", "directory", "channel".

If confirmed:
1. Create transport-specific workspace
2. Bootstrap `.squad/` directory
3. Copy archetype `team/` templates
4. Register in team registry
5. Initialize signal directories
6. Cast initial agent team (if archetype provides default)
7. Commit changes (worktree commits to its branch, directory changes tracked separately)

---

### Wizard Implementation Sketch

```typescript
// skills/onboard-wizard.ts (pseudo-code)

async function runOnboardWizard() {
  // Step 1: What will this team work on?
  const workType = await askMultipleChoice(
    "What will this team work on?",
    [
      "Features/code in THIS repository",
      "A different codebase or external project",
      "Research, analysis, or document creation",
      "Coordination across teams or with people"
    ]
  );
  
  let transport: TeamTransport;
  let location: string;
  
  // Step 2: Auto-select transport based on work type
  switch (workType) {
    case 0: // Same repo
      const integration = await askMultipleChoice(
        "How should this team's work integrate?",
        ["Via pull requests to main (Recommended)", "Direct commits to a shared branch"]
      );
      transport = new WorktreeTransport(repoRoot);
      location = await transport.bootstrap(teamName, archetypeId, { branchPrefix: "squad/" });
      break;
      
    case 1: // Different codebase
      const projectLocation = await askChoice(
        "Where is the project?",
        ["Local path", "Git repo URL"]
      );
      if (projectLocation === 0) {
        const path = await askString("Enter local path:");
        location = path;
      } else {
        const url = await askString("Enter git URL:");
        location = await cloneRepository(url, `../${teamName}`);
      }
      transport = new DirectoryTransport(location);
      break;
      
    case 2: // Research/analysis
      const outputLocation = await askMultipleChoice(
        "Where should outputs be stored?",
        ["In a subfolder of this project (Recommended)", "A separate directory"]
      );
      location = outputLocation === 0 
        ? join(repoRoot, `.worktrees/${teamName}`)
        : await askString("Enter directory path:");
      transport = new DirectoryTransport(location);
      break;
      
    case 3: // Coordination
      const commMethod = await askMultipleChoice(
        "How should this team communicate?",
        ["Microsoft Teams channel (Recommended if Teams available)", "Local directory for signal files"]
      );
      if (commMethod === 0) {
        // Create Teams channel
        const channelId = await createTeamsChannel(teamName);
        transport = new TeamsChannelTransport(channelId);
        location = `teams://${channelId}`;
      } else {
        location = join(repoRoot, `.worktrees/${teamName}`);
        transport = new DirectoryTransport(location);
      }
      break;
  }
  
  // Show summary and confirm
  const summary = formatSummary(teamName, archetypeId, location, transport);
  const confirmed = await askConfirm(summary);
  
  if (confirmed) {
    await onboardTeam(teamName, archetypeId, transport, location);
  }
}
```

### Key Design Decisions

1. **No transport jargon in UI** — Users see "work in this repo" not "choose worktree transport"
2. **Work-first decision tree** — What the team does determines how it's organized
3. **Auto-recommendation** — Wizard picks the transport, user just confirms
4. **Progressive disclosure** — Only ask follow-up questions relevant to the work type
5. **Summary before commit** — Always show what will be created and why
6. **Escape hatches** — Expert users can skip wizard and specify transport directly via CLI flag

---

## 5. Archetype Structure

### 5.1 Meta vs Team Directory Convention

**Approved: Option A (Directory Convention)**

```
squad-archetype-{name}/
├── plugin.json
├── README.md
├── meta/                          # Meta-squad orchestration
│   ├── archetype.json             # Manifest + state machine
│   ├── skills/
│   │   ├── {name}-setup/          # Setup wizard
│   │   ├── {name}-aggregation/    # Collection & validation (if applicable)
│   │   ├── monitor-{name}/        # Status interpretation skill
│   │   └── triage-{name}/         # Problem diagnosis skill
│   ├── agents/
│   │   └── (optional agents)
│   └── scripts/
│       ├── monitor-{name}.ts      # Data collection script
│       ├── triage-{name}.ts       # Stall detection script
│       └── aggregate.ts           # Aggregation script (if applicable)
├── team/                          # Team execution resources
│   ├── skills/
│   │   └── {name}-playbook/       # Primary workflow skill
│   ├── templates/
│   │   ├── launch-prompt-first.md
│   │   ├── launch-prompt-refresh.md
│   │   ├── launch-prompt-reset.md
│   │   └── cleanup-hook.sh
│   └── archetype.json             # Team-level config template
└── package.json
```

### 5.2 plugin.json Schema

```json
{
  "name": "squad-archetype-deliverable",
  "version": "0.2.0",
  "description": "Deliverable work pattern archetype",
  "meta": {
    "skills": "meta/skills/",
    "agents": "meta/agents/",
    "archetype": "meta/archetype.json"
  },
  "team": {
    "skills": "team/skills/",
    "templates": "team/templates/",
    "archetype": "team/archetype.json"
  }
}
```

### 5.3 What Lives Where

**meta/** — Meta-squad concerns (orchestration):
- Setup wizards
- Aggregation skills/scripts
- Monitor skills/scripts (interpret team status)
- Triage skills/scripts (diagnose stuck teams)
- Recovery recommendations
- State machine definitions
- Dashboard rendering logic

**team/** — Team concerns (execution):
- Playbook skills (how to do the work)
- Launch prompt templates
- Cleanup hooks
- Deliverable schemas
- Error recovery guides
- Team-level config defaults

**KEY RULE:** Core does NOT copy meta/ to teams. Only team/ is seeded during onboarding.

---

## 6. Onboarding Model: "Start Empty, Add What's Needed"

### 6.1 Option 3 Approved

**OLD (Option 1):** Copy everything → remove what's wrong → lots of cleanup  
**NEW (Option 3):** Start empty → add what's needed → minimal bootstrap

### 6.2 Bootstrap Package

Every archetype provides a **minimal bootstrap** in `team/`:

1. **Essential skills** (playbook only, not all meta skills)
2. **Launch prompts** (templates for first/refresh/reset runs)
3. **Cleanup hooks** (archetype-specific reset logic)
4. **Default config** (team/archetype.json template)

**What's NOT copied:**
- Meta-squad skills (setup, aggregation, monitoring, triage)
- Scripts (monitor, triage, aggregate — only meta needs these)
- Marketplace discovery (deferred until team actually needs it)

### 6.3 Onboard Workflow

```typescript
// scripts/onboard.ts (simplified)

async function onboardTeam(domain: string, archetypeId: string) {
  // 1. Create transport-specific workspace (e.g., git worktree branch)
  const transport = await createTransport(archetypeId);
  await transport.bootstrap(domain, archetypeId, {});
  
  // 2. Copy team/ directory from archetype plugin
  const archetypePlugin = loadArchetypePlugin(archetypeId);
  const teamDir = join(archetypePlugin.path, 'team');
  const teamLocation = await transport.getLocation(domain);
  await copyDirectory(teamDir, teamLocation);
  
  // 3. Initialize .squad/ directory
  await transport.writeFile(domain, '.squad/status.json', JSON.stringify({
    domain,
    domain_id: generateId(),
    state: 'initializing',  // First state from archetype state machine
    step: 'bootstrap',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archetype_id: archetypeId
  }, null, 2));
  
  // 4. Create signal directories
  await transport.writeFile(domain, '.squad/signals/inbox/.gitkeep', '');
  await transport.writeFile(domain, '.squad/signals/outbox/.gitkeep', '');
  
  // 5. Initialize learning log
  await transport.writeFile(domain, '.squad/learning.log', '');
  
  // 6. Register team in registry
  const registry = new TeamRegistry(repoRoot);
  await registry.addTeam({
    domain,
    domainId: generateId(),
    archetypeId,
    transport: 'worktree',
    location: await transport.getLocation(domain),
    createdAt: new Date().toISOString()
  });
  
  // 7. Commit
  await commitChanges(domain, `chore: onboard team ${domain} (${archetypeId})`);
}
```

---

## 7. Hybrid Monitoring: Collect → Interpret

### 7.1 Strategy

**Scripts (mechanical):**
- Parse status.json from all teams
- Detect stalls (updated_at > threshold)
- Aggregate progress metrics
- Output structured JSON

**Skills (intelligent):**
- Interpret state transitions
- Recommend recovery actions
- Present human-readable dashboard
- Handle edge cases

### 7.2 Monitor Base Class

```typescript
// sdk/monitor-base.ts

import { TeamContext, ScanStatus } from './transport.js';

/**
 * MonitorCollector — Base class for monitoring scripts.
 * 
 * Archetypes extend this to collect archetype-specific data.
 */
export abstract class MonitorCollector<TData = unknown> {
  /**
   * Collect raw monitoring data for all teams.
   */
  abstract collect(teams: TeamContext[]): Promise<MonitorResult<TData>>;
  
  /**
   * Detect if a team is stalled.
   */
  protected isStalled(status: ScanStatus, thresholdMinutes: number = 60): boolean {
    const updatedAt = new Date(status.updated_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
    
    return diffMinutes > thresholdMinutes && !status.completed_at;
  }
  
  /**
   * Calculate progress percentage.
   */
  protected calculateProgress(status: ScanStatus, lifecycle: string[]): number {
    const currentIndex = lifecycle.indexOf(status.state);
    if (currentIndex === -1) return 0;
    
    return Math.round((currentIndex / (lifecycle.length - 1)) * 100);
  }
}

export interface MonitorResult<TData = unknown> {
  teams: Array<{
    domain: string;
    domainId: string;
    status: ScanStatus & TData;
    health: 'healthy' | 'stalled' | 'failed';
    progressPct: number;
  }>;
  summary: {
    total: number;
    active: number;
    complete: number;
    failed: number;
    stalled: number;
  };
}
```

### 7.3 Reference Implementation: monitor-deliverable

```typescript
// meta/scripts/monitor-deliverable.ts

import { MonitorCollector, MonitorResult } from '@squad/federation-core/sdk/monitor-base.js';
import { TeamContext } from '@squad/federation-core/sdk/transport.js';
import { TeamRegistry } from '@squad/federation-core/lib/team-registry.js';

interface DeliverableData {
  fragmentCount?: number;
  schemaVersion?: string;
  lastDiscovery?: string;
}

class DeliverableMonitor extends MonitorCollector<DeliverableData> {
  async collect(teams: TeamContext[]): Promise<MonitorResult<DeliverableData>> {
    const results = await Promise.all(teams.map(async team => {
      const status = await team.transport.readStatus(team.domainId);
      if (!status) {
        return null;
      }
      
      // Read archetype-specific data
      const deliverableData: DeliverableData = {};
      
      const schemaContent = await team.transport.readFile(team.domainId, '.squad/deliverable/schema.json');
      if (schemaContent) {
        const schema = JSON.parse(schemaContent);
        deliverableData.schemaVersion = schema.version;
      }
      
      const fragmentsDir = await team.transport.listFiles(team.domainId, '.squad/deliverable/fragments');
      deliverableData.fragmentCount = fragmentsDir.length;
      
      const health = status.error ? 'failed' 
        : this.isStalled(status) ? 'stalled' 
        : 'healthy';
      
      const lifecycle = ['initializing', 'scanning', 'distilling', 'aggregating', 'reviewing', 'complete', 'failed'];
      const progressPct = this.calculateProgress(status, lifecycle);
      
      return {
        domain: team.domain,
        domainId: team.domainId,
        status: { ...status, ...deliverableData },
        health,
        progressPct
      };
    }));
    
    const teams = results.filter(r => r !== null);
    
    return {
      teams,
      summary: {
        total: teams.length,
        active: teams.filter(t => !['complete', 'failed'].includes(t.status.state)).length,
        complete: teams.filter(t => t.status.state === 'complete').length,
        failed: teams.filter(t => t.health === 'failed').length,
        stalled: teams.filter(t => t.health === 'stalled').length
      }
    };
  }
}

// CLI entry point
async function main() {
  const registry = new TeamRegistry(process.cwd());
  const teams = await registry.getTeamsByArchetype('deliverable');
  
  const monitor = new DeliverableMonitor();
  const result = await monitor.collect(teams);
  
  console.log(JSON.stringify(result, null, 2));
}

main();
```

---

## 8. Extension Points

### 8.1 Adding a New Archetype (No Core Changes)

1. **Create archetype plugin structure:**
   ```
   squad-archetype-{name}/
   ├── plugin.json
   ├── meta/
   │   ├── archetype.json
   │   ├── skills/
   │   └── scripts/
   └── team/
       ├── skills/
       └── templates/
   ```

2. **Define state machine in meta/archetype.json:**
   ```json
   {
     "id": "my-archetype",
     "name": "My Archetype",
     "version": "1.0.0",
     "states": {
       "lifecycle": ["init", "working", "validating", "done"],
       "terminal": ["done", "failed"],
       "pauseable": ["working"]
     },
     "monitor": {
       "script": { "path": "meta/scripts/monitor-my-archetype.ts" },
       "display": { "sectionTitle": "My Teams" }
     }
   }
   ```

3. **Implement MonitorCollector:**
   ```typescript
   import { MonitorCollector } from '@squad/federation-core/sdk/monitor-base.js';
   
   class MyArchetypeMonitor extends MonitorCollector {
     async collect(teams) { /* ... */ }
   }
   ```

4. **Install archetype plugin:**
   ```bash
   npm install squad-archetype-{name}
   ```

5. **Use it:**
   ```bash
   gh copilot run --plugin squad-federation-core -- federation setup
   # Select "my-archetype" from list
   ```

**Zero changes to core.** The archetype is discovered via plugin.json, loaded via TeamRegistry, and integrated via SDK interfaces.

---

## 9. Testing Strategy

### 9.1 Stack: Vitest

- Fast, TypeScript-native
- Built-in mocking
- Watch mode for TDD
- Coverage reports

### 9.2 Test Categories

**Unit Tests:**
- SDK types (Zod validation)
- Transport implementations (mock filesystem)
- Registry operations (add/remove/list)
- Monitor base class logic
- Utility functions

**Integration Tests:**
- Full onboard → monitor → triage workflow
- Multi-archetype federation
- Signal protocol round-trip
- Learning log append/read

**Contract Tests:**
- Archetype manifest schema validation
- Transport interface compliance (all adapters must pass same suite)
- State machine transition validation

### 9.3 Test Harness

```typescript
// tests/harness/mock-transport.ts

import { TeamTransport, ScanStatus, SignalMessage, LearningEntry } from '../../sdk/transport.js';

/**
 * MockTransport — In-memory transport for testing.
 */
export class MockTransport implements TeamTransport {
  private files: Map<string, Map<string, string>> = new Map();
  
  async readFile(teamId: string, filePath: string): Promise<string | null> {
    const teamFiles = this.files.get(teamId);
    return teamFiles?.get(filePath) || null;
  }
  
  async writeFile(teamId: string, filePath: string, content: string): Promise<void> {
    if (!this.files.has(teamId)) {
      this.files.set(teamId, new Map());
    }
    this.files.get(teamId)!.set(filePath, content);
  }
  
  async readStatus(teamId: string): Promise<ScanStatus | null> {
    const content = await this.readFile(teamId, '.squad/status.json');
    return content ? JSON.parse(content) : null;
  }
  
  // ... implement other methods
  
  /**
   * Test helper: seed a team with data.
   */
  seedTeam(teamId: string, files: Record<string, string>): void {
    this.files.set(teamId, new Map(Object.entries(files)));
  }
}
```

**Usage:**
```typescript
import { describe, it, expect } from 'vitest';
import { MockTransport } from './harness/mock-transport.js';
import { DeliverableMonitor } from '../meta/scripts/monitor-deliverable.js';

describe('DeliverableMonitor', () => {
  it('should detect stalled teams', async () => {
    const transport = new MockTransport();
    transport.seedTeam('team-alpha', {
      '.squad/status.json': JSON.stringify({
        domain: 'team-alpha',
        state: 'scanning',
        updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h ago
      })
    });
    
    const monitor = new DeliverableMonitor();
    const result = await monitor.collect([{
      domain: 'team-alpha',
      domainId: 'alpha',
      location: '/mock',
      archetypeId: 'deliverable',
      transport
    }]);
    
    expect(result.teams[0].health).toBe('stalled');
  });
});
```

---

## 10. Stack Decisions

### 10.1 Validation: Zod

**Why:** Type-safe schema validation with TypeScript inference. Already in PR #22.

```typescript
import { z } from 'zod';

const ArchetypeManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  states: z.object({
    lifecycle: z.array(z.string()).min(1),
    terminal: z.array(z.string()).min(1)
  })
});

// Load and validate
const manifest = ArchetypeManifestSchema.parse(JSON.parse(content));
```

### 10.2 Testing: Vitest

**Why:** Fast, modern, TypeScript-native. Better DX than Jest.

```bash
npm install -D vitest
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
```

### 10.3 Discovery: Convention-Based

**No IoC container.** Filesystem conventions + manifest files.

- Archetypes discovered via plugin.json
- States loaded from archetype.json
- Teams discovered via TeamRegistry
- Skills auto-discovered by Copilot

---

## 11. Reference Implementation Plan

**Build order:**

### Phase 1: Foundation (Week 1)
1. SDK types (`sdk/types.ts`, `sdk/transport.ts`)
2. TeamTransport interface
3. WorktreeTransport implementation (`lib/worktree-transport.ts`)
4. TeamRegistry (`lib/team-registry.ts`)
5. Zod validation for config (update PR #22)
6. Vitest setup + mock transport harness

**Deliverable:** Transport abstraction working, test infrastructure ready

### Phase 2: Archetype Restructure (Week 2)
1. Restructure deliverable archetype (meta/ + team/)
2. Restructure coding archetype (meta/ + team/)
3. Update plugin.json for both
4. Update onboard.ts for "start empty" model
5. Migration guide

**Deliverable:** Both archetypes follow new structure

### Phase 3: Monitor Framework (Week 2-3)
1. MonitorCollector base class (`sdk/monitor-base.ts`)
2. Reference: monitor-deliverable script
3. Reference: monitor-deliverable skill (interpret output)
4. monitor-coding script + skill

**Deliverable:** Hybrid monitoring working for both archetypes

### Phase 4: Triage + Recovery (Week 3-4)
1. TriageCollector base class (`sdk/triage-base.ts`)
2. RecoveryAction base class (`sdk/recovery-base.ts`)
3. Deliverable triage script + skill
4. Coding triage script + skill
5. Recovery recommendations for both

**Deliverable:** Full monitor → triage → recover cycle

### Phase 5: Polish (Week 4)
1. Update ARCHITECTURE.md
2. Migration guide for v0.1.0 → v0.2.0 federations
3. Contract test suite
4. Documentation refresh

**Deliverable:** v0.2.0 release-ready

---

## 12. Migration Path (v0.1.0 → v0.2.0)

### 12.1 Breaking Changes

1. **Archetype structure** — meta/ and team/ directories required
2. **Team discovery** — TeamRegistry replaces git worktree list
3. **Onboarding** — "start empty" model replaces "copy everything"

### 12.2 Backward Compatibility

**Temporary dual support:**

```typescript
// lib/archetype-loader.ts

function loadArchetypeManifest(plugin: PluginMetadata): ArchetypeManifest {
  // Try new structure first
  const newPath = join(plugin.path, 'meta/archetype.json');
  if (existsSync(newPath)) {
    return JSON.parse(readFileSync(newPath, 'utf-8'));
  }
  
  // Fallback to legacy structure
  const legacyPath = join(plugin.path, 'archetype.json');
  if (existsSync(legacyPath)) {
    console.warn(`[DEPRECATED] ${plugin.name} uses legacy structure. Migrate to meta/team.`);
    return JSON.parse(readFileSync(legacyPath, 'utf-8'));
  }
  
  throw new Error(`Archetype manifest not found for ${plugin.name}`);
}
```

### 12.3 Migration Steps

1. **Install v0.2.0:** `npm update squad-federation-core`
2. **Update archetypes:** Install new archetype versions
3. **Migrate existing teams:**
   ```bash
   gh copilot run -- federation migrate-teams
   ```
   This creates `.squad/teams.json` from existing worktrees
4. **Verify:** `gh copilot run -- federation monitor`

---

## 13. Open Questions

1. **Archetype versioning:** How to handle archetype plugin updates when teams are already onboarded?
2. **State rollback:** If a team needs to go back to a previous state, how does that work?
3. **Multi-archetype monitoring:** Should dashboard group by archetype or show unified view?
4. **Transport fallback:** If a transport fails (e.g., git worktree corrupted), can we recover?
5. **Signal retention:** Do we ever garbage collect old signals, or keep forever as audit trail?
6. **Learning graduation approval:** Graduation proposals queue to meta-squad inbox; human operator confirms via `/approve-graduation` command or similar mechanism.
7. **Ceremony enforcement:** How do we ensure teams actually run required ceremonies?

---

## 14. Success Criteria

**v0.2.0 is successful when:**

1. ✅ New archetype can be added without touching core code
2. ✅ Transport abstraction supports worktrees + at least one other adapter (directory or remote)
3. ✅ Monitor script + skill work for both deliverable and coding archetypes
4. ✅ Onboarding creates minimal bootstrap (< 10 files), not kitchen sink
5. ✅ TeamRegistry replaces git worktree list as source of truth
6. ✅ All core libs have unit tests with >80% coverage
7. ✅ Integration test suite validates full lifecycle (onboard → monitor → triage)
8. ✅ Documentation updated (ARCHITECTURE.md, migration guide, archetype author guide)
9. ✅ Backward compatibility maintained for v0.1.0 federations

---

## Appendix A: Key TypeScript Interfaces (Full)

See sections 2, 3, 4, and 7 for complete interface definitions.

---

## Appendix B: Archetype Author Guide

**Coming in Phase 5** — Standalone guide for creating custom archetypes.

---

**End of Design Document**

---

## Revision History

### 2026-04-13 — Post-Opus Review Updates

**Author:** Mal (Lead)  
**PR:** #23  
**Changes Applied:**

**Group 1: Opus Review Fixes (REQUIRED)**
1. ✅ Added `exists(teamId, filePath)` method to `TeamTransport` interface for file existence checks without catching read errors
2. ✅ Added `stat?(teamId, filePath)` optional method for file/directory metadata
3. ✅ Added file locking strategy to `TeamRegistry` via `withLock()` private method for concurrent onboard safety
4. ✅ Resolved Open Question #6: Learning graduation approval workflow documented

**Group 2: Opus Suggestions (NICE-TO-HAVE)**
5. ✅ Added `sdk/index.ts` barrel export documentation (Section 2.0)
6. ✅ Documented `selectTransport()` utility for auto-detection (Section 4.1)
7. ✅ Added `coreCompatibility` semver field to `ArchetypeManifest` for version safety
8. ✅ Added `archetypeEmoji` to `MonitorConfig.display` for multi-archetype dashboard visualization

**Group 3: Mesh-Readiness Low-Hanging Fruit**
9. ✅ Added `to` field to `SignalMessage` interface for routable signals
10. ✅ Added `protocol` version field to `SignalMessage` interface (e.g., "1.0")
11. ✅ Added `federation` block to `TeamEntry` registry schema for parent/role tracking
12. ✅ Renamed `exists(teamId)` to `workspaceExists(teamId)` to distinguish from `exists(teamId, filePath)`
13. ✅ Verified transport method naming is non-hierarchical and mesh-ready

**Group 4: Transport Evolution for Push-Based Transports**
14. ✅ Added `listSignals(teamId, direction, filter?)` method to `TeamTransport` for filtered signal queries
15. ✅ Added optional `watchSignals?(teamId, direction, callback)` method for push-based transports (returns unsubscribe function)
16. ✅ Added Section 4.2: Future Transport Roadmap documenting planned transports:
    - WorktreeTransport (v0.2.0) — git worktree branches, filesystem signals
    - DirectoryTransport (v0.2.0) — standalone directories, filesystem signals
    - TeamsChannelTransport (v0.3.0 vision) — Microsoft Teams channels, human-readable push-based signals
    - EventHubTransport (v0.3.0+ vision) — Azure Event Hub, high-throughput pub-sub
17. ✅ Added Section 4.1: Transport Selection workflow and `selectTransport()` helper utility

**Impact:** These changes position federation-core for mesh architectures, push-based transports, and multi-environment deployments while maintaining backward compatibility with v0.1.0 worktree-only federations.
