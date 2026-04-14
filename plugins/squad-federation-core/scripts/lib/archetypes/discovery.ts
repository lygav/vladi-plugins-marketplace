/**
 * Archetype Discovery Library
 *
 * Dynamic archetype discovery for the federation-setup wizard. Discovers available
 * archetypes from marketplace.json.
 * 
 * Archetypes are plugins with category="archetype" that define team lifecycle states
 * and provide meta-squad and team-level skills/agents/scripts.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { OTelEmitter } from '../../../sdk/otel-emitter.js';

// ==================== Types ====================

/**
 * A discovered archetype with metadata from marketplace and archetype config.
 */
export interface DiscoveredArchetype {
  /** Archetype identifier (e.g., 'squad-archetype-deliverable') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Semantic version */
  version: string;
  /** Path to plugin directory (e.g., 'plugins/squad-archetype-deliverable') */
  source: string;
  /** Lifecycle state names from team/archetype.json */
  states: string[];
  /** Category from marketplace.json or plugin.json (should be 'archetype') */
  category: string;
}

// ==================== Core Discovery ====================

/**
 * Discover available archetypes from marketplace.json.
 * 
 * Discovery strategy:
 * 1. Read .github/plugin/marketplace.json
 * 2. If empty or missing, return empty array with warning
 * 
 * Emits OTel event 'archetype.discovered' with count on success.
 * 
 * @param repoRoot - Repository root path (defaults to current directory)
 * @param emitter - Optional OTel emitter for telemetry
 * @returns Array of discovered archetypes
 * 
 * @example
 * ```typescript
 * const archetypes = discoverArchetypes('/path/to/repo');
 * console.log(`Found ${archetypes.length} archetypes`);
 * 
 * for (const arch of archetypes) {
 *   console.log(`${arch.name} — ${arch.description}`);
 *   console.log(`  States: ${arch.states.join(' → ')}`);
 * }
 * ```
 */
export function discoverArchetypes(
  repoRoot?: string,
  emitter?: OTelEmitter
): DiscoveredArchetype[] {
  const root = repoRoot || process.cwd();
  const emit = emitter || new OTelEmitter();

  try {
    const marketplaceArchetypes = discoverFromMarketplace(root);
    if (marketplaceArchetypes.length > 0) {
      emit.event('archetype.discovered', {
        'discovery.source': 'marketplace',
        'archetype.count': marketplaceArchetypes.length,
      });
      return marketplaceArchetypes;
    }

    console.warn('[archetype-discovery] No archetypes found via marketplace.json.');
    emit.event('archetype.discovered', {
      'discovery.source': 'none',
      'archetype.count': 0,
    });
    return [];
  } catch (err) {
    console.error('[archetype-discovery] Discovery failed:', err);
    return [];
  }
}

/**
 * Read archetypes from .github/plugin/marketplace.json.
 * 
 * Filters plugins where category === 'archetype' and reads lifecycle states
 * from each archetype's team/archetype.json file.
 * 
 * @param repoRoot - Repository root path
 * @returns Array of discovered archetypes
 */
function discoverFromMarketplace(repoRoot: string): DiscoveredArchetype[] {
  try {
    const marketplacePath = path.join(repoRoot, '.github', 'plugin', 'marketplace.json');
    if (!existsSync(marketplacePath)) {
      return [];
    }

    const marketplaceData = JSON.parse(readFileSync(marketplacePath, 'utf-8'));
    const plugins = marketplaceData.plugins || [];

    const archetypes: DiscoveredArchetype[] = [];

    for (const plugin of plugins) {
      // Filter for archetype category
      if (plugin.category !== 'archetype') continue;

      // Read lifecycle states from team/archetype.json
      const states = readArchetypeStates(repoRoot, plugin.source);

      archetypes.push({
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        source: plugin.source,
        states,
        category: plugin.category,
      });
    }

    return archetypes;
  } catch {
    return [];
  }
}

/**
 * Read lifecycle states from team/archetype.json.
 * 
 * @param repoRoot - Repository root path
 * @param pluginSource - Plugin source path (e.g., 'plugins/squad-archetype-deliverable')
 * @returns Array of lifecycle state names
 */
function readArchetypeStates(repoRoot: string, pluginSource: string): string[] {
  try {
    const archetypePath = path.join(repoRoot, pluginSource, 'team', 'archetype.json');
    if (!existsSync(archetypePath)) {
      return [];
    }

    const archetypeData = JSON.parse(readFileSync(archetypePath, 'utf-8'));
    const lifecycleStates = archetypeData.states?.lifecycle || [];

    return lifecycleStates;
  } catch {
    return [];
  }
}

// ==================== Formatting ====================

/**
 * Format archetypes for display in the setup wizard.
 * 
 * Produces a numbered list with descriptions and state transitions.
 * 
 * @param archetypes - Array of discovered archetypes
 * @returns Formatted string ready for console output
 * 
 * @example
 * ```typescript
 * const archetypes = discoverArchetypes();
 * console.log(formatArchetypeChoices(archetypes));
 * ```
 * 
 * Output:
 * ```
 * Available archetypes:
 *   1. deliverable — Iterative teams that scan sources, distill artifacts, learn from feedback
 *      States: preparing → scanning → distilling → aggregating
 *   2. coding — Implementation teams that write code and open PRs
 *      States: preparing → implementing → testing → pr-open → pr-review → pr-approved → merged
 * ```
 */
export function formatArchetypeChoices(archetypes: DiscoveredArchetype[]): string {
  if (archetypes.length === 0) {
    return 'No archetypes found. Install an archetype plugin from the marketplace.';
  }

  const lines = ['Available archetypes:'];

  archetypes.forEach((arch, index) => {
    // Clean archetype name (remove 'squad-archetype-' prefix)
    const shortName = arch.name.replace(/^squad-archetype-/, '');

    // Format description
    lines.push(`  ${index + 1}. ${shortName} — ${arch.description}`);

    // Format states as arrow-separated list
    if (arch.states.length > 0) {
      const stateFlow = arch.states.join(' → ');
      lines.push(`     States: ${stateFlow}`);
    }
  });

  return lines.join('\n');
}
