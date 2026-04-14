/**
 * MonitorBase — Abstract base class for archetype monitors.
 * 
 * Handles the mechanical parts of monitoring:
 * - Team discovery via registry
 * - Status collection from transports
 * - Stall detection
 * - Dashboard formatting
 * 
 * Archetypes extend this to:
 * - Collect archetype-specific data
 * - Format custom dashboard columns
 * 
 * Hybrid pattern: Scripts (this class) collect data → Skills interpret it.
 * 
 * @module sdk/monitor-base
 */

import type {
  TeamPlacement,
  TeamCommunication,
  ScanStatus,
  DashboardEntry,
  TeamEntry
} from './types.js';
import { OTelEmitter } from './otel-emitter.js';

/**
 * MonitorBase — Abstract base class for monitoring scripts.
 * 
 * Provides shared utilities for collecting team status and formatting dashboards.
 * Archetypes implement abstract methods to add custom monitoring logic.
 * 
 * @example
 * ```typescript
 * class DeliverableMonitor extends MonitorBase<DeliverableData> {
 *   get archetypeName(): string { return 'deliverable'; }
 *   
 *   async collectArchetypeData(placement, communication, status) {
 *     const fragments = await placement.listFiles(status.domain_id, '.squad/deliverable/fragments');
 *     return { fragmentCount: fragments.length };
 *   }
 *   
 *   formatArchetypeColumns(entry) {
 *     return `Fragments: ${entry.metadata.fragmentCount || 0}`;
 *   }
 * }
 * ```
 */
export abstract class MonitorBase<TArchetypeData = unknown> {
  protected readonly emitter: OTelEmitter;

  /**
   * Create a monitor for a specific archetype.
   * @param placementMap - Map of domainId to TeamPlacement instances
   * @param communicationMap - Map of domainId to TeamCommunication instances
   * @param emitter - Optional OTel emitter for instrumentation
   */
  constructor(
    protected readonly placementMap: Map<string, TeamPlacement>,
    protected readonly communicationMap: Map<string, TeamCommunication>,
    emitter?: OTelEmitter
  ) {
    this.emitter = emitter || new OTelEmitter();
  }

  /**
   * Collect status from all teams of this archetype type.
   * 
   * For each team:
   * 1. Read status.json via transport
   * 2. Call collectArchetypeData() for custom data
   * 3. Detect stalls
   * 4. Build DashboardEntry with enriched metadata
   * 
   * @param teams - Array of team entries from registry
   * @returns Array of dashboard entries with archetype-specific data
   */
  async collectAll(teams: TeamEntry[]): Promise<DashboardEntry[]> {
    let collectedEntries: DashboardEntry[] = [];

    await this.emitter.span(
      'monitor.collectAll',
      async () => {
        const entries: DashboardEntry[] = [];
        let stallCount = 0;

        for (const team of teams) {
          // Instrument per-team collection
          await this.emitter.span(
            'monitor.collectTeam',
            async () => {
              try {
                const placement = this.placementMap.get(team.domainId);
                const communication = this.communicationMap.get(team.domainId);
                if (!placement || !communication) {
                  console.warn(`No placement or communication found for team: ${team.domainId}`);
                  return;
                }

                const status = await communication.readStatus(team.domainId);
                if (!status) {
                  console.warn(`No status found for team: ${team.domainId}`);
                  return;
                }

                // Collect archetype-specific data
                const archetypeData = await this.collectArchetypeData(placement, communication, status);

                // Detect health status
                const health = this.detectHealth(status);
                if (health === 'stalled') {
                  stallCount++;
                }

                // Calculate progress
                const progress = status.progress_pct !== undefined
                  ? status.progress_pct
                  : status.step;

                entries.push({
                  domain: team.domain,
                  domainId: team.domainId,
                  archetypeId: team.archetypeId,
                  state: status.state,
                  health,
                  progress,
                  lastUpdate: status.updated_at,
                  error: status.error,
                  metadata: archetypeData as Record<string, unknown>
                });
              } catch (error) {
                console.error(`Error collecting status for ${team.domain}:`, error);
                // Continue processing other teams — one team failing doesn't crash the dashboard
              }
            },
            {
              'squad.domain': team.domain,
              'archetype.id': team.archetypeId
            }
          );
        }

        // Emit metrics for collection
        await this.emitter.metric('teams.scanned', teams.length, {
          'archetype.name': this.archetypeName
        });
        await this.emitter.metric('teams.stalled', stallCount, {
          'archetype.name': this.archetypeName
        });

        collectedEntries = entries;
      },
      {
        'archetype.name': this.archetypeName,
        'teams.count': teams.length
      }
    );

    return collectedEntries;
  }

