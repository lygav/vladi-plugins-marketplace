/**
 * TriageBase — Abstract base class for diagnosing team problems.
 * 
 * Analyzes dashboard entries to detect issues and suggest recovery actions.
 * Archetypes extend this to implement archetype-specific diagnostics.
 * 
 * Hybrid pattern: Scripts detect patterns → Skills interpret and recommend actions.
 * 
 * @module sdk/triage-base
 */

import type { DashboardEntry } from './types.js';

/**
 * Triage result — A diagnosed problem with suggested recovery actions.
 */
export interface TriageResult {
  /** Team identifier */
  teamId: string;
  /** Team domain name */
  domain: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'critical';
  /** Problem category (e.g., 'stalled', 'error', 'configuration') */
  category: string;
  /** Human-readable issue description */
  issue: string;
  /** Detailed explanation and context */
  details: string;
  /** Suggested recovery action IDs or descriptions */
  suggestedActions: string[];
  /** Archetype-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Recovery action — A structured procedure for fixing a problem.
 */
export interface RecoveryAction {
  /** Unique action identifier */
  id: string;
  /** Human-readable action name */
  name: string;
  /** Detailed description of what the action does */
  description: string;
  /** Whether this action can be automated */
  automated: boolean;
  /** Manual steps (if not automated) */
  manualSteps?: string[];
  /** Script path (if automated) */
  scriptPath?: string;
}

/**
 * TriageBase — Abstract base class for triage scripts.
 * 
 * Provides shared utilities for problem detection and recovery suggestion.
 * Archetypes implement abstract methods to add custom diagnostic logic.
 * 
 * @example
 * ```typescript
 * class DeliverableTriage extends TriageBase {
 *   async diagnose(entries: DashboardEntry[]): Promise<TriageResult[]> {
 *     const results: TriageResult[] = [];
 *     
 *     for (const entry of entries) {
 *       if (entry.health === 'stalled') {
 *         results.push({
 *           teamId: entry.domainId,
 *           domain: entry.domain,
 *           severity: 'warning',
 *           category: 'stalled',
 *           issue: 'Team has not updated in 10+ minutes',
 *           details: `Last update: ${entry.lastUpdate}`,
 *           suggestedActions: ['check-logs', 'send-directive']
 *         });
 *       }
 *     }
 *     
 *     return results;
 *   }
 *   
 *   async suggestRecovery(result: TriageResult): Promise<RecoveryAction[]> {
 *     return [
 *       { id: 'check-logs', name: 'Check run logs', automated: false, manualSteps: ['...'] },
 *       { id: 'send-directive', name: 'Send pause directive', automated: true, scriptPath: '...' }
 *     ];
 *   }
 * }
 * ```
 */
export abstract class TriageBase {
  /**
   * Diagnose issues from dashboard entries.
   * 
   * Analyzes team status, health, and metadata to detect problems.
   * Returns structured triage results with severity and suggested actions.
   * 
   * @param entries - Dashboard entries to analyze
   * @returns Array of diagnosed problems
   */
  abstract diagnose(entries: DashboardEntry[]): Promise<TriageResult[]>;

  /**
   * Suggest recovery actions for a diagnosed issue.
   * 
   * Based on the problem category and severity, return applicable
   * recovery actions (both automated and manual).
   * 
   * @param diagnosis - Triage result from diagnose()
   * @returns Array of recovery actions
   */
  abstract suggestRecovery(diagnosis: TriageResult): Promise<RecoveryAction[]>;

  /**
   * Format triage report for display.
   * 
   * Renders triage results as a human-readable report with severity
   * indicators, grouped by category, and suggested actions.
   * 
   * @param results - Triage results to format
   * @returns Formatted report string
   */
  formatReport(results: TriageResult[]): string {
    if (results.length === 0) {
      return '✅ No issues detected.\n';
    }

    const lines: string[] = [];
    lines.push('🔍 TRIAGE REPORT');
    lines.push('━'.repeat(80));
    lines.push('');

    // Group by severity
    const critical = results.filter(r => r.severity === 'critical');
    const warnings = results.filter(r => r.severity === 'warning');
    const info = results.filter(r => r.severity === 'info');

    if (critical.length > 0) {
      lines.push('🔴 CRITICAL ISSUES');
      lines.push('');
      for (const result of critical) {
        lines.push(...this.formatTriageResult(result));
        lines.push('');
      }
    }

    if (warnings.length > 0) {
      lines.push('⚠️  WARNINGS');
      lines.push('');
      for (const result of warnings) {
        lines.push(...this.formatTriageResult(result));
        lines.push('');
      }
    }

    if (info.length > 0) {
      lines.push('ℹ️  INFORMATION');
      lines.push('');
      for (const result of info) {
        lines.push(...this.formatTriageResult(result));
        lines.push('');
      }
    }

    lines.push('━'.repeat(80));
    lines.push(`Total issues: ${results.length} (Critical: ${critical.length}, Warnings: ${warnings.length}, Info: ${info.length})`);
    lines.push('');

    return lines.join('\n');
  }

  // ==================== Protected Helpers ====================

  /**
   * Format a single triage result.
   * 
   * @param result - Triage result to format
   * @returns Array of formatted lines
   */
  protected formatTriageResult(result: TriageResult): string[] {
    const lines: string[] = [];
    
    lines.push(`Team: ${result.domain} (${result.teamId})`);
    lines.push(`Category: ${result.category}`);
    lines.push(`Issue: ${result.issue}`);
    
    if (result.details) {
      lines.push(`Details: ${result.details}`);
    }
    
    if (result.suggestedActions.length > 0) {
      lines.push('Suggested Actions:');
      for (const action of result.suggestedActions) {
        lines.push(`  • ${action}`);
      }
    }
    
    return lines;
  }

  /**
   * Classify severity based on problem characteristics.
   * 
   * Common classification logic:
   * - Errors or failures → critical
   * - Stalls in critical states → warning
   * - Stalls in non-critical states → info
   * 
   * @param entry - Dashboard entry to classify
   * @returns Severity level
   */
  protected classifySeverity(entry: DashboardEntry): 'info' | 'warning' | 'critical' {
    if (entry.health === 'failed' || entry.error) {
      return 'critical';
    }
    
    if (entry.health === 'stalled') {
      // Critical states get warning severity
      const criticalStates = ['scanning', 'distilling', 'validating'];
      if (criticalStates.includes(entry.state)) {
        return 'warning';
      }
      return 'info';
    }
    
    return 'info';
  }
}
