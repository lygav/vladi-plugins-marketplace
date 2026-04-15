---
title: SDK Types
description: TypeScript interfaces and schemas for Squad Federation
---

# SDK Types

Squad Federation provides TypeScript interfaces and Zod schemas in the `packages/sdk/src/` directory.

## Core Interfaces

### TeamPlacement

Abstracts **where** team files live (worktree, directory, custom).

```typescript
interface TeamPlacement {
  /**
   * Get the absolute path to the team's root directory.
   */
  getRootPath(): string;

  /**
   * Read a file from the team's workspace.
   * @param relativePath - Path relative to team root (e.g., "status.json")
   * @returns File content as string
   */
  readFile(relativePath: string): Promise<string>;

  /**
   * Write a file to the team's workspace.
   * @param relativePath - Path relative to team root
   * @param content - File content to write
   */
  writeFile(relativePath: string, content: string): Promise<void>;

  /**
   * List files in a directory within the team's workspace.
   * @param relativePath - Directory path relative to team root (default: "")
   * @returns Array of file/directory names
   */
  listFiles(relativePath?: string): Promise<string[]>;

  /**
   * Check if a file exists in the team's workspace.
   * @param relativePath - Path relative to team root
   */
  fileExists(relativePath: string): Promise<boolean>;

  /**
   * Commit changes (git-based placements only).
   * @param message - Commit message
   */
  commit(message: string): Promise<void>;

  /**
   * Push changes to remote (git-based placements only).
   */
  push(): Promise<void>;

  /**
   * Clean up resources (e.g., delete worktree).
   */
  cleanup(): Promise<void>;
}
```

### TeamCommunication

Abstracts **how** teams exchange signals (file-signal, teams-channel).

```typescript
interface TeamCommunication {
  /**
   * Read signals from a team's inbox or outbox.
   * @param teamId - Team identifier
   * @param box - "inbox" or "outbox"
   * @returns Array of signal messages
   */
  readSignals(teamId: string, box: 'inbox' | 'outbox'): Promise<SignalMessage[]>;

  /**
   * Write a signal to a team's inbox.
   * @param teamId - Team identifier
   * @param signal - Signal message to send
   */
  writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void>;

  /**
   * Write a signal from a team to the outbox.
   * @param teamId - Team identifier
   * @param signal - Signal message to send
   */
  writeOutboxSignal(teamId: string, signal: SignalMessage): Promise<void>;

  /**
   * Acknowledge a signal (mark as read).
   * @param teamId - Team identifier
   * @param signalId - Signal identifier
   */
  acknowledgeSignal(teamId: string, signalId: string): Promise<void>;

  /**
   * Read team status.
   * @param teamId - Team identifier
   * @returns Team status object
   */
  readStatus(teamId: string): Promise<ScanStatus>;

  /**
   * Write team status.
   * @param teamId - Team identifier
   * @param status - Status object
   */
  writeStatus(teamId: string, status: ScanStatus): Promise<void>;
}
```

### TeamContext

High-level team workspace interface combining placement and communication.

```typescript
interface TeamContext {
  readonly teamId: string;
  readonly placement: TeamPlacement;
  readonly communication: TeamCommunication;

  /**
   * Log a learning to the team's learning log.
   * @param entry - Learning entry
   */
  logLearning(entry: LearningEntry): Promise<void>;

  /**
   * Read all learnings for this team.
   * @returns Array of learning entries
   */
  readLearnings(): Promise<LearningEntry[]>;

  /**
   * Update the team's current status.
   * @param status - Status update
   */
  updateStatus(status: Partial<ScanStatus>): Promise<void>;

  /**
   * Get the team's current status.
   */
  getStatus(): Promise<ScanStatus>;

  /**
   * Send a signal to another team or meta squad.
   * @param to - Recipient team ID
   * @param signal - Signal message
   */
  sendSignal(to: string, signal: Omit<SignalMessage, 'id' | 'timestamp' | 'from'>): Promise<void>;

  /**
   * Receive signals from inbox.
   * @returns Array of unacknowledged signals
   */
  receiveSignals(): Promise<SignalMessage[]>;
}
```

## Data Schemas

### SignalMessage