  /**
   * Format dashboard output for display.
   * 
   * Renders a text table with emoji states, progress, and archetype-specific columns.
   * 
   * @param entries - Dashboard entries to render
   * @returns Formatted dashboard string
   */
  formatDashboard(entries: DashboardEntry[]): string {
    if (entries.length === 0) {
      return `No ${this.archetypeName} teams found.\n`;
    }

    const lines: string[] = [];
    lines.push(`📊 ${this.archetypeName.toUpperCase()} TEAMS`);
    lines.push('━'.repeat(80));
    lines.push('');

    // Sort by state priority (failed first, complete last)
    const stateOrder: Record<string, number> = {
      'failed': 0,
      'stalled': 1,
      'paused': 2,
      'scanning': 3,
      'distilling': 4,
      'initializing': 5,
      'complete': 6
    };

    const sorted = [...entries].sort((a, b) => {
      const aOrder = stateOrder[a.state] ?? 99;
      const bOrder = stateOrder[b.state] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.domain.localeCompare(b.domain);
    });

    for (const entry of sorted) {
      const emoji = this.getStateEmoji(entry.state, entry.health);
      const progress = typeof entry.progress === 'number'
        ? `${entry.progress}%`
        : String(entry.progress);

      lines.push(`${emoji} ${entry.domain.padEnd(30)} ${entry.state.padEnd(15)} ${progress}`);

      if (entry.error) {
        lines.push(`   ⚠️  Error: ${entry.error}`);
      }

      const minutesSince = this.getMinutesSince(entry.lastUpdate);
      const timeStr = minutesSince === 0 ? 'just now' : `${minutesSince}m ago`;
      lines.push(`   Last update: ${timeStr}`);

      // Add archetype-specific columns
      const customColumns = this.formatArchetypeColumns(entry);
      if (customColumns) {
        lines.push(`   ${customColumns}`);
      }

      lines.push('');
    }

    lines.push('━'.repeat(80));
    lines.push(`Total: ${entries.length} | Complete: ${entries.filter(e => e.state === 'complete').length} | Failed: ${entries.filter(e => e.health === 'failed').length} | Stalled: ${entries.filter(e => e.health === 'stalled').length}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Detect teams that may be stuck.
   * 
   * A team is stalled if:
   * - Last update exceeds threshold
   * - Not in a terminal state (complete/failed)
   * 
   * @param entries - Dashboard entries to check
   * @param thresholdMinutes - Stall threshold in minutes (default: 10)
   * @returns Filtered array of stalled teams
   */
  detectStalls(entries: DashboardEntry[], thresholdMinutes: number = 10): DashboardEntry[] {
    return entries.filter(entry => {
      if (entry.state === 'complete' || entry.state === 'failed') {
        return false;
      }

      const minutesSince = this.getMinutesSince(entry.lastUpdate);
      return minutesSince > thresholdMinutes;
    });
  }

  // ==================== Abstract Methods ====================

  /**
   * Collect archetype-specific data from a team's workspace.
   * 
   * Called once per team during collectAll(). Use placement for reading files
   * and communication for reading signals/status.
   * 
   * @param placement - Placement instance for file operations
   * @param communication - Communication instance for signal operations
   * @param status - Parsed status.json from the team
   * @returns Archetype-specific data to include in dashboard metadata
   */
  abstract collectArchetypeData(
    placement: TeamPlacement,
    communication: TeamCommunication,
    status: ScanStatus
  ): Promise<TArchetypeData>;

  /**
   * Format archetype-specific columns for dashboard display.
   * 
   * Called once per team during formatDashboard(). Return a string to display
   * below the standard status line, or empty string to skip.
   * 
   * @param entry - Dashboard entry with archetype data in metadata
   * @returns Formatted string for display (without leading spaces or newlines)
   */
  abstract formatArchetypeColumns(entry: DashboardEntry): string;

  /**
   * Get the archetype name this monitor handles.
   * 
   * Used for dashboard headers and filtering teams by archetype.
   * 
   * @returns Archetype identifier (e.g., 'deliverable', 'coding')
   */
  abstract get archetypeName(): string;

  // ==================== Protected Helpers ====================

  /**
   * Detect health status from scan status.
   * 
   * @param status - Scan status to analyze
   * @returns Health classification
   */
  protected detectHealth(status: ScanStatus): 'healthy' | 'stalled' | 'failed' {
    if (status.error) {
      return 'failed';
    }

    const minutesSince = this.getMinutesSince(status.updated_at);
    const isStalled = minutesSince > 10 && !status.completed_at;

    return isStalled ? 'stalled' : 'healthy';
  }

  /**
   * Get emoji for state and health combination.
   * 
   * @param state - Team state
   * @param health - Health status
   * @returns Emoji string
   */
  protected getStateEmoji(state: string, health: string): string {
    if (health === 'failed') return '🔴';
    if (health === 'stalled') return '⚠️ ';
    
    switch (state) {
      case 'complete': return '🟢';
      case 'scanning': return '🟡';
      case 'distilling': return '🔵';
      case 'paused': return '⏸️ ';
      case 'initializing': return '🟠';
      default: return '⚪';
    }
  }

  /**
   * Calculate minutes since a timestamp.
   * 
   * @param isoTimestamp - ISO 8601 timestamp
   * @returns Minutes elapsed
   */
  protected getMinutesSince(isoTimestamp: string): number {
    const then = new Date(isoTimestamp);
    const now = new Date();
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60));
  }
}
