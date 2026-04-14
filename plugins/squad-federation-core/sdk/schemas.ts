/**
 * SDK Schemas — Zod Validation for Federation Types
 * 
 * This module provides runtime validation schemas using Zod for all core
 * federation types. These schemas are the single source of truth for
 * validation. TypeScript types are defined in types.ts and should be
 * kept in sync with these schemas.
 */

import { z } from 'zod';

/**
 * ScanStatus Schema — Validates team status from status.json
 */
export const ScanStatusSchema = z.object({
  domain: z.string(),
  domain_id: z.string(),
  state: z.string(),
  step: z.string(),
  started_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  progress_pct: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
  agent_active: z.string().optional(),
  archetype_id: z.string(),
});

/**
 * SignalMessage Schema — Validates IPC messages
 */
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

/**
 * LearningEntry Schema — Validates learning log entries
 */
export const LearningEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  version: z.string(),
  type: z.enum(['discovery', 'correction', 'pattern', 'technique', 'gotcha']),
  content: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  tags: z.array(z.string()).optional(),
  graduated: z.boolean().optional(),
  graduated_to: z.string().optional(),
  supersedes: z.string().optional(),
});

/**
 * StateSchema Schema — Validates archetype state machine definitions
 */
export const StateSchemaSchema = z.object({
  lifecycle: z.array(z.string()).min(1),
  terminal: z.array(z.string()).min(1),
  pauseable: z.array(z.string()).optional(),
  transitions: z.record(z.string(), z.array(z.string())).optional(),
  descriptions: z.record(z.string(), z.string()).optional(),
});

/**
 * MonitorConfig Schema — Validates monitor configuration
 */
export const MonitorConfigSchema = z.object({
  script: z
    .object({
      path: z.string(),
      outputFormat: z.enum(['json', 'jsonl']),
    })
    .optional(),
  skill: z.string().optional(),
  display: z.object({
    sectionTitle: z.string(),
    stateProgressFormat: z.enum(['percentage', 'step', 'custom']),
    groupByArchetype: z.boolean(),
    archetypeEmoji: z.string().optional(),
  }),
});

/**
 * TriageDiagnostic Schema — Validates diagnostic patterns
 */
export const TriageDiagnosticSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  indicators: z.array(z.string()),
  suggestedRecovery: z.array(z.string()).optional(),
});

/**
 * TriageConfig Schema — Validates triage configuration
 */
export const TriageConfigSchema = z.object({
  script: z
    .object({
      path: z.string(),
      outputFormat: z.literal('json'),
    })
    .optional(),
  skill: z.string().optional(),
  diagnostics: z.array(TriageDiagnosticSchema),
});

/**
 * RecoveryAction Schema — Validates recovery action definitions
 */
export const RecoveryActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  automated: z.boolean(),
  script: z.string().optional(),
  manualSteps: z.array(z.string()).optional(),
});

/**
 * RecoveryConfig Schema — Validates recovery configuration
 */
export const RecoveryConfigSchema = z.object({
  script: z
    .object({
      path: z.string(),
    })
    .optional(),
  skill: z.string().optional(),
  actions: z.array(RecoveryActionSchema),
});

/**
 * ArchetypeManifest Schema — Validates archetype manifest files
 */
export const ArchetypeManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),
  coreCompatibility: z.string().optional(),
  states: StateSchemaSchema,
  monitor: MonitorConfigSchema,
  triage: TriageConfigSchema.optional(),
  recovery: RecoveryConfigSchema.optional(),
  deliverableSchema: z
    .object({
      path: z.string(),
      version: z.string(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * TeamPlacementType Schema — Validates placement type for team workspaces.
 * @since v0.4.0
 */
export const TeamPlacementTypeSchema = z.enum(['worktree', 'directory']);

/**
 * TeamCommunicationType Schema — Validates communication type for team signaling.
 * @since v0.4.0
 */
export const TeamCommunicationTypeSchema = z.enum(['file-signal', 'teams-channel']);

/**
 * TeamEntry Schema — Validates team registry entries
 */
export const TeamEntrySchema = z.object({
  domain: z.string(),
  domainId: z.string(),
  archetypeId: z.string(),
  transport: z.enum(['worktree', 'directory', 'remote']),
  placementType: TeamPlacementTypeSchema.optional(),
  location: z.string(),
  createdAt: z.string(),
  federation: z
    .object({
      parent: z.string(),
      parentLocation: z.string(),
      role: z.enum(['team', 'meta']),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * FederateConfig Schema — Validates federate.config.json
 */
export const FederateConfigSchema = z.object({
  description: z.string().optional(),
  branchPrefix: z.string().default('squad/'),
  worktreeDir: z.union([z.literal('parallel'), z.literal('inside'), z.string()]).default('parallel'),
  telemetry: z
    .object({
      enabled: z.boolean(),
      aspire: z.boolean().optional(),
    })
    .default({ enabled: true }),
  communicationType: z.enum(['file-signal', 'teams-channel']).default('file-signal'),
  teamsConfig: z.object({
    teamId: z.string().describe('Teams workspace ID (GUID)'),
    channelId: z.string().describe('Teams channel ID')
  }).optional(),
  playbookSkill: z.string().optional().default('domain-playbook'),
  deliverable: z.string().optional(),
  deliverableSchema: z.string().optional(),
  importHook: z.string().optional(),
}).refine(
  (config) => config.communicationType !== 'teams-channel' || config.teamsConfig !== undefined,
  {
    message: 'teamsConfig is required when communicationType is teams-channel',
    path: ['teamsConfig'],
  }
);

/**
 * MonitorResult Schema — Validates monitoring script output
 */
export const MonitorResultSchema = z.object({
  teams: z.array(
    z.object({
      domain: z.string(),
      domainId: z.string(),
      status: ScanStatusSchema.and(z.record(z.string(), z.unknown())),
      health: z.enum(['healthy', 'stalled', 'failed']),
      progressPct: z.number().min(0).max(100),
    })
  ),
  summary: z.object({
    total: z.number(),
    active: z.number(),
    complete: z.number(),
    failed: z.number(),
    stalled: z.number(),
  }),
});

/**
 * TriageResult Schema — Validates triage script output
 */
export const TriageResultSchema = z.object({
  problems: z.array(
    z.object({
      teamId: z.string(),
      domain: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      category: z.string(),
      description: z.string(),
      diagnosticId: z.string().optional(),
      suggestedRecovery: z.array(z.string()).optional(),
    })
  ),
});

/**
 * DashboardEntry Schema — Validates dashboard entries
 */
export const DashboardEntrySchema = z.object({
  domain: z.string(),
  domainId: z.string(),
  archetypeId: z.string(),
  state: z.string(),
  health: z.enum(['healthy', 'stalled', 'failed']),
  progress: z.union([z.number(), z.string()]),
  lastUpdate: z.string(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