```typescript
interface SignalMessage {
  id: string;              // Unique identifier (e.g., "sig-1706611200000-abc123")
  timestamp: string;       // ISO 8601 timestamp
  from: string;            // Sender team ID
  to: string;              // Recipient team ID
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;         // Brief subject line
  body: string;            // Detailed message content
  protocol: string;        // "file-signal-v1" or "teams-channel-v1"
}
```

**Zod Schema:**

```typescript
import { z } from 'zod';

const SignalMessageSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(['directive', 'question', 'report', 'alert']),
  subject: z.string(),
  body: z.string(),
  protocol: z.string()
});

type SignalMessage = z.infer<typeof SignalMessageSchema>;
```

### LearningEntry

```typescript
interface LearningEntry {
  timestamp: string;       // ISO 8601 timestamp
  domain: string;          // Team name
  category: 'pattern' | 'discovery' | 'convention' | 'gotcha';
  content: string;         // The insight (1-2 sentences)
  tags: string[];          // Keywords for search
  context?: string;        // Optional details
}
```

**Zod Schema:**

```typescript
const LearningEntrySchema = z.object({
  timestamp: z.string(),
  domain: z.string(),
  category: z.enum(['pattern', 'discovery', 'convention', 'gotcha']),
  content: z.string(),
  tags: z.array(z.string()),
  context: z.string().optional()
});

type LearningEntry = z.infer<typeof LearningEntrySchema>;
```

### ScanStatus

```typescript
interface ScanStatus {
  state: 'initializing' | 'scanning' | 'distilling' | 'complete' | 'failed' | 'paused';
  step?: string;           // Current sub-task
  updated_at: string;      // ISO 8601 timestamp
  agent_active?: string;   // Active agent name
  progress_pct?: number;   // Estimated completion (0-100)
  error?: string;          // Error message if failed
}
```

**Zod Schema:**

```typescript
const ScanStatusSchema = z.object({
  state: z.enum(['initializing', 'scanning', 'distilling', 'complete', 'failed', 'paused']),
  step: z.string().optional(),
  updated_at: z.string(),
  agent_active: z.string().optional(),
  progress_pct: z.number().min(0).max(100).optional(),
  error: z.string().optional()
});

type ScanStatus = z.infer<typeof ScanStatusSchema>;
```

## Configuration Types

### FederationConfig

```typescript
interface FederationConfig {
  federationName: string;
  communicationType: 'file-signal' | 'teams-channel';
  teamsConfig?: {
    teamId: string;        // MS Teams team GUID
    channelId: string;     // MS Teams channel GUID
  };
  telemetry?: {
    enabled: boolean;
    aspire?: boolean;
  };
}
```

**Zod Schema:**

```typescript
const FederationConfigSchema = z.object({
  federationName: z.string(),
  communicationType: z.enum(['file-signal', 'teams-channel']),
  teamsConfig: z.object({
    teamId: z.string(),
    channelId: z.string()
  }).optional(),
  telemetry: z.object({
    enabled: z.boolean(),
    aspire: z.boolean().optional()
  }).optional()
});

type FederationConfig = z.infer<typeof FederationConfigSchema>;
```

### TeamConfig

```typescript
interface TeamConfig {
  domain: string;          // Team name (slug)
  mission: string;         // Team objective
  placementType: 'worktree' | 'directory' | 'custom';
  placementOptions: Record<string, any>;  // Type-specific options
  archetypeId: string;     // Archetype identifier
}
```

**Zod Schema:**

```typescript
const TeamConfigSchema = z.object({
  domain: z.string(),
  mission: z.string(),
  placementType: z.enum(['worktree', 'directory', 'custom']),
  placementOptions: z.record(z.any()),
  archetypeId: z.string()
});

type TeamConfig = z.infer<typeof TeamConfigSchema>;
```

## Archetype Types

### ArchetypeConfig

```typescript
interface ArchetypeConfig {
  archetypeId: string;     // Unique identifier
  name: string;            // Display name
  states: string[];        // Valid state names
  skills: string[];        // Skill file paths (relative to archetype dir)
}
```

**Zod Schema:**

```typescript
const ArchetypeConfigSchema = z.object({
  archetypeId: z.string(),
  name: z.string(),
  states: z.array(z.string()),
  skills: z.array(z.string())
});

type ArchetypeConfig = z.infer<typeof ArchetypeConfigSchema>;
```

