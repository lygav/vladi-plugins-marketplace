---
title: SDK Types
description: Core TypeScript interfaces for federation development
---

# SDK Types

Squad Federation provides TypeScript interfaces and types in `sdk/types.ts`. These define the contracts between core and archetypes.

## Core Interfaces

### TeamPlacement

Abstracts **where** team files live—handles file I/O and workspace location.

```typescript
export interface TeamPlacement {
  readFile(teamId: string, filePath: string): Promise<string | null>;
  writeFile(teamId: string, filePath: string, content: string): Promise<void>;
  exists(teamId: string, filePath: string): Promise<boolean>;
  stat?(teamId: string, filePath: string): Promise<{ isDirectory: boolean; size: number } | null>;
  getLocation(teamId: string): Promise<string>;
  listFiles(teamId: string, directory?: string): Promise<string[]>;
  bootstrap(teamId: string, archetypeId: string, config: Record<string, unknown>): Promise<void>;
  workspaceExists(teamId: string): Promise<boolean>;
}
```

**What it does:**
- `readFile` / `writeFile` — File operations scoped to team workspace
- `exists` / `stat` — Check file existence and metadata
- `getLocation` — Get workspace path or URL
- `listFiles` — Enumerate workspace contents
- `bootstrap` — Initialize new team workspace
- `workspaceExists` — Check if workspace is set up

### TeamCommunication

Abstracts **how** teams exchange signals and status—separated from placement to allow different communication protocols with unified file operations.

```typescript
export interface TeamCommunication {
  readStatus(teamId: string): Promise<ScanStatus | null>;
  readInboxSignals(teamId: string): Promise<SignalMessage[]>;
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;
  readOutboxSignals(teamId: string): Promise<SignalMessage[]>;
  listSignals(
    teamId: string,
    direction: 'inbox' | 'outbox',
    filter?: { type?: string; since?: string; from?: string }
  ): Promise<SignalMessage[]>;
  readLearningLog(teamId: string): Promise<LearningEntry[]>;
  appendLearning(teamId: string, entry: LearningEntry): Promise<void>;
  watchSignals?(
    teamId: string,
    direction: 'inbox' | 'outbox',
    callback: (signal: SignalMessage) => void
  ): () => void;
}
```

**What it does:**
- `readStatus` — Get team's current state (scanning, complete, etc.)
- `readInboxSignals` / `writeInboxSignal` — Messages sent TO the team
- `readOutboxSignals` — Messages sent FROM the team
- `listSignals` — Query signals with filters
- `readLearningLog` / `appendLearning` — Team knowledge capture
- `watchSignals` (optional) — Real-time signal notifications for push-based transports

### TeamContext

Combines placement and communication for convenient team interactions.

```typescript
export interface TeamContext {
  domain: string;
  domainId: string;
  location: string;
  archetypeId: string;
  placement: TeamPlacement;
  communication: TeamCommunication;
}
```

**What it does:** Encapsulates everything needed to work with a team—domain identity, workspace location, archetype type, and the adapters for file/signal operations.

### TeamEntry

Registry entry. Status field (v0.5.0+): `active` (default) | `paused` | `retired`.

Lifecycle: `active → paused ⇄ active`, `active|paused → retired` (terminal).

## Data Schemas

### ScanStatus

Represents a team's current state.

```typescript
interface ScanStatus {
  domain: string;
  domain_id: string;
  state: 'initializing' | 'scanning' | 'distilling' | 'complete' | 'failed' | 'paused';
  step: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  progress_pct?: number;
  error?: string;
  agent_active?: string;
}
```

**Fields:**
- `state` — Current lifecycle phase
- `step` — Human-readable current task
- `progress_pct` — Estimated completion (0-100)
- `error` — Error message if `state` is `failed`
- `agent_active` — Which agent is currently running

### SignalMessage

Inter-team communication message.

```typescript
interface SignalMessage {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;
  body: string;
  protocol: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
}
```

**Types:**
- `directive` — Tell a team what to do
- `question` — Request information
- `report` — Share findings or status
- `alert` — Raise error or blocking issue

**Protocol values:** `file-signal-v1`

### LearningEntry

Captured knowledge from team work.

```typescript
interface LearningEntry {
  id: string;
  timestamp: string;
  domain: 'generalizable' | string;
  category: 'pattern' | 'discovery' | 'convention' | 'gotcha';
  content: string;
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
  graduated?: boolean;
  relatedSkill?: string;
  context?: string;
}
```

**Fields:**
- `domain` — `generalizable` for cross-team learnings, or team-specific
- `category` — Type of insight
- `confidence` — How sure the team is about this learning
- `graduated` — Whether this became a skill
- `relatedSkill` — Skill file this came from or created

## Communication Implementations

### FileSignalCommunication

File-based signals (JSON inbox/outbox).

**Location:** `.squad/signals/inbox/` and `.squad/signals/outbox/`

**Signal format:** JSON files named `{timestamp}-{type}-{subject}.json`

**How it works:**
- Writes signals as JSON files
- Reads by parsing directory contents
- Acknowledgment via `.ack` files

## Next Steps

- [View configuration schema](/vladi-plugins-marketplace/reference/configuration)
- [Understand signal protocol](/vladi-plugins-marketplace/reference/signal-protocol)
- [Explore scripts reference](/vladi-plugins-marketplace/reference/scripts)
