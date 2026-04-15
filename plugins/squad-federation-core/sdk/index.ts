/**
 * SDK Public API — Barrel Export
 * 
 * This module provides a single entry point for importing all SDK types,
 * interfaces, and schemas. Archetype authors can import everything they
 * need from this module without knowing the internal structure.
 * 
 * Usage in Archetype Code:
 * ```typescript
 * import {
 *   TeamContext,
 *   TeamPlacement,
 *   TeamCommunication,
 *   ScanStatus,
 *   SignalMessage,
 *   ArchetypeManifest,
 *   MonitorBase,
 *   TriageBase,
 *   RecoveryBase,
 *   ScanStatusSchema,
 *   SignalMessageSchema,
 *   ArchetypeManifestSchema
 * } from '@squad/federation-core/sdk';
 * ```
 */

// Export all TypeScript types and interfaces
export * from './types.js';

// Export all Zod schemas and inferred types
export * from './schemas.js';

// Export base classes for archetype implementation
export * from './monitor-base.js';
export { TriageBase } from './triage-base.js';
export type { TriageResult as TriageFinding, RecoveryAction as RecoveryProcedure } from './triage-base.js';
export * from './recovery-base.js';

// Export telemetry infrastructure
export * from './otel-emitter.js';

// Export progress reporting utilities
export * from './progress-reporter.js';
