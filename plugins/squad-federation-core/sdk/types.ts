/**
 * SDK Types — Core Federation Type Definitions
 * 
 * This module provides the foundational TypeScript types and interfaces for the
 * federation SDK. These types define the contracts between core and archetypes.
 */

/**
 * TeamTransport — Abstract interface for team workspace operations.
 * 
 * Provides a unified API for interacting with team workspaces regardless of
 * their physical location (git worktree, directory, remote, cloud, etc.).
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
 * TeamContext — Minimal data needed to interact with a team.
 * 
 * Encapsulates the essential information for a team without coupling
 * to any specific transport implementation.
 */
export interface TeamContext {
  /** Team domain name */
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
 * TeamEntry — Registry entry with federation metadata.
 * 
 * Stored in .squad/teams.json as the source of truth for team discovery.
 */
export interface TeamEntry {
  domain: string;
  domainId: string;
  archetypeId: string;
  transport: 'worktree' | 'directory' | 'remote';
  location: string;
  createdAt: string;
  federation?: {
    parent: string;
    parentLocation: string;
    role: 'team' | 'meta';
  };
  metadata?: Record<string, unknown>;
}

/**
 * ScanStatus — Current team state (from status.json).
 * 
 * Archetype-specific state tracking. Core doesn't predefine ANY states.
 */
export interface ScanStatus {
  domain: string;
  domain_id: string;
  state: string;
  step: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  progress_pct?: number;
  error?: string;
  agent_active?: string;
  archetype_id: string;
}

/**
 * SignalMessage — IPC message shape for cross-team communication.
 * 
 * Includes `to` field for mesh routing and `protocol` for versioning.
 */
export interface SignalMessage {
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

/**
 * LearningEntry — Append-only log entry.
 * 
 * Captured insights from team execution that can be graduated to reusable skills.
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

/**
 * StateSchema — Archetype-specific state machine.
 * 
 * Core validates but doesn't predefine ANY states. Each archetype defines its own.
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
 * ArchetypeManifest — Declares archetype capabilities and metadata.
 * 
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
  coreCompatibility?: string;

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
 * MonitorConfig — Dashboard rendering metadata.
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
    archetypeEmoji?: string;
  };
}

/**
 * TriageConfig — Problem detection and diagnosis.
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
 * TriageDiagnostic — Structured problem pattern.
 */
export interface TriageDiagnostic {
  id: string;
  pattern: string;
  indicators: string[];
  suggestedRecovery?: string[];
}

/**
 * RecoveryConfig — Automated/semi-automated fixes.
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
 * RecoveryAction — Structured recovery procedure.
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
 * MonitorCollector — Base interface for monitoring scripts.
 * 
 * Archetypes extend this to collect archetype-specific monitoring data.
 */
export interface MonitorCollector<TData = unknown> {
  /**
   * Collect raw monitoring data for all teams.
   * @param teams - Array of team contexts to monitor
   */
  collect(teams: TeamContext[]): Promise<MonitorResult<TData>>;
}

/**
 * MonitorResult — Structured monitoring output.
 */
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

/**
 * TriageCollector — Base interface for triage scripts.
 * 
 * Archetypes extend this to detect and diagnose team problems.
 */
export interface TriageCollector {
  /**
   * Detect problems across teams.
   * @param teams - Array of team contexts to triage
   */
  detect(teams: TeamContext[]): Promise<TriageResult>;
}

/**
 * TriageResult — Structured triage output.
 */
export interface TriageResult {
  problems: Array<{
    teamId: string;
    domain: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    diagnosticId?: string;
    suggestedRecovery?: string[];
  }>;
}

/**
 * DashboardEntry — Team representation in monitoring dashboard.
 * 
 * Used by monitor skills to render team status in a human-readable format.
 */
export interface DashboardEntry {
  domain: string;
  domainId: string;
  archetypeId: string;
  state: string;
  health: 'healthy' | 'stalled' | 'failed';
  progress: number | string;
  lastUpdate: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
