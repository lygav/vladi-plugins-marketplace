/**
 * TeamContext Factory — Composes TeamPlacement + TeamCommunication
 * 
 * Placement is per-team (worktree or directory).
 * Communication is federation-scoped (read from federate.config.json).
 * 
 * @since v0.4.0
 */

import type { TeamPlacement, TeamCommunication, TeamContext, TeamEntry } from '../../sdk/types.js';
import type { FederateConfig } from './config.js';
import { WorktreePlacement } from './worktree-placement.js';
import { DirectoryPlacement } from './directory-placement.js';
import { FileSignalCommunication } from './file-signal-communication.js';
import { OTelEmitter } from '../../sdk/otel-emitter.js';

/**
 * PlacementConfig — Configuration for TeamPlacement instantiation.
 * 
 * Structure depends on placement type:
 * - worktree: { basePath: string, branch: string, repoRoot: string }
 * - directory: { basePath: string, teamId: string }
 */
export interface PlacementConfig {
  basePath: string;
  branch?: string;
  repoRoot?: string;
  teamId?: string;
}

/**
 * CommunicationFactory — Function that creates a TeamCommunication instance.
 */
type CommunicationFactory = (
  config: Record<string, unknown>,
  emitter?: OTelEmitter
) => TeamCommunication;

/**
 * Communication adapter registry — maps type strings to factory functions.
 */
const communicationAdapters = new Map<string, CommunicationFactory>();

/**
 * Register the file-signal adapter (v0.4.0 default and only option).
 */
communicationAdapters.set('file-signal', (config, emitter) => {
  const placement = config.placement as TeamPlacement | undefined;
  if (!placement) {
    throw new Error('FileSignalCommunication requires placement in config');
  }
  return new FileSignalCommunication(placement, emitter);
});

/**
 * Future adapters:
 * communicationAdapters.set('teams-channel', (config, emitter) => 
 *   new TeamsChannelCommunication(config, emitter)
 * );
 */

/**
 * Register a custom communication adapter.
 * 
 * Allows archetypes or plugins to add new transport types (e.g., teams-channel in v0.5.0).
 * 
 * @param type - Communication type identifier (e.g., 'teams-channel')
 * @param factory - Factory function that creates TeamCommunication instance
 */
export function registerCommunicationAdapter(type: string, factory: CommunicationFactory): void {
  communicationAdapters.set(type, factory);
}

/**
 * Create a TeamPlacement instance based on type and config.
 * 
 * @param type - Placement type: 'worktree' or 'directory'
 * @param config - Placement configuration
 * @param emitter - Optional OTel emitter for instrumentation
 * @returns TeamPlacement instance
 * @throws Error if placement type is unknown
 */
export function createPlacement(
  type: string, 
  config: PlacementConfig,
  emitter?: OTelEmitter
): TeamPlacement {
  switch (type) {
    case 'worktree': {
      if (!config.branch || !config.repoRoot) {
        throw new Error('WorktreePlacement requires branch and repoRoot in config');
      }
      return new WorktreePlacement(
        config.basePath,
        config.branch,
        config.repoRoot,
        emitter,
        config.teamId
      );
    }
    case 'directory': {
      if (!config.teamId) {
        throw new Error('DirectoryPlacement requires teamId in config');
      }
      const basePathMap = new Map<string, string>();
      basePathMap.set(config.teamId, config.basePath);
      return new DirectoryPlacement(basePathMap, emitter);
    }
    default:
      throw new Error(`Unknown placement type: ${type}. Available: worktree, directory`);
  }
}

/**
 * Create a TeamCommunication instance based on type and config.
 * 
 * @param type - Communication type (e.g., 'file-signal')
 * @param config - Communication-specific configuration
 * @param emitter - Optional OTel emitter for instrumentation
 * @returns TeamCommunication instance
 * @throws Error if communication type is unknown
 */
export function createCommunication(
  type: string, 
  config: Record<string, unknown>,
  emitter?: OTelEmitter
): TeamCommunication {
  const factory = communicationAdapters.get(type);
  if (!factory) {
    const available = Array.from(communicationAdapters.keys()).join(', ');
    throw new Error(`Unknown communication type: ${type}. Available: ${available}`);
  }
  return factory(config, emitter);
}

/**
 * Infer PlacementConfig from TeamEntry.
 * 
 * Derives placement configuration from team entry metadata and location.
 * For worktree: extracts branch from location path (last segment after .worktrees/)
 * For directory: uses domain as teamId
 * 
 * @param teamEntry - Team registry entry
 * @param repoRoot - Repository root (for worktree placement)
 * @returns PlacementConfig for createPlacement
 */
function inferPlacementConfig(teamEntry: TeamEntry, repoRoot?: string): PlacementConfig {
  const placementType = teamEntry.placementType || teamEntry.transport;
  
  if (placementType === 'worktree') {
    // Extract branch name from location path
    // Location format: /path/to/repo/.worktrees/{branch} or ../worktrees/{branch}
    const branch = teamEntry.location.split('/').pop() || teamEntry.domain;
    
    if (!repoRoot) {
      throw new Error('repoRoot is required for worktree placement');
    }
    
    return {
      basePath: teamEntry.location,
      branch,
      repoRoot,
      teamId: teamEntry.domainId
    };
  } else {
    // Directory placement
    return {
      basePath: teamEntry.location,
      teamId: teamEntry.domainId
    };
  }
}

/**
 * Create a complete TeamContext by composing placement + communication.
 * 
 * Placement is per-team (from TeamEntry.placementType).
 * Communication is federation-scoped (from FederateConfig.communicationType).
 * 
 * PlacementConfig is inferred from TeamEntry.location and metadata.
 * 
 * @param teamEntry - Team registry entry
 * @param federationConfig - Federation-wide configuration
 * @param repoRoot - Repository root (required for worktree placement)
 * @param emitter - Optional OTel emitter for instrumentation
 * @returns Complete TeamContext with placement + communication adapters
 */
export function createTeamContext(
  teamEntry: TeamEntry,
  federationConfig: FederateConfig,
  repoRoot?: string,
  emitter?: OTelEmitter
): TeamContext {
  // Infer placement config from team entry
  const placementConfig = inferPlacementConfig(teamEntry, repoRoot);
  
  // Use placementType if available, fall back to deprecated transport field
  const placementType = teamEntry.placementType || teamEntry.transport;
  
  // Create placement adapter (per-team)
  const placement = createPlacement(placementType, placementConfig, emitter);
  
  // Create communication adapter (federation-scoped)
  const communicationConfig = buildCommunicationConfig(
    federationConfig.communicationType,
    placement,
    federationConfig
  );
  const communication = createCommunication(
    federationConfig.communicationType,
    communicationConfig,
    emitter
  );
  
  return {
    domain: teamEntry.domain,
    domainId: teamEntry.domainId,
    location: teamEntry.location,
    archetypeId: teamEntry.archetypeId,
    placement,
    communication
  };
}

function buildCommunicationConfig(
  type: string,
  placement: TeamPlacement,
  _federationConfig: FederateConfig
): Record<string, unknown> {
  switch (type) {
    case 'file-signal':
      return { placement };
    default:
      return {};
  }
}
