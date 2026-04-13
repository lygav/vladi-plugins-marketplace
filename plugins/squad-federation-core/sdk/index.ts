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
 *   TeamTransport,
 *   ScanStatus,
 *   SignalMessage,
 *   ArchetypeManifest,
 *   MonitorCollector,
 *   TriageCollector,
 *   RecoveryAction,
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