### ArchetypeManifest (Root)

```typescript
interface ArchetypeManifest {
  archetypes: {
    [archetypeId: string]: {
      path: string;        // Path to archetype directory
      archetypeJson: string;  // Path to archetype.json
    };
  };
}
```

## Placement-Specific Types

### WorktreePlacementOptions

```typescript
interface WorktreePlacementOptions {
  branch: string;          // Git branch name
  worktreePath?: string;   // Optional custom worktree path
}
```

### DirectoryPlacementOptions

```typescript
interface DirectoryPlacementOptions {
  path: string;            // Absolute or relative directory path
}
```

### CustomPlacementOptions

```typescript
type CustomPlacementOptions = Record<string, any>;  // Plugin-defined
```

## Registry Types

### TeamRegistry

```typescript
interface TeamRegistry {
  teams: TeamRegistryEntry[];
}

interface TeamRegistryEntry {
  domain: string;          // Team name (slug)
  teamId: string;          // Unique identifier (GUID)
  mission: string;         // Team objective
  archetypeId: string;     // Archetype identifier
  placementType: 'worktree' | 'directory' | 'custom';
  placementOptions: Record<string, any>;
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

**Zod Schema:**

```typescript
const TeamRegistryEntrySchema = z.object({
  domain: z.string(),
  teamId: z.string(),
  mission: z.string(),
  archetypeId: z.string(),
  placementType: z.enum(['worktree', 'directory', 'custom']),
  placementOptions: z.record(z.any()),
  createdAt: z.string(),
  updatedAt: z.string()
});

const TeamRegistrySchema = z.object({
  teams: z.array(TeamRegistryEntrySchema)
});

type TeamRegistry = z.infer<typeof TeamRegistrySchema>;
type TeamRegistryEntry = z.infer<typeof TeamRegistryEntrySchema>;
```

## Type Guards

### isSignalMessage

```typescript
function isSignalMessage(obj: any): obj is SignalMessage {
  return SignalMessageSchema.safeParse(obj).success;
}
```

### isLearningEntry

```typescript
function isLearningEntry(obj: any): obj is LearningEntry {
  return LearningEntrySchema.safeParse(obj).success;
}
```

### isScanStatus

```typescript
function isScanStatus(obj: any): obj is ScanStatus {
  return ScanStatusSchema.safeParse(obj).success;
}
```

## Usage Examples

### Reading Signals

```typescript
const communication = new FileSignalCommunication(config);
const signals = await communication.readSignals('frontend', 'inbox');

for (const signal of signals) {
  console.log(`${signal.type}: ${signal.subject}`);
  if (signal.type === 'directive') {
    // Handle directive
  }
}
```

### Writing Status

```typescript
const context = new TeamContextImpl(teamId, placement, communication);
await context.updateStatus({
  state: 'scanning',
  step: 'analyzing authentication module',
  progress_pct: 45
});
```

### Logging Learning

```typescript
await context.logLearning({
  timestamp: new Date().toISOString(),
  domain: 'frontend',
  category: 'pattern',
  content: 'Use factory pattern for service initialization',
  tags: ['architecture', 'di'],
  context: 'Simplifies testing and mocking'
});
```

## Extending Types

### Custom Placement

Implement `TeamPlacement` interface:

```typescript
class S3Placement implements TeamPlacement {
  constructor(private bucketName: string, private prefix: string) {}

  getRootPath(): string {
    return `s3://${this.bucketName}/${this.prefix}`;
  }

  async readFile(relativePath: string): Promise<string> {
    // S3 get object
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    // S3 put object
  }

  // ... implement other methods
}
```

### Custom Communication

Implement `TeamCommunication` interface:

```typescript
class SlackCommunication implements TeamCommunication {
  async readSignals(teamId: string, box: 'inbox' | 'outbox'): Promise<SignalMessage[]> {
    // Poll Slack channel for messages with hashtags
  }

  async writeInboxSignal(teamId: string, signal: SignalMessage): Promise<void> {
    // Post to Slack channel with #{teamId} hashtag
  }

  // ... implement other methods
}
```

## Next Steps

- [View full configuration schema](/reference/configuration)
- [Understand the signal protocol](/reference/signal-protocol)
- [Explore script usage](/reference/scripts)
