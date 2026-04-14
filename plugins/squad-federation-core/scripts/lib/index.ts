/**
 * Core library exports.
 */

export { DirectoryPlacement } from './directory-placement';
export { WorktreePlacement } from './worktree-placement';
export type { WorktreeInfo } from './worktree-placement';
export { FileSignalCommunication } from './file-signal-communication';
export { createTeamContext, createPlacement, createCommunication, registerCommunicationAdapter } from './team-context';
export type { PlacementConfig } from './team-context';
export { signals } from './signals';
export { learningLog } from './learning-log';
export { loadConfig, validateConfig } from './config';
export { discoverArchetypes, formatArchetypeChoices } from './archetype-discovery';
export type { DiscoveredArchetype } from './archetype-discovery';
export { ceremonies } from './ceremonies';
